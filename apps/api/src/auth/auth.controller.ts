import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { CookieOptions, Request, Response } from "express";
import { CurrentUser } from "./current-user.decorator";
import { AuthService, FacebookProfile } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { User } from "@prisma/client";
import { CompleteProfileDto } from "./dto/complete-profile.dto";
import { AdminLoginDto } from "./dto/admin-login.dto";
import { ChangeAdminPasswordDto } from "./dto/change-admin-password.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.get("COOKIE_SECURE", "false") === "true",
      path: "/",
    };
  }

  @Get("facebook/start")
  facebookStart(@Req() request: Request, @Res() response: Response) {
    const rememberForThirtyDays = request.query.remember === "1";
    response.cookie("tws_login_remember", rememberForThirtyDays ? "1" : "0", {
      ...this.cookieOptions(),
      maxAge: 10 * 60 * 1000,
    });
    return response.redirect("/api/v1/auth/facebook");
  }

  @Get("facebook")
  @UseGuards(AuthGuard("facebook"))
  facebookLogin() {}

  @Get("facebook/callback")
  @UseGuards(AuthGuard("facebook"))
  async facebookCallback(
    @Req() request: Request & { user: FacebookProfile },
    @Res() response: Response,
  ) {
    const rememberForThirtyDays = request.cookies?.tws_login_remember === "1";
    const result = await this.auth.loginWithFacebook(
      request.user,
      rememberForThirtyDays,
    );
    const sessionCookie: CookieOptions = this.cookieOptions();
    if (rememberForThirtyDays) sessionCookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    response.cookie("tws_session", result.token, sessionCookie);
    response.clearCookie("tws_login_remember", this.cookieOptions());
    const destination = result.user.profileCompletedAt
      ? "/marketplace?login=success"
      : "/complete-profile";
    return response.redirect(
      `${this.config.get("WEB_URL", "http://localhost:3000")}${destination}`,
    );
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    const {
      id,
      displayName,
      avatarUrl,
      email,
      phoneNumber,
      facebookProfileUrl,
      profileCompletedAt,
      role,
      joinedAt,
      canPostListings,
      postingRestrictionReason,
    } = user;
    return {
      id,
      displayName,
      avatarUrl,
      email,
      phoneNumber,
      facebookProfileUrl,
      profileCompleted: Boolean(
        profileCompletedAt && phoneNumber && facebookProfileUrl,
      ),
      role,
      joinedAt,
      canPostListings,
      postingRestrictionReason,
    };
  }

  @Post("admin/login")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async adminLogin(
    @Body() input: AdminLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.loginWithAdmin(input);
    const sessionCookie = this.cookieOptions();
    if (input.remember) sessionCookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    response.cookie("tws_session", result.token, sessionCookie);
    return {
      id: result.user.id,
      displayName: result.user.displayName,
      email: result.user.email,
      role: result.user.role,
    };
  }

  @Patch("admin/password")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async changeAdminPassword(
    @Body() input: ChangeAdminPasswordDto,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.changeAdminPassword(user.id, input);
    response.clearCookie("tws_session", this.cookieOptions());
    return { ...result, requiresLogin: true };
  }

  @Patch("profile")
  @UseGuards(JwtAuthGuard)
  async completeProfile(
    @Body() input: CompleteProfileDto,
    @CurrentUser() user: User,
  ) {
    const updated = await this.auth.completeProfile(user.id, input);
    return {
      id: updated.id,
      phoneNumber: updated.phoneNumber,
      facebookProfileUrl: updated.facebookProfileUrl,
      profileCompleted: true,
    };
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie("tws_session", this.cookieOptions());
    response.clearCookie("tws_login_remember", this.cookieOptions());
    return { success: true };
  }
}
