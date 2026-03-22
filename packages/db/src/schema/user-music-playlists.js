"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userMusicPlaylists = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
const media_files_1 = require("./media-files");
exports.userMusicPlaylists = (0, pg_core_1.pgTable)('user_music_playlists', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id, { onDelete: 'cascade' })
        .notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 256 }).notNull(),
    description: (0, pg_core_1.text)('description').notNull().default(''),
    coverMediaId: (0, pg_core_1.uuid)('cover_media_id')
        .references(() => media_files_1.mediaFiles.id, { onDelete: 'restrict' })
        .notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
});
//# sourceMappingURL=user-music-playlists.js.map