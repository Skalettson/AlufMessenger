import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const chatFolders = pgTable(
  'chat_folders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    name: varchar('name', { length: 32 }).notNull(),
    icon: varchar('icon', { length: 10 }),
    includedChatIds: jsonb('included_chat_ids').default([]).notNull(),
    excludedChatIds: jsonb('excluded_chat_ids').default([]).notNull(),
    includeTypes: jsonb('include_types').default([]).notNull(),
    includeUnread: boolean('include_unread').default(false).notNull(),
    includeMuted: boolean('include_muted').default(false).notNull(),
    position: integer('position').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [index('chat_folders_user_id_idx').on(table.userId)],
);
