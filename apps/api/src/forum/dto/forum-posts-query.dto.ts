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

export class ForumPostsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(["NEWEST", "OLDEST"])
  sort: "NEWEST" | "OLDEST" = "NEWEST";

  @Transform(({ value }) => toNumber(value, 1))
  @IsInt()
  @Min(1)
  page = 1;

  @Transform(({ value }) => toNumber(value, 6))
  @IsInt()
  @Min(5)
  @Max(20)
  pageSize = 6;
}
