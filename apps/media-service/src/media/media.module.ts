import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { ImageProcessor } from './image-processor';
import { DatabaseProvider } from '../providers/database.provider';
import { MinioProvider } from '../providers/minio.provider';

@Module({
  controllers: [MediaController],
  providers: [
    DatabaseProvider,
    MinioProvider,
    MediaService,
    ImageProcessor,
  ],
  exports: [MediaService],
})
export class MediaModule {}
