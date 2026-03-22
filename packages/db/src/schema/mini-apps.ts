import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

/** Зарегистрированные Mini-Apps (панель разработчика / ma-platform). */
export const miniApps = pgTable(
  'mini_apps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 256 }).notNull(),
    version: varchar('version', { length: 64 }).notNull().default('1.0.0'),
    description: text('description'),
    icon: varchar('icon', { length: 512 }),
    category: varchar('category', { length: 128 }).notNull().default('general'),
    url: varchar('url', { length: 2048 }).notNull(),
    settings: jsonb('settings')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    /** draft | active | review | archived */
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index('mini_apps_status_idx').on(table.status),
    index('mini_apps_category_idx').on(table.category),
  ],
);
