import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlufApp, createApp, initApp } from '../index.js';

describe('AlufApp', () => {
  let app: AlufApp;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('creation', () => {
    it('should create app with correct config', () => {
      app = createApp({
        id: 'test-app',
        name: 'Test App',
        debug: true,
      });

      expect(app).toBeDefined();
      expect(app.bridge).toBeDefined();
      expect(app.miniApp).toBeDefined();
    });

    it('should not be ready initially', () => {
      app = createApp({ id: 'test', name: 'Test' });
      expect(app.ready).toBe(false);
    });
  });

  describe('initialization', () => {
    it('should initialize with initApp', async () => {
      // Mock the bridge ready event
      const initializedApp = await initApp({
        id: 'test-app',
        name: 'Test App',
      });

      expect(initializedApp).toBeDefined();
    });
  });

  describe('utility functions', () => {
    it('isAlufMessenger should return boolean', () => {
      const result = isAlufMessenger();
      expect(typeof result).toBe('boolean');
    });

    it('getPlatform should return platform info or null', () => {
      const platform = getPlatform();
      // В тестовой среде должен вернуть null
      expect(platform).toBeNull();
    });
  });
});

import { isAlufMessenger, getPlatform } from '../index.js';
