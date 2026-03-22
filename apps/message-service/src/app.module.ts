import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MessageModule } from './message/message.module';
import { DatabaseProvider } from './providers/database.provider';
import { RedisProvider } from './providers/redis.provider';
import { NatsProvider } from './providers/nats.provider';
import { HealthController } from './health.controller';

@Module({
  imports: [ScheduleModule.forRoot(), MessageModule],
  controllers: [HealthController],
  providers: [DatabaseProvider, RedisProvider, NatsProvider],
  exports: [DatabaseProvider, RedisProvider, NatsProvider],
})
export class AppModule {}
