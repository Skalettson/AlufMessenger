-- User music library (tracks + playlists)

CREATE TABLE IF NOT EXISTS "user_music_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(512) NOT NULL,
	"artist" varchar(512) NOT NULL,
	"genre" varchar(128) DEFAULT '' NOT NULL,
	"audio_media_id" uuid NOT NULL,
	"cover_media_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_music_tracks" ADD CONSTRAINT "user_music_tracks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_music_tracks" ADD CONSTRAINT "user_music_tracks_audio_media_id_media_files_id_fk" FOREIGN KEY ("audio_media_id") REFERENCES "public"."media_files"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_music_tracks" ADD CONSTRAINT "user_music_tracks_cover_media_id_media_files_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media_files"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_music_playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover_media_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_music_playlists" ADD CONSTRAINT "user_music_playlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_music_playlists" ADD CONSTRAINT "user_music_playlists_cover_media_id_media_files_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media_files"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_music_playlist_tracks" (
	"playlist_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_music_playlist_tracks_playlist_id_track_id_pk" PRIMARY KEY("playlist_id","track_id")
);
--> statement-breakpoint
ALTER TABLE "user_music_playlist_tracks" ADD CONSTRAINT "user_music_playlist_tracks_playlist_id_user_music_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."user_music_playlists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_music_playlist_tracks" ADD CONSTRAINT "user_music_playlist_tracks_track_id_user_music_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."user_music_tracks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_music_tracks_user_id_idx" ON "user_music_tracks" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_music_playlists_user_id_idx" ON "user_music_playlists" ("user_id");
