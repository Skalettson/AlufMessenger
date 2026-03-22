import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const bots = pgTable('bots', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('owner_id')
    .references(() => users.id)
    .notNull(),
  token: varchar('token', { length: 255 }).unique().notNull(),
  webhookUrl: text('webhook_url'),
  webhookSecret: varchar('webhook_secret', { length: 255 }),
  isInline: boolean('is_inline').default(false).notNull(),
  commands: jsonb('commands').default([]).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});
