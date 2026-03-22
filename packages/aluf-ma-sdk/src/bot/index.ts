/**
 * Aluf Mini-Apps SDK - Bot Integration
 * Глубокая интеграция с ботами Aluf Messenger
 */

import { AlufBridge, createBridge } from '@aluf/ma-core';
import type {
  AlufBotInitData,
  AlufBotMessage,
  AlufCallbackQuery,
} from '@aluf/ma-core';

// ============================================
// BotIntegration Class
// ============================================

export interface BotIntegrationConfig {
  botId?: string;
  debug?: boolean;
}

export class BotIntegration {
  private bridge: AlufBridge | null = null;
  private config: Required<BotIntegrationConfig>;
  private eventHandlers: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  constructor(config: BotIntegrationConfig = {}) {
    this.config = {
      botId: config.botId || '',
      debug: config.debug || false,
    };

    this.init();
  }

  private async init() {
    try {
      // Инициализация моста
      this.bridge = createBridge({
        appId: this.config.botId || 'bot-integration',
        platform: 'aluf-messenger',
        debug: this.config.debug,
      });

      // Подписываемся на события бота
      this.bridge.on('bot.message', this.handleMessage.bind(this));
      this.bridge.on('bot.callbackQuery', this.handleCallbackQuery.bind(this));
      this.bridge.on('bot.inlineQuery', this.handleInlineQuery.bind(this));

      if (this.config.debug) {
        console.log('[BotIntegration] Initialized');
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('[BotIntegration] Init error:', error);
      }
    }
  }

  // ============================================
  // Отправка сообщений
  // ============================================

  async sendMessage(
    chatId: string,
    text: string,
    options?: SendMessageOptions
  ): Promise<{ messageId: string }> {
    if (!this.bridge) {
      throw new Error('Bridge not initialized');
    }

    return this.bridge.bot.sendMessage(chatId, text, options);
  }

  async editMessage(
    chatId: string,
    messageId: string,
    text: string
  ): Promise<void> {
    if (!this.bridge) {
      throw new Error('Bridge not initialized');
    }

    await this.bridge.bot.editMessage(chatId, messageId, text);
  }

  async deleteMessage(chatId: string, messageId: string): Promise<void> {
    if (!this.bridge) {
      throw new Error('Bridge not initialized');
    }

    await this.bridge.bot.deleteMessage(chatId, messageId);
  }

  async sendPhoto(
    chatId: string,
    photo: string | File,
    caption?: string
  ): Promise<{ messageId: string }> {
    if (!this.bridge) {
      throw new Error('Bridge not initialized');
    }

    return this.bridge.request('bot.sendPhoto', {
      chatId,
      photo,
      caption,
    });
  }

  async sendDocument(
    chatId: string,
    document: string | File,
    caption?: string
  ): Promise<{ messageId: string }> {
    if (!this.bridge) {
      throw new Error('Bridge not initialized');
    }

    return this.bridge.request('bot.sendDocument', {
      chatId,
      document,
      caption,
    });
  }

  // ============================================
  // Callback Queries
  // ============================================

  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
    options?: AnswerCallbackQueryOptions
  ): Promise<void> {
    if (!this.bridge) {
      throw new Error('Bridge not initialized');
    }

    await this.bridge.bot.answerCallbackQuery(callbackQueryId, text, options);
  }

  // ============================================
  // Webhook Integration
  // ============================================

  async sendToBot(data: unknown): Promise<{ success: boolean; response?: unknown }> {
    if (!this.bridge) {
      throw new Error('Bridge not initialized');
    }

    return this.bridge.bot.sendToBot(data);
  }

  async requestFromBot<T>(action: string, params?: unknown): Promise<T> {
    if (!this.bridge) {
      throw new Error('Bridge not initialized');
    }

    return this.bridge.bot.requestFromBot(action, params);
  }

  // ============================================
  // Init Data
  // ============================================

  getInitData(): AlufBotInitData | null {
    if (!this.bridge) {
      return this.parseInitDataFromUrl();
    }

    return this.bridge.bot.getInitData();
  }

  private parseInitDataFromUrl(): AlufBotInitData | null {
    const initData = new URLSearchParams(window.location.search).get('alufWebAppData');
    if (!initData) return null;

    try {
      return JSON.parse(decodeURIComponent(initData));
    } catch {
      return null;
    }
  }

  getUserFromInitData() {
    const initData = this.getInitData();
    return initData?.user || null;
  }

  getChatFromInitData() {
    const initData = this.getInitData();
    return initData?.chat || null;
  }

  // ============================================
  // Event Handlers
  // ============================================

  on(event: 'message', handler: (message: AlufBotMessage) => void): () => void;
  on(event: 'callbackQuery', handler: (query: AlufCallbackQuery) => void): () => void;
  on(event: 'inlineQuery', handler: (query: unknown) => void): () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, handler: (...args: any[]) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  private handleMessage(message: AlufBotMessage) {
    this.eventHandlers.get('message')?.forEach((handler) => {
      handler(message);
    });
  }

  private handleCallbackQuery(query: AlufCallbackQuery) {
    this.eventHandlers.get('callbackQuery')?.forEach((handler) => {
      handler(query);
    });
  }

  private handleInlineQuery(query: unknown) {
    this.eventHandlers.get('inlineQuery')?.forEach((handler) => {
      handler(query);
    });
  }

  // ============================================
  // Utils
  // ============================================

  isConnected(): boolean {
    return this.bridge?.isConnected ?? false;
  }

  async close(): Promise<void> {
    if (this.bridge) {
      await this.bridge.request('ui.close');
    }
  }

  async expand(): Promise<void> {
    if (this.bridge) {
      await this.bridge.ui.expand();
    }
  }
}

// ============================================
// Types
// ============================================

interface SendMessageOptions {
  parseMode?: 'markdown' | 'html' | 'plain';
  replyMarkup?: unknown;
  entities?: unknown[];
  linkPreviewOptions?: {
    isDisabled?: boolean;
    url?: string;
  };
}

interface AnswerCallbackQueryOptions {
  showAlert?: boolean;
  cacheTime?: number;
}

// ============================================
// Factory function
// ============================================

export function createBotIntegration(config?: BotIntegrationConfig): BotIntegration {
  return new BotIntegration(config);
}

// ============================================
// React Hook
// ============================================

export function useBotIntegration(config?: BotIntegrationConfig) {
  const [integration] = useState(() => new BotIntegration(config));
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    setIsConnected(integration.isConnected());

    const checkConnection = setInterval(() => {
      setIsConnected(integration.isConnected());
    }, 1000);

    return () => clearInterval(checkConnection);
  }, [integration]);

  return {
    integration,
    isConnected,
    initData: integration.getInitData(),
    user: integration.getUserFromInitData(),
    chat: integration.getChatFromInitData(),
  };
}

// Для React нужно импортировать useState и useEffect
import { useState, useEffect } from 'react';
