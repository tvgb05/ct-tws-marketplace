import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TradesService } from "./trades.service";
import { RequestTradeDto } from "./dto/request-trade.dto";

@ApiTags("trades")
@ApiCookieAuth("tws_session")
@UseGuards(JwtAuthGuard)
@Controller()
export class TradesController {
  constructor(private readonly trades: TradesService) {}

  @Post("listings/:listingId/contact")
  requestContact(
    @Param("listingId") listingId: string,
    @Body() input: RequestTradeDto,
    @CurrentUser() user: User,
  ) {
    return this.trades.requestContact(listingId, user, input.quantity);
  }

  @Get("trades/mine")
  mine(@CurrentUser() user: User) { return this.trades.listMine(user); }

  @Post("trades/:tradeId/activate")
  activate(@Param("tradeId") tradeId: string, @CurrentUser() user: User) { return this.trades.activate(tradeId, user); }

  @Post("trades/:tradeId/complete")
  complete(@Param("tradeId") tradeId: string, @CurrentUser() user: User) { return this.trades.complete(tradeId, user); }

  @Post("trades/:tradeId/admin-complete")
  adminComplete(@Param("tradeId") tradeId: string, @CurrentUser() user: User) { return this.trades.adminComplete(tradeId, user); }

  @Post("trades/:tradeId/cancel")
  cancel(@Param("tradeId") tradeId: string, @CurrentUser() user: User) { return this.trades.cancel(tradeId, user); }
}
