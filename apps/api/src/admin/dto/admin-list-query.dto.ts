import { Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class AdminListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @Transform(({ value }) => toNumber(value, 1))
  @IsInt()
  @Min(1)
  page = 1;

  @Transform(({ value }) => toNumber(value, 10))
  @IsInt()
  @Min(5)
  @Max(50)
  pageSize = 10;
}

export class AdminUsersQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsIn(["RECENT", "RESTRICTED"])
  scope: "RECENT" | "RESTRICTED" = "RECENT";
}

export class AdminReportsQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsIn(["ALL", "OPEN", "REVIEWING"])
  status: "ALL" | "OPEN" | "REVIEWING" = "ALL";
}
