import { IsString, Length, Matches } from "class-validator";

export class ChangeAdminPasswordDto {
  @IsString()
  @Length(6, 128)
  currentPassword: string;

  @IsString()
  @Length(6, 128)
  @Matches(/[A-Za-z]/, {
    message: "Mật khẩu mới cần có ít nhất một chữ cái",
  })
  @Matches(/[0-9]/, { message: "Mật khẩu mới cần có chữ số" })
  newPassword: string;
}
