import { Transform } from "class-transformer";
import {
  Equals,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from "class-validator";

export class CompleteProfileDto {
  @IsBoolean()
  @Equals(true, {
    message: "Bạn cần xác nhận đã đọc cam kết bảo vệ thông tin liên hệ",
  })
  contactPrivacyAccepted!: boolean;

  @Transform(({ value }: { value: unknown }) =>
    String(value ?? "").replace(/[\s().-]/g, ""),
  )
  @IsString()
  @Matches(/^(?:\+84|0)\d{9,10}$/, {
    message: "Số điện thoại liên hệ không hợp lệ",
  })
  phoneNumber!: string;

  @Transform(({ value }: { value: unknown }) => {
    const normalized = String(value ?? "").trim();
    return normalized || undefined;
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @IsUrl(
    { protocols: ["https"], require_protocol: true },
    { message: "Đường dẫn Facebook phải bắt đầu bằng https://" },
  )
  facebookProfileUrl?: string;
}
