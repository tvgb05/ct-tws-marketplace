import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { CreateAdminAccountDto } from "./dto/create-admin-account.dto";
import { ResolveUserReportDto } from "./dto/resolve-user-report.dto";
import { SetPostingPermissionDto } from "./dto/set-posting-permission.dto";

@ApiTags("admin")
@ApiCookieAuth("tws_session")
@UseGuards(JwtAuthGuard)
@Controller("admin")
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}
  @Get("overview")
  async overview(@CurrentUser() user: User) {
    if (user.role !== "ADMIN") throw new ForbiddenException();
    const [
      listings,
      users,
      listingOpenReports,
      userOpenReports,
      activeMediations,
      recentReports,
      recentUserReports,
      restrictedUsers,
    ] = await this.prisma.$transaction([
      this.prisma.listing.count({ where: { deletedAt: null } }),
      this.prisma.user.count(),
      this.prisma.report.count({
        where: { status: { in: ["OPEN", "REVIEWING"] } },
      }),
      this.prisma.userReport.count({
        where: { status: { in: ["OPEN", "REVIEWING"] } },
      }),
      this.prisma.mediationRequest.count({
        where: {
          status: {
            in: [
              "REQUESTED",
              "SELLER_ACCEPTED",
              "ADMIN_ASSIGNED",
              "IN_PROGRESS",
            ],
          },
        },
      }),
      this.prisma.report.findMany({
        where: { status: { in: ["OPEN", "REVIEWING"] } },
        include: {
          listing: { select: { id: true, slug: true, title: true } },
          reporter: { select: { id: true, displayName: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      this.prisma.userReport.findMany({
        where: { status: { in: ["OPEN", "REVIEWING"] } },
        select: {
          id: true,
          reason: true,
          description: true,
          status: true,
          createdAt: true,
          reporter: {
            select: { id: true, displayName: true, role: true },
          },
          reportedUser: {
            select: {
              id: true,
              displayName: true,
              role: true,
              canPostListings: true,
              postingRestrictionReason: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.user.findMany({
        where: { role: "USER", canPostListings: false },
        select: {
          id: true,
          displayName: true,
          email: true,
          postingRestrictionReason: true,
          postingRestrictedAt: true,
        },
        orderBy: { postingRestrictedAt: "desc" },
        take: 50,
      }),
    ]);
    return {
      listings,
      users,
      openReports: listingOpenReports + userOpenReports,
      activeMediations,
      recentReports,
      recentUserReports,
      restrictedUsers,
    };
  }

  @Patch("user-reports/:reportId/resolve")
  async resolveUserReport(
    @Param("reportId") reportId: string,
    @Body() input: ResolveUserReportDto,
    @CurrentUser() admin: User,
  ) {
    if (admin.role !== "ADMIN") throw new ForbiddenException();
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.userReport.findUnique({
        where: { id: reportId },
        include: { reportedUser: true },
      });
      if (!report) throw new NotFoundException("Không tìm thấy phiếu tố cáo");
      if (!new Set(["OPEN", "REVIEWING"]).has(report.status))
        throw new BadRequestException("Phiếu tố cáo đã được xử lý");

      const resolution =
        input.resolution?.trim() ||
        (input.decision === "RESTRICT_POSTING"
          ? "Admin xác nhận tài khoản đã vi phạm quy tắc cộng đồng."
          : "Admin không tìm thấy vi phạm đủ cơ sở để áp dụng hạn chế.");

      if (input.decision === "DISMISS") {
        const dismissed = await tx.userReport.update({
          where: { id: report.id },
          data: {
            status: "DISMISSED",
            handledById: admin.id,
            resolution,
            resolvedAt: new Date(),
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: admin.id,
            action: "USER_REPORT_DISMISSED",
            entityType: "UserReport",
            entityId: report.id,
            newData: { resolution },
          },
        });
        return dismissed;
      }

      if (report.reportedUser.role === "ADMIN")
        throw new BadRequestException(
          "Không thể khóa quyền đăng bài của tài khoản admin",
        );
      const now = new Date();
      const [, resolved] = await Promise.all([
        tx.user.update({
          where: { id: report.reportedUserId },
          data: {
            canPostListings: false,
            postingRestrictionReason: resolution,
            postingRestrictedAt: now,
          },
        }),
        tx.userReport.update({
          where: { id: report.id },
          data: {
            status: "RESOLVED",
            handledById: admin.id,
            resolution,
            resolvedAt: now,
          },
        }),
        tx.notification.create({
          data: {
            userId: report.reportedUserId,
            type: "SYSTEM",
            title: "Admin đã tạm khóa quyền đăng bài của bạn",
            message: `${resolution} Bạn vẫn có thể đăng nhập, xem thông tin và liên hệ admin nếu cần khiếu nại.`,
            targetUrl: "/community-guidelines",
          },
        }),
        tx.auditLog.create({
          data: {
            actorId: admin.id,
            action: "USER_POSTING_RESTRICTED",
            entityType: "User",
            entityId: report.reportedUserId,
            oldData: { canPostListings: report.reportedUser.canPostListings },
            newData: { canPostListings: false, reason: resolution, reportId },
          },
        }),
      ]);
      return resolved;
    });
  }

  @Patch("users/:userId/posting-permission")
  async setPostingPermission(
    @Param("userId") userId: string,
    @Body() input: SetPostingPermissionDto,
    @CurrentUser() admin: User,
  ) {
    if (admin.role !== "ADMIN") throw new ForbiddenException();
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.user.findUnique({ where: { id: userId } });
      if (!member || member.role !== "USER")
        throw new NotFoundException("Không tìm thấy tài khoản thành viên");
      if (!input.allowed && !input.reason?.trim())
        throw new BadRequestException("Cần nhập lý do khóa quyền đăng bài");

      const reason = input.allowed ? null : input.reason!.trim();
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          canPostListings: input.allowed,
          postingRestrictionReason: reason,
          postingRestrictedAt: input.allowed ? null : new Date(),
        },
      });
      if (member.canPostListings !== input.allowed) {
        await tx.notification.create({
          data: {
            userId,
            type: "SYSTEM",
            title: input.allowed
              ? "Admin đã khôi phục quyền đăng bài của bạn"
              : "Admin đã tạm khóa quyền đăng bài của bạn",
            message: input.allowed
              ? "Bạn có thể đăng sản phẩm mới trở lại. Vui lòng tiếp tục tuân thủ quy tắc cộng đồng."
              : `${reason} Bạn vẫn có thể đăng nhập và liên hệ admin nếu cần khiếu nại.`,
            targetUrl: input.allowed
              ? "/account/listings/new"
              : "/community-guidelines",
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: input.allowed
            ? "USER_POSTING_RESTORED"
            : "USER_POSTING_RESTRICTED",
          entityType: "User",
          entityId: userId,
          oldData: { canPostListings: member.canPostListings },
          newData: { canPostListings: input.allowed, reason },
        },
      });
      return {
        id: updated.id,
        canPostListings: updated.canPostListings,
        postingRestrictionReason: updated.postingRestrictionReason,
      };
    });
  }

  @Get("accounts")
  accounts(@CurrentUser() user: User) {
    if (user.role !== "ADMIN") throw new ForbiddenException();
    return this.prisma.adminCredential.findMany({
      where: { user: { role: "ADMIN" } },
      select: {
        id: true,
        email: true,
        createdAt: true,
        createdById: true,
        user: {
          select: {
            id: true,
            displayName: true,
            role: true,
            status: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  @Post("accounts")
  createAccount(
    @Body() input: CreateAdminAccountDto,
    @CurrentUser() user: User,
  ) {
    if (user.role !== "ADMIN") throw new ForbiddenException();
    return this.auth.createAdminAccount(input, user.id);
  }

  @Delete("accounts/:credentialId")
  revokeAccount(
    @Param("credentialId") credentialId: string,
    @CurrentUser() user: User,
  ) {
    if (user.role !== "ADMIN") throw new ForbiddenException();
    return this.auth.revokeAdminAccount(credentialId, user.id);
  }
}
