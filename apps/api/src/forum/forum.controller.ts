import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import type { Prisma, User } from "@prisma/client";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { CreateForumPostDto } from "./dto/create-forum-post.dto";
import { ForumPostsQueryDto } from "./dto/forum-posts-query.dto";

@ApiTags("forum")
@ApiCookieAuth("tws_session")
@UseGuards(JwtAuthGuard)
@Controller("forum")
export class ForumController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("posts")
  async posts(@Query() query: ForumPostsQueryDto) {
    const search = query.q?.trim();
    const where: Prisma.ForumPostWhereInput = search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { content: { contains: search, mode: "insensitive" } },
            {
              author: {
                displayName: { contains: search, mode: "insensitive" },
              },
            },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.forumPost.findMany({
        where,
        select: {
          id: true,
          title: true,
          content: true,
          publishedAt: true,
          updatedAt: true,
          author: { select: { id: true, displayName: true, role: true } },
        },
        orderBy: {
          publishedAt: query.sort === "OLDEST" ? "asc" : "desc",
        },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.forumPost.count({ where }),
    ]);
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  @Post("posts")
  async createPost(
    @Body() input: CreateForumPostDto,
    @CurrentUser() admin: User,
  ) {
    if (admin.role !== "ADMIN") throw new ForbiddenException();

    return this.prisma.$transaction(async (tx) => {
      const post = await tx.forumPost.create({
        data: {
          title: input.title.trim(),
          content: input.content.trim(),
          authorId: admin.id,
        },
        select: {
          id: true,
          title: true,
          content: true,
          publishedAt: true,
          updatedAt: true,
          author: { select: { id: true, displayName: true, role: true } },
        },
      });
      const members = await tx.user.findMany({
        where: { role: "USER", status: "ACTIVE" },
        select: { id: true },
      });
      if (members.length) {
        await tx.notification.createMany({
          data: members.map(({ id }) => ({
            userId: id,
            type: "FORUM_POSTED",
            title: `Thông báo mới: ${post.title}`,
            message: `Admin ${post.author.displayName} vừa đăng thông tin mới trên Forum cộng đồng.`,
            targetUrl: `/community-guidelines#forum-${post.id}`,
          })),
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "FORUM_POST_CREATED",
          entityType: "ForumPost",
          entityId: post.id,
          newData: { title: post.title, notifiedUsers: members.length },
        },
      });
      return { ...post, notifiedUsers: members.length };
    });
  }
}
