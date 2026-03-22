"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationTokens = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
exports.notificationTokens = (0, pg_core_1.pgTable)('notification_tokens', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id)
        .notNull(),
    token: (0, pg_core_1.text)('token').notNull(),
    platform: (0, pg_core_1.varchar)('platform', { length: 10 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [(0, pg_core_1.index)('notification_tokens_user_id_idx').on(table.userId)]);
//# sourceMappingURL=notification-tokens.js.map