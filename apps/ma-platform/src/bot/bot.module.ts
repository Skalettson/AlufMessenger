import { Module } from '@nestjs/common';
import { BotService } from './bot.service.js';
import { BotController } from './bot.controller.js';

@Module({
  providers: [BotService],
  controllers: [BotController],
  exports: [BotService],
})
export class BotModule {}
