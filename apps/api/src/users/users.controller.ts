import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateUserReportDto } from "./dto/create-user-report.dto";
import { CreateUserReviewDto } from "./dto/create-user-review.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiCookieAuth("tws_session")
@UseGuards(JwtAuthGuard)
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("users/:userId/profile")
  profile(@Param("userId") userId: string) {
    return this.users.profile(userId);
  }

  @Post("trades/:tradeId/reviews")
  review(
    @Param("tradeId") tradeId: string,
    @CurrentUser() user: User,
    @Body() input: CreateUserReviewDto,
  ) {
    return this.users.createReview(tradeId, user, input);
  }

  @Post("users/:userId/reports")
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  report(
    @Param("userId") userId: string,
    @CurrentUser() user: User,
    @Body() input: CreateUserReportDto,
  ) {
    return this.users.reportUser(userId, user, input);
  }
}
