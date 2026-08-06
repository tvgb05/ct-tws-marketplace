import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { FacebookStrategy } from "./facebook.strategy";
import { GoogleStrategy } from "./google.strategy";
import { EmailOtpService } from "./email-otp.service";
import { GoogleOAuthGuard } from "./google-oauth.guard";
import { requireJwtSecret } from "./jwt-secret";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: requireJwtSecret(config),
        signOptions: { expiresIn: "15m" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailOtpService,
    FacebookStrategy,
    GoogleOAuthGuard,
    GoogleStrategy,
    JwtStrategy,
  ],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
