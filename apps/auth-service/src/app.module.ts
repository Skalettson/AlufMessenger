import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DatabaseProvider } from './providers/database.provider';
import { RedisProvider } from './providers/redis.provider';
import { HealthController } from './health.controller';

@Module({
  imports: [AuthModule],
  controllers: [HealthController],
  providers: [DatabaseProvider, RedisProvider],
  exports: [DatabaseProvider, RedisProvider],
})
export class AppModule {}
