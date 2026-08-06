import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { CookieOptions, Request, Response } from "express";
import { CurrentUser } from "./current-user.decorator";
import {
  AuthService,
  FacebookProfile,
  GoogleProfile,
} from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { User } from "@prisma/client";
import { CompleteProfileDto } from "./dto/complete-profile.dto";
import { AdminLoginDto } from "./dto/admin-login.dto";
import { ChangeAdminPasswordDto } from "./dto/change-admin-password.dto";
import { EmailOtpService } from "./email-otp.service";
import { RequestEmailOtpDto } from "./dto/request-email-otp.dto";
import { VerifyEmailOtpDto } from "./dto/verify-email-otp.dto";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { GoogleOAuthGuard } from "./google-oauth.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly emailOtp: EmailOtpService,
    private readonly config: ConfigService,
  ) {}

  private cookieOptions(): CookieOptions {
    const secure = this.config.get("COOKIE_SECURE", "false") === "true";
    return {
      httpOnly: true,
      sameSite: secure ? "none" : "lax",
      secure,
      path: "/",
    };
  }

  @Get("methods")
  methods() {
    return {
      google: Boolean(
        this.config.get("GOOGLE_CLIENT_ID") &&
          this.config.get("GOOGLE_CLIENT_SECRET") &&
          this.config.get("GOOGLE_CALLBACK_URL"),
      ),
      emailOtp: this.emailOtp.isAvailable(),
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

  @Get("google/start")
  googleStart(@Req() request: Request, @Res() response: Response) {
    const rememberForThirtyDays = request.query.remember === "1";
    const state = randomBytes(32).toString("hex");
    response.cookie("tws_login_remember", rememberForThirtyDays ? "1" : "0", {
      ...this.cookieOptions(),
      maxAge: 10 * 60 * 1000,
    });
    response.cookie("tws_google_oauth_state", state, {
      ...this.cookieOptions(),
      maxAge: 10 * 60 * 1000,
    });
    return response.redirect(
      `/api/v1/auth/google?state=${encodeURIComponent(state)}`,
    );
  }

  @Get("google")
  @UseGuards(GoogleOAuthGuard)
  googleLogin() {}

  @Get("google/callback")
  @UseGuards(GoogleOAuthGuard)
  async googleCallback(
    @Req() request: Request & { user: GoogleProfile },
    @Res() response: Response,
  ) {
    const expectedState = request.cookies?.tws_google_oauth_state;
    const receivedState = request.query.state;
    response.clearCookie("tws_google_oauth_state", this.cookieOptions());
    if (
      typeof expectedState !== "string" ||
      typeof receivedState !== "string" ||
      expectedState.length !== receivedState.length ||
      !timingSafeEqual(Buffer.from(expectedState), Buffer.from(receivedState))
    ) {
      throw new UnauthorizedException("Phiên đăng nhập Google không hợp lệ");
    }
    const rememberForThirtyDays = request.cookies?.tws_login_remember === "1";
    const result = await this.auth.loginWithGoogle(
      request.user,
      rememberForThirtyDays,
    );
    this.setSessionCookie(response, result.token, rememberForThirtyDays);
    return response.redirect(
      this.loginDestination(result.user.profileCompletedAt),
    );
  }

  @Post("email/request-code")
  @Throttle({ default: { limit: 3, ttl: 10 * 60_000 } })
  requestEmailCode(@Body() input: RequestEmailOtpDto) {
    return this.emailOtp.requestCode(input.email);
  }

  @Post("email/verify-code")
  @Throttle({ default: { limit: 10, ttl: 10 * 60_000 } })
  async verifyEmailCode(
    @Body() input: VerifyEmailOtpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const email = await this.emailOtp.verifyCode(input.email, input.code);
    const result = await this.auth.loginWithEmail(
      email,
      input.displayName,
      input.remember,
    );
    this.setSessionCookie(response, result.token, input.remember);
    return {
      id: result.user.id,
      displayName: result.user.displayName,
      email: result.user.email,
      role: result.user.role,
      profileCompleted: Boolean(result.user.profileCompletedAt),
    };
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
    response.clearCookie("tws_google_oauth_state", this.cookieOptions());
    return { success: true };
  }

  private setSessionCookie(
    response: Response,
    token: string,
    rememberForThirtyDays: boolean,
  ) {
    const sessionCookie = this.cookieOptions();
    if (rememberForThirtyDays)
      sessionCookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    response.cookie("tws_session", token, sessionCookie);
    response.clearCookie("tws_login_remember", this.cookieOptions());
  }

  private loginDestination(profileCompletedAt: Date | null) {
    const destination = profileCompletedAt
      ? "/marketplace?login=success"
      : "/complete-profile";
    return `${this.config.get("WEB_URL", "http://localhost:3000")}${destination}`;
  }
}
