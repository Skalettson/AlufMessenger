"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageStatus = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const enums_1 = require("./enums");
const messages_1 = require("./messages");
const users_1 = require("./users");
exports.messageStatus = (0, pg_core_1.pgTable)('message_status', {
    messageId: (0, pg_core_1.bigint)('message_id', { mode: 'bigint' })
        .references(() => messages_1.messages.id)
        .notNull(),
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id)
        .notNull(),
    status: (0, enums_1.deliveryStatusEnum)('status').notNull(),
    timestamp: (0, pg_core_1.timestamp)('timestamp', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [(0, pg_core_1.primaryKey)({ columns: [table.messageId, table.userId] })]);
//# sourceMappingURL=message-status.js.map