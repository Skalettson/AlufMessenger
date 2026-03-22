import { Injectable, Logger } from '@nestjs/common';

interface StorageEntry {
  key: string;
  value: unknown;
  scope: 'user' | 'app' | 'global';
  userId?: string;
  appId: string;
  createdAt: Date;
  updatedAt: Date;
  ttl?: number;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storage = new Map<string, StorageEntry>();

  async get(
    key: string,
    appId: string,
    scope: 'user' | 'app' | 'global' = 'app',
    userId?: string,
  ): Promise<unknown> {
    const storageKey = this.makeKey(key, appId, scope, userId);
    const entry = this.storage.get(storageKey);

    if (!entry) {
      return null;
    }

    // Проверка TTL
    if (entry.ttl && Date.now() > entry.createdAt.getTime() + entry.ttl) {
      await this.remove(key, appId, scope, userId);
      return null;
    }

    return entry.value;
  }

  async set(
    key: string,
    value: unknown,
    appId: string,
    scope: 'user' | 'app' | 'global' = 'app',
    userId?: string,
    options?: { ttl?: number; encrypt?: boolean },
  ): Promise<void> {
    const storageKey = this.makeKey(key, appId, scope, userId);
    const now = new Date();

    const entry: StorageEntry = {
      key,
      value,
      scope,
      userId,
      appId,
      createdAt: now,
      updatedAt: now,
      ttl: options?.ttl,
    };

    this.storage.set(storageKey, entry);
    this.logger.debug(`Storage set: ${storageKey}`);
  }

  async remove(
    key: string,
    appId: string,
    scope: 'user' | 'app' | 'global' = 'app',
    userId?: string,
  ): Promise<boolean> {
    const storageKey = this.makeKey(key, appId, scope, userId);
    const deleted = this.storage.delete(storageKey);
    this.logger.debug(`Storage remove: ${storageKey}`);
    return deleted;
  }

  async keys(
    appId: string,
    scope: 'user' | 'app' | 'global' = 'app',
    userId?: string,
    pattern?: string,
  ): Promise<string[]> {
    const prefix = `${scope}:${appId}${userId ? `:${userId}` : ''}:`;
    const keys: string[] = [];

    for (const [key] of this.storage.entries()) {
      if (key.startsWith(prefix)) {
        const actualKey = key.replace(prefix, '');
        if (!pattern || actualKey.includes(pattern)) {
          keys.push(actualKey);
        }
      }
    }

    return keys;
  }

  async clear(
    appId: string,
    scope: 'user' | 'app' | 'global' = 'app',
    userId?: string,
  ): Promise<number> {
    const prefix = `${scope}:${appId}${userId ? `:${userId}` : ''}:`;
    let count = 0;

    for (const key of this.storage.keys()) {
      if (key.startsWith(prefix)) {
        this.storage.delete(key);
        count++;
      }
    }

    this.logger.debug(`Storage clear: ${count} keys removed`);
    return count;
  }

  private makeKey(
    key: string,
    appId: string,
    scope: 'user' | 'app' | 'global',
    userId?: string,
  ): string {
    return `${scope}:${appId}${userId ? `:${userId}` : ''}:${key}`;
  }
}
