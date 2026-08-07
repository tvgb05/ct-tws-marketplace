import { Transform } from "class-transformer";
import { IsBoolean, IsEmail, IsOptional, MaxLength } from "class-validator";

export class RequestEmailOtpDto {
  @Transform(({ value }) =>
    String(value ?? "")
      .trim()
      .toLowerCase(),
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  // Backward compatible with older deployed web clients; no consent is required.
  @IsOptional()
  @IsBoolean()
  contactPrivacyAccepted?: boolean;
}
