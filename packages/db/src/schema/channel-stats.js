"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.channelDailyStats = exports.channelMessageStats = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const chats_1 = require("./chats");
const messages_1 = require("./messages");
/**
 * Статистика сообщений канала (просмотры, реакции, пересылки)
 */
exports.channelMessageStats = (0, pg_core_1.pgTable)('channel_message_stats', {
    chatId: (0, pg_core_1.uuid)('chat_id')
        .references(() => chats_1.chats.id)
        .notNull(),
    messageId: (0, pg_core_1.bigint)('message_id', { mode: 'bigint' })
        .references(() => messages_1.messages.id)
        .notNull(),
    /** Количество просмотров */
    views: (0, pg_core_1.bigint)('views', { mode: 'bigint' }).default(BigInt(0)).notNull(),
    /** Количество пересылок */
    forwards: (0, pg_core_1.bigint)('forwards', { mode: 'bigint' }).default(BigInt(0)).notNull(),
    /** Реакции: {emoji: count} */
    reactions: (0, pg_core_1.jsonb)('reactions').default({}).notNull(),
    /** Уникальные просмотревшие (приблизительно) */
    uniqueViewers: (0, pg_core_1.integer)('unique_viewers').default(0).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [
    (0, pg_core_1.primaryKey)({ columns: [table.chatId, table.messageId] }),
    (0, pg_core_1.index)('channel_message_stats_chat_id_idx').on(table.chatId),
    (0, pg_core_1.index)('channel_message_stats_message_id_idx').on(table.messageId),
    (0, pg_core_1.index)('channel_message_stats_views_idx').on(table.views),
    (0, pg_core_1.foreignKey)({
        columns: [table.chatId],
        foreignColumns: [chats_1.chats.id],
        name: 'channel_message_stats_chat_id_fkey',
    }),
    (0, pg_core_1.foreignKey)({
        columns: [table.messageId],
        foreignColumns: [messages_1.messages.id],
        name: 'channel_message_stats_message_id_fkey',
    }),
]);
/**
 * Дневная статистика канала (прирост подписчиков, активность)
 */
exports.channelDailyStats = (0, pg_core_1.pgTable)('channel_daily_stats', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    chatId: (0, pg_core_1.uuid)('chat_id')
        .references(() => chats_1.chats.id)
        .notNull(),
    /** Дата статистики (без времени) */
    date: (0, pg_core_1.timestamp)('date', { withTimezone: true }).notNull(),
    /** Общее количество подписчиков на конец дня */
    totalSubscribers: (0, pg_core_1.integer)('total_subscribers').default(0).notNull(),
    /** Новые подписчики за день */
    newSubscribers: (0, pg_core_1.integer)('new_subscribers').default(0).notNull(),
    /** Отписавшиеся за день */
    unsubscribers: (0, pg_core_1.integer)('unsubscribers').default(0).notNull(),
    /** Суммарное количество просмотров за день */
    totalViews: (0, pg_core_1.bigint)('total_views', { mode: 'bigint' }).default(BigInt(0)).notNull(),
    /** Суммарное количество реакций за день */
    totalReactions: (0, pg_core_1.bigint)('total_reactions', { mode: 'bigint' }).default(BigInt(0)).notNull(),
    /** Суммарное количество пересылок за день */
    totalForwards: (0, pg_core_1.bigint)('total_forwards', { mode: 'bigint' }).default(BigInt(0)).notNull(),
    /** Количество отправленных сообщений за день */
    messagesSent: (0, pg_core_1.integer)('messages_sent').default(0).notNull(),
    /** Охват (уникальные пользователи, видевшие сообщения) */
    reach: (0, pg_core_1.integer)('reach').default(0).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [
    (0, pg_core_1.index)('channel_daily_stats_chat_id_idx').on(table.chatId),
    (0, pg_core_1.index)('channel_daily_stats_date_idx').on(table.date),
    (0, pg_core_1.index)('channel_daily_stats_chat_date_idx').on(table.chatId, table.date),
]);
//# sourceMappingURL=channel-stats.js.map