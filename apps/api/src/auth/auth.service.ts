import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthProvider } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { CreateAdminAccountDto } from "../admin/dto/create-admin-account.dto";
import { PrismaService } from "../prisma/prisma.service";
import { AdminLoginDto } from "./dto/admin-login.dto";
import { ChangeAdminPasswordDto } from "./dto/change-admin-password.dto";
import { CompleteProfileDto } from "./dto/complete-profile.dto";

export interface FacebookProfile {
  providerUserId: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  profileUrl?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async loginWithFacebook(
    profile: FacebookProfile,
    rememberForThirtyDays = false,
  ) {
    const facebookProfileUrl = this.normalizeFacebookProfileUrl(
      profile.profileUrl,
    );
    const identity = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.FACEBOOK,
          providerUserId: profile.providerUserId,
        },
      },
      include: { user: true },
    });

    if (identity?.user.role === "ADMIN")
      throw new UnauthorizedException(
        "Tài khoản quản trị chỉ được đăng nhập bằng cổng quản trị",
      );

    const user = identity
      ? await this.prisma.user.update({
          where: { id: identity.userId },
          data: {
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            email: profile.email,
            ...(facebookProfileUrl ? { facebookProfileUrl } : {}),
            lastLoginAt: new Date(),
          },
        })
      : await this.prisma.user.create({
          data: {
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            email: profile.email,
            facebookProfileUrl,
            lastLoginAt: new Date(),
            authIdentities: {
              create: {
                provider: AuthProvider.FACEBOOK,
                providerUserId: profile.providerUserId,
              },
            },
          },
        });

    if (user.status !== "ACTIVE")
      throw new UnauthorizedException("Tài khoản đã bị hạn chế");
    return {
      user,
      token: await this.jwt.signAsync(
        { sub: user.id, role: user.role },
        { expiresIn: rememberForThirtyDays ? "30d" : "15m" },
      ),
    };
  }

  async loginWithAdmin(input: AdminLoginDto) {
    const credential = await this.prisma.adminCredential.findUnique({
      where: { email: input.email },
      include: { user: true },
    });
    const validPassword = credential
      ? await compare(input.password, credential.passwordHash)
      : false;
    if (!credential || !validPassword || credential.user.status !== "ACTIVE")
      throw new UnauthorizedException("Email hoặc mật khẩu không chính xác");

    const user = await this.prisma.user.update({
      where: { id: credential.userId },
      data: { lastLoginAt: new Date() },
    });
    return {
      user,
      token: await this.jwt.signAsync(
        {
          sub: user.id,
          role: user.role,
          ...(user.role === "ADMIN"
            ? { adminCredentialVersion: credential.updatedAt.getTime() }
            : {}),
        },
        { expiresIn: input.remember ? "30d" : "15m" },
      ),
    };
  }

  async createAdminAccount(input: CreateAdminAccountDto, createdById?: string) {
    const existing = await this.prisma.adminCredential.findUnique({
      where: { email: input.email },
    });
    if (existing)
      throw new ConflictException("Email này đã được cấp tài khoản quản trị");

    const passwordHash = await hash(input.password, 12);
    return this.prisma.user.create({
      data: {
        displayName: input.displayName.trim(),
        email: input.email,
        role: "ADMIN",
        adminCredential: {
          create: { email: input.email, passwordHash, createdById },
        },
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async changeAdminPassword(userId: string, input: ChangeAdminPasswordDto) {
    const credential = await this.prisma.adminCredential.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!credential || credential.user.role !== "ADMIN")
      throw new ForbiddenException(
        "Chỉ tài khoản quản trị có thể đổi mật khẩu",
      );

    const validCurrentPassword = await compare(
      input.currentPassword,
      credential.passwordHash,
    );
    if (!validCurrentPassword)
      throw new UnauthorizedException("Mật khẩu hiện tại không chính xác");
    if (input.currentPassword === input.newPassword)
      throw new BadRequestException("Mật khẩu mới phải khác mật khẩu hiện tại");

    const passwordHash = await hash(input.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.adminCredential.update({
        where: { id: credential.id },
        data: { passwordHash },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: "ADMIN_PASSWORD_CHANGED",
          entityType: "AdminCredential",
          entityId: credential.id,
        },
      }),
    ]);
    return { success: true };
  }

  async completeProfile(userId: string, input: CompleteProfileDto) {
    const existingUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { facebookProfileUrl: true },
    });
    const submittedFacebookProfileUrl = input.facebookProfileUrl
      ? this.normalizeFacebookProfileUrl(input.facebookProfileUrl)
      : undefined;
    const facebookProfileUrl =
      submittedFacebookProfileUrl ?? existingUser.facebookProfileUrl;
    if (!facebookProfileUrl) {
      throw new BadRequestException(
        "Vui lòng nhập đường dẫn hồ sơ Facebook hợp lệ",
      );
    }
    if (input.facebookProfileUrl && !submittedFacebookProfileUrl) {
      throw new BadRequestException(
        "Vui lòng nhập đường dẫn hồ sơ Facebook hợp lệ",
      );
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        phoneNumber: input.phoneNumber,
        facebookProfileUrl,
        profileCompletedAt: new Date(),
      },
    });
  }

  private normalizeFacebookProfileUrl(value?: string | null) {
    if (!value) return undefined;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return undefined;
    }
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (
      !new Set(["facebook.com", "m.facebook.com", "fb.com"]).has(hostname) ||
      url.pathname === "/"
    ) {
      return undefined;
    }
    url.protocol = "https:";
    url.hash = "";
    return url.toString();
  }
}
