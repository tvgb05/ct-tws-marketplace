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
  @Length(6, 128)
  @Matches(/[A-Za-z]/, { message: "Mật khẩu cần có ít nhất một chữ cái" })
  @Matches(/[0-9]/, { message: "Mật khẩu cần có chữ số" })
  password: string;
}
