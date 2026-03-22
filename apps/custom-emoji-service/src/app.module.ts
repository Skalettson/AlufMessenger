import { Module } from '@nestjs/common';
import { CustomEmojiModule } from './custom-emoji/custom-emoji.module';
import { DatabaseProvider } from './providers/database.provider';
import { HealthController } from './health.controller';

@Module({
  imports: [CustomEmojiModule],
  controllers: [HealthController],
  providers: [DatabaseProvider],
  exports: [DatabaseProvider],
})
export class AppModule {}
