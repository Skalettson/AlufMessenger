import { Module } from '@nestjs/common';
import { CustomEmojiController } from './custom-emoji.controller';
import { CustomEmojiService } from './custom-emoji.service';
import { DatabaseProvider } from '../providers/database.provider';

@Module({
  controllers: [CustomEmojiController],
  providers: [DatabaseProvider, CustomEmojiService],
  exports: [CustomEmojiService],
})
export class CustomEmojiModule {}
