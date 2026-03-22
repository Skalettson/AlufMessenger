CREATE TABLE IF NOT EXISTS "custom_emoji" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"shortcode" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_sticker_packs" (
	"user_id" uuid NOT NULL,
	"sticker_pack_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sticker_packs_user_id_sticker_pack_id_pk" PRIMARY KEY("user_id","sticker_pack_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_custom_emoji" (
	"user_id" uuid NOT NULL,
	"custom_emoji_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_custom_emoji_user_id_custom_emoji_id_pk" PRIMARY KEY("user_id","custom_emoji_id")
);
--> statement-breakpoint
ALTER TABLE "reactions" ALTER COLUMN "emoji" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "sticker_packs" ADD COLUMN IF NOT EXISTS "creator_id" uuid;--> statement-breakpoint
ALTER TABLE "sticker_packs" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sticker_packs" ADD COLUMN IF NOT EXISTS "cover_media_id" uuid;--> statement-breakpoint
ALTER TABLE "sticker_packs" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "sticker_packs" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_emoji_creator_id_users_id_fk') THEN ALTER TABLE "custom_emoji" ADD CONSTRAINT "custom_emoji_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_emoji_media_id_media_files_id_fk') THEN ALTER TABLE "custom_emoji" ADD CONSTRAINT "custom_emoji_media_id_media_files_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_files"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_sticker_packs_user_id_users_id_fk') THEN ALTER TABLE "user_sticker_packs" ADD CONSTRAINT "user_sticker_packs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_sticker_packs_sticker_pack_id_sticker_packs_id_fk') THEN ALTER TABLE "user_sticker_packs" ADD CONSTRAINT "user_sticker_packs_sticker_pack_id_sticker_packs_id_fk" FOREIGN KEY ("sticker_pack_id") REFERENCES "public"."sticker_packs"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_custom_emoji_user_id_users_id_fk') THEN ALTER TABLE "user_custom_emoji" ADD CONSTRAINT "user_custom_emoji_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_custom_emoji_custom_emoji_id_custom_emoji_id_fk') THEN ALTER TABLE "user_custom_emoji" ADD CONSTRAINT "user_custom_emoji_custom_emoji_id_custom_emoji_id_fk" FOREIGN KEY ("custom_emoji_id") REFERENCES "public"."custom_emoji"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "custom_emoji_shortcode_unique" ON "custom_emoji" USING btree ("shortcode");--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sticker_packs_creator_id_users_id_fk') THEN ALTER TABLE "sticker_packs" ADD CONSTRAINT "sticker_packs_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;