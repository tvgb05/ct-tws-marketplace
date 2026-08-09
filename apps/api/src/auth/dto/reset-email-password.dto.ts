import { Transform } from "class-transformer";
import { IsEmail, IsString, Length, Matches, MaxLength } from "class-validator";

export class ResetEmailPasswordDto {
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

  @IsString()
  @Length(12, 128)
  @Matches(/[a-z]/, { message: "Mật khẩu mới cần có chữ thường" })
  @Matches(/[A-Z]/, { message: "Mật khẩu mới cần có chữ hoa" })
  @Matches(/[0-9]/, { message: "Mật khẩu mới cần có chữ số" })
  password: string;
}
