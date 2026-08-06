import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";

const trimmedOptional = ({ value }: { value: unknown }) => {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
};

export class UpdateMarketplaceAdDto {
  @IsBoolean()
  enabled: boolean;

  @Transform(trimmedOptional)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @Transform(trimmedOptional)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sponsorName?: string;

  @Transform(trimmedOptional)
  @IsOptional()
  @IsString()
  @MaxLength(220)
  description?: string;

  @Transform(trimmedOptional)
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(500)
  imageUrl?: string;

  @Transform(trimmedOptional)
  @IsOptional()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(500)
  targetUrl?: string;
}
