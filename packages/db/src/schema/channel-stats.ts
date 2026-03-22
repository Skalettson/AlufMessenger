import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  bigint,
  integer,
  timestamp,
  jsonb,
  index,
  primaryKey,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { chats } from './chats';
import { messages } from './messages';

/**
 * Статистика сообщений канала (просмотры, реакции, пересылки)
 */
export const channelMessageStats = pgTable(
  'channel_message_stats',
  {
    chatId: uuid('chat_id')
      .references(() => chats.id)
      .notNull(),
    messageId: bigint('message_id', { mode: 'bigint' })
      .references(() => messages.id)
      .notNull(),
    /** Количество просмотров */
    views: bigint('views', { mode: 'bigint' }).default(BigInt(0)).notNull(),
    /** Количество пересылок */
    forwards: bigint('forwards', { mode: 'bigint' }).default(BigInt(0)).notNull(),
    /** Реакции: {emoji: count} */
    reactions: jsonb('reactions').default({}).notNull(),
    /** Уникальные просмотревшие (приблизительно) */
    uniqueViewers: integer('unique_viewers').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.messageId] }),
    index('channel_message_stats_chat_id_idx').on(table.chatId),
    index('channel_message_stats_message_id_idx').on(table.messageId),
    index('channel_message_stats_views_idx').on(table.views),
    foreignKey({
      columns: [table.chatId],
      foreignColumns: [chats.id],
      name: 'channel_message_stats_chat_id_fkey',
    }),
    foreignKey({
      columns: [table.messageId],
      foreignColumns: [messages.id],
      name: 'channel_message_stats_message_id_fkey',
    }),
  ],
);

/**
 * Дневная статистика канала (прирост подписчиков, активность)
 */
export const channelDailyStats = pgTable(
  'channel_daily_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatId: uuid('chat_id')
      .references(() => chats.id)
      .notNull(),
    /** Дата статистики (без времени) */
    date: timestamp('date', { withTimezone: true }).notNull(),
    /** Общее количество подписчиков на конец дня */
    totalSubscribers: integer('total_subscribers').default(0).notNull(),
    /** Новые подписчики за день */
    newSubscribers: integer('new_subscribers').default(0).notNull(),
    /** Отписавшиеся за день */
    unsubscribers: integer('unsubscribers').default(0).notNull(),
    /** Суммарное количество просмотров за день */
    totalViews: bigint('total_views', { mode: 'bigint' }).default(BigInt(0)).notNull(),
    /** Суммарное количество реакций за день */
    totalReactions: bigint('total_reactions', { mode: 'bigint' }).default(BigInt(0)).notNull(),
    /** Суммарное количество пересылок за день */
    totalForwards: bigint('total_forwards', { mode: 'bigint' }).default(BigInt(0)).notNull(),
    /** Количество отправленных сообщений за день */
    messagesSent: integer('messages_sent').default(0).notNull(),
    /** Охват (уникальные пользователи, видевшие сообщения) */
    reach: integer('reach').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index('channel_daily_stats_chat_id_idx').on(table.chatId),
    index('channel_daily_stats_date_idx').on(table.date),
    index('channel_daily_stats_chat_date_idx').on(table.chatId, table.date),
  ],
);
