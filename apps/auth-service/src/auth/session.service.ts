import { Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { eq, asc, lt } from 'drizzle-orm';
import { sessions } from '@aluf/db';
import { NotFoundError, MAX_ACTIVE_SESSIONS, JWT_REFRESH_TOKEN_TTL } from '@aluf/shared';
import { DATABASE_TOKEN, type DrizzleDB } from '../providers/database.provider';

export interface DeviceInfo {
  platform: string;
  deviceName: string;
  appVersion: string;
  osVersion: string;
}

@Injectable()
export class SessionService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: DrizzleDB) {}

  async createSession(
    userId: string,
    refreshToken: string,
    deviceInfo: DeviceInfo,
    ip: string,
    /** Must match `sessionId` embedded in access/refresh JWTs */
    explicitSessionId?: string,
  ): Promise<string> {
    await this.enforceSessionLimit(userId);

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + JWT_REFRESH_TOKEN_TTL * 1000);
    const id = explicitSessionId ?? crypto.randomUUID();

    const [session] = await this.db
      .insert(sessions)
      .values({
        id,
        userId,
        tokenHash,
        deviceInfo,
        ip,
        expiresAt,
      })
      .returning({ id: sessions.id });

    return session.id;
  }

  async getSession(sessionId: string) {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) {
      throw new NotFoundError('Session', sessionId);
    }
    return session;
  }

  async getSessionByTokenHash(tokenHash: string) {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);

    return session ?? null;
  }

  async getUserSessions(userId: string) {
    return this.db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(asc(sessions.lastActiveAt));
  }

  async updateSessionToken(sessionId: string, newRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + JWT_REFRESH_TOKEN_TTL * 1000);

    await this.db
      .update(sessions)
      .set({ tokenHash, lastActiveAt: new Date(), expiresAt })
      .where(eq(sessions.id, sessionId));
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ lastActiveAt: new Date() })
      .where(eq(sessions.id, sessionId));
  }

  async terminateSession(sessionId: string): Promise<void> {
    const result = await this.db
      .delete(sessions)
      .where(eq(sessions.id, sessionId))
      .returning({ id: sessions.id });

    if (result.length === 0) {
      throw new NotFoundError('Session', sessionId);
    }
  }

  async terminateAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
    if (exceptSessionId) {
      const userSessions = await this.getUserSessions(userId);
      const toDelete = userSessions
        .filter((s) => s.id !== exceptSessionId)
        .map((s) => s.id);

      for (const id of toDelete) {
        await this.db.delete(sessions).where(eq(sessions.id, id));
      }
    } else {
      await this.db.delete(sessions).where(eq(sessions.userId, userId));
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    const deleted = await this.db
      .delete(sessions)
      .where(lt(sessions.expiresAt, now))
      .returning({ id: sessions.id });

    return deleted.length;
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async enforceSessionLimit(userId: string): Promise<void> {
    const userSessions = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(asc(sessions.lastActiveAt));

    if (userSessions.length >= MAX_ACTIVE_SESSIONS) {
      const excess = userSessions.length - MAX_ACTIVE_SESSIONS + 1;
      const toRemove = userSessions.slice(0, excess);

      for (const session of toRemove) {
        await this.db.delete(sessions).where(eq(sessions.id, session.id));
      }
    }
  }
}
