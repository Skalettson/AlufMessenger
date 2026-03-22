import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  bigint,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { chatTypeEnum } from './enums';
import { users } from './users';

export const chats = pgTable(
  'chats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: chatTypeEnum('type').notNull(),
    title: varchar('title', { length: 255 }),
    description: text('description'),
    avatarUrl: text('avatar_url'),
    createdBy: uuid('created_by')
      .references(() => users.id)
      .notNull(),
    settings: jsonb('settings').default({}).notNull(),
    /** Хранение истории в днях; null = без ограничения (Premium) */
    retentionDays: integer('retention_days'),
    memberCount: integer('member_count').default(0).notNull(),
    /** Публичный username канала/группы (как в Telegram: 5–32 символа), ссылка /c/username */
    username: varchar('username', { length: 32 }).unique(),
    inviteLink: varchar('invite_link', { length: 32 }).unique(),
    lastMessageId: bigint('last_message_id', { mode: 'bigint' }),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    /** ID чата с обсуждениями для канала (привязанная группа) */
    linkedDiscussionChatId: uuid('linked_discussion_chat_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index('chats_type_idx').on(table.type),
    index('chats_created_by_idx').on(table.createdBy),
    index('chats_username_idx').on(table.username),
    uniqueIndex('chats_invite_link_idx').on(table.inviteLink),
    index('chats_linked_discussion_idx').on(table.linkedDiscussionChatId),
    foreignKey({
      columns: [table.linkedDiscussionChatId],
      foreignColumns: [table.id],
      name: 'chats_linked_discussion_chat_id_fkey',
    }),
  ],
);
