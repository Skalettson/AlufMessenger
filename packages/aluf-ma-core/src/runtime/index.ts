/**
 * Aluf Mini-Apps Runtime
 * Среда выполнения для Mini-Apps с песочницей и плагинами
 */

import { EventEmitter } from 'eventemitter3';
import type { MiniAppConfig, PlatformType, PluginManifest, PluginContext } from '../types/index.js';

// ============================================
// Sandbox Environment
// ============================================

export class Sandbox extends EventEmitter {
  private iframe: HTMLIFrameElement | null = null;
  private isReady = false;
  private messageQueue: unknown[] = [];

  constructor(
    private config: {
      id: string;
      url: string;
      permissions: string[];
      timeout?: number;
    }
  ) {
    super();
  }

  async mount(container: HTMLElement): Promise<void> {
    return new Promise((resolve, reject) => {
      this.iframe = document.createElement('iframe');
      this.iframe.className = 'aluf-ma-sandbox';
      this.iframe.style.width = '100%';
      this.iframe.style.height = '100%';
      this.iframe.style.border = 'none';
      this.iframe.style.flex = '1';
      
      // Sandbox attributes для безопасности
      const sandboxAttrs = [
        'allow-scripts',
        'allow-same-origin',
        'allow-forms',
        'allow-popups',
      ];
      
      if (this.config.permissions.includes('camera')) {
        this.iframe.setAttribute('allow', 'camera');
      }
      if (this.config.permissions.includes('microphone')) {
        this.iframe.setAttribute('allow', 'microphone');
      }
      if (this.config.permissions.includes('geolocation')) {
        this.iframe.setAttribute('allow', 'geolocation');
      }

      this.iframe.setAttribute('sandbox', sandboxAttrs.join(' '));
      this.iframe.src = this.config.url;

      this.iframe.onload = () => {
        this.isReady = true;
        this.flushMessageQueue();
        this.emit('ready');
        resolve();
      };

      this.iframe.onerror = (error: Event | string) => {
        this.emit('error', error);
        reject(error);
      };

      container.appendChild(this.iframe);

      // Слушаем сообщения из песочницы
      window.addEventListener('message', this.handleMessage.bind(this));
    });
  }

  unmount(): void {
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
    this.isReady = false;
  }

  postMessage(message: unknown): void {
    if (!this.isReady || !this.iframe?.contentWindow) {
      this.messageQueue.push(message);
      return;
    }
    this.iframe.contentWindow.postMessage(message, '*');
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      this.postMessage(message);
    }
  }

  private handleMessage(event: MessageEvent): void {
    if (event.source === this.iframe?.contentWindow) {
      this.emit('message', event.data);
    }
  }

  async execute<T>(code: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const requestId = `exec_${Date.now()}_${Math.random()}`;
      
      const timeout = setTimeout(() => {
        reject(new Error('Execution timeout'));
      }, this.config.timeout || 30000);

      const handler = (data: unknown) => {
        if (typeof data === 'object' && data !== null && 'requestId' in data) {
          const response = data as { requestId: string; result?: T; error?: Error };
          if (response.requestId === requestId) {
            clearTimeout(timeout);
            this.off('message', handler);
            
            if (response.error) {
              reject(response.error);
            } else {
              resolve(response.result!);
            }
          }
        }
      };

      this.on('message', handler);
      this.postMessage({ type: 'execute', requestId, code });
    });
  }
}

// ============================================
// Plugin System
// ============================================

export class PluginManager extends EventEmitter {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private pluginContexts: Map<string, PluginContext> = new Map();

  constructor(
    private appId: string,
    private platform: PlatformType
  ) {
    super();
  }

  async register(manifest: PluginManifest, implementation: PluginImplementation): Promise<void> {
    if (this.plugins.has(manifest.id)) {
      throw new Error(`Plugin ${manifest.id} already registered`);
    }

    // Проверка зависимостей
    if (manifest.dependencies) {
      for (const dep of manifest.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(`Missing dependency: ${dep}`);
        }
      }
    }

    const context: PluginContext = {
      appId: this.appId,
      platform: this.platform,
      config: {},
    };

    await implementation.init(context);

    const loadedPlugin: LoadedPlugin = {
      manifest,
      implementation,
      context,
      enabled: true,
    };

    this.plugins.set(manifest.id, loadedPlugin);
    this.pluginContexts.set(manifest.id, context);

    this.emit('plugin:registered', manifest.id);
  }

  async enable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (!plugin.enabled) {
      await plugin.implementation.enable?.(plugin.context);
      plugin.enabled = true;
      this.emit('plugin:enabled', pluginId);
    }
  }

  async disable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (plugin.enabled) {
      await plugin.implementation.disable?.(plugin.context);
      plugin.enabled = false;
      this.emit('plugin:disabled', pluginId);
    }
  }

  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return;
    }

    if (plugin.enabled) {
      await plugin.implementation.destroy(plugin.context);
    }

    this.plugins.delete(pluginId);
    this.pluginContexts.delete(pluginId);
    this.emit('plugin:unregistered', pluginId);
  }

  get<T extends PluginImplementation>(pluginId: string): T | undefined {
    return this.plugins.get(pluginId)?.implementation as T;
  }

  getContext(pluginId: string): PluginContext | undefined {
    return this.pluginContexts.get(pluginId);
  }

  list(): PluginManifest[] {
    return Array.from(this.plugins.values()).map(p => p.manifest);
  }

  async configure(pluginId: string, config: Record<string, unknown>): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    plugin.context.config = config;
    await plugin.implementation.configure?.(plugin.context, config);
  }
}

interface LoadedPlugin {
  manifest: PluginManifest;
  implementation: PluginImplementation;
  context: PluginContext;
  enabled: boolean;
}

export interface PluginImplementation {
  init(context: PluginContext): Promise<void>;
  enable?(context: PluginContext): Promise<void>;
  disable?(context: PluginContext): Promise<void>;
  configure?(context: PluginContext, config: Record<string, unknown>): Promise<void>;
  destroy(context: PluginContext): Promise<void>;
}

// ============================================
// Mini-App Runtime
// ============================================

export class MiniAppRuntime extends EventEmitter {
  private sandbox: Sandbox | null = null;
  private pluginManager: PluginManager;
  private isRunning = false;

  constructor(
    private config: MiniAppConfig & { url: string }
  ) {
    super();
    this.pluginManager = new PluginManager(config.id, 'web');
  }

  async start(container: HTMLElement): Promise<void> {
    if (this.isRunning) {
      throw new Error('Mini-App is already running');
    }

    this.sandbox = new Sandbox({
      id: this.config.id,
      url: this.config.url,
      permissions: this.config.permissions,
    });

    this.sandbox.on('ready', () => {
      this.emit('started');
    });

    this.sandbox.on('error', (error) => {
      this.emit('error', error);
    });

    this.sandbox.on('message', (message) => {
      this.emit('message', message);
    });

    await this.sandbox.mount(container);
    this.isRunning = true;
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.sandbox) {
      return;
    }

    this.sandbox.unmount();
    this.sandbox = null;
    this.isRunning = false;
    this.emit('stopped');
  }

  async registerPlugin(manifest: PluginManifest, implementation: PluginImplementation): Promise<void> {
    await this.pluginManager.register(manifest, implementation);
  }

  getPlugin<T extends PluginImplementation>(pluginId: string): T | undefined {
    return this.pluginManager.get<T>(pluginId);
  }

  get isStarted(): boolean {
    return this.isRunning;
  }

  get plugins(): PluginManifest[] {
    return this.pluginManager.list();
  }
}

// ============================================
// Mini-App Class
// ============================================

export class MiniApp {
  public runtime: MiniAppRuntime;
  private _bridge: unknown = null;

  constructor(
    public config: MiniAppConfig & { url: string }
  ) {
    this.runtime = new MiniAppRuntime(config);
  }

  async mount(container: HTMLElement): Promise<void> {
    await this.runtime.start(container);
  }

  async unmount(): Promise<void> {
    await this.runtime.stop();
  }

  setBridge(bridge: unknown): void {
    this._bridge = bridge;
  }

  getBridge<T>(): T | null {
    return this._bridge as T | null;
  }
}

// ============================================
// Factory functions
// ============================================

export function createMiniApp(config: MiniAppConfig & { url: string }): MiniApp {
  return new MiniApp(config);
}

export function createSandbox(config: {
  id: string;
  url: string;
  permissions: string[];
  timeout?: number;
}): Sandbox {
  return new Sandbox(config);
}

export function createPluginManager(appId: string, platform: PlatformType): PluginManager {
  return new PluginManager(appId, platform);
}
