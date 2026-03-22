/**
 * Aluf Mini-Apps Bridge
 * Мост для связи Mini-App с платформой
 * Превосходит Telegram WebApp API по всем параметрам
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import type {
  BridgeConfig,
  BridgeRequest,
  BridgeResponse,
  BridgeEvent,
  UserContext,
  ChatContext,
  PlatformInfo,
  MainButtonConfig,
  BackButtonConfig,
  ShowAlertOptions,
  ShowConfirmOptions,
  ShowPopupOptions,
  StorageOptions,
  NetworkRequest,
  NetworkResponse,
  Invoice,
  PaymentResult,
  FilePickerOptions,
  FileData,
  AnalyticsEvent,
  Nullable,
} from '../types/index.js';

// ============================================
// Transport Layer
// ============================================

type TransportType = 'postMessage' | 'websocket' | 'grpc' | 'http';

interface TransportMessage {
  type: 'request' | 'response' | 'event';
  data: unknown;
}

class Transport extends EventEmitter {
  private type: TransportType;
  public connected = false;
  private queue: TransportMessage[] = [];

  constructor(type: TransportType = 'postMessage') {
    super();
    this.type = type;
    this.init();
  }

  private init() {
    if (this.type === 'postMessage') {
      this.initPostMessage();
    } else if (this.type === 'websocket') {
      this.initWebSocket();
    }
  }

  private initPostMessage() {
    window.addEventListener('message', (event) => {
      const message = event.data as TransportMessage;
      if (message?.type) {
        this.emit('message', message);
      }
    });
    this.connected = true;
    this.flushQueue();
  }

  private initWebSocket() {
    // WebSocket реализация для продвинутых сценариев
    this.connected = true;
  }

  send(message: TransportMessage) {
    if (!this.connected) {
      this.queue.push(message);
      return;
    }

    if (this.type === 'postMessage' && window.parent) {
      window.parent.postMessage(message, '*');
    }
  }

  private flushQueue() {
    while (this.queue.length > 0) {
      const message = this.queue.shift()!;
      this.send(message);
    }
  }

  connect() {
    this.connected = true;
    this.flushQueue();
  }

  disconnect() {
    this.connected = false;
  }
}

// ============================================
// Bridge API Implementation
// ============================================

export class AlufBridge extends EventEmitter {
  private config: Required<BridgeConfig>;
  public readonly transport: Transport;
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  // Контексты
  private _platformInfo: Nullable<PlatformInfo> = null;
  private _user: Nullable<UserContext> = null;
  private _chat: Nullable<ChatContext> = null;

  // Компоненты API
  public readonly storage: StorageAPI;
  public readonly network: NetworkAPI;
  public readonly ui: UIAPI;
  public readonly bot: BotAPI;
  public readonly payments: PaymentsAPI;
  public readonly files: FilesAPI;
  public readonly analytics: AnalyticsAPI;
  public readonly utils: UtilsAPI;

  constructor(config: BridgeConfig) {
    super();
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      debug: false,
      ...config,
    };

    this.transport = new Transport('postMessage');
    this.transport.on('message', this.handleMessage.bind(this));

    // Инициализация API компонентов
    this.storage = new StorageAPI(this);
    this.network = new NetworkAPI(this);
    this.ui = new UIAPI(this);
    this.bot = new BotAPI(this);
    this.payments = new PaymentsAPI(this);
    this.files = new FilesAPI(this);
    this.analytics = new AnalyticsAPI(this);
    this.utils = new UtilsAPI(this);

    this.init();
  }

  private async init() {
    try {
      // Получение информации о платформе
      this._platformInfo = await this.request<PlatformInfo>('platform.getInfo');
      
      // Получение информации о пользователе
      this._user = await this.request<UserContext>('user.getInfo');
      
      // Получение информации о чате (если есть)
      try {
        this._chat = await this.request<ChatContext>('chat.getInfo');
      } catch {
        // Чат не обязателен
      }

      this.emit('ready', {
        platform: this._platformInfo,
        user: this._user,
        chat: this._chat,
      });
    } catch (error) {
      if (this.config.debug) {
        console.error('[AlufBridge] Init error:', error);
      }
      this.emit('error', error);
    }
  }

  private handleMessage(message: TransportMessage) {
    if (message.type === 'response') {
      const response = message.data as BridgeResponse;
      const pending = this.pendingRequests.get(response.id);
      
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.id);

        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
      }
    } else if (message.type === 'event') {
      const event = message.data as BridgeEvent;
      this.emit(event.type, event.payload);
    }
  }

  public async request<T>(method: string, params?: unknown): Promise<T> {
    const id = uuidv4();
    
    return new Promise<T>((resolve, reject) => {
      const request: BridgeRequest = {
        id,
        method,
        params,
        timestamp: Date.now(),
      };

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.config.timeout);

      this.pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout });

      this.transport.send({
        type: 'request',
        data: request,
      });

      if (this.config.debug) {
        console.log('[AlufBridge] Request:', request);
      }
    });
  }

  public onEvent<T>(event: string, handler: (payload: T) => void) {
    this.on(event, handler);
    return () => this.off(event, handler);
  }

  // Геттеры
  get platformInfo(): Nullable<PlatformInfo> {
    return this._platformInfo;
  }

  get user(): Nullable<UserContext> {
    return this._user;
  }

  get chat(): Nullable<ChatContext> {
    return this._chat;
  }

  get isConnected(): boolean {
    return this.transport.connected;
  }
}

// ============================================
// Storage API
// ============================================

class StorageAPI {
  constructor(private bridge: AlufBridge) {}

  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    return this.bridge.request('storage.get', { key, options });
  }

  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    await this.bridge.request('storage.set', { key, value, options });
  }

  async remove(key: string, options?: StorageOptions): Promise<void> {
    await this.bridge.request('storage.remove', { key, options });
  }

  async keys(pattern?: string, options?: StorageOptions): Promise<string[]> {
    return this.bridge.request('storage.keys', { pattern, options });
  }

  async clear(options?: StorageOptions): Promise<void> {
    await this.bridge.request('storage.clear', { options });
  }
}

// ============================================
// Network API
// ============================================

class NetworkAPI {
  constructor(private bridge: AlufBridge) {}

  async fetch<T>(request: NetworkRequest): Promise<NetworkResponse<T>> {
    return this.bridge.request('network.fetch', request);
  }

  async get<T>(url: string, headers?: Record<string, string>): Promise<NetworkResponse<T>> {
    return this.fetch({ url, method: 'GET', headers });
  }

  async post<T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<NetworkResponse<T>> {
    return this.fetch({ url, method: 'POST', body, headers });
  }

  async put<T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<NetworkResponse<T>> {
    return this.fetch({ url, method: 'PUT', body, headers });
  }

  async delete<T>(url: string, headers?: Record<string, string>): Promise<NetworkResponse<T>> {
    return this.fetch({ url, method: 'DELETE', headers });
  }
}

// ============================================
// UI API
// ============================================

class UIAPI {
  constructor(private bridge: AlufBridge) {}

  async showAlert(options: ShowAlertOptions): Promise<string> {
    const result = await this.bridge.request('ui.showAlert', options);
    return (result as { buttonId: string }).buttonId;
  }

  async showConfirm(options: ShowConfirmOptions): Promise<boolean> {
    const result = await this.bridge.request('ui.showConfirm', options);
    return (result as { confirmed: boolean }).confirmed;
  }

  async showPopup(options: ShowPopupOptions): Promise<string> {
    const result = await this.bridge.request('ui.showPopup', options);
    return (result as { buttonId: string }).buttonId;
  }

  setMainButton(config: MainButtonConfig) {
    this.bridge.transport.send({
      type: 'request',
      data: { method: 'ui.setMainButton', params: config },
    });
  }

  hideMainButton() {
    this.setMainButton({ text: '', visible: false });
  }

  setBackButton(config: BackButtonConfig) {
    this.bridge.transport.send({
      type: 'request',
      data: { method: 'ui.setBackButton', params: config },
    });
  }

  hideBackButton() {
    this.setBackButton({ visible: false });
  }

  async expand() {
    await this.bridge.request('ui.expand');
  }

  async close() {
    await this.bridge.request('ui.close');
  }

  onMainButtonClick(handler: () => void) {
    return this.bridge.onEvent('mainButton.click', handler);
  }

  onBackButtonClick(handler: () => void) {
    return this.bridge.onEvent('backButton.click', handler);
  }
}

// ============================================
// Bot API - Aluf Messenger Integration
// ============================================

/**
 * BotAPI - Интеграция с ботами Aluf Messenger
 * 
 * Возможности:
 * - Глубокая связь Mini-App ↔ Бот
 * - Бот как backend для Mini-App
 * - Webhook-интеграция
 * - Inline-режим
 * - Callback queries
 */
class BotAPI {
  constructor(private bridge: AlufBridge) {}

  /**
   * Отправить сообщение через бота
   */
  async sendMessage(chatId: string, text: string, options?: BotMessageOptions): Promise<{ messageId: string }> {
    return this.bridge.request('bot.sendMessage', { chatId, text, ...options });
  }

  /**
   * Редактировать сообщение
   */
  async editMessage(chatId: string, messageId: string, text: string): Promise<void> {
    await this.bridge.request('bot.editMessage', { chatId, messageId, text });
  }

  /**
   * Удалить сообщение
   */
  async deleteMessage(chatId: string, messageId: string): Promise<void> {
    await this.bridge.request('bot.deleteMessage', { chatId, messageId });
  }

  /**
   * Ответить на callback query
   */
  async answerCallbackQuery(callbackQueryId: string, text?: string, options?: CallbackQueryOptions): Promise<void> {
    await this.bridge.request('bot.answerCallbackQuery', { callbackQueryId, text, ...options });
  }

  /**
   * Получить данные инициализации от бота Aluf Messenger
   * Содержит информацию о пользователе, чате, и данные для авторизации
   */
  getInitData(): AlufBotInitData | null {
    const initData = new URLSearchParams(window.location.search).get('alufWebAppData');
    if (!initData) return null;
    
    try {
      return JSON.parse(decodeURIComponent(initData));
    } catch {
      return null;
    }
  }

  /**
   * Отправить данные боту (webhook)
   */
  async sendToBot(data: unknown): Promise<{ success: boolean; response?: unknown }> {
    return this.bridge.request('bot.sendToBot', { data });
  }

  /**
   * Запросить данные от бота
   */
  async requestFromBot<T>(action: string, params?: unknown): Promise<T> {
    return this.bridge.request('bot.request', { action, params });
  }

  /**
   * Подписаться на события от бота
   */
  onBotEvent<T>(eventType: string, handler: (data: T) => void) {
    return this.bridge.onEvent(`bot.${eventType}`, handler);
  }

  /**
   * Событие: новое сообщение от бота
   */
  onMessage(handler: (message: AlufBotMessage) => void) {
    return this.onBotEvent('message', handler);
  }

  /**
   * Событие: callback query
   */
  onCallbackQuery(handler: (query: AlufCallbackQuery) => void) {
    return this.onBotEvent('callbackQuery', handler);
  }
}

interface BotMessageOptions {
  parseMode?: 'markdown' | 'html' | 'plain';
  replyMarkup?: unknown;
  entities?: unknown[];
}

interface CallbackQueryOptions {
  showAlert?: boolean;
  cacheTime?: number;
}

export interface AlufBotInitData {
  user: {
    id: string;
    username?: string;
    displayName: string;
    avatar?: string;
  };
  chat?: {
    id: string;
    type: 'private' | 'group' | 'channel';
    title?: string;
  };
  auth: {
    hash: string;
    timestamp: number;
  };
  raw?: string;
}

export interface AlufBotMessage {
  id: string;
  chatId: string;
  text?: string;
  from: {
    id: string;
    isBot: boolean;
  };
  date: number;
}

export interface AlufCallbackQuery {
  id: string;
  from: {
    id: string;
  };
  data: string;
  messageId?: string;
}

// ============================================
// Payments API
// ============================================

class PaymentsAPI {
  constructor(private bridge: AlufBridge) {}

  async createInvoice(invoice: Invoice): Promise<{ invoiceId: string; url: string }> {
    return this.bridge.request('payments.createInvoice', invoice);
  }

  async payInvoice(invoiceId: string): Promise<PaymentResult> {
    return this.bridge.request('payments.payInvoice', { invoiceId });
  }

  async getPaymentStatus(paymentId: string): Promise<{ status: string; details?: unknown }> {
    return this.bridge.request('payments.getStatus', { paymentId });
  }

  onPaymentSuccess(handler: (paymentId: string) => void) {
    return this.bridge.onEvent('payments.success', handler);
  }

  onPaymentFailed(handler: (error: string) => void) {
    return this.bridge.onEvent('payments.failed', handler);
  }
}

// ============================================
// Files API
// ============================================

class FilesAPI {
  constructor(private bridge: AlufBridge) {}

  async pickFiles(options?: FilePickerOptions): Promise<FileData[]> {
    return this.bridge.request('files.pick', options);
  }

  async upload(file: FileData | File): Promise<{ fileId: string; url: string }> {
    return this.bridge.request('files.upload', { file });
  }

  async download(fileId: string): Promise<FileData> {
    return this.bridge.request('files.download', { fileId });
  }

  async delete(fileId: string): Promise<void> {
    await this.bridge.request('files.delete', { fileId });
  }
}

// ============================================
// Analytics API
// ============================================

class AnalyticsAPI {
  constructor(private bridge: AlufBridge) {}

  track(event: AnalyticsEvent) {
    this.bridge.transport.send({
      type: 'request',
      data: { method: 'analytics.track', params: event },
    });
  }

  setUserProperties(properties: Record<string, unknown>) {
    this.bridge.transport.send({
      type: 'request',
      data: { method: 'analytics.setUserProperties', params: properties },
    });
  }

  logEvent(name: string, properties?: Record<string, unknown>) {
    this.track({ name, properties, timestamp: Date.now() });
  }
}

// ============================================
// Utils API
// ============================================

class UtilsAPI {
  constructor(private bridge: AlufBridge) {}

  async hapticFeedback(type: 'impact' | 'notification' | 'selection', style?: string) {
    await this.bridge.request('utils.hapticFeedback', { type, style });
  }

  async clipboardWrite(text: string): Promise<void> {
    await this.bridge.request('utils.clipboard.write', { text });
  }

  async clipboardRead(): Promise<string> {
    return this.bridge.request('utils.clipboard.read');
  }

  async share(content: { text?: string; url?: string; files?: string[] }): Promise<void> {
    await this.bridge.request('utils.share', content);
  }

  async openLink(url: string, options?: { external?: boolean }) {
    await this.bridge.request('utils.openLink', { url, ...options });
  }

  getTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  getLocale(): string {
    return navigator.language;
  }
}

// ============================================
// Factory function
// ============================================

export function createBridge(config: BridgeConfig): AlufBridge {
  return new AlufBridge(config);
}

// ============================================
// Экспорт для совместимости
// ============================================

export { AlufBridge as MiniAppBridge };
export type { AlufBridge as IMiniAppBridge };
