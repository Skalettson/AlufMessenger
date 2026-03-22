import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { BotService } from './bot.service.js';
import { AuthGuard } from '../auth/auth.guard.js';

@Controller('bot')
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Post('send')
  @UseGuards(AuthGuard)
  async sendMessage(
    @Body()
    body: {
      chatId: string;
      text: string;
      parseMode?: 'markdown' | 'html' | 'plain';
      replyMarkup?: unknown;
    },
  ) {
    return this.botService.sendMessage(
      body.chatId,
      body.text,
      {
        parseMode: body.parseMode,
        replyMarkup: body.replyMarkup,
      },
    );
  }

  @Post('edit')
  @UseGuards(AuthGuard)
  async editMessage(
    @Body()
    body: {
      chatId: string;
      messageId: string;
      text: string;
    },
  ) {
    return this.botService.editMessage(
      body.chatId,
      body.messageId,
      body.text,
    );
  }

  @Post('delete')
  @UseGuards(AuthGuard)
  async deleteMessage(
    @Body()
    body: {
      chatId: string;
      messageId: string;
    },
  ) {
    const deleted = await this.botService.deleteMessage(
      body.chatId,
      body.messageId,
    );
    return { success: deleted };
  }

  @Post('callback')
  @UseGuards(AuthGuard)
  async answerCallbackQuery(
    @Body()
    body: {
      callbackQueryId: string;
      text?: string;
      showAlert?: boolean;
      cacheTime?: number;
    },
  ) {
    return this.botService.answerCallbackQuery(
      body.callbackQueryId,
      body.text,
      {
        showAlert: body.showAlert,
        cacheTime: body.cacheTime,
      },
    );
  }

  @Post('webhook')
  async sendToBot(
    @Body()
    body: {
      botId: string;
      data: unknown;
    },
  ) {
    return this.botService.sendToBot(body.botId, body.data);
  }
}
