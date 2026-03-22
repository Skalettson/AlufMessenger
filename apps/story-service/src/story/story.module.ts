import { Module } from '@nestjs/common';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';
import { DatabaseProvider } from '../providers/database.provider';
import { RedisProvider } from '../providers/redis.provider';

@Module({
  controllers: [StoryController],
  providers: [DatabaseProvider, RedisProvider, StoryService],
  exports: [StoryService],
})
export class StoryModule {}
