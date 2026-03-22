ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "username" varchar(32);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chats_username_idx" ON "chats" USING btree ("username");--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chats_username_unique') THEN ALTER TABLE "chats" ADD CONSTRAINT "chats_username_unique" UNIQUE("username"); END IF; END $$;