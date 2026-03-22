import {
  pgTable,
  uuid,
  varchar,
  bigint,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const uploadSessions = pgTable('upload_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 127 }).notNull(),
  totalSize: bigint('total_size', { mode: 'bigint' }).notNull(),
  storageKey: varchar('storage_key', { length: 512 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
