import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  timestamp,
  boolean,
  index,
  primaryKey,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { chats } from './chats';
import { users } from './users';

/**
 * Подписчики каналов
 * Для каналов: все участники канала - подписчики
 * Для групп: участники группы
 */
export const channelSubscribers = pgTable(
  'channel_subscribers',
  {
    chatId: uuid('chat_id')
      .references(() => chats.id)
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    /** Дата подписки */
    subscribedAt: timestamp('subscribed_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    /** Включены ли уведомления */
    notificationsEnabled: boolean('notifications_enabled').default(true).notNull(),
    /** Активна ли подписка (false = отписался) */
    isActive: boolean('is_active').default(true).notNull(),
    /** Дата последней активности (чтение сообщений) */
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.userId] }),
    index('channel_subscribers_chat_id_idx').on(table.chatId),
    index('channel_subscribers_user_id_idx').on(table.userId),
    index('channel_subscribers_active_idx').on(table.isActive),
    foreignKey({
      columns: [table.chatId],
      foreignColumns: [chats.id],
      name: 'channel_subscribers_chat_id_fkey',
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'channel_subscribers_user_id_fkey',
    }),
  ],
);
