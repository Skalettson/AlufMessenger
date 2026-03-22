import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { chats } from './chats';

/** Темы/топики для групп (как в Telegram Groups 2.0) */
export const chatTopics = pgTable(
  'chat_topics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatId: uuid('chat_id')
      .references(() => chats.id)
      .notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    icon: varchar('icon', { length: 50 }),
    color: integer('color'),
    createdBy: uuid('created_by').notNull(),
    isClosed: boolean('is_closed').default(false).notNull(),
    isPinned: boolean('is_pinned').default(false).notNull(),
    lastMessageId: uuid('last_message_id'),
    unreadCount: integer('unread_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index('chat_topics_chat_id_idx').on(table.chatId),
    index('chat_topics_created_by_idx').on(table.createdBy),
    index('chat_topics_is_pinned_idx').on(table.isPinned),
  ],
);
