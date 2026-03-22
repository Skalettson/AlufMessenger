import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { miniApps } from './mini-apps';

export const maAnalyticsEvents = pgTable(
  'ma_analytics_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appId: uuid('app_id')
      .references(() => miniApps.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id'),
    event: varchar('event', { length: 128 }).notNull(),
    properties: jsonb('properties').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index('ma_analytics_app_created_idx').on(table.appId, table.createdAt),
    index('ma_analytics_event_idx').on(table.event),
  ],
);
