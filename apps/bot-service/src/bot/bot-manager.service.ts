import { Injectable, Inject } from '@nestjs/common';
import * as crypto from 'crypto';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { bots, users, chatMembers, messages, messageStatus, reactions } from '@aluf/db';
import {
  NotFoundError,
  BadRequestError,
  ALUF_ID_MIN,
  ALUF_ID_MAX,
  USERNAME_REGEX,
  MAX_BOTS_PER_USER,
  MAX_BOTS_PER_USER_FREE,
} from '@aluf/shared';
import { DATABASE_TOKEN, type DrizzleDB } from '../providers/database.provider';
import { REDIS_TOKEN } from '../providers/redis.provider';
import type Redis from 'ioredis';

export interface WebhookStatusInfo {
  lastDeliveryAt: string;
  lastSuccessAt?: string;
  lastError?: string;
  lastStatusCode?: number;
}

export interface BotInfo {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  description: string | null;
  commands: { command: string; description: string }[];
  webhookUrl: string | null;
  isInline: boolean;
  createdAt: Date;
  webhookStatus?: WebhookStatusInfo | null;
  chatCount?: number;
}

export interface UpdateBotPayload {
  description?: string | null;
  commands?: { command: string; description: string }[];
  webhookUrl?: string | null;
  isInline?: boolean;
}

@Injectable()
export class BotManagerService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
    @Inject(REDIS_TOKEN) private readonly redis: Redis,
  ) {}

  private async getIsPremium(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ isPremium: users.isPremium })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.isPremium ?? false;
  }

  async createBot(
    ownerId: string,
    username: string,
    displayName: string,
    description?: string | null,
    avatarUrl?: string | null,
  ) {
    if (!USERNAME_REGEX.test(username)) {
      throw new BadRequestError(
        'Имя бота должно начинаться с буквы и содержать только буквы, цифры и подчёркивание (3-32 символа)',
      );
    }

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(bots)
      .where(eq(bots.ownerId, ownerId));
    const isPremium = await this.getIsPremium(ownerId);
    const limit = isPremium ? MAX_BOTS_PER_USER : MAX_BOTS_PER_USER_FREE;
    if ((countRow?.count ?? 0) >= limit) {
      throw new BadRequestError(
        `Достигнут лимит ботов (${limit}). Удалите неиспользуемого бота или обратитесь в поддержку.`,
      );
    }

    const alufId = await this.generateAlufId();
    const token = this.generateToken();

    const [user] = await this.db
      .insert(users)
      .values({
        alufId,
        username,
        displayName,
        isBot: true,
        ...(avatarUrl != null && avatarUrl !== '' && { avatarUrl }),
      })
      .returning();

    await this.db.insert(bots).values({
      id: user.id,
      ownerId,
      token,
      ...(description != null && description !== '' && { description }),
    });

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      token,
    };
  }

  async deleteBot(botId: string, ownerId: string) {
    const bot = await this.requireBotOwnership(botId, ownerId);

    const botMessageIds = await this.db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.senderId, bot.id));
    const ids = botMessageIds.map((r) => r.id);
    if (ids.length > 0) {
      await this.db.delete(reactions).where(inArray(reactions.messageId, ids));
      await this.db.delete(messageStatus).where(inArray(messageStatus.messageId, ids));
    }
    await this.db.delete(messageStatus).where(eq(messageStatus.userId, bot.id));
    await this.db.delete(messages).where(eq(messages.senderId, bot.id));
    await this.db.delete(chatMembers).where(eq(chatMembers.userId, bot.id));
    await this.db.delete(bots).where(eq(bots.id, bot.id));
    await this.db.delete(users).where(eq(users.id, bot.id));
  }

  async regenerateToken(botId: string, ownerId: string) {
    await this.requireBotOwnership(botId, ownerId);

    const newToken = this.generateToken();
    await this.db
      .update(bots)
      .set({ token: newToken })
      .where(eq(bots.id, botId));

    return { token: newToken };
  }

  async listBots(ownerId: string): Promise<{ bots: BotInfo[]; limit: number }> {
    const isPremium = await this.getIsPremium(ownerId);
    const limit = isPremium ? MAX_BOTS_PER_USER : MAX_BOTS_PER_USER_FREE;

    const rows = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        description: bots.description,
        commands: bots.commands,
        webhookUrl: bots.webhookUrl,
        isInline: bots.isInline,
        createdAt: bots.createdAt,
      })
      .from(bots)
      .innerJoin(users, eq(bots.id, users.id))
      .where(eq(bots.ownerId, ownerId));

    const result: BotInfo[] = [];
    for (const r of rows) {
      let webhookStatus: WebhookStatusInfo | null = null;
      try {
        const statusJson = await this.redis.get(`bot:webhook:status:${r.id}`);
        if (statusJson) {
          const data = JSON.parse(statusJson) as Record<string, unknown>;
          if (data && typeof data.lastDeliveryAt === 'string') {
            webhookStatus = {
              lastDeliveryAt: data.lastDeliveryAt as string,
              ...(typeof data.lastSuccessAt === 'string' && { lastSuccessAt: data.lastSuccessAt }),
              ...(typeof data.lastError === 'string' && { lastError: data.lastError }),
              ...(typeof data.lastStatusCode === 'number' && { lastStatusCode: data.lastStatusCode }),
            };
          }
        }
      } catch {
        // ignore
      }
      result.push({
        id: r.id,
        username: r.username,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl ?? null,
        description: r.description ?? null,
        commands: Array.isArray(r.commands) ? (r.commands as { command: string; description: string }[]) : [],
        webhookUrl: r.webhookUrl ?? null,
        isInline: r.isInline ?? false,
        createdAt: r.createdAt,
        webhookStatus: webhookStatus ?? undefined,
        chatCount: undefined, // set below
      });
    }
    if (result.length > 0) {
      const ids = result.map((b) => b.id);
      const countRows = await this.db
        .select({ userId: chatMembers.userId, count: sql<number>`count(*)::int` })
        .from(chatMembers)
        .where(inArray(chatMembers.userId, ids))
        .groupBy(chatMembers.userId);
      const countMap = new Map(countRows.map((row) => [row.userId, row.count]));
      result.forEach((b) => { b.chatCount = countMap.get(b.id) ?? 0; });
    }
    return { bots: result, limit };
  }

  async getBot(ownerId: string, botId: string): Promise<BotInfo> {
    const [row] = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        description: bots.description,
        commands: bots.commands,
        webhookUrl: bots.webhookUrl,
        isInline: bots.isInline,
        createdAt: bots.createdAt,
      })
      .from(bots)
      .innerJoin(users, eq(bots.id, users.id))
      .where(and(eq(bots.id, botId), eq(bots.ownerId, ownerId)))
      .limit(1);

    if (!row) {
      throw new NotFoundError('Bot', botId);
    }

    let webhookStatus: WebhookStatusInfo | null = null;
    try {
      const statusJson = await this.redis.get(`bot:webhook:status:${botId}`);
      if (statusJson) {
        const data = JSON.parse(statusJson) as Record<string, unknown>;
        if (data && typeof data.lastDeliveryAt === 'string') {
          webhookStatus = {
            lastDeliveryAt: data.lastDeliveryAt as string,
            ...(typeof data.lastSuccessAt === 'string' && { lastSuccessAt: data.lastSuccessAt }),
            ...(typeof data.lastError === 'string' && { lastError: data.lastError }),
            ...(typeof data.lastStatusCode === 'number' && { lastStatusCode: data.lastStatusCode }),
          };
        }
      }
    } catch {
      // ignore
    }

    let chatCount = 0;
    const [cc] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatMembers)
      .where(eq(chatMembers.userId, botId));
    if (cc) chatCount = cc.count;

    return {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl ?? null,
      description: row.description ?? null,
      commands: Array.isArray(row.commands) ? (row.commands as { command: string; description: string }[]) : [],
      webhookUrl: row.webhookUrl ?? null,
      isInline: row.isInline ?? false,
      createdAt: row.createdAt,
      webhookStatus: webhookStatus ?? undefined,
      chatCount,
    };
  }

  async updateBot(
    ownerId: string,
    botId: string,
    payload: UpdateBotPayload,
  ): Promise<BotInfo> {
    await this.requireBotOwnership(botId, ownerId);

    const update: Record<string, unknown> = {};
    if (payload.description !== undefined) update.description = payload.description;
    if (payload.commands !== undefined) update.commands = payload.commands;
    if (payload.webhookUrl !== undefined) update.webhookUrl = payload.webhookUrl;
    if (payload.isInline !== undefined) update.isInline = payload.isInline;

    if (Object.keys(update).length > 0) {
      await this.db.update(bots).set(update as Record<string, unknown>).where(eq(bots.id, botId));
    }

    return this.getBot(ownerId, botId);
  }

  private async requireBotOwnership(botId: string, ownerId: string) {
    const [bot] = await this.db
      .select()
      .from(bots)
      .where(and(eq(bots.id, botId), eq(bots.ownerId, ownerId)))
      .limit(1);

    if (!bot) {
      throw new NotFoundError('Bot', botId);
    }

    return bot;
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private async generateAlufId(): Promise<bigint> {
    const range = ALUF_ID_MAX - ALUF_ID_MIN;
    for (let attempt = 0; attempt < 100; attempt++) {
      const randomBytes = crypto.randomBytes(8);
      const randomBig = BigInt('0x' + randomBytes.toString('hex')) % range;
      const candidate = ALUF_ID_MIN + randomBig;

      const [existing] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.alufId, candidate))
        .limit(1);

      if (!existing) return candidate;
    }
    throw new Error('Failed to generate unique aluf_id after 100 attempts');
  }
}
