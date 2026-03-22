"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inviteLinks = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const chats_1 = require("./chats");
const users_1 = require("./users");
exports.inviteLinks = (0, pg_core_1.pgTable)('invite_links', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    chatId: (0, pg_core_1.uuid)('chat_id')
        .references(() => chats_1.chats.id)
        .notNull(),
    createdBy: (0, pg_core_1.uuid)('created_by')
        .references(() => users_1.users.id)
        .notNull(),
    code: (0, pg_core_1.varchar)('code', { length: 32 }).unique().notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 64 }),
    usageLimit: (0, pg_core_1.integer)('usage_limit'),
    usageCount: (0, pg_core_1.integer)('usage_count').default(0).notNull(),
    expiresAt: (0, pg_core_1.timestamp)('expires_at', { withTimezone: true }),
    requiresApproval: (0, pg_core_1.boolean)('requires_approval').default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('invite_links_code_idx').on(table.code),
    (0, pg_core_1.index)('invite_links_chat_id_idx').on(table.chatId),
]);
//# sourceMappingURL=invite-links.js.map