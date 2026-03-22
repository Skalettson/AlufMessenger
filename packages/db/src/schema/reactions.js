"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reactions = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const messages_1 = require("./messages");
const users_1 = require("./users");
exports.reactions = (0, pg_core_1.pgTable)('reactions', {
    messageId: (0, pg_core_1.bigint)('message_id', { mode: 'bigint' })
        .references(() => messages_1.messages.id)
        .notNull(),
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id)
        .notNull(),
    emoji: (0, pg_core_1.varchar)('emoji', { length: 64 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [(0, pg_core_1.primaryKey)({ columns: [table.messageId, table.userId] })]);
//# sourceMappingURL=reactions.js.map