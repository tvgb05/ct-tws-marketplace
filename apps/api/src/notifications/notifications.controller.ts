import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("notifications")
@ApiCookieAuth("tws_session")
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  }

  @Get("unread-count")
  async unreadCount(@CurrentUser() user: User) {
    return { count: await this.prisma.notification.count({ where: { userId: user.id, readAt: null } }) };
  }

  @Post(":id/read")
  async markRead(@Param("id") id: string, @CurrentUser() user: User) {
    await this.prisma.notification.updateMany({ where: { id, userId: user.id }, data: { readAt: new Date() } });
    return { success: true };
  }

  @Post("read-all")
  async markAllRead(@CurrentUser() user: User) {
    await this.prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    return { success: true };
  }
}
