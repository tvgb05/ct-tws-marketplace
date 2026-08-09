import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class VerifyEmailOtpDto {
  @Transform(({ value }) =>
    String(value ?? "")
      .trim()
      .toLowerCase(),
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Transform(({ value }) => String(value ?? "").trim())
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;

  @Transform(({ value }) => String(value ?? "").trim())
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  displayName?: string;

  @IsBoolean()
  remember: boolean;
}
