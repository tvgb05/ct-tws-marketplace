import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Profile, Strategy } from "passport-facebook";

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, "facebook") {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>("FACEBOOK_APP_ID") || "facebook-app-id-not-configured",
      clientSecret: config.get<string>("FACEBOOK_APP_SECRET") || "facebook-app-secret-not-configured",
      callbackURL: config.get("FACEBOOK_CALLBACK_URL", "http://localhost:4000/api/v1/auth/facebook/callback"),
      profileFields: ["id", "displayName", "photos"],
    });
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile) {
    return {
      providerUserId: profile.id,
      displayName: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
    };
  }
}
