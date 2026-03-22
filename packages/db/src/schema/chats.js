"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chats = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const enums_1 = require("./enums");
const users_1 = require("./users");
exports.chats = (0, pg_core_1.pgTable)('chats', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    type: (0, enums_1.chatTypeEnum)('type').notNull(),
    title: (0, pg_core_1.varchar)('title', { length: 255 }),
    description: (0, pg_core_1.text)('description'),
    avatarUrl: (0, pg_core_1.text)('avatar_url'),
    createdBy: (0, pg_core_1.uuid)('created_by')
        .references(() => users_1.users.id)
        .notNull(),
    settings: (0, pg_core_1.jsonb)('settings').default({}).notNull(),
    /** Хранение истории в днях; null = без ограничения (Premium) */
    retentionDays: (0, pg_core_1.integer)('retention_days'),
    memberCount: (0, pg_core_1.integer)('member_count').default(0).notNull(),
    /** Публичный username канала/группы (как в Telegram: 5–32 символа), ссылка /c/username */
    username: (0, pg_core_1.varchar)('username', { length: 32 }).unique(),
    inviteLink: (0, pg_core_1.varchar)('invite_link', { length: 32 }).unique(),
    lastMessageId: (0, pg_core_1.bigint)('last_message_id', { mode: 'bigint' }),
    lastMessageAt: (0, pg_core_1.timestamp)('last_message_at', { withTimezone: true }),
    /** ID чата с обсуждениями для канала (привязанная группа) */
    linkedDiscussionChatId: (0, pg_core_1.uuid)('linked_discussion_chat_id'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [
    (0, pg_core_1.index)('chats_type_idx').on(table.type),
    (0, pg_core_1.index)('chats_created_by_idx').on(table.createdBy),
    (0, pg_core_1.index)('chats_username_idx').on(table.username),
    (0, pg_core_1.uniqueIndex)('chats_invite_link_idx').on(table.inviteLink),
    (0, pg_core_1.index)('chats_linked_discussion_idx').on(table.linkedDiscussionChatId),
    (0, pg_core_1.foreignKey)({
        columns: [table.linkedDiscussionChatId],
        foreignColumns: [table.id],
        name: 'chats_linked_discussion_chat_id_fkey',
    }),
]);
//# sourceMappingURL=chats.js.map