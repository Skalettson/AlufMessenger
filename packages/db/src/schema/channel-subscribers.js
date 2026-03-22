"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.channelSubscribers = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const chats_1 = require("./chats");
const users_1 = require("./users");
/**
 * Подписчики каналов
 * Для каналов: все участники канала - подписчики
 * Для групп: участники группы
 */
exports.channelSubscribers = (0, pg_core_1.pgTable)('channel_subscribers', {
    chatId: (0, pg_core_1.uuid)('chat_id')
        .references(() => chats_1.chats.id)
        .notNull(),
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id)
        .notNull(),
    /** Дата подписки */
    subscribedAt: (0, pg_core_1.timestamp)('subscribed_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
    /** Включены ли уведомления */
    notificationsEnabled: (0, pg_core_1.boolean)('notifications_enabled').default(true).notNull(),
    /** Активна ли подписка (false = отписался) */
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    /** Дата последней активности (чтение сообщений) */
    lastActivityAt: (0, pg_core_1.timestamp)('last_activity_at', { withTimezone: true }),
}, (table) => [
    (0, pg_core_1.primaryKey)({ columns: [table.chatId, table.userId] }),
    (0, pg_core_1.index)('channel_subscribers_chat_id_idx').on(table.chatId),
    (0, pg_core_1.index)('channel_subscribers_user_id_idx').on(table.userId),
    (0, pg_core_1.index)('channel_subscribers_active_idx').on(table.isActive),
    (0, pg_core_1.foreignKey)({
        columns: [table.chatId],
        foreignColumns: [chats_1.chats.id],
        name: 'channel_subscribers_chat_id_fkey',
    }),
    (0, pg_core_1.foreignKey)({
        columns: [table.userId],
        foreignColumns: [users_1.users.id],
        name: 'channel_subscribers_user_id_fkey',
    }),
]);
//# sourceMappingURL=channel-subscribers.js.map