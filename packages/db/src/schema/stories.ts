import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { mediaFiles } from './media-files';

export const stories = pgTable(
  'stories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    mediaId: uuid('media_id')
      .references(() => mediaFiles.id)
      .notNull(),
    caption: varchar('caption', { length: 1024 }),
    privacy: jsonb('privacy').default({}).notNull(),
    viewCount: integer('view_count').default(0).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index('stories_user_id_idx').on(table.userId),
    index('stories_expires_at_idx').on(table.expiresAt),
  ],
);
