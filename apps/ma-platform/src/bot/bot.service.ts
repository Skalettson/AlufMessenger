import { Injectable, Logger } from '@nestjs/common';

export interface BotMessage {
  id: string;
  chatId: string;
  text: string;
  parseMode?: 'markdown' | 'html' | 'plain';
  replyMarkup?: unknown;
  sent: boolean;
  timestamp: Date;
}

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);
  private readonly messages = new Map<string, BotMessage>();

  async sendMessage(
    chatId: string,
    text: string,
    options?: {
      parseMode?: 'markdown' | 'html' | 'plain';
      replyMarkup?: unknown;
    },
  ): Promise<BotMessage> {
    const messageId = this.generateId();

    const message: BotMessage = {
      id: messageId,
      chatId,
      text,
      parseMode: options?.parseMode || 'plain',
      replyMarkup: options?.replyMarkup,
      sent: true,
      timestamp: new Date(),
    };

    this.messages.set(messageId, message);
    this.logger.log(`Bot message sent to ${chatId}: ${text.substring(0, 50)}...`);

    return message;
  }

  async editMessage(
    chatId: string,
    messageId: string,
    text: string,
  ): Promise<BotMessage | null> {
    const message = this.messages.get(messageId);
    if (!message || message.chatId !== chatId) {
      return null;
    }

    message.text = text;
    message.timestamp = new Date();

    this.logger.log(`Bot message edited: ${messageId}`);
    return message;
  }

  async deleteMessage(
    chatId: string,
    messageId: string,
  ): Promise<boolean> {
    const message = this.messages.get(messageId);
    if (!message || message.chatId !== chatId) {
      return false;
    }

    this.messages.delete(messageId);
    this.logger.log(`Bot message deleted: ${messageId}`);
    return true;
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    _text?: string,
    _options?: { showAlert?: boolean; cacheTime?: number },
  ): Promise<{ success: boolean }> {
    this.logger.log(`Callback query answered: ${callbackQueryId}`);
    return { success: true };
  }

  async sendToBot(
    botId: string,
    data: unknown,
  ): Promise<{ success: boolean; response?: unknown }> {
    this.logger.log(`Sending to bot ${botId}:`, data);
    // Здесь будет интеграция с ботом Aluf Messenger
    return { success: true };
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
