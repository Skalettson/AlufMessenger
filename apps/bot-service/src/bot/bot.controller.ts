import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AlufError } from '@aluf/shared';
import { BotService } from './bot.service';
import { BotRateLimitGuard } from './bot-rate-limit.guard';

function toHttpError(err: unknown): HttpException {
  if (err instanceof AlufError) {
    return new HttpException(
      { ok: false, error_code: err.statusCode, description: err.message },
      err.statusCode,
    );
  }
  return new HttpException(
    { ok: false, error_code: 500, description: 'Internal server error' },
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}

@Controller('bot:token')
@UseGuards(BotRateLimitGuard)
export class BotController {
  constructor(
    private readonly botService: BotService,
  ) {}

  @Post('getMe')
  async getMe(@Param('token') token: string) {
    try {
      const bot = await this.botService.validateBotToken(token);
      const info = await this.botService.getMe(bot.id);
      return { ok: true, result: info };
    } catch (err) {
      throw toHttpError(err);
    }
  }

  @Post('sendMessage')
  async sendMessage(
    @Param('token') token: string,
    @Body() body: { chat_id: string; text: string; reply_markup?: string; reply_to_message_id?: string },
  ) {
    try {
      const bot = await this.botService.validateBotToken(token);
      const replyMarkup = body.reply_markup ? JSON.parse(body.reply_markup) : undefined;
      const result = await this.botService.sendMessage(
        bot.id,
        body.chat_id,
        body.text,
        replyMarkup,
        body.reply_to_message_id,
      );
      return { ok: true, result };
    } catch (err) {
      throw toHttpError(err);
    }
  }

  @Post('getUpdates')
  async getUpdates(
    @Param('token') token: string,
    @Body() body: { offset?: number; limit?: number; timeout?: number },
  ) {
    try {
      const bot = await this.botService.validateBotToken(token);
      const updates = await this.botService.getUpdates(
        bot.id,
        body.offset ?? 0,
        body.limit ?? 100,
        body.timeout ?? 0,
      );
      return { ok: true, result: updates };
    } catch (err) {
      throw toHttpError(err);
    }
  }

  @Post('setWebhook')
  async setWebhook(
    @Param('token') token: string,
    @Body() body: { url: string; secret?: string },
  ) {
    try {
      const bot = await this.botService.validateBotToken(token);
      await this.botService.setWebhook(bot.id, body.url, body.secret);
      return { ok: true, result: true, description: 'Webhook was set' };
    } catch (err) {
      throw toHttpError(err);
    }
  }

  @Post('deleteWebhook')
  async deleteWebhook(@Param('token') token: string) {
    try {
      const bot = await this.botService.validateBotToken(token);
      await this.botService.setWebhook(bot.id, null);
      return { ok: true, result: true, description: 'Webhook was deleted' };
    } catch (err) {
      throw toHttpError(err);
    }
  }

  @Post('sendPhoto')
  async sendPhoto(
    @Param('token') token: string,
    @Body() body: { chat_id: string; photo: string; caption?: string; reply_markup?: string },
  ) {
    try {
      const bot = await this.botService.validateBotToken(token);
      const replyMarkup = body.reply_markup ? JSON.parse(body.reply_markup) : undefined;
      const result = await this.botService.sendMedia(
        bot.id,
        body.chat_id,
        'image',
        body.photo,
        body.caption,
        replyMarkup,
      );
      return { ok: true, result };
    } catch (err) {
      throw toHttpError(err);
    }
  }

  @Post('sendDocument')
  async sendDocument(
    @Param('token') token: string,
    @Body() body: { chat_id: string; document: string; caption?: string; reply_markup?: string },
  ) {
    try {
      const bot = await this.botService.validateBotToken(token);
      const replyMarkup = body.reply_markup ? JSON.parse(body.reply_markup) : undefined;
      const result = await this.botService.sendMedia(
        bot.id,
        body.chat_id,
        'document',
        body.document,
        body.caption,
        replyMarkup,
      );
      return { ok: true, result };
    } catch (err) {
      throw toHttpError(err);
    }
  }

  @Post('answerCallbackQuery')
  async answerCallbackQuery(
    @Param('token') token: string,
    @Body() body: { callback_query_id: string; text?: string; show_alert?: boolean },
  ) {
    try {
      const bot = await this.botService.validateBotToken(token);
      await this.botService.answerCallbackQuery(
        bot.id,
        body.callback_query_id,
        body.text,
        body.show_alert,
      );
      return { ok: true, result: true };
    } catch (err) {
      throw toHttpError(err);
    }
  }

  @Post('editMessageText')
  async editMessageText(
    @Param('token') token: string,
    @Body() body: {
      chat_id: string;
      message_id: string;
      text: string;
      reply_markup?: string;
    },
  ) {
    try {
      const bot = await this.botService.validateBotToken(token);
      const replyMarkup = body.reply_markup ? JSON.parse(body.reply_markup) : undefined;
      const result = await this.botService.editMessageText(
        bot.id,
        body.chat_id,
        body.message_id,
        body.text,
        replyMarkup,
      );
      return { ok: true, result };
    } catch (err) {
      throw toHttpError(err);
    }
  }

  @Post('deleteMessage')
  async deleteMessage(
    @Param('token') token: string,
    @Body() body: { chat_id: string; message_id: string; delete_for_everyone?: boolean },
  ) {
    try {
      const bot = await this.botService.validateBotToken(token);
      await this.botService.deleteMessage(
        bot.id,
        body.chat_id,
        body.message_id,
        body.delete_for_everyone ?? true,
      );
      return { ok: true, result: true };
    } catch (err) {
      throw toHttpError(err);
    }
  }

  @Post('getChat')
  async getChat(
    @Param('token') token: string,
    @Body() body: { chat_id: string },
  ) {
    try {
      const bot = await this.botService.validateBotToken(token);
      const result = await this.botService.getChat(bot.id, body.chat_id);
      return { ok: true, result };
    } catch (err) {
      throw toHttpError(err);
    }
  }

  @Post('pinMessage')
  async pinMessage(
    @Param('token') token: string,
    @Body() body: { chat_id: string; message_id: string },
  ) {
    try {
      const bot = await this.botService.validateBotToken(token);
      await this.botService.pinMessage(bot.id, body.chat_id, body.message_id);
      return { ok: true, result: true };
    } catch (err) {
      throw toHttpError(err);
    }
  }

  @Post('unpinMessage')
  async unpinMessage(
    @Param('token') token: string,
    @Body() body: { chat_id: string; message_id: string },
  ) {
    try {
      const bot = await this.botService.validateBotToken(token);
      await this.botService.unpinMessage(bot.id, body.chat_id, body.message_id);
      return { ok: true, result: true };
    } catch (err) {
      throw toHttpError(err);
    }
  }
}
