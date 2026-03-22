import { Module } from '@nestjs/common';
import { BotController } from './bot.controller';
import { BotGrpcController } from './bot-grpc.controller';
import { BotRateLimitGuard } from './bot-rate-limit.guard';
import { BotService } from './bot.service';
import { BotManagerService } from './bot-manager.service';
import { WebhookService } from './webhook.service';
import { AlufBotSeedService } from './aluf-bot.seed';
import { AlufBotMessageHandler } from './aluf-bot.handler';
import { GrpcClientsModule } from '../grpc/grpc-clients.module';
import { DatabaseProvider } from '../providers/database.provider';
import { RedisProvider } from '../providers/redis.provider';
import { NatsProvider } from '../providers/nats.provider';

@Module({
  imports: [GrpcClientsModule],
  controllers: [BotController, BotGrpcController],
  providers: [
    DatabaseProvider,
    RedisProvider,
    NatsProvider,
    BotRateLimitGuard,
    BotService,
    BotManagerService,
    WebhookService,
    AlufBotSeedService,
    AlufBotMessageHandler,
  ],
  exports: [BotService, BotManagerService],
})
export class BotModule {}
