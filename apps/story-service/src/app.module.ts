import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { StoryModule } from './story/story.module';
import { DatabaseProvider } from './providers/database.provider';
import { RedisProvider } from './providers/redis.provider';
import { HealthController } from './health.controller';

@Module({
  imports: [ScheduleModule.forRoot(), StoryModule],
  controllers: [HealthController],
  providers: [DatabaseProvider, RedisProvider],
  exports: [DatabaseProvider, RedisProvider],
})
export class AppModule {}
