import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';
import { mediaFiles } from './media-files';

export const userMusicTracks = pgTable('user_music_tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: varchar('title', { length: 512 }).notNull(),
  artist: varchar('artist', { length: 512 }).notNull(),
  genre: varchar('genre', { length: 128 }).notNull().default(''),
  audioMediaId: uuid('audio_media_id')
    .references(() => mediaFiles.id, { onDelete: 'restrict' })
    .notNull(),
  coverMediaId: uuid('cover_media_id').references(() => mediaFiles.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  /** Виден в глобальном поиске / каталоге */
  isPublic: boolean('is_public').default(false).notNull(),
});
