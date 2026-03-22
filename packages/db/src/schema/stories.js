"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stories = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
const media_files_1 = require("./media-files");
exports.stories = (0, pg_core_1.pgTable)('stories', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id)
        .notNull(),
    mediaId: (0, pg_core_1.uuid)('media_id')
        .references(() => media_files_1.mediaFiles.id)
        .notNull(),
    caption: (0, pg_core_1.varchar)('caption', { length: 1024 }),
    privacy: (0, pg_core_1.jsonb)('privacy').default({}).notNull(),
    viewCount: (0, pg_core_1.integer)('view_count').default(0).notNull(),
    expiresAt: (0, pg_core_1.timestamp)('expires_at', { withTimezone: true }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [
    (0, pg_core_1.index)('stories_user_id_idx').on(table.userId),
    (0, pg_core_1.index)('stories_expires_at_idx').on(table.expiresAt),
]);
//# sourceMappingURL=stories.js.map