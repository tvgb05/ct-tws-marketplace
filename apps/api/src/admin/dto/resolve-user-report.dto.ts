import { IsIn, IsOptional, IsString, Length } from "class-validator";

export const userReportDecisions = ["RESTRICT_POSTING", "DISMISS"] as const;
export type UserReportDecision = (typeof userReportDecisions)[number];

export class ResolveUserReportDto {
  @IsIn(userReportDecisions)
  decision: UserReportDecision;

  @IsOptional()
  @IsString()
  @Length(3, 500)
  resolution?: string;
}
