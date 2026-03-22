import { Module } from '@nestjs/common';
import { StickerController } from './sticker.controller';
import { StickerService } from './sticker.service';
import { DatabaseProvider } from '../providers/database.provider';

@Module({
  controllers: [StickerController],
  providers: [DatabaseProvider, StickerService],
  exports: [StickerService],
})
export class StickerModule {}
