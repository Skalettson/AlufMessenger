import { Module } from '@nestjs/common';
import { WsGatewayModule } from './gateway/ws-gateway.module';
import { RedisProvider } from './providers/redis.provider';
import { NatsProvider } from './providers/nats.provider';
import { HealthController } from './health.controller';

@Module({
  imports: [WsGatewayModule],
  controllers: [HealthController],
  providers: [RedisProvider, NatsProvider],
  exports: [RedisProvider, NatsProvider],
})
export class AppModule {}
