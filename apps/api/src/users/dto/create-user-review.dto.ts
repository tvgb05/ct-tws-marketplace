import { IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";

export class CreateUserReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  comment?: string;
}
