import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { DatabaseProvider } from './providers/database.provider';
import { RedisProvider } from './providers/redis.provider';
import { NatsProvider } from './providers/nats.provider';
import { HealthController } from './health.controller';

@Module({
  imports: [ChatModule],
  controllers: [HealthController],
  providers: [DatabaseProvider, RedisProvider, NatsProvider],
  exports: [DatabaseProvider, RedisProvider, NatsProvider],
})
export class AppModule {}
