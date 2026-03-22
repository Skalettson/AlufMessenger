import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { customEmoji } from './custom-emoji';

export const userCustomEmoji = pgTable(
  'user_custom_emoji',
  {
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    customEmojiId: uuid('custom_emoji_id')
      .references(() => customEmoji.id, { onDelete: 'cascade' })
      .notNull(),
    addedAt: timestamp('added_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.customEmojiId] }),
  ],
);
