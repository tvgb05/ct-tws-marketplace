import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class RegisterEmailDto {
  @Transform(({ value }) =>
    String(value ?? "")
      .trim()
      .toLowerCase(),
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Transform(({ value }) => String(value ?? "").trim())
  @Matches(/^\d{6}$/)
  code: string;

  @Transform(({ value }) => String(value ?? "").trim())
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  displayName: string;

  @IsString()
  @Length(12, 128)
  @Matches(/[a-z]/, { message: "Mật khẩu cần có chữ thường" })
  @Matches(/[A-Z]/, { message: "Mật khẩu cần có chữ hoa" })
  @Matches(/[0-9]/, { message: "Mật khẩu cần có chữ số" })
  password: string;

  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}
