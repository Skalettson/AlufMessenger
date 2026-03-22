import { pgTable, uuid, integer, primaryKey } from 'drizzle-orm/pg-core';
import { userMusicPlaylists } from './user-music-playlists';
import { userMusicTracks } from './user-music-tracks';

export const userMusicPlaylistTracks = pgTable(
  'user_music_playlist_tracks',
  {
    playlistId: uuid('playlist_id')
      .references(() => userMusicPlaylists.id, { onDelete: 'cascade' })
      .notNull(),
    trackId: uuid('track_id')
      .references(() => userMusicTracks.id, { onDelete: 'cascade' })
      .notNull(),
    position: integer('position').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.playlistId, t.trackId] }),
  }),
);
