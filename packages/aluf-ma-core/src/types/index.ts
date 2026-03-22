/**
 * Aluf Mini-Apps Core - Types
 * Основная система типов для платформы Mini-Apps
 */

import { z } from 'zod';

// ============================================
// Базовые типы Mini-App
// ============================================

export interface MiniAppConfig {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  category: MiniAppCategory;
  permissions: Permission[];
  settings?: AppSettings;
}

export type MiniAppCategory =
  | 'games'
  | 'productivity'
  | 'social'
  | 'utilities'
  | 'entertainment'
  | 'education'
  | 'finance'
  | 'shopping'
  | 'health'
  | 'news'
  | 'custom';

export type Permission =
  | 'storage'
  | 'camera'
  | 'microphone'
  | 'location'
  | 'contacts'
  | 'notifications'
  | 'clipboard'
  | 'files'
  | 'media'
  | 'bot'
  | 'payments'
  | 'biometric'
  | 'background';

export interface AppSettings {
  theme?: 'light' | 'dark' | 'auto';
  locale?: string;
  debug?: boolean;
  sandbox?: boolean;
}

// ============================================
// Платформа и окружение
// ============================================

export type PlatformType = 'web' | 'aluf-messenger' | 'mobile' | 'desktop';

export interface PlatformInfo {
  type: PlatformType;
  version: string;
  userAgent: string;
  capabilities: PlatformCapability[];
}

export type PlatformCapability =
  | 'websocket'
  | 'webrtc'
  | 'notifications'
  | 'payments'
  | 'biometric'
  | 'nfc'
  | 'bluetooth'
  | 'camera'
  | 'microphone'
  | 'location'
  | 'contacts'
  | 'files'
  | 'clipboard';

export type ThemeType = 'light' | 'dark' | 'auto';

export interface UserPreferences {
  theme?: ThemeType;
  locale?: string;
  notifications?: boolean;
}

export interface UserContext {
  id: string;
  username?: string;
  displayName: string;
  avatar?: string;
  locale: string;
  timezone: string;
  isPremium: boolean;
  permissions: string[];
  preferences?: UserPreferences;
}

export interface ChatContext {
  id: string;
  type: 'private' | 'group' | 'channel' | 'supergroup';
  title?: string;
  membersCount?: number;
  isAdmin: boolean;
  isOwner: boolean;
}

// ============================================
// Bridge API
// ============================================

export interface BridgeConfig {
  appId: string;
  platform: PlatformType;
  debug?: boolean;
  timeout?: number;
  retryAttempts?: number;
}

export interface BridgeRequest<T = unknown> {
  id: string;
  method: string;
  params?: T;
  timestamp: number;
}

export interface BridgeResponse<T = unknown> {
  id: string;
  result?: T;
  error?: BridgeError;
  timestamp: number;
}

export interface BridgeError {
  code: number;
  message: string;
  details?: unknown;
}

export type BridgeEventHandler = (event: BridgeEvent) => void;

export interface BridgeEvent {
  type: string;
  payload: unknown;
  timestamp: number;
}

// ============================================
// Storage API
// ============================================

export interface StorageOptions {
  scope?: 'user' | 'app' | 'global';
  encrypt?: boolean;
  ttl?: number;
}

export interface StorageEntry {
  key: string;
  value: unknown;
  timestamp: number;
  ttl?: number;
}

// ============================================
// Network API
// ============================================

export interface NetworkRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

export interface NetworkResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  data: T;
  ok: boolean;
}

// ============================================
// UI API
// ============================================

export interface ShowAlertOptions {
  title?: string;
  message: string;
  buttons?: AlertButton[];
}

export interface AlertButton {
  id: string;
  text: string;
  style?: 'default' | 'destructive' | 'success';
}

export interface ShowConfirmOptions extends ShowAlertOptions {
  confirmText?: string;
  cancelText?: string;
}

export interface ShowPopupOptions {
  title?: string;
  message?: string;
  content?: string; // HTML content
  buttons?: PopupButton[];
  closeOnOutsideClick?: boolean;
}

export interface PopupButton extends AlertButton {
  type?: 'button' | 'link' | 'default' | 'ok' | 'cancel';
  url?: string;
}

export interface MainButtonConfig {
  text: string;
  color?: string;
  textColor?: string;
  disabled?: boolean;
  visible?: boolean;
  progress?: boolean;
}

export interface BackButtonConfig {
  visible: boolean;
}

// ============================================
// Bot Integration API - Aluf Messenger
// ============================================

export interface BotConfig {
  token: string;
  platform: 'aluf';
  webhookUrl?: string;
}

export interface BotMessage {
  id: string;
  chatId: string;
  text?: string;
  html?: string;
  markdown?: string;
  entities?: MessageEntity[];
  replyMarkup?: ReplyMarkup;
}

export type MessageEntityType =
  | 'mention'
  | 'hashtag'
  | 'cashtag'
  | 'bot_command'
  | 'url'
  | 'email'
  | 'phone_number'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'spoiler'
  | 'code'
  | 'pre'
  | 'text_link'
  | 'text_mention';

export interface MessageEntity {
  type: MessageEntityType;
  offset: number;
  length: number;
  url?: string;
  user?: UserContext;
}

export type ReplyMarkup = InlineKeyboardMarkup | ReplyKeyboardMarkup | ForceReply;

export interface InlineKeyboardMarkup {
  inlineKeyboard: InlineKeyboardButton[][];
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callbackData?: string;
  switchInlineQuery?: string;
  miniAppUrl?: string;
}

export interface ReplyKeyboardMarkup {
  keyboard: KeyboardButton[][];
  resizeKeyboard?: boolean;
  oneTimeKeyboard?: boolean;
  selective?: boolean;
}

export interface KeyboardButton {
  text: string;
  requestUser?: boolean;
  requestChat?: boolean;
  requestLocation?: boolean;
  requestPoll?: boolean;
}

export interface ForceReply {
  selective?: boolean;
}

// ============================================
// Payments API
// ============================================

export interface PaymentConfig {
  provider: 'stripe' | 'yookassa' | 'cloudpayments' | 'custom';
  currency: string;
}

export interface Invoice {
  title: string;
  description: string;
  amount: number;
  currency: string;
  payload?: string;
  providerToken?: string;
  needName?: boolean;
  needEmail?: boolean;
  needPhone?: boolean;
  needShippingAddress?: boolean;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

// ============================================
// File System API
// ============================================

export interface FilePickerOptions {
  types?: FileType[];
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // in bytes
}

export type FileType = 'image' | 'video' | 'audio' | 'document' | 'any';

export interface FileData {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  blob?: Blob;
  base64?: string;
}

// ============================================
// Analytics API
// ============================================

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp?: number;
}

export interface AnalyticsUserProperties {
  userId?: string;
  displayName?: string;
  email?: string;
  isPremium?: boolean;
}

// ============================================
// Plugin System
// ============================================

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  permissions?: Permission[];
  dependencies?: string[];
  main: string;
}

export interface PluginContext {
  appId: string;
  platform: PlatformType;
  config: Record<string, unknown>;
}

// ============================================
// Schemas для валидации
// ============================================

export const MiniAppConfigSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().max(512).optional(),
  icon: z.string().url().optional(),
  category: z.enum([
    'games', 'productivity', 'social', 'utilities',
    'entertainment', 'education', 'finance', 'shopping',
    'health', 'news', 'custom'
  ]),
  permissions: z.array(z.enum([
    'storage', 'camera', 'microphone', 'location',
    'contacts', 'notifications', 'clipboard', 'files',
    'media', 'bot', 'payments', 'biometric', 'background'
  ])),
  settings: z.object({
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    locale: z.string().optional(),
    debug: z.boolean().optional(),
    sandbox: z.boolean().optional(),
  }).optional(),
});

export const BridgeConfigSchema = z.object({
  appId: z.string().min(1),
  platform: z.enum(['web', 'telegram', 'discord', 'whatsapp', 'aluf-messenger', 'mobile', 'desktop']),
  debug: z.boolean().optional(),
  timeout: z.number().min(1000).max(60000).optional(),
  retryAttempts: z.number().min(0).max(10).optional(),
});

// ============================================
// Type helpers
// ============================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type AsyncFunction<T = unknown, A = unknown> = (args: A) => Promise<T>;

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;
