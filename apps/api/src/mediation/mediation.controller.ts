import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { TradesService } from "../trades/trades.service";

class CreateMediationDto {
  @IsOptional() @IsString() @Length(0, 1000) buyerNote?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(9999) quantity = 1;
}

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
          in: ["REQUESTED", "SELLER_ACCEPTED", "ADMIN_ASSIGNED", "IN_PROGRESS"],
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
    const trade = await this.trades.requestContact(
      listingId,
      user,
      dto.quantity,
      request.id,
    );
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
          ? {}
          : { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
      include: {
        listing: { select: { id: true, slug: true, title: true } },
        buyer: { select: { id: true, displayName: true, role: true } },
        seller: { select: { id: true, displayName: true, role: true } },
        admin: { select: { id: true, displayName: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
