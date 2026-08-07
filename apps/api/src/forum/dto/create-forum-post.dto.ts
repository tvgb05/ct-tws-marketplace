import { IsString, Length } from "class-validator";

export class CreateForumPostDto {
  @IsString()
  @Length(4, 120)
  title!: string;

  @IsString()
  @Length(10, 5000)
  content!: string;
}
