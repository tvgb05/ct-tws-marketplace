import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class RequestTradeDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  quantity = 1;
}
