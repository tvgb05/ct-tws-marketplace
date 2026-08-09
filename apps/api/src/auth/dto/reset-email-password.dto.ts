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
  @Length(6, 128)
  @Matches(/[A-Za-z]/, {
    message: "Mật khẩu mới cần có ít nhất một chữ cái",
  })
  @Matches(/[0-9]/, { message: "Mật khẩu mới cần có chữ số" })
  password: string;
}
