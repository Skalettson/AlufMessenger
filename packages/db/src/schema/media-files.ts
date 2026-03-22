import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  bigint,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { stickerPacks } from './sticker-packs';

export const mediaFiles = pgTable('media_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  uploaderId: uuid('uploader_id')
    .references(() => users.id)
    .notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 127 }).notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'bigint' }).notNull(),
  storageKey: varchar('storage_key', { length: 512 }).notNull(),
  thumbnailKey: varchar('thumbnail_key', { length: 512 }),
  stickerPackId: uuid('sticker_pack_id').references(() => stickerPacks.id),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});
