import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { StringCodec } from 'nats';
import { REDIS_TOKEN } from '../providers/redis.provider';
import { NATS_TOKEN, type NatsClients } from '../providers/nats.provider';
import { NATS_SUBJECTS, PRESENCE_HEARTBEAT_INTERVAL_MS, PRESENCE_OFFLINE_THRESHOLD_MS } from '@aluf/shared';
import { ConnectionManager } from './connection-manager';
import type Redis from 'ioredis';

const PRESENCE_KEY_PREFIX = 'presence:';
const LAST_SEEN_KEY_PREFIX = 'last_seen:';
const PRESENCE_TTL_SECONDS = Math.ceil(PRESENCE_OFFLINE_THRESHOLD_MS / 1000);
const OFFLINE_GRACE_PERIOD_MS = 5000;

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);
  private readonly sc = StringCodec();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly offlineTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    @Inject(REDIS_TOKEN) private readonly redis: Redis,
    @Inject(NATS_TOKEN) private readonly nats: NatsClients,
    private readonly connectionManager: ConnectionManager,
  ) {}

  onModuleInit() {
    this.heartbeatTimer = setInterval(
      () => this.refreshAllPresence(),
      PRESENCE_HEARTBEAT_INTERVAL_MS,
    );
  }

  onModuleDestroy() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    for (const timer of this.offlineTimers.values()) {
      clearTimeout(timer);
    }
  }

  async setOnline(userId: string): Promise<void> {
    const existingTimer = this.offlineTimers.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.offlineTimers.delete(userId);
    }

    const now = Date.now().toString();
    const key = `${PRESENCE_KEY_PREFIX}${userId}`;

    await this.redis.set(key, now, 'EX', PRESENCE_TTL_SECONDS);
    await this.redis.set(`${LAST_SEEN_KEY_PREFIX}${userId}`, now);

    this.publishPresenceChange(userId, 'online', now);
  }

  scheduleOffline(userId: string): void {
    if (this.connectionManager.isOnline(userId)) return;

    const existing = this.offlineTimers.get(userId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.offlineTimers.delete(userId);
      if (!this.connectionManager.isOnline(userId)) {
        this.setOffline(userId);
      }
    }, OFFLINE_GRACE_PERIOD_MS);

    this.offlineTimers.set(userId, timer);
  }

  async setOffline(userId: string): Promise<void> {
    const key = `${PRESENCE_KEY_PREFIX}${userId}`;
    const now = Date.now().toString();

    await this.redis.del(key);
    await this.redis.set(`${LAST_SEEN_KEY_PREFIX}${userId}`, now);

    this.publishPresenceChange(userId, 'offline', now);
  }

  async heartbeat(userId: string): Promise<void> {
    const key = `${PRESENCE_KEY_PREFIX}${userId}`;
    const now = Date.now().toString();

    await this.redis.set(key, now, 'EX', PRESENCE_TTL_SECONDS);
    await this.redis.set(`${LAST_SEEN_KEY_PREFIX}${userId}`, now);
  }

  async isOnline(userId: string): Promise<boolean> {
    const key = `${PRESENCE_KEY_PREFIX}${userId}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async getLastSeen(userId: string): Promise<string | null> {
    return this.redis.get(`${LAST_SEEN_KEY_PREFIX}${userId}`);
  }

  private async refreshAllPresence(): Promise<void> {
    const userIds = this.connectionManager.getAllConnectedUserIds();
    if (userIds.length === 0) return;

    const pipeline = this.redis.pipeline();
    const now = Date.now().toString();

    for (const userId of userIds) {
      const key = `${PRESENCE_KEY_PREFIX}${userId}`;
      pipeline.set(key, now, 'EX', PRESENCE_TTL_SECONDS);
      pipeline.set(`${LAST_SEEN_KEY_PREFIX}${userId}`, now);
    }

    await pipeline.exec();
    this.logger.debug(`Refreshed presence for ${userIds.length} users`);
  }

  private publishPresenceChange(userId: string, status: string, timestamp: string): void {
    this.nats.nc.publish(
      NATS_SUBJECTS.PRESENCE,
      this.sc.encode(JSON.stringify({ userId, status, timestamp })),
    );
  }
}
