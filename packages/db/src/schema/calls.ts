import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { callTypeEnum, callStatusEnum } from './enums';
import { chats } from './chats';
import { users } from './users';

export const calls = pgTable(
  'calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatId: uuid('chat_id')
      .references(() => chats.id)
      .notNull(),
    initiatorId: uuid('initiator_id')
      .references(() => users.id)
      .notNull(),
    type: callTypeEnum('type').notNull(),
    isGroup: boolean('is_group').default(false).notNull(),
    status: callStatusEnum('status').default('ringing').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [index('calls_chat_id_idx').on(table.chatId)],
);
