import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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
import { CONTACT_PRIVACY_POLICY_VERSION } from "./contact-privacy";
import type { AuthIntent } from "./auth-intent";

export interface FacebookProfile {
  providerUserId: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  profileUrl?: string;
}

export interface GoogleProfile {
  providerUserId: string;
  displayName: string;
  avatarUrl?: string;
  email: string;
}

interface LoginProfile {
  providerUserId: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
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
    return this.loginWithIdentity(
      AuthProvider.FACEBOOK,
      profile,
      rememberForThirtyDays,
      facebookProfileUrl,
    );
  }

  async loginWithGoogle(
    profile: GoogleProfile,
    rememberForThirtyDays = false,
    intent: AuthIntent = "login",
  ) {
    const adminCredential = await this.prisma.adminCredential.findFirst({
      where: {
        email: { equals: profile.email, mode: "insensitive" },
        user: { role: "ADMIN" },
      },
      include: { user: true },
    });
    if (adminCredential) {
      if (adminCredential.user.status !== "ACTIVE")
        throw new UnauthorizedException("Tài khoản đã bị hạn chế");

      const user = await this.prisma.$transaction(async (tx) => {
        await tx.authIdentity.upsert({
          where: {
            provider_providerUserId: {
              provider: AuthProvider.GOOGLE,
              providerUserId: profile.providerUserId,
            },
          },
          create: {
            userId: adminCredential.userId,
            provider: AuthProvider.GOOGLE,
            providerUserId: profile.providerUserId,
          },
          update: { userId: adminCredential.userId },
        });
        return tx.user.update({
          where: { id: adminCredential.userId },
          data: {
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            email: profile.email,
            lastLoginAt: new Date(),
          },
        });
      });
      return {
        user,
        token: await this.signSession(user, rememberForThirtyDays, {
          adminCredentialVersion: adminCredential.updatedAt.getTime(),
        }),
      };
    }

    return this.loginWithIdentity(
      AuthProvider.GOOGLE,
      profile,
      rememberForThirtyDays,
      undefined,
      undefined,
      intent,
    );
  }

  async registerWithEmail(
    email: string,
    displayName: string,
    password: string,
    rememberForThirtyDays = false,
  ) {
    const passwordHash = await hash(password, 12);
    return this.loginWithIdentity(
      AuthProvider.EMAIL,
      {
        providerUserId: email,
        displayName: displayName.trim(),
        email,
      },
      rememberForThirtyDays,
      undefined,
      undefined,
      "register",
      passwordHash,
    );
  }

  async loginWithEmailPassword(
    email: string,
    password: string,
    rememberForThirtyDays = false,
  ) {
    const adminCredential = await this.prisma.adminCredential.findUnique({
      where: { email },
    });
    if (adminCredential) {
      return this.loginWithAdmin({
        email,
        password,
        remember: rememberForThirtyDays,
      });
    }

    const identity = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.EMAIL,
          providerUserId: email,
        },
      },
      include: { user: true },
    });
    const validPassword =
      identity?.passwordHash &&
      (await compare(password, identity.passwordHash));
    if (
      !identity ||
      !validPassword ||
      identity.user.role !== "USER" ||
      identity.user.status !== "ACTIVE"
    ) {
      throw new UnauthorizedException("Email hoặc mật khẩu không chính xác");
    }

    const user = await this.prisma.user.update({
      where: { id: identity.userId },
      data: { lastLoginAt: new Date() },
    });
    return {
      user,
      token: await this.signSession(user, rememberForThirtyDays),
    };
  }

  async resetEmailPassword(email: string, password: string) {
    const adminCredential = await this.prisma.adminCredential.findUnique({
      where: { email },
      include: { user: true },
    });
    const passwordHash = await hash(password, 12);
    if (adminCredential) {
      if (adminCredential.user.status !== "ACTIVE")
        throw new UnauthorizedException("Tài khoản đã bị hạn chế");
      await this.prisma.$transaction([
        this.prisma.adminCredential.update({
          where: { id: adminCredential.id },
          data: { passwordHash },
        }),
        this.prisma.user.update({
          where: { id: adminCredential.userId },
          data: { sessionVersion: { increment: 1 } },
        }),
        this.prisma.auditLog.create({
          data: {
            actorId: adminCredential.userId,
            action: "ADMIN_PASSWORD_RESET",
            entityType: "AdminCredential",
            entityId: adminCredential.id,
          },
        }),
      ]);
      return { success: true };
    }

    const users = await this.prisma.user.findMany({
      where: { email: { equals: email, mode: "insensitive" } },
      take: 2,
    });
    if (users.length !== 1 || users[0].role !== "USER")
      throw new NotFoundException("Không tìm thấy tài khoản phù hợp với email");
    const user = users[0];
    if (user.status !== "ACTIVE")
      throw new UnauthorizedException("Tài khoản đã bị hạn chế");

    const existingIdentity = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.EMAIL,
          providerUserId: email,
        },
      },
    });
    if (existingIdentity && existingIdentity.userId !== user.id)
      throw new ConflictException(
        "Email đang gắn với nhiều tài khoản. Vui lòng liên hệ quản trị viên.",
      );

    await this.prisma.$transaction([
      this.prisma.authIdentity.upsert({
        where: {
          provider_providerUserId: {
            provider: AuthProvider.EMAIL,
            providerUserId: email,
          },
        },
        create: {
          userId: user.id,
          provider: AuthProvider.EMAIL,
          providerUserId: email,
          passwordHash,
        },
        update: { passwordHash },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { sessionVersion: { increment: 1 } },
      }),
    ]);
    return { success: true };
  }

  private async loginWithIdentity(
    provider: AuthProvider,
    profile: LoginProfile,
    rememberForThirtyDays: boolean,
    facebookProfileUrl?: string,
    contactPrivacyAcceptedAt?: Date,
    intent?: AuthIntent,
    identityPasswordHash?: string,
  ) {
    const identity = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: profile.providerUserId,
        },
      },
      include: { user: true },
    });

    if (identity?.user.role === "ADMIN")
      throw new UnauthorizedException(
        "Tài khoản quản trị cần đăng nhập bằng Google đã xác minh",
      );

    const usersByEmail =
      !identity && profile.email
        ? await this.prisma.user.findMany({
            where: {
              email: { equals: profile.email, mode: "insensitive" },
            },
            take: 2,
          })
        : [];
    if (usersByEmail.length > 1)
      throw new ConflictException(
        "Email này đang gắn với nhiều tài khoản. Vui lòng liên hệ admin.",
      );
    const existingByEmail = usersByEmail[0] ?? null;
    if (existingByEmail?.role === "ADMIN")
      throw new UnauthorizedException(
        "Tài khoản quản trị cần đăng nhập bằng Google đã xác minh",
      );
    const existingAccount = identity?.user ?? existingByEmail;
    if (existingAccount && existingAccount.status !== "ACTIVE")
      throw new UnauthorizedException("Tài khoản đã bị hạn chế");

    if (intent === "login" && !existingAccount)
      throw new NotFoundException(
        "Email này chưa có tài khoản. Vui lòng chuyển sang Tạo tài khoản.",
      );
    if (intent === "register" && existingAccount)
      throw new ConflictException(
        "Email này đã có tài khoản. Vui lòng chuyển sang Đăng nhập.",
      );
    if (intent === "register" && !profile.displayName.trim())
      throw new BadRequestException("Vui lòng nhập tên hiển thị");

    const profileUpdates = {
      ...(provider !== AuthProvider.EMAIL
        ? {
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
          }
        : {}),
      email: profile.email,
      ...(facebookProfileUrl ? { facebookProfileUrl } : {}),
      ...(contactPrivacyAcceptedAt
        ? {
            contactPrivacyAcceptedAt,
            contactPrivacyVersion: CONTACT_PRIVACY_POLICY_VERSION,
          }
        : {}),
      lastLoginAt: new Date(),
    };
    const user = identity
      ? await this.prisma.user.update({
          where: { id: identity.userId },
          data: profileUpdates,
        })
      : existingByEmail
        ? await this.prisma.user.update({
            where: { id: existingByEmail.id },
            data: {
              ...profileUpdates,
              authIdentities: {
                create: {
                  provider,
                  providerUserId: profile.providerUserId,
                  passwordHash: identityPasswordHash,
                },
              },
            },
          })
        : await this.prisma.user.create({
            data: {
              displayName: profile.displayName,
              avatarUrl: profile.avatarUrl,
              email: profile.email,
              facebookProfileUrl,
              contactPrivacyAcceptedAt,
              contactPrivacyVersion: contactPrivacyAcceptedAt
                ? CONTACT_PRIVACY_POLICY_VERSION
                : undefined,
              lastLoginAt: new Date(),
              authIdentities: {
                create: {
                  provider,
                  providerUserId: profile.providerUserId,
                  passwordHash: identityPasswordHash,
                },
              },
            },
          });

    if (user.status !== "ACTIVE")
      throw new UnauthorizedException("Tài khoản đã bị hạn chế");
    return {
      user,
      token: await this.signSession(user, rememberForThirtyDays),
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
      token: await this.signSession(user, Boolean(input.remember), {
        adminCredentialVersion: credential.updatedAt.getTime(),
      }),
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

  async revokeAdminAccount(credentialId: string, revokedById: string) {
    const credential = await this.prisma.adminCredential.findUnique({
      where: { id: credentialId },
      include: { user: true },
    });
    if (!credential)
      throw new NotFoundException("Không tìm thấy tài khoản admin");
    if (credential.createdById === null)
      throw new ForbiddenException("Tài khoản admin seed được bảo vệ");
    if (credential.userId === revokedById)
      throw new BadRequestException(
        "Bạn không thể thu hồi tài khoản admin đang đăng nhập",
      );

    return this.prisma.$transaction(async (tx) => {
      await tx.adminCredential.delete({ where: { id: credential.id } });
      await tx.user.update({
        where: { id: credential.userId },
        data: { role: "USER", status: "SUSPENDED" },
      });
      await tx.auditLog.create({
        data: {
          actorId: revokedById,
          action: "ADMIN_ACCOUNT_REVOKED",
          entityType: "AdminCredential",
          entityId: credential.id,
          oldData: {
            userId: credential.userId,
            email: credential.email,
            role: credential.user.role,
            status: credential.user.status,
          },
          newData: { role: "USER", status: "SUSPENDED" },
        },
      });
      return { success: true, id: credential.id };
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
        contactPrivacyAcceptedAt: new Date(),
        contactPrivacyVersion: CONTACT_PRIVACY_POLICY_VERSION,
      },
    });
  }

  private signSession(
    user: {
      id: string;
      role: "USER" | "ADMIN";
      sessionVersion: number;
    },
    rememberForThirtyDays: boolean,
    extra: { adminCredentialVersion?: number } = {},
  ) {
    return this.jwt.signAsync(
      {
        sub: user.id,
        role: user.role,
        sessionVersion: user.sessionVersion,
        ...extra,
      },
      { expiresIn: rememberForThirtyDays ? "30d" : "15m" },
    );
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
