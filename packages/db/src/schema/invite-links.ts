import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { chats } from './chats';
import { users } from './users';

export const inviteLinks = pgTable(
  'invite_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatId: uuid('chat_id')
      .references(() => chats.id)
      .notNull(),
    createdBy: uuid('created_by')
      .references(() => users.id)
      .notNull(),
    code: varchar('code', { length: 32 }).unique().notNull(),
    name: varchar('name', { length: 64 }),
    usageLimit: integer('usage_limit'),
    usageCount: integer('usage_count').default(0).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    requiresApproval: boolean('requires_approval').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    uniqueIndex('invite_links_code_idx').on(table.code),
    index('invite_links_chat_id_idx').on(table.chatId),
  ],
);
