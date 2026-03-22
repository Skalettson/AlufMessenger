export declare const userMusicPlaylistTracks: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "user_music_playlist_tracks";
    schema: undefined;
    columns: {
        playlistId: import("drizzle-orm/pg-core").PgColumn<{
            name: "playlist_id";
            tableName: "user_music_playlist_tracks";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        trackId: import("drizzle-orm/pg-core").PgColumn<{
            name: "track_id";
            tableName: "user_music_playlist_tracks";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        position: import("drizzle-orm/pg-core").PgColumn<{
            name: "position";
            tableName: "user_music_playlist_tracks";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
//# sourceMappingURL=user-music-playlist-tracks.d.ts.map