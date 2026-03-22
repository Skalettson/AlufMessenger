import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { stickerPacks } from './sticker-packs';

export const userStickerPacks = pgTable(
  'user_sticker_packs',
  {
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    stickerPackId: uuid('sticker_pack_id')
      .references(() => stickerPacks.id, { onDelete: 'cascade' })
      .notNull(),
    addedAt: timestamp('added_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.stickerPackId] }),
  ],
);
