"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userMusicPlaylistTracks = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const user_music_playlists_1 = require("./user-music-playlists");
const user_music_tracks_1 = require("./user-music-tracks");
exports.userMusicPlaylistTracks = (0, pg_core_1.pgTable)('user_music_playlist_tracks', {
    playlistId: (0, pg_core_1.uuid)('playlist_id')
        .references(() => user_music_playlists_1.userMusicPlaylists.id, { onDelete: 'cascade' })
        .notNull(),
    trackId: (0, pg_core_1.uuid)('track_id')
        .references(() => user_music_tracks_1.userMusicTracks.id, { onDelete: 'cascade' })
        .notNull(),
    position: (0, pg_core_1.integer)('position').notNull().default(0),
}, (t) => ({
    pk: (0, pg_core_1.primaryKey)({ columns: [t.playlistId, t.trackId] }),
}));
//# sourceMappingURL=user-music-playlist-tracks.js.map