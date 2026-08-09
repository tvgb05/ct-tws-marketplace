import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  MaxLength,
} from "class-validator";
import { AUTH_INTENTS, type AuthIntent } from "../auth-intent";

export class RequestEmailOtpDto {
  @Transform(({ value }) =>
    String(value ?? "")
      .trim()
      .toLowerCase(),
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsIn(AUTH_INTENTS)
  intent: AuthIntent;

  // Backward compatible with older deployed web clients; no consent is required.
  @IsOptional()
  @IsBoolean()
  contactPrivacyAccepted?: boolean;
}
