import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { maAnalyticsEvents } from '@aluf/db';
import { DATABASE_TOKEN, type DrizzleDB } from '../providers/database.provider.js';

export interface AnalyticsEvent {
  id: string;
  appId: string;
  userId?: string;
  event: string;
  properties?: Record<string, unknown>;
  timestamp: Date;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(@Inject(DATABASE_TOKEN) private readonly db: DrizzleDB) {}

  async track(
    appId: string,
    event: string,
    properties?: Record<string, unknown>,
    userId?: string,
  ): Promise<AnalyticsEvent> {
    const [row] = await this.db
      .insert(maAnalyticsEvents)
      .values({
        appId,
        userId: userId ?? null,
        event,
        properties: properties ?? null,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to persist analytics event');
    }

    this.logger.debug(`Analytics event: ${event} (app: ${appId})`);

    return {
      id: row.id,
      appId: row.appId,
      userId: row.userId ?? undefined,
      event: row.event,
      properties: (row.properties ?? undefined) as Record<string, unknown> | undefined,
      timestamp: row.createdAt,
    };
  }

  async getEvents(appId: string, limit = 100, offset = 0) {
    const rows = await this.db
      .select()
      .from(maAnalyticsEvents)
      .where(eq(maAnalyticsEvents.appId, appId))
      .orderBy(desc(maAnalyticsEvents.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      id: row.id,
      appId: row.appId,
      userId: row.userId ?? undefined,
      event: row.event,
      properties: (row.properties ?? undefined) as Record<string, unknown> | undefined,
      timestamp: row.createdAt,
    }));
  }

  async getStats(
    appId: string,
    from?: Date,
    to?: Date,
  ): Promise<Record<string, number>> {
    const parts = [eq(maAnalyticsEvents.appId, appId)];
    if (from) parts.push(gte(maAnalyticsEvents.createdAt, from));
    if (to) parts.push(lte(maAnalyticsEvents.createdAt, to));

    const whereExpr = parts.length === 1 ? parts[0] : and(...parts);

    const rows = await this.db
      .select({ event: maAnalyticsEvents.event })
      .from(maAnalyticsEvents)
      .where(whereExpr);

    const stats: Record<string, number> = {};
    for (const r of rows) {
      stats[r.event] = (stats[r.event] || 0) + 1;
    }
    return stats;
  }
}
