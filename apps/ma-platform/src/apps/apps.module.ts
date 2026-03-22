import { Module } from '@nestjs/common';
import { AppsService } from './apps.service.js';
import { AppsController } from './apps.controller.js';

@Module({
  providers: [AppsService],
  controllers: [AppsController],
  exports: [AppsService],
})
export class AppsModule {}
