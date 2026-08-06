import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

const favoriteListingInclude = {
  seller: {
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      joinedAt: true,
      role: true,
    },
  },
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { sortOrder: "asc" as const } },
  _count: { select: { favorites: true, reports: true } },
};

@ApiTags("favorites")
@ApiCookieAuth("tws_session")
@UseGuards(JwtAuthGuard)
@Controller("favorites")
export class FavoritesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@CurrentUser() user: User) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId: user.id },
      include: { listing: { include: favoriteListingInclude } },
      orderBy: { createdAt: "desc" },
    });
    return favorites.map((favorite) => favorite.listing);
  }

  @Post(":listingId")
  async add(@Param("listingId") listingId: string, @CurrentUser() user: User) {
    await this.prisma.favorite.upsert({
      where: { userId_listingId: { userId: user.id, listingId } },
      create: { userId: user.id, listingId },
      update: {},
    });
    return { success: true };
  }

  @Delete(":listingId")
  async remove(
    @Param("listingId") listingId: string,
    @CurrentUser() user: User,
  ) {
    await this.prisma.favorite.deleteMany({
      where: { userId: user.id, listingId },
    });
    return { success: true };
  }
}
