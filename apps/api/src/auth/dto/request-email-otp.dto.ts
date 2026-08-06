import { Transform } from "class-transformer";
import { Equals, IsBoolean, IsEmail, MaxLength } from "class-validator";

export class RequestEmailOtpDto {
  @Transform(({ value }) => String(value ?? "").trim().toLowerCase())
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsBoolean()
  @Equals(true, {
    message: "Bạn cần đồng ý cam kết sử dụng thông tin liên hệ",
  })
  contactPrivacyAccepted: boolean;
}
