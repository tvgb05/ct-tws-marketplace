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
  Length,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { ListingImageDto } from "./create-listing.dto";

export class SharedPhotoListingItemDto {
  @IsString() @Length(3, 120) title: string;
  @IsString() categoryId: string;
  @IsOptional() @IsString() @Length(2, 80) subcategory?: string;
  @IsEnum(ListingCondition) condition: ListingCondition;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) price: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(9999) quantity = 1;
}

export class CreateListingBatchDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SharedPhotoListingItemDto)
  items: SharedPhotoListingItemDto[];

  @IsString() @Length(20, 5000) description: string;
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
