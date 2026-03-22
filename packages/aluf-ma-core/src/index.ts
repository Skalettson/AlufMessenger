/**
 * Aluf Mini-Apps Core
 * 
 * Ядро платформы Aluf Mini-Apps - мощнее и быстрее Telegram Mini-Apps
 * 
 * @package @aluf/ma-core
 * @version 1.0.0
 */

// ============================================
// Types
// ============================================
export * from './types/index.js';

// ============================================
// Bridge
// ============================================
export { AlufBridge, createBridge } from './bridge/index.js';
export type { AlufBridge as IMiniAppBridge, AlufBotInitData, AlufBotMessage, AlufCallbackQuery } from './bridge/index.js';

// ============================================
// Runtime
// ============================================
export {
  Sandbox,
  PluginManager,
  MiniAppRuntime,
  MiniApp,
  createMiniApp,
  createSandbox,
  createPluginManager,
} from './runtime/index.js';

export type { PluginImplementation } from './runtime/index.js';

// ============================================
// Version
// ============================================
export const VERSION = '1.0.0';
export const PLATFORM_NAME = 'Aluf Mini-Apps';

// ============================================
// Utility functions
// ============================================

/**
 * Проверка, запущено ли приложение внутри Aluf Messenger
 */
export function isAlufMessenger(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.navigator.userAgent.includes('AlufMessenger');
}

/**
 * Проверка, запущено ли приложение как Mini-App
 */
export function isMiniApp(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.navigator.userAgent.includes('AlufMiniApp');
}

/**
 * Получить версию платформы
 */
export function getPlatformVersion(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.navigator.userAgent.match(/AlufMessenger\/([\d.]+)/);
  return match?.[1] ?? null;
}

/**
 * Ждать готовности платформы
 */
export function waitForReady(timeout = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isMiniApp()) {
      const timer = setTimeout(() => {
        reject(new Error('Ready timeout'));
      }, timeout);

      window.addEventListener('aluf-ready', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    } else {
      resolve();
    }
  });
}
