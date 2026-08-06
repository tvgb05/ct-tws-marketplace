import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Profile, Strategy } from "passport-google-oauth20";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(config: ConfigService) {
    super({
      clientID:
        config.get<string>("GOOGLE_CLIENT_ID") ||
        "google-client-id-not-configured",
      clientSecret:
        config.get<string>("GOOGLE_CLIENT_SECRET") ||
        "google-client-secret-not-configured",
      callbackURL: config.get(
        "GOOGLE_CALLBACK_URL",
        "http://localhost:4000/api/v1/auth/google/callback",
      ),
      scope: ["profile", "email"],
    });
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile) {
    const email = profile.emails?.[0]?.value?.trim().toLowerCase();
    const rawProfile = profile._json as {
      verified_email?: boolean;
      email_verified?: boolean;
    };
    const emailVerified =
      rawProfile.verified_email === true || rawProfile.email_verified === true;
    if (!email || !emailVerified)
      throw new UnauthorizedException("Google không cung cấp email đã xác minh");
    return {
      providerUserId: profile.id,
      displayName: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
      email,
    };
  }
}
