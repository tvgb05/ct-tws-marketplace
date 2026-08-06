import { UserReportReason } from "@prisma/client";
import { IsEnum, IsOptional, IsString, Length } from "class-validator";

export class CreateUserReportDto {
  @IsEnum(UserReportReason)
  reason: UserReportReason;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;
}
