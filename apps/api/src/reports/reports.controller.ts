import { Body, ConflictException, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, Length } from "class-validator";
import { ReportReason, User } from "@prisma/client";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

class CreateReportDto { @IsEnum(ReportReason) reason: ReportReason; @IsOptional() @IsString() @Length(0, 1000) description?: string; }

@ApiTags("reports") @ApiCookieAuth("tws_session") @UseGuards(JwtAuthGuard) @Controller("listings/:listingId/reports")
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}
  @Post()
  async create(@Param("listingId") listingId: string, @CurrentUser() user: User, @Body() dto: CreateReportDto) {
    const duplicate = await this.prisma.report.findFirst({ where: { listingId, reporterId: user.id, reason: dto.reason, status: { in: ["OPEN", "REVIEWING"] } } });
    if (duplicate) throw new ConflictException("Bạn đã gửi báo cáo này trước đó");
    return this.prisma.report.create({ data: { listingId, reporterId: user.id, reason: dto.reason, description: dto.description?.trim() } });
  }
}

