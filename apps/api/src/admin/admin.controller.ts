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
  ParseEnumPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import {
  MarketplaceAdPlacement,
  Prisma,
  ReportStatus,
  type User,
} from "@prisma/client";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { CreateAdminAccountDto } from "./dto/create-admin-account.dto";
import { ResolveUserReportDto } from "./dto/resolve-user-report.dto";
import { SetPostingPermissionDto } from "./dto/set-posting-permission.dto";
import { UpdateMarketplaceAdDto } from "./dto/update-marketplace-ad.dto";
import {
  AdminReportsQueryDto,
  AdminUsersQueryDto,
} from "./dto/admin-list-query.dto";

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
    const activeSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      listings,
      users,
      activeUsers,
      listingOpenReports,
      userOpenReports,
      activeMediations,
    ] = await this.prisma.$transaction([
      this.prisma.listing.count({ where: { deletedAt: null } }),
      this.prisma.user.count(),
      this.prisma.user.count({
        where: {
          role: "USER",
          status: "ACTIVE",
          lastLoginAt: { gte: activeSince },
        },
      }),
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
    ]);
    return {
      listings,
      users,
      activeUsers,
      openReports: listingOpenReports + userOpenReports,
      activeMediations,
    };
  }

  @Get("users")
  async users(@Query() query: AdminUsersQueryDto, @CurrentUser() user: User) {
    if (user.role !== "ADMIN") throw new ForbiddenException();
    const page = query.page;
    const pageSize = query.pageSize;
    const q = query.q?.trim();
    const activeSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const where = {
      ...(query.scope === "RESTRICTED"
        ? { role: "USER" as const, canPostListings: false }
        : {
            role: "USER" as const,
            status: "ACTIVE" as const,
            lastLoginAt: { gte: activeSince },
          }),
      ...(q
        ? {
            OR: [
              { displayName: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          displayName: true,
          email: true,
          role: true,
          status: true,
          lastLoginAt: true,
          canPostListings: true,
          postingRestrictionReason: true,
          postingRestrictedAt: true,
        },
        orderBy:
          query.scope === "RESTRICTED"
            ? { postingRestrictedAt: "desc" }
            : { lastLoginAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return this.paginated(items, total, page, pageSize);
  }

  @Get("user-reports")
  async userReports(
    @Query() query: AdminReportsQueryDto,
    @CurrentUser() user: User,
  ) {
    if (user.role !== "ADMIN") throw new ForbiddenException();
    const { page, pageSize } = query;
    const q = query.q?.trim();
    const where: Prisma.UserReportWhereInput = {
      status:
        query.status === "ALL"
          ? { in: [ReportStatus.OPEN, ReportStatus.REVIEWING] }
          : query.status === "OPEN"
            ? ReportStatus.OPEN
            : ReportStatus.REVIEWING,
      ...(q
        ? {
            OR: [
              { description: { contains: q, mode: "insensitive" as const } },
              {
                reporter: {
                  displayName: { contains: q, mode: "insensitive" as const },
                },
              },
              {
                reportedUser: {
                  displayName: { contains: q, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.userReport.findMany({
        where,
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
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.userReport.count({ where }),
    ]);
    return this.paginated(items, total, page, pageSize);
  }

  @Get("listing-reports")
  async listingReports(
    @Query() query: AdminReportsQueryDto,
    @CurrentUser() user: User,
  ) {
    if (user.role !== "ADMIN") throw new ForbiddenException();
    const { page, pageSize } = query;
    const q = query.q?.trim();
    const where: Prisma.ReportWhereInput = {
      status:
        query.status === "ALL"
          ? { in: [ReportStatus.OPEN, ReportStatus.REVIEWING] }
          : query.status === "OPEN"
            ? ReportStatus.OPEN
            : ReportStatus.REVIEWING,
      ...(q
        ? {
            OR: [
              { description: { contains: q, mode: "insensitive" as const } },
              {
                listing: {
                  title: { contains: q, mode: "insensitive" as const },
                },
              },
              {
                reporter: {
                  displayName: { contains: q, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        select: {
          id: true,
          reason: true,
          description: true,
          status: true,
          createdAt: true,
          listing: { select: { id: true, slug: true, title: true } },
          reporter: { select: { id: true, displayName: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.report.count({ where }),
    ]);
    return this.paginated(items, total, page, pageSize);
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

  @Get("marketplace-ads")
  marketplaceAds(@CurrentUser() user: User) {
    if (user.role !== "ADMIN") throw new ForbiddenException();
    return this.prisma.marketplaceAd.findMany({
      orderBy: { placement: "asc" },
    });
  }

  @Patch("marketplace-ads/:placement")
  async updateMarketplaceAd(
    @Param("placement", new ParseEnumPipe(MarketplaceAdPlacement))
    placement: MarketplaceAdPlacement,
    @Body() input: UpdateMarketplaceAdDto,
    @CurrentUser() user: User,
  ) {
    if (user.role !== "ADMIN") throw new ForbiddenException();
    if (input.enabled && (!input.title || !input.targetUrl))
      throw new BadRequestException(
        "Quảng cáo đang bật cần có tiêu đề và liên kết đích",
      );
    const defaults =
      placement === MarketplaceAdPlacement.MARKETPLACE_LEFT
        ? "Vị trí quảng cáo bên trái"
        : "Vị trí quảng cáo bên phải";
    const updated = await this.prisma.marketplaceAd.upsert({
      where: { placement },
      create: {
        placement,
        enabled: input.enabled,
        title: input.title ?? defaults,
        sponsorName: input.sponsorName,
        description: input.description,
        imageUrl: input.imageUrl,
        targetUrl: input.targetUrl,
        updatedById: user.id,
      },
      update: {
        enabled: input.enabled,
        ...(input.title !== undefined && { title: input.title }),
        sponsorName: input.sponsorName ?? null,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        targetUrl: input.targetUrl ?? null,
        updatedById: user.id,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "MARKETPLACE_AD_UPDATED",
        entityType: "MarketplaceAd",
        entityId: updated.id,
        newData: {
          placement,
          enabled: updated.enabled,
          targetUrl: updated.targetUrl,
        },
      },
    });
    return updated;
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

  private paginated<T>(
    items: T[],
    total: number,
    page: number,
    pageSize: number,
  ) {
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
}
