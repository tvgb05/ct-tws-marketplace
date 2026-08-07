import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { CategoriesModule } from "./categories/categories.module";
import { HealthController } from "./health.controller";
import { FavoritesModule } from "./favorites/favorites.module";
import { ForumModule } from "./forum/forum.module";
import { ListingsModule } from "./listings/listings.module";
import { MediationModule } from "./mediation/mediation.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReportsModule } from "./reports/reports.module";
import { TradesModule } from "./trades/trades.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    CategoriesModule,
    ListingsModule,
    FavoritesModule,
    ForumModule,
    ReportsModule,
    MediationModule,
    TradesModule,
    NotificationsModule,
    UsersModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
