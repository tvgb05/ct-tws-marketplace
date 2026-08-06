import { IsBoolean, IsOptional, IsString, Length } from "class-validator";

export class SetPostingPermissionDto {
  @IsBoolean()
  allowed: boolean;

  @IsOptional()
  @IsString()
  @Length(3, 500)
  reason?: string;
}
