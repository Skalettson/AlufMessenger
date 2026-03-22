-- Добавляем поле linkedDiscussionChatId в таблицу chats
ALTER TABLE "chats" ADD COLUMN "linked_discussion_chat_id" uuid;
--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_linked_discussion_chat_id_fkey" FOREIGN KEY ("linked_discussion_chat_id") REFERENCES "chats"("id") ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chats_linked_discussion_idx" ON "chats" USING btree ("linked_discussion_chat_id");

-- Добавляем поле hide_author в таблицу messages
ALTER TABLE "messages" ADD COLUMN "hide_author" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_hide_author_idx" ON "messages" USING btree ("hide_author");

-- Создаём таблицу channel_message_stats для статистики сообщений каналов
CREATE TABLE IF NOT EXISTS "channel_message_stats" (
	"chat_id" uuid NOT NULL REFERENCES "chats"("id") ON DELETE cascade ON UPDATE cascade,
	"message_id" bigint NOT NULL REFERENCES "messages"("id") ON DELETE cascade ON UPDATE cascade,
	"views" bigint DEFAULT '0' NOT NULL,
	"forwards" bigint DEFAULT '0' NOT NULL,
	"reactions" jsonb DEFAULT '{}' NOT NULL,
	"unique_viewers" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_message_stats_pkey" PRIMARY KEY("chat_id","message_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "channel_message_stats_chat_id_idx" ON "channel_message_stats" USING btree ("chat_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "channel_message_stats_message_id_idx" ON "channel_message_stats" USING btree ("message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "channel_message_stats_views_idx" ON "channel_message_stats" USING btree ("views");

-- Создаём таблицу channel_daily_stats для дневной статистики каналов
CREATE TABLE IF NOT EXISTS "channel_daily_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL REFERENCES "chats"("id") ON DELETE cascade ON UPDATE cascade,
	"date" timestamp with time zone NOT NULL,
	"total_subscribers" integer DEFAULT 0 NOT NULL,
	"new_subscribers" integer DEFAULT 0 NOT NULL,
	"unsubscribers" integer DEFAULT 0 NOT NULL,
	"total_views" bigint DEFAULT '0' NOT NULL,
	"total_reactions" bigint DEFAULT '0' NOT NULL,
	"total_forwards" bigint DEFAULT '0' NOT NULL,
	"messages_sent" integer DEFAULT 0 NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "channel_daily_stats_chat_id_idx" ON "channel_daily_stats" USING btree ("chat_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "channel_daily_stats_date_idx" ON "channel_daily_stats" USING btree ("date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "channel_daily_stats_chat_date_idx" ON "channel_daily_stats" USING btree ("chat_id","date");

-- Создаём таблицу channel_subscribers для подписчиков каналов
CREATE TABLE IF NOT EXISTS "channel_subscribers" (
	"chat_id" uuid NOT NULL REFERENCES "chats"("id") ON DELETE cascade ON UPDATE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade ON UPDATE cascade,
	"subscribed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_activity_at" timestamp with time zone,
	CONSTRAINT "channel_subscribers_pkey" PRIMARY KEY("chat_id","user_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "channel_subscribers_chat_id_idx" ON "channel_subscribers" USING btree ("chat_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "channel_subscribers_user_id_idx" ON "channel_subscribers" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "channel_subscribers_active_idx" ON "channel_subscribers" USING btree ("is_active");
