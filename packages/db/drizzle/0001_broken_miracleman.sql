CREATE TABLE IF NOT EXISTS "sticker_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bots" ADD COLUMN IF NOT EXISTS "webhook_secret" varchar(255);--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "retention_days" integer;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "sticker_pack_id" uuid;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_files_sticker_pack_id_sticker_packs_id_fk') THEN ALTER TABLE "media_files" ADD CONSTRAINT "media_files_sticker_pack_id_sticker_packs_id_fk" FOREIGN KEY ("sticker_pack_id") REFERENCES "public"."sticker_packs"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;