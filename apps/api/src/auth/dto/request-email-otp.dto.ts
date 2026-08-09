import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  MaxLength,
} from "class-validator";
import { EMAIL_OTP_INTENTS, type EmailOtpIntent } from "../auth-intent";

export class RequestEmailOtpDto {
  @Transform(({ value }) =>
    String(value ?? "")
      .trim()
      .toLowerCase(),
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsIn(EMAIL_OTP_INTENTS)
  intent: EmailOtpIntent;

  // Backward compatible with older deployed web clients; no consent is required.
  @IsOptional()
  @IsBoolean()
  contactPrivacyAccepted?: boolean;
}
