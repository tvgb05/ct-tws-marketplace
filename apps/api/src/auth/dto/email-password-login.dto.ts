import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
} from "class-validator";

export class EmailPasswordLoginDto {
  @Transform(({ value }) =>
    String(value ?? "")
      .trim()
      .toLowerCase(),
  )
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 128)
  password: string;

  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}
