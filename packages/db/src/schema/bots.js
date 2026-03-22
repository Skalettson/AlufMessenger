"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bots = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
exports.bots = (0, pg_core_1.pgTable)('bots', {
    id: (0, pg_core_1.uuid)('id').primaryKey(),
    ownerId: (0, pg_core_1.uuid)('owner_id')
        .references(() => users_1.users.id)
        .notNull(),
    token: (0, pg_core_1.varchar)('token', { length: 255 }).unique().notNull(),
    webhookUrl: (0, pg_core_1.text)('webhook_url'),
    webhookSecret: (0, pg_core_1.varchar)('webhook_secret', { length: 255 }),
    isInline: (0, pg_core_1.boolean)('is_inline').default(false).notNull(),
    commands: (0, pg_core_1.jsonb)('commands').default([]).notNull(),
    description: (0, pg_core_1.text)('description'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
});
//# sourceMappingURL=bots.js.map