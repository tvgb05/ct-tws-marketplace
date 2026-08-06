import { DeliveryMethod, ListingCondition } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class ListingImageDto {
  @IsString() publicId: string;
  @IsUrl({ require_tld: false }) secureUrl: string;
  @IsOptional() @IsNumber() width?: number;
  @IsOptional() @IsNumber() height?: number;
}

export class CreateListingDto {
  @IsString() @Length(5, 120) title: string;
  @IsString() @Length(20, 5000) description: string;
  @IsString() categoryId: string;
  @IsOptional() @IsString() @Length(2, 80) subcategory?: string;
  @IsEnum(ListingCondition) condition: ListingCondition;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) price: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(9999) quantity = 1;
  @IsString() @Length(2, 120) location: string;
  @IsEnum(DeliveryMethod) deliveryMethod: DeliveryMethod;
  @IsOptional() @IsBoolean() allowAdminMediation = true;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ListingImageDto)
  images: ListingImageDto[];
  @IsBoolean() sellerPolicyAccepted: boolean;
}
