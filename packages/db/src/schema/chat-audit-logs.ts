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
import { chats } from './chats';

/** Журнал действий администраторов (Audit Log) */
export const chatAuditLogs = pgTable(
  'chat_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatId: uuid('chat_id')
      .references(() => chats.id)
      .notNull(),
    actorId: uuid('actor_id')
      .references(() => users.id)
      .notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    targetUserId: uuid('target_user_id').references(() => users.id),
    targetMessageId: uuid('target_message_id'),
    details: jsonb('details').default({}),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index('chat_audit_logs_chat_id_idx').on(table.chatId),
    index('chat_audit_logs_actor_id_idx').on(table.actorId),
    index('chat_audit_logs_action_idx').on(table.action),
    index('chat_audit_logs_created_at_idx').on(table.createdAt),
  ],
);
