import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { DatabaseProvider } from './providers/database.provider';
import { RedisProvider } from './providers/redis.provider';
import { NatsProvider } from './providers/nats.provider';
import { HealthController } from './health.controller';

@Module({
  imports: [NotificationModule],
  controllers: [HealthController],
  providers: [DatabaseProvider, RedisProvider, NatsProvider],
  exports: [DatabaseProvider, RedisProvider, NatsProvider],
})
export class AppModule {}
