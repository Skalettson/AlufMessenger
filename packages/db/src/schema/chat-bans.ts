import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  timestamp,
  text,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { chats } from './chats';

/** Чёрный список участников группы/канала */
export const chatBans = pgTable(
  'chat_bans',
  {
    chatId: uuid('chat_id')
      .references(() => chats.id)
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    bannedBy: uuid('banned_by')
      .references(() => users.id)
      .notNull(),
    reason: text('reason'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.userId] }),
    index('chat_bans_chat_id_idx').on(table.chatId),
    index('chat_bans_user_id_idx').on(table.userId),
  ],
);
