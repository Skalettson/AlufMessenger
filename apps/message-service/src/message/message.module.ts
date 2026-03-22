import { Module } from '@nestjs/common';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { MessageIncomingSubscriber } from './message-incoming.subscriber';
import { DatabaseProvider } from '../providers/database.provider';
import { RedisProvider } from '../providers/redis.provider';
import { NatsProvider } from '../providers/nats.provider';

@Module({
  controllers: [MessageController],
  providers: [
    DatabaseProvider,
    RedisProvider,
    NatsProvider,
    MessageService,
    MessageIncomingSubscriber,
  ],
  exports: [MessageService],
})
export class MessageModule {}
