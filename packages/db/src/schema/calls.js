"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calls = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const enums_1 = require("./enums");
const chats_1 = require("./chats");
const users_1 = require("./users");
exports.calls = (0, pg_core_1.pgTable)('calls', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    chatId: (0, pg_core_1.uuid)('chat_id')
        .references(() => chats_1.chats.id)
        .notNull(),
    initiatorId: (0, pg_core_1.uuid)('initiator_id')
        .references(() => users_1.users.id)
        .notNull(),
    type: (0, enums_1.callTypeEnum)('type').notNull(),
    isGroup: (0, pg_core_1.boolean)('is_group').default(false).notNull(),
    status: (0, enums_1.callStatusEnum)('status').default('ringing').notNull(),
    startedAt: (0, pg_core_1.timestamp)('started_at', { withTimezone: true }),
    endedAt: (0, pg_core_1.timestamp)('ended_at', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [(0, pg_core_1.index)('calls_chat_id_idx').on(table.chatId)]);
//# sourceMappingURL=calls.js.map