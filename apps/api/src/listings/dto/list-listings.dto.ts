import { Type } from "class-transformer";
import { IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from "class-validator";
import { ListingCondition } from "@prisma/client";

export class ListListingsDto {
  @IsOptional() @IsString() @Length(1, 100) search?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() categories?: string;
  @IsOptional() @IsString() subcategories?: string;
  @IsOptional() @IsEnum(ListingCondition) condition?: ListingCondition;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxPrice?: number;
  @IsOptional() @IsIn(["yes", "no"]) shipping?: "yes" | "no";
  @IsOptional() @IsString() sort?:
    | "newest"
    | "oldest"
    | "price_asc"
    | "price_desc";
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}
