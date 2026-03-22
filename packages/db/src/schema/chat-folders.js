"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatFolders = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
exports.chatFolders = (0, pg_core_1.pgTable)('chat_folders', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id)
        .notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 32 }).notNull(),
    icon: (0, pg_core_1.varchar)('icon', { length: 10 }),
    includedChatIds: (0, pg_core_1.jsonb)('included_chat_ids').default([]).notNull(),
    excludedChatIds: (0, pg_core_1.jsonb)('excluded_chat_ids').default([]).notNull(),
    includeTypes: (0, pg_core_1.jsonb)('include_types').default([]).notNull(),
    includeUnread: (0, pg_core_1.boolean)('include_unread').default(false).notNull(),
    includeMuted: (0, pg_core_1.boolean)('include_muted').default(false).notNull(),
    position: (0, pg_core_1.integer)('position').default(0).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [(0, pg_core_1.index)('chat_folders_user_id_idx').on(table.userId)]);
//# sourceMappingURL=chat-folders.js.map