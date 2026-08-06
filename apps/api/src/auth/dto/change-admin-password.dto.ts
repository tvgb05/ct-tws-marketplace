import { IsString, Length, Matches } from "class-validator";

export class ChangeAdminPasswordDto {
  @IsString()
  @Length(8, 128)
  currentPassword: string;

  @IsString()
  @Length(12, 128)
  @Matches(/[a-z]/, { message: "Mật khẩu mới cần có chữ thường" })
  @Matches(/[A-Z]/, { message: "Mật khẩu mới cần có chữ hoa" })
  @Matches(/[0-9]/, { message: "Mật khẩu mới cần có chữ số" })
  newPassword: string;
}
