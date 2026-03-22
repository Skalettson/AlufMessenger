import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MaPlatformController } from './ma-platform.controller.js';
import { MaPlatformService } from './ma-platform.service.js';
import { AppsModule } from './apps/apps.module.js';
import { StorageModule } from './storage/storage.module.js';
import { BotModule } from './bot/bot.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { MaPlatformGateway } from './websocket/websocket.gateway.js';
import { DatabaseModule } from './database/database.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.ma', '.env'],
    }),
    DatabaseModule,
    AppsModule,
    DashboardModule,
    StorageModule,
    BotModule,
    AnalyticsModule,
    PaymentsModule,
  ],
  controllers: [MaPlatformController],
  providers: [MaPlatformService, MaPlatformGateway],
})
export class AppModule {}
