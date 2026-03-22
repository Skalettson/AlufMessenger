"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatTopics = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const chats_1 = require("./chats");
/** Темы/топики для групп (как в Telegram Groups 2.0) */
exports.chatTopics = (0, pg_core_1.pgTable)('chat_topics', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    chatId: (0, pg_core_1.uuid)('chat_id')
        .references(() => chats_1.chats.id)
        .notNull(),
    title: (0, pg_core_1.varchar)('title', { length: 255 }).notNull(),
    icon: (0, pg_core_1.varchar)('icon', { length: 50 }),
    color: (0, pg_core_1.integer)('color'),
    createdBy: (0, pg_core_1.uuid)('created_by').notNull(),
    isClosed: (0, pg_core_1.boolean)('is_closed').default(false).notNull(),
    isPinned: (0, pg_core_1.boolean)('is_pinned').default(false).notNull(),
    lastMessageId: (0, pg_core_1.uuid)('last_message_id'),
    unreadCount: (0, pg_core_1.integer)('unread_count').default(0).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [
    (0, pg_core_1.index)('chat_topics_chat_id_idx').on(table.chatId),
    (0, pg_core_1.index)('chat_topics_created_by_idx').on(table.createdBy),
    (0, pg_core_1.index)('chat_topics_is_pinned_idx').on(table.isPinned),
]);
//# sourceMappingURL=chat-topics.js.map