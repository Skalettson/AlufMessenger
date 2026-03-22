import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const contacts = pgTable(
  'contacts',
  {
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    contactUserId: uuid('contact_user_id')
      .references(() => users.id)
      .notNull(),
    customName: varchar('custom_name', { length: 64 }),
    isBlocked: boolean('is_blocked').default(false).notNull(),
    isMuted: boolean('is_muted').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.contactUserId] })],
);
