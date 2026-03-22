import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MaPlatformService } from './ma-platform.service.js';
import { AuthGuard } from './auth/auth.guard.js';

@Controller()
export class MaPlatformController {
  constructor(private readonly service: MaPlatformService) {}

  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Post('apps/:appId/init')
  @UseGuards(AuthGuard)
  async initApp(
    @Param('appId') appId: string,
    @Body() body: { initData?: string },
  ) {
    return this.service.initApp(appId, body.initData);
  }

  @Get('storage')
  @UseGuards(AuthGuard)
  async getStorage(
    @Query('key') key: string,
    @Query('scope') scope: 'user' | 'app' | 'global' = 'app',
  ) {
    return this.service.getStorage(key, scope);
  }

  @Post('storage')
  @UseGuards(AuthGuard)
  async setStorage(
    @Body() body: { key: string; value: unknown; scope?: 'user' | 'app' | 'global' },
  ) {
    return this.service.setStorage(body.key, body.value, body.scope);
  }

  @Post('bot/send')
  @UseGuards(AuthGuard)
  async sendBotMessage(
    @Body() body: { chatId: string; text: string; parseMode?: string },
  ) {
    return this.service.sendBotMessage(body.chatId, body.text, body.parseMode);
  }

  @Post('payments/create-invoice')
  @UseGuards(AuthGuard)
  async createInvoice(
    @Body() body: {
      title: string;
      description: string;
      amount: number;
      currency: string;
      payload?: string;
    },
  ) {
    return this.service.createInvoice(body);
  }
}
