import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlufBridge, createBridge } from '../bridge/index.js';
import type { BridgeConfig } from '../types/index.js';

describe('AlufBridge', () => {
  let bridge: AlufBridge;

  const config: BridgeConfig = {
    appId: 'test-app',
    platform: 'aluf-messenger',
    debug: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    bridge = createBridge(config);
  });

  describe('initialization', () => {
    it('should create bridge with correct config', () => {
      expect(bridge).toBeDefined();
      expect(bridge.isConnected).toBeDefined();
    });

    it('should have storage API', () => {
      expect(bridge.storage).toBeDefined();
      expect(typeof bridge.storage.get).toBe('function');
      expect(typeof bridge.storage.set).toBe('function');
    });

    it('should have UI API', () => {
      expect(bridge.ui).toBeDefined();
      expect(typeof bridge.ui.showAlert).toBe('function');
      expect(typeof bridge.ui.setMainButton).toBe('function');
    });

    it('should have Bot API', () => {
      expect(bridge.bot).toBeDefined();
      expect(typeof bridge.bot.sendMessage).toBe('function');
      expect(typeof bridge.bot.getInitData).toBe('function');
    });
  });

  describe('storage API', () => {
    it('should get null for non-existent key', async () => {
      // Mock request
      bridge.request = vi.fn().mockResolvedValue(null);
      
      const result = await bridge.storage.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should set value', async () => {
      bridge.request = vi.fn().mockResolvedValue(undefined);
      
      await expect(
        bridge.storage.set('key', { data: 'value' })
      ).resolves.toBeUndefined();
    });

    it('should remove key', async () => {
      bridge.request = vi.fn().mockResolvedValue(undefined);
      
      await expect(bridge.storage.remove('key')).resolves.toBeUndefined();
    });
  });

  describe('event handling', () => {
    it('should subscribe to events', () => {
      const handler = vi.fn();
      const unsubscribe = bridge.onEvent('test', handler);
      
      expect(typeof unsubscribe).toBe('function');
    });

    it('should emit ready event', (done) => {
      bridge.on('ready', () => {
        done();
      });
    });
  });

  describe('Bot API', () => {
    it('should return null for missing initData', () => {
      // Mock window.location.search
      const originalSearch = window.location.search;
      Object.defineProperty(window, 'location', {
        value: { search: '' },
        writable: true,
      });

      const initData = bridge.bot.getInitData();
      expect(initData).toBeNull();

      // Restore
      Object.defineProperty(window, 'location', {
        value: { search: originalSearch },
        writable: true,
      });
    });
  });
});
