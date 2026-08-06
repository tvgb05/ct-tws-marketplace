import { Transform } from "class-transformer";
import { IsEmail, IsString, Length, Matches } from "class-validator";

export class CreateAdminAccountDto {
  @IsString()
  @Length(2, 80)
  displayName: string;

  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail()
  email: string;

  @IsString()
  @Length(12, 128)
  @Matches(/[a-z]/, { message: "Mật khẩu cần có chữ thường" })
  @Matches(/[A-Z]/, { message: "Mật khẩu cần có chữ hoa" })
  @Matches(/[0-9]/, { message: "Mật khẩu cần có chữ số" })
  password: string;
}
