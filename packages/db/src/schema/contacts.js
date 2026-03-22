"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contacts = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
exports.contacts = (0, pg_core_1.pgTable)('contacts', {
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id)
        .notNull(),
    contactUserId: (0, pg_core_1.uuid)('contact_user_id')
        .references(() => users_1.users.id)
        .notNull(),
    customName: (0, pg_core_1.varchar)('custom_name', { length: 64 }),
    isBlocked: (0, pg_core_1.boolean)('is_blocked').default(false).notNull(),
    isMuted: (0, pg_core_1.boolean)('is_muted').default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [(0, pg_core_1.primaryKey)({ columns: [table.userId, table.contactUserId] })]);
//# sourceMappingURL=contacts.js.map