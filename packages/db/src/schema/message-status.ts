import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  bigint,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { deliveryStatusEnum } from './enums';
import { messages } from './messages';
import { users } from './users';

export const messageStatus = pgTable(
  'message_status',
  {
    messageId: bigint('message_id', { mode: 'bigint' })
      .references(() => messages.id)
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    status: deliveryStatusEnum('status').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.messageId, table.userId] })],
);
