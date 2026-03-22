/**
 * Aluf Mini-Apps SDK
 * Основной SDK для разработки Mini-Apps
 */

import {
  AlufBridge,
  createBridge,
  MiniApp,
  createMiniApp as createCoreMiniApp,
  type BridgeConfig,
  type PlatformInfo,
  type UserContext,
  type ChatContext,
} from '@aluf/ma-core';

// ============================================
// AlufApp - основной класс приложения
// ============================================

export interface AlufAppConfig {
  id: string;
  name: string;
  version?: string;
  debug?: boolean;
}

export class AlufApp {
  public bridge: AlufBridge;
  public miniApp: MiniApp;
  public ready = false;

  private _platform: PlatformInfo | null = null;
  private _user: UserContext | null = null;
  private _chat: ChatContext | null = null;

  constructor(config: AlufAppConfig) {
    const bridgeConfig: BridgeConfig = {
      appId: config.id,
      platform: 'aluf-messenger',
      debug: config.debug,
    };

    this.bridge = createBridge(bridgeConfig);
    
    this.miniApp = createCoreMiniApp({
      id: config.id,
      name: config.name,
      version: config.version || '1.0.0',
      category: 'custom',
      permissions: [],
      url: window.location.href,
    });

    this.init();
  }

  private async init() {
    // Ждём готовности моста
    await new Promise<void>((resolve) => {
      this.bridge.on('ready', () => {
        this._platform = this.bridge.platformInfo;
        this._user = this.bridge.user;
        this._chat = this.bridge.chat;
        this.ready = true;
        resolve();
      });
    });

    // Устанавливаем мост в miniApp
    this.miniApp.setBridge(this.bridge);
  }

  // Геттеры
  get platform(): PlatformInfo | null {
    return this._platform;
  }

  get user(): UserContext | null {
    return this._user;
  }

  get chat(): ChatContext | null {
    return this._chat;
  }

  get theme(): 'light' | 'dark' | 'auto' {
    return this._user?.preferences?.theme || 'auto';
  }

  get locale(): string {
    return this._user?.locale || 'en';
  }

  // Методы
  async readyAsync(): Promise<this> {
    if (this.ready) return this;
    
    return new Promise<this>((resolve) => {
      this.bridge.on('ready', () => {
        resolve(this);
      });
    });
  }

  onClose(handler: () => void) {
    this.bridge.ui.onBackButtonClick(handler);
  }

  onMainButtonClick(handler: () => void) {
    this.bridge.ui.onMainButtonClick(handler);
  }
}

// ============================================
// Factory functions
// ============================================

export function createApp(config: AlufAppConfig): AlufApp {
  return new AlufApp(config);
}

export function initApp(config: AlufAppConfig): Promise<AlufApp> {
  const app = createApp(config);
  return app.readyAsync();
}

// ============================================
// Utility functions
// ============================================

export function isAlufMessenger(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.navigator.userAgent.includes('AlufMessenger') ||
    window.navigator.userAgent.includes('AlufMiniApp')
  );
}

export function getPlatform(): PlatformInfo | null {
  if (typeof window === 'undefined') return null;
  
  const isAluf = isAlufMessenger();
  if (!isAluf) return null;

  const match = window.navigator.userAgent.match(/AlufMessenger\/([\d.]+)/);
  
  return {
    type: 'aluf-messenger',
    version: match?.[1] || 'unknown',
    userAgent: window.navigator.userAgent,
    capabilities: [],
  };
}

export function getUser(): UserContext | null {
  // Получаем из initData
  const initData = new URLSearchParams(window.location.search).get('alufWebAppData');
  if (!initData) return null;

  try {
    const data = JSON.parse(decodeURIComponent(initData));
    return data.user || null;
  } catch {
    return null;
  }
}

// ============================================
// Экспорты для совместимости
// ============================================

export type { AlufBridge as Bridge } from '@aluf/ma-core';
export type { MiniApp as App } from '@aluf/ma-core';
