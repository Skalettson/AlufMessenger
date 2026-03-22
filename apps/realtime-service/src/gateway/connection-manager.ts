import { Injectable, Inject, Logger } from '@nestjs/common';
import { StringCodec } from 'nats';
import { NATS_TOKEN, type NatsClients } from '../providers/nats.provider';
import { REDIS_TOKEN } from '../providers/redis.provider';
import type Redis from 'ioredis';
import type { WebSocket } from 'ws';

@Injectable()
export class ConnectionManager {
  private readonly logger = new Logger(ConnectionManager.name);
  private readonly connections = new Map<string, Set<WebSocket>>();
  private readonly wsToUser = new WeakMap<WebSocket, string>();
  private readonly sc = StringCodec();

  constructor(
    @Inject(REDIS_TOKEN) private readonly redis: Redis,
    @Inject(NATS_TOKEN) private readonly nats: NatsClients,
  ) {}

  addConnection(userId: string, ws: WebSocket): void {
    let set = this.connections.get(userId);
    if (!set) {
      set = new Set();
      this.connections.set(userId, set);
    }
    set.add(ws);
    this.wsToUser.set(ws, userId);
    this.logger.log(`User ${userId} connected (${set.size} total connections)`);
  }

  removeConnection(userId: string, ws: WebSocket): void {
    const set = this.connections.get(userId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) {
      this.connections.delete(userId);
    }
    this.logger.log(
      `User ${userId} disconnected (${set?.size ?? 0} remaining connections)`,
    );
  }

  getUserId(ws: WebSocket): string | undefined {
    return this.wsToUser.get(ws);
  }

  getConnections(userId: string): WebSocket[] {
    const set = this.connections.get(userId);
    return set ? Array.from(set) : [];
  }

  isOnline(userId: string): boolean {
    const set = this.connections.get(userId);
    return !!set && set.size > 0;
  }

  getAllConnectedUserIds(): string[] {
    return Array.from(this.connections.keys());
  }

  broadcastToUser(userId: string, event: string, data: unknown): void {
    const sockets = this.getConnections(userId);
    if (sockets.length === 0) return;

    const payload = JSON.stringify({ event, data });
    for (const ws of sockets) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload);
      }
    }
  }

  broadcastToAll(event: string, data: unknown): void {
    const payload = JSON.stringify({ event, data });
    for (const [, sockets] of this.connections) {
      for (const ws of sockets) {
        if (ws.readyState === ws.OPEN) {
          ws.send(payload);
        }
      }
    }
  }

  async broadcastToChat(
    chatId: string,
    event: string,
    data: unknown,
    excludeUserId?: string,
  ): Promise<void> {
    const memberIds = await this.resolveMemberIds(chatId, event, data);

    for (const memberId of memberIds) {
      if (memberId === excludeUserId) continue;
      this.broadcastToUser(memberId, event, data);
    }

    this.nats.nc.publish(
      `aluf.ws.broadcast.${chatId}`,
      this.sc.encode(
        JSON.stringify({ chatId, event, data, excludeUserId, origin: this.getInstanceId() }),
      ),
    );
  }

  async broadcastToChatLocal(
    chatId: string,
    event: string,
    data: unknown,
    excludeUserId?: string,
    originInstance?: string,
  ): Promise<void> {
    if (originInstance === this.getInstanceId()) return;

    const memberIds = await this.resolveMemberIds(chatId, event, data);
    for (const memberId of memberIds) {
      if (memberId === excludeUserId) continue;
      this.broadcastToUser(memberId, event, data);
    }
  }

  private async resolveMemberIds(chatId: string, event: string, data: unknown): Promise<string[]> {
    let memberIds = await this.getChatMemberIds(chatId);

    if (data && typeof data === 'object') {
      const payload = data as { senderId?: string; memberIds?: string[]; userId?: string };

      if (Array.isArray(payload.memberIds) && payload.memberIds.length > 0) {
        memberIds = payload.memberIds;
        this.cacheChatMembers(chatId, memberIds);
      }

      if (event === 'message.new' && payload.senderId && !memberIds.includes(payload.senderId)) {
        memberIds = [...memberIds, payload.senderId];
      }

      if (payload.userId && !memberIds.includes(payload.userId)) {
        memberIds = [...memberIds, payload.userId];
        this.cacheChatMembers(chatId, [payload.userId]);
      }
    }

    return memberIds;
  }

  private async getChatMemberIds(chatId: string): Promise<string[]> {
    const cacheKey = `chat_members:${chatId}`;
    const cached = await this.redis.smembers(cacheKey);
    if (cached.length > 0) return cached;
    return [];
  }

  private cacheChatMembers(chatId: string, memberIds: string[]): void {
    if (memberIds.length === 0) return;
    const cacheKey = `chat_members:${chatId}`;
    this.redis.sadd(cacheKey, ...memberIds).catch(() => {});
    this.redis.expire(cacheKey, 86400).catch(() => {});
  }

  private getInstanceId(): string {
    return process.env.INSTANCE_ID || `ws-${process.pid}`;
  }
}
