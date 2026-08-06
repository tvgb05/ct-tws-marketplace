import { Transform } from "class-transformer";
import { Equals, IsBoolean, IsEmail, MaxLength } from "class-validator";

export class RequestEmailOtpDto {
  @Transform(({ value }) =>
    String(value ?? "")
      .trim()
      .toLowerCase(),
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsBoolean()
  @Equals(true, {
    message: "Bạn cần xác nhận đã đọc cam kết bảo vệ thông tin liên hệ",
  })
  contactPrivacyAccepted: boolean;
}
