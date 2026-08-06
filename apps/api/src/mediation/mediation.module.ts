import { Module } from "@nestjs/common";
import { TradesModule } from "../trades/trades.module";
import {
  MediationController,
  MediationRequestsController,
} from "./mediation.controller";
@Module({
  imports: [TradesModule],
  controllers: [MediationController, MediationRequestsController],
})
export class MediationModule {}
