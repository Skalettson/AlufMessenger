import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { mediaFiles } from './media-files';

export const customEmoji = pgTable(
  'custom_emoji',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    creatorId: uuid('creator_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    mediaId: uuid('media_id')
      .references(() => mediaFiles.id, { onDelete: 'cascade' })
      .notNull(),
    shortcode: varchar('shortcode', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [uniqueIndex('custom_emoji_shortcode_unique').on(table.shortcode)],
);
