import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserReportDto } from "./dto/create-user-report.dto";
import { CreateUserReviewDto } from "./dto/create-user-review.dto";

const publicIdentitySelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  role: true,
} as const;

const identityLabel = (user: { displayName: string; role: string }) =>
  user.role === "ADMIN" ? `${user.displayName} (ADMIN)` : user.displayName;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...publicIdentitySelect,
        joinedAt: true,
        status: true,
      },
    });
    if (!user || user.status !== "ACTIVE")
      throw new NotFoundException("Không tìm thấy thành viên");

    const [salesCount, rating, recentReviews] = await this.prisma.$transaction([
      this.prisma.listingTrade.count({
        where: { sellerId: userId, status: "COMPLETED" },
      }),
      this.prisma.userReview.aggregate({
        where: { revieweeId: userId },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      this.prisma.userReview.findMany({
        where: { revieweeId: userId },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          reviewer: { select: publicIdentitySelect },
          trade: {
            select: {
              listing: { select: { title: true, slug: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const { status: _status, ...safeUser } = user;
    void _status;
    return {
      user: safeUser,
      stats: {
        salesCount,
        reviewCount: rating._count.rating,
        averageRating: rating._avg.rating
          ? Number(rating._avg.rating.toFixed(1))
          : null,
      },
      recentReviews,
    };
  }

  async createReview(
    tradeId: string,
    reviewer: User,
    input: CreateUserReviewDto,
  ) {
    const trade = await this.prisma.listingTrade.findUnique({
      where: { id: tradeId },
      include: {
        buyer: { select: publicIdentitySelect },
        seller: { select: publicIdentitySelect },
        listing: { select: { title: true, slug: true } },
      },
    });
    if (!trade) throw new NotFoundException("Không tìm thấy giao dịch");
    if (trade.status !== "COMPLETED")
      throw new BadRequestException(
        "Chỉ có thể đánh giá sau khi giao dịch hoàn tất",
      );
    if (reviewer.id !== trade.buyerId && reviewer.id !== trade.sellerId)
      throw new BadRequestException("Bạn không tham gia giao dịch này");

    const existing = await this.prisma.userReview.findUnique({
      where: { tradeId_reviewerId: { tradeId, reviewerId: reviewer.id } },
    });
    if (existing) throw new ConflictException("Bạn đã đánh giá giao dịch này");

    const reviewee = reviewer.id === trade.buyerId ? trade.seller : trade.buyer;
    const comment = input.comment?.trim() || null;
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.userReview.create({
        data: {
          tradeId,
          reviewerId: reviewer.id,
          revieweeId: reviewee.id,
          rating: input.rating,
          comment,
        },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          reviewerId: true,
          revieweeId: true,
        },
      });
      await tx.notification.create({
        data: {
          userId: reviewee.id,
          type: "REVIEW_RECEIVED",
          title: `${identityLabel(reviewer)} đã đánh giá bạn ${input.rating}/5 sao`,
          message: comment
            ? `Đánh giá cho giao dịch ${trade.listing.title}: ${comment}`
            : `Bạn nhận được đánh giá cho giao dịch ${trade.listing.title}.`,
          targetUrl: `/users/${reviewee.id}`,
        },
      });
      return review;
    });
  }

  async reportUser(
    reportedUserId: string,
    reporter: User,
    input: CreateUserReportDto,
  ) {
    if (reportedUserId === reporter.id)
      throw new BadRequestException("Bạn không thể tố cáo chính mình");
    const reportedUser = await this.prisma.user.findUnique({
      where: { id: reportedUserId },
      select: { id: true, status: true },
    });
    if (!reportedUser || reportedUser.status !== "ACTIVE")
      throw new NotFoundException("Không tìm thấy thành viên");

    const existing = await this.prisma.userReport.findFirst({
      where: {
        reporterId: reporter.id,
        reportedUserId,
        status: { in: ["OPEN", "REVIEWING"] },
      },
    });
    if (existing)
      throw new ConflictException(
        "Bạn đã gửi tố cáo về thành viên này và phiếu đang được xử lý",
      );

    return this.prisma.userReport.create({
      data: {
        reporterId: reporter.id,
        reportedUserId,
        reason: input.reason,
        description: input.description?.trim() || null,
      },
      select: { id: true, status: true, createdAt: true },
    });
  }
}
