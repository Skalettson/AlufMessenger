ALTER TABLE "user_music_tracks" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;
