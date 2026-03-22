"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatMembers = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const enums_1 = require("./enums");
const chats_1 = require("./chats");
const users_1 = require("./users");
exports.chatMembers = (0, pg_core_1.pgTable)('chat_members', {
    chatId: (0, pg_core_1.uuid)('chat_id')
        .references(() => chats_1.chats.id)
        .notNull(),
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id)
        .notNull(),
    role: (0, enums_1.memberRoleEnum)('role').default('member').notNull(),
    permissions: (0, pg_core_1.jsonb)('permissions').default({}).notNull(),
    joinedAt: (0, pg_core_1.timestamp)('joined_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
    mutedUntil: (0, pg_core_1.timestamp)('muted_until', { withTimezone: true }),
    lastReadMessageId: (0, pg_core_1.bigint)('last_read_message_id', { mode: 'bigint' }),
    isPinned: (0, pg_core_1.boolean)('is_pinned').default(false).notNull(),
    isArchived: (0, pg_core_1.boolean)('is_archived').default(false).notNull(),
}, (table) => [
    (0, pg_core_1.primaryKey)({ columns: [table.chatId, table.userId] }),
    (0, pg_core_1.index)('chat_members_user_id_idx').on(table.userId),
    (0, pg_core_1.index)('chat_members_chat_id_idx').on(table.chatId),
]);
//# sourceMappingURL=chat-members.js.map