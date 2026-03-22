import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  boolean,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const stickerPacks = pgTable('sticker_packs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 128 }).notNull(),
  isPremium: boolean('is_premium').default(false).notNull(),
  creatorId: uuid('creator_id').references(() => users.id),
  isPublic: boolean('is_public').default(true).notNull(),
  coverMediaId: uuid('cover_media_id'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});
