import { Inject, Injectable } from '@nestjs/common';
import { and, count, gte, isNotNull, sql } from 'drizzle-orm';
import { miniApps, maAnalyticsEvents } from '@aluf/db';
import { DATABASE_TOKEN, type DrizzleDB } from '../providers/database.provider.js';

@Injectable()
export class DashboardService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: DrizzleDB) {}

  async getSummary() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalRow] = await this.db
      .select({ c: count() })
      .from(miniApps);

    const statusRows = await this.db
      .select({
        status: miniApps.status,
        c: count(),
      })
      .from(miniApps)
      .groupBy(miniApps.status);

    const byStatus: Record<string, number> = {};
    for (const r of statusRows) {
      byStatus[r.status] = Number(r.c);
    }

    const [events7d] = await this.db
      .select({ c: count() })
      .from(maAnalyticsEvents)
      .where(gte(maAnalyticsEvents.createdAt, sevenDaysAgo));

    const [users7d] = await this.db
      .select({
        c: sql<number>`count(distinct ${maAnalyticsEvents.userId})::int`.mapWith(Number),
      })
      .from(maAnalyticsEvents)
      .where(
        and(
          gte(maAnalyticsEvents.createdAt, sevenDaysAgo),
          isNotNull(maAnalyticsEvents.userId),
        ),
      );

    return {
      totalApps: Number(totalRow?.c ?? 0),
      appsByStatus: byStatus,
      eventsLast7Days: Number(events7d?.c ?? 0),
      uniqueUsersLast7Days: Number(users7d?.c ?? 0),
      generatedAt: new Date().toISOString(),
    };
  }
}
