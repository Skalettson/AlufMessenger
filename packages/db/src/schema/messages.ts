import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  bigint,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { contentTypeEnum } from './enums';
import { chats } from './chats';
import { users } from './users';

export const messages = pgTable(
  'messages',
  {
    id: bigint('id', { mode: 'bigint' }).primaryKey(),
    chatId: uuid('chat_id')
      .references(() => chats.id)
      .notNull(),
    senderId: uuid('sender_id')
      .references(() => users.id)
      .notNull(),
    replyToId: bigint('reply_to_id', { mode: 'bigint' }),
    forwardFromId: bigint('forward_from_id', { mode: 'bigint' }),
    forwardFromChatId: uuid('forward_from_chat_id'),
    topicId: uuid('topic_id'),
    contentType: contentTypeEnum('content_type').notNull(),
    textContent: text('text_content'),
    mediaId: uuid('media_id'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    metadata: jsonb('metadata').default({}).notNull(),
    isEdited: boolean('is_edited').default(false).notNull(),
    isPinned: boolean('is_pinned').default(false).notNull(),
    /** Скрывать автора сообщения (публикация от имени канала) */
    hideAuthor: boolean('hide_author').default(false).notNull(),
    selfDestructAt: timestamp('self_destruct_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
  },
  (table) => [
    index('messages_chat_id_created_at_idx').on(table.chatId, table.createdAt),
    index('messages_sender_id_idx').on(table.senderId),
    index('messages_hide_author_idx').on(table.hideAuthor),
  ],
);
