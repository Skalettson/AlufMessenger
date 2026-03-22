"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadSessions = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
exports.uploadSessions = (0, pg_core_1.pgTable)('upload_sessions', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id)
        .notNull(),
    fileName: (0, pg_core_1.varchar)('file_name', { length: 255 }).notNull(),
    mimeType: (0, pg_core_1.varchar)('mime_type', { length: 127 }).notNull(),
    totalSize: (0, pg_core_1.bigint)('total_size', { mode: 'bigint' }).notNull(),
    storageKey: (0, pg_core_1.varchar)('storage_key', { length: 512 }).notNull(),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('pending'),
    expiresAt: (0, pg_core_1.timestamp)('expires_at', { withTimezone: true }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
});
//# sourceMappingURL=upload-sessions.js.map