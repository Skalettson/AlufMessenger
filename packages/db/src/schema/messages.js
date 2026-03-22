"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messages = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const enums_1 = require("./enums");
const chats_1 = require("./chats");
const users_1 = require("./users");
exports.messages = (0, pg_core_1.pgTable)('messages', {
    id: (0, pg_core_1.bigint)('id', { mode: 'bigint' }).primaryKey(),
    chatId: (0, pg_core_1.uuid)('chat_id')
        .references(() => chats_1.chats.id)
        .notNull(),
    senderId: (0, pg_core_1.uuid)('sender_id')
        .references(() => users_1.users.id)
        .notNull(),
    replyToId: (0, pg_core_1.bigint)('reply_to_id', { mode: 'bigint' }),
    forwardFromId: (0, pg_core_1.bigint)('forward_from_id', { mode: 'bigint' }),
    forwardFromChatId: (0, pg_core_1.uuid)('forward_from_chat_id'),
    topicId: (0, pg_core_1.uuid)('topic_id'),
    contentType: (0, enums_1.contentTypeEnum)('content_type').notNull(),
    textContent: (0, pg_core_1.text)('text_content'),
    mediaId: (0, pg_core_1.uuid)('media_id'),
    scheduledAt: (0, pg_core_1.timestamp)('scheduled_at', { withTimezone: true }),
    metadata: (0, pg_core_1.jsonb)('metadata').default({}).notNull(),
    isEdited: (0, pg_core_1.boolean)('is_edited').default(false).notNull(),
    isPinned: (0, pg_core_1.boolean)('is_pinned').default(false).notNull(),
    /** Скрывать автора сообщения (публикация от имени канала) */
    hideAuthor: (0, pg_core_1.boolean)('hide_author').default(false).notNull(),
    selfDestructAt: (0, pg_core_1.timestamp)('self_destruct_at', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
    editedAt: (0, pg_core_1.timestamp)('edited_at', { withTimezone: true }),
}, (table) => [
    (0, pg_core_1.index)('messages_chat_id_created_at_idx').on(table.chatId, table.createdAt),
    (0, pg_core_1.index)('messages_sender_id_idx').on(table.senderId),
    (0, pg_core_1.index)('messages_hide_author_idx').on(table.hideAuthor),
]);
//# sourceMappingURL=messages.js.map