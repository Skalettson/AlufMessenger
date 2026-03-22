import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  bigint,
  timestamp,
  jsonb,
  boolean,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { memberRoleEnum } from './enums';
import { chats } from './chats';
import { users } from './users';

export const chatMembers = pgTable(
  'chat_members',
  {
    chatId: uuid('chat_id')
      .references(() => chats.id)
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    role: memberRoleEnum('role').default('member').notNull(),
    permissions: jsonb('permissions').default({}).notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    mutedUntil: timestamp('muted_until', { withTimezone: true }),
    lastReadMessageId: bigint('last_read_message_id', { mode: 'bigint' }),
    isPinned: boolean('is_pinned').default(false).notNull(),
    isArchived: boolean('is_archived').default(false).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.userId] }),
    index('chat_members_user_id_idx').on(table.userId),
    index('chat_members_chat_id_idx').on(table.chatId),
  ],
);
