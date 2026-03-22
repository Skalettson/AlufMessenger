import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const encryptionKeys = pgTable(
  'encryption_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    keyType: varchar('key_type', { length: 50 }).notNull(),
    publicKey: text('public_key').notNull(),
    keyBundle: jsonb('key_bundle'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [index('encryption_keys_user_id_idx').on(table.userId)],
);
