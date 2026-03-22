import { Module } from '@nestjs/common';
import { CallController } from './call.controller';
import { CallService } from './call.service';
import { DatabaseProvider } from '../providers/database.provider';
import { RedisProvider } from '../providers/redis.provider';
import { NatsProvider } from '../providers/nats.provider';

@Module({
  controllers: [CallController],
  providers: [DatabaseProvider, RedisProvider, NatsProvider, CallService],
  exports: [CallService],
})
export class CallModule {}
