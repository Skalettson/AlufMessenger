"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customEmoji = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
const media_files_1 = require("./media-files");
exports.customEmoji = (0, pg_core_1.pgTable)('custom_emoji', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    creatorId: (0, pg_core_1.uuid)('creator_id')
        .references(() => users_1.users.id, { onDelete: 'cascade' })
        .notNull(),
    mediaId: (0, pg_core_1.uuid)('media_id')
        .references(() => media_files_1.mediaFiles.id, { onDelete: 'cascade' })
        .notNull(),
    shortcode: (0, pg_core_1.varchar)('shortcode', { length: 64 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [(0, pg_core_1.uniqueIndex)('custom_emoji_shortcode_unique').on(table.shortcode)]);
//# sourceMappingURL=custom-emoji.js.map