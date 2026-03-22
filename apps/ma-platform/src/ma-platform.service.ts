import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MaPlatformService {
  private readonly logger = new Logger(MaPlatformService.name);
  private readonly storage = new Map<string, unknown>();

  constructor() {
    this.init();
  }

  private async init() {
    this.logger.log('MaPlatformService initialized');
  }

  async initApp(appId: string, initData?: string) {
    const session = {
      id: uuidv4(),
      appId,
      initData,
      createdAt: new Date(),
    };

    this.logger.debug(`App ${appId} initialized with session ${session.id}`);

    return {
      session,
      platform: {
        type: 'aluf-messenger',
        version: '1.0.0',
        capabilities: [
          'websocket',
          'notifications',
          'payments',
          'bot',
          'storage',
          'files',
          'clipboard',
        ],
      },
    };
  }

  async getStorage(key: string, scope: 'user' | 'app' | 'global' = 'app') {
    const storageKey = `${scope}:${key}`;
    return this.storage.get(storageKey) || null;
  }

  async setStorage(
    key: string,
    value: unknown,
    scope: 'user' | 'app' | 'global' = 'app',
  ) {
    const storageKey = `${scope}:${key}`;
    this.storage.set(storageKey, {
      value,
      updatedAt: new Date(),
    });
    return { success: true };
  }

  async sendBotMessage(chatId: string, text: string, parseMode?: string) {
    this.logger.log(`Sending bot message to ${chatId}: ${text}`);
    return {
      messageId: uuidv4(),
      chatId,
      text,
      parseMode,
      sent: true,
    };
  }

  async createInvoice(invoice: {
    title: string;
    description: string;
    amount: number;
    currency: string;
    payload?: string;
  }) {
    const invoiceId = uuidv4();
    this.logger.log(`Creating invoice ${invoiceId} for ${invoice.amount} ${invoice.currency}`);

    return {
      invoiceId,
      url: `https://pay.aluf.app/invoice/${invoiceId}`,
      status: 'pending',
    };
  }
}
