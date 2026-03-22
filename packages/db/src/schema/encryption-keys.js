"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptionKeys = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
exports.encryptionKeys = (0, pg_core_1.pgTable)('encryption_keys', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id)
        .notNull(),
    keyType: (0, pg_core_1.varchar)('key_type', { length: 50 }).notNull(),
    publicKey: (0, pg_core_1.text)('public_key').notNull(),
    keyBundle: (0, pg_core_1.jsonb)('key_bundle'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [(0, pg_core_1.index)('encryption_keys_user_id_idx').on(table.userId)]);
//# sourceMappingURL=encryption-keys.js.map