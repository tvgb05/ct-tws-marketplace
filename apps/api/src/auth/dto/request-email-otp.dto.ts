import { Transform } from "class-transformer";
import { IsEmail, MaxLength } from "class-validator";

export class RequestEmailOtpDto {
  @Transform(({ value }) => String(value ?? "").trim().toLowerCase())
  @IsEmail()
  @MaxLength(254)
  email: string;
}
