"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatBans = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
const chats_1 = require("./chats");
/** Чёрный список участников группы/канала */
exports.chatBans = (0, pg_core_1.pgTable)('chat_bans', {
    chatId: (0, pg_core_1.uuid)('chat_id')
        .references(() => chats_1.chats.id)
        .notNull(),
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id)
        .notNull(),
    bannedBy: (0, pg_core_1.uuid)('banned_by')
        .references(() => users_1.users.id)
        .notNull(),
    reason: (0, pg_core_1.text)('reason'),
    expiresAt: (0, pg_core_1.timestamp)('expires_at', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [
    (0, pg_core_1.primaryKey)({ columns: [table.chatId, table.userId] }),
    (0, pg_core_1.index)('chat_bans_chat_id_idx').on(table.chatId),
    (0, pg_core_1.index)('chat_bans_user_id_idx').on(table.userId),
]);
//# sourceMappingURL=chat-bans.js.map