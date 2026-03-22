import { Module } from '@nestjs/common';
import { MediaModule } from './media/media.module';
import { DatabaseProvider } from './providers/database.provider';
import { MinioProvider } from './providers/minio.provider';
import { HealthController } from './health.controller';

@Module({
  imports: [MediaModule],
  controllers: [HealthController],
  providers: [DatabaseProvider, MinioProvider],
  exports: [DatabaseProvider, MinioProvider],
})
export class AppModule {}
