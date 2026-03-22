import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  bigint,
  varchar,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { messages } from './messages';
import { users } from './users';

export const reactions = pgTable(
  'reactions',
  {
    messageId: bigint('message_id', { mode: 'bigint' })
      .references(() => messages.id)
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    emoji: varchar('emoji', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.messageId, table.userId] })],
);
