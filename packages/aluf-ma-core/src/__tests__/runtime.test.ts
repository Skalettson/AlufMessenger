import { describe, it, expect, beforeEach } from 'vitest';
import { MiniApp, createMiniApp } from '../runtime/index.js';
import type { MiniAppConfig } from '../types/index.js';

describe('MiniApp', () => {
  let app: MiniApp;

  const config: MiniAppConfig & { url: string } = {
    id: 'test-app',
    name: 'Test App',
    version: '1.0.0',
    category: 'custom',
    permissions: ['storage'],
    url: 'http://localhost:3000',
  };

  beforeEach(() => {
    app = createMiniApp(config);
  });

  describe('initialization', () => {
    it('should create MiniApp with correct config', () => {
      expect(app).toBeDefined();
      expect(app.config.id).toBe('test-app');
      expect(app.config.name).toBe('Test App');
    });

    it('should have runtime', () => {
      expect(app.runtime).toBeDefined();
    });

    it('should not be started initially', () => {
      expect(app.runtime.isStarted).toBe(false);
    });
  });

  describe('lifecycle', () => {
    it('should start and stop', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      await app.runtime.start(container);
      expect(app.runtime.isStarted).toBe(true);

      await app.runtime.stop();
      expect(app.runtime.isStarted).toBe(false);

      document.body.removeChild(container);
    });
  });

  describe('plugins', () => {
    it('should list empty plugins', () => {
      expect(app.plugins).toEqual([]);
    });
  });
});
