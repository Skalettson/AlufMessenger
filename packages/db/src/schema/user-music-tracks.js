"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userMusicTracks = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
const media_files_1 = require("./media-files");
exports.userMusicTracks = (0, pg_core_1.pgTable)('user_music_tracks', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id, { onDelete: 'cascade' })
        .notNull(),
    title: (0, pg_core_1.varchar)('title', { length: 512 }).notNull(),
    artist: (0, pg_core_1.varchar)('artist', { length: 512 }).notNull(),
    genre: (0, pg_core_1.varchar)('genre', { length: 128 }).notNull().default(''),
    audioMediaId: (0, pg_core_1.uuid)('audio_media_id')
        .references(() => media_files_1.mediaFiles.id, { onDelete: 'restrict' })
        .notNull(),
    coverMediaId: (0, pg_core_1.uuid)('cover_media_id').references(() => media_files_1.mediaFiles.id, {
        onDelete: 'set null',
    }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
});
//# sourceMappingURL=user-music-tracks.js.map