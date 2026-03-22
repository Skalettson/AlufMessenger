import { Module } from '@nestjs/common';
import { StickerModule } from './sticker/sticker.module';
import { DatabaseProvider } from './providers/database.provider';
import { HealthController } from './health.controller';

@Module({
  imports: [StickerModule],
  controllers: [HealthController],
  providers: [DatabaseProvider],
  exports: [DatabaseProvider],
})
export class AppModule {}
