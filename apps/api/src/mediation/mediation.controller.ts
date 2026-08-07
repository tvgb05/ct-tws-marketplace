import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { Prisma, type User } from "@prisma/client";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { TradesService } from "../trades/trades.service";
import { AdminMediationQueryDto } from "./dto/admin-mediation-query.dto";

class CreateMediationDto {
  @IsOptional() @IsString() @Length(0, 1000) buyerNote?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(9999) quantity = 1;
}

const activeMediationStatuses = [
  "REQUESTED",
  "SELLER_ACCEPTED",
  "ADMIN_ASSIGNED",
  "IN_PROGRESS",
] as const;

const mediationInclude = {
  listing: { select: { id: true, slug: true, title: true } },
  buyer: { select: { id: true, displayName: true, role: true } },
  seller: { select: { id: true, displayName: true, role: true } },
  admin: { select: { id: true, displayName: true, role: true } },
  trade: {
    select: {
      id: true,
      status: true,
      requestedQuantity: true,
      allocatedQuantity: true,
    },
  },
} satisfies Prisma.MediationRequestInclude;

@ApiTags("mediation")
@ApiCookieAuth("tws_session")
@UseGuards(JwtAuthGuard)
@Controller("listings/:listingId/mediation-requests")
export class MediationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trades: TradesService,
  ) {}
  @Post()
  async create(
    @Param("listingId") listingId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateMediationDto,
  ) {
    const listing = await this.prisma.listing.findUniqueOrThrow({
      where: { id: listingId },
    });
    if (listing.sellerId === user.id)
      throw new BadRequestException(
        "Bạn không thể yêu cầu trung gian cho bài đăng của mình",
      );
    if (
      !listing.allowAdminMediation ||
      !["AVAILABLE", "RESERVED"].includes(listing.status)
    )
      throw new BadRequestException(
        "Bài đăng này không nhận hỗ trợ trung gian",
      );
    if (dto.quantity > listing.totalQuantity)
      throw new BadRequestException(
        `Mỗi yêu cầu chỉ được đặt tối đa ${listing.totalQuantity} sản phẩm`,
      );
    const existing = await this.prisma.mediationRequest.findFirst({
      where: {
        listingId,
        buyerId: user.id,
        status: {
          in: [...activeMediationStatuses],
        },
      },
    });
    if (existing)
      throw new BadRequestException("Bạn đã có một yêu cầu đang xử lý");
    const request = await this.prisma.mediationRequest.create({
      data: {
        listingId,
        buyerId: user.id,
        sellerId: listing.sellerId,
        buyerNote: dto.buyerNote?.trim(),
      },
    });
    const trade = await this.trades
      .requestContact(listingId, user, dto.quantity, request.id)
      .catch(async (error: unknown) => {
        await this.prisma.mediationRequest.delete({
          where: { id: request.id },
        });
        throw error;
      });
    const admins = await this.prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { id: true },
    });
    if (admins.length) {
      await this.prisma.notification.createMany({
        data: admins.map(({ id }) => ({
          userId: id,
          type: "MEDIATION_REQUESTED",
          title: `${user.displayName} yêu cầu admin trung gian`,
          message: `Giao dịch ${listing.title} đang chờ một admin nhận phụ trách.`,
          targetUrl: "/admin#mediation-queue",
        })),
      });
    }
    return { request, ...trade };
  }
}

@ApiTags("mediation")
@ApiCookieAuth("tws_session")
@UseGuards(JwtAuthGuard)
@Controller("mediation-requests")
export class MediationRequestsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("mine")
  mine(@CurrentUser() user: User) {
    return this.prisma.mediationRequest.findMany({
      where:
        user.role === "ADMIN"
          ? { assignedAdminId: user.id }
          : { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
      include: mediationInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  @Get("admin")
  async adminQueue(
    @Query() query: AdminMediationQueryDto,
    @CurrentUser() admin: User,
  ) {
    if (admin.role !== "ADMIN") throw new ForbiddenException();
    const search = query.q?.trim();
    const where: Prisma.MediationRequestWhereInput = {
      AND: [
        query.scope === "PENDING"
          ? {
              assignedAdminId: null,
              status: { in: ["REQUESTED", "SELLER_ACCEPTED"] },
            }
          : {
              assignedAdminId: admin.id,
              status: { in: ["ADMIN_ASSIGNED", "IN_PROGRESS"] },
            },
        ...(search
          ? [
              {
                OR: [
                  {
                    listing: {
                      title: { contains: search, mode: "insensitive" as const },
                    },
                  },
                  {
                    buyer: {
                      displayName: {
                        contains: search,
                        mode: "insensitive" as const,
                      },
                    },
                  },
                  {
                    seller: {
                      displayName: {
                        contains: search,
                        mode: "insensitive" as const,
                      },
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.mediationRequest.findMany({
        where,
        include: mediationInclude,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.mediationRequest.count({ where }),
    ]);
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  @Post(":id/assign")
  async assign(@Param("id") id: string, @CurrentUser() admin: User) {
    if (admin.role !== "ADMIN") throw new ForbiddenException();
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.mediationRequest.updateMany({
        where: {
          id,
          assignedAdminId: null,
          status: { in: ["REQUESTED", "SELLER_ACCEPTED"] },
        },
        data: {
          assignedAdminId: admin.id,
          assignedAt: new Date(),
          status: "ADMIN_ASSIGNED",
        },
      });
      if (claimed.count !== 1) {
        const current = await tx.mediationRequest.findUnique({
          where: { id },
          include: mediationInclude,
        });
        if (!current)
          throw new BadRequestException("Không tìm thấy yêu cầu trung gian");
        if (current.assignedAdminId === admin.id) return current;
        if (current.assignedAdminId)
          throw new ConflictException(
            "Yêu cầu này đã được một admin khác nhận phụ trách",
          );
        throw new BadRequestException("Yêu cầu này không còn chờ admin duyệt");
      }

      const assigned = await tx.mediationRequest.findUniqueOrThrow({
        where: { id },
        include: mediationInclude,
      });
      const adminLabel = `${admin.displayName} (ADMIN)`;
      await tx.notification.createMany({
        data: [assigned.buyerId, assigned.sellerId].map((userId) => ({
          userId,
          type: "MEDIATION_ASSIGNED" as const,
          title: `${adminLabel} đã duyệt yêu cầu trung gian`,
          message: `${adminLabel} đã nhận trách nhiệm hỗ trợ ${assigned.listing.title}. Bấm để xem hồ sơ admin.`,
          targetUrl: `/users/${admin.id}`,
        })),
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "MEDIATION_ASSIGNED",
          entityType: "MediationRequest",
          entityId: assigned.id,
          newData: {
            assignedAdminId: admin.id,
            buyerId: assigned.buyerId,
            sellerId: assigned.sellerId,
          },
        },
      });
      return assigned;
    });
  }
}
