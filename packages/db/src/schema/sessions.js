"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessions = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
exports.sessions = (0, pg_core_1.pgTable)('sessions', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id)
        .notNull(),
    tokenHash: (0, pg_core_1.varchar)('token_hash', { length: 255 }).notNull(),
    deviceInfo: (0, pg_core_1.jsonb)('device_info').notNull(),
    ip: (0, pg_core_1.varchar)('ip', { length: 45 }).notNull(),
    lastActiveAt: (0, pg_core_1.timestamp)('last_active_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
    expiresAt: (0, pg_core_1.timestamp)('expires_at', { withTimezone: true }).notNull(),
}, (table) => [
    (0, pg_core_1.index)('sessions_user_id_idx').on(table.userId),
    (0, pg_core_1.index)('sessions_token_hash_idx').on(table.tokenHash),
]);
//# sourceMappingURL=sessions.js.map