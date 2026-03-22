-- Migration for enhanced group features
-- Apply this migration manually using: psql <connection_string> -f 0007_enhanced_groups.sql
-- Or via Node.js script: node scripts/apply-migration.js

-- Add supergroup type to chat_type enum
DO $$ BEGIN
    ALTER TYPE "chat_type" ADD VALUE IF NOT EXISTS 'supergroup';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create chat_bans table for banned members
CREATE TABLE IF NOT EXISTS "chat_bans" (
  "chat_id" uuid NOT NULL REFERENCES "chats"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "banned_by" uuid NOT NULL REFERENCES "users"("id"),
  "reason" text,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chat_bans_pkey" PRIMARY KEY ("chat_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "chat_bans_chat_id_idx" ON "chat_bans"("chat_id");
CREATE INDEX IF NOT EXISTS "chat_bans_user_id_idx" ON "chat_bans"("user_id");

-- Create chat_audit_logs table for admin actions logging
CREATE TABLE IF NOT EXISTS "chat_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chat_id" uuid NOT NULL REFERENCES "chats"("id") ON DELETE CASCADE,
  "actor_id" uuid NOT NULL REFERENCES "users"("id"),
  "action" varchar(50) NOT NULL,
  "target_user_id" uuid REFERENCES "users"("id"),
  "target_message_id" uuid,
  "details" jsonb DEFAULT '{}',
  "ip_address" varchar(45),
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "chat_audit_logs_chat_id_idx" ON "chat_audit_logs"("chat_id");
CREATE INDEX IF NOT EXISTS "chat_audit_logs_actor_id_idx" ON "chat_audit_logs"("actor_id");
CREATE INDEX IF NOT EXISTS "chat_audit_logs_action_idx" ON "chat_audit_logs"("action");
CREATE INDEX IF NOT EXISTS "chat_audit_logs_created_at_idx" ON "chat_audit_logs"("created_at");

-- Create chat_topics table for group topics/threads
CREATE TABLE IF NOT EXISTS "chat_topics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chat_id" uuid NOT NULL REFERENCES "chats"("id") ON DELETE CASCADE,
  "title" varchar(255) NOT NULL,
  "icon" varchar(50),
  "color" integer,
  "created_by" uuid NOT NULL,
  "is_closed" boolean DEFAULT false NOT NULL,
  "is_pinned" boolean DEFAULT false NOT NULL,
  "last_message_id" uuid,
  "unread_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "chat_topics_chat_id_idx" ON "chat_topics"("chat_id");
CREATE INDEX IF NOT EXISTS "chat_topics_created_by_idx" ON "chat_topics"("created_by");
CREATE INDEX IF NOT EXISTS "chat_topics_is_pinned_idx" ON "chat_topics"("is_pinned");

-- Create chat_moderation_settings table for group moderation
CREATE TABLE IF NOT EXISTS "chat_moderation_settings" (
  "chat_id" uuid PRIMARY KEY REFERENCES "chats"("id") ON DELETE CASCADE,
  "forbidden_words" text[],
  "forbidden_words_mode" varchar(20) DEFAULT 'warn',
  "anti_spam_enabled" boolean DEFAULT false NOT NULL,
  "anti_spam_messages_limit" integer DEFAULT 5,
  "anti_spam_time_window" integer DEFAULT 10,
  "anti_spam_action" varchar(20) DEFAULT 'warn',
  "links_allowed" boolean DEFAULT true NOT NULL,
  "links_require_approval" boolean DEFAULT false,
  "captcha_enabled" boolean DEFAULT false NOT NULL,
  "captcha_timeout" integer DEFAULT 300,
  "media_require_approval" boolean DEFAULT false,
  "auto_delete_spam" boolean DEFAULT false,
  "auto_ban_repeat_offenders" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "chat_moderation_settings_chat_id_idx" ON "chat_moderation_settings"("chat_id");

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "chats_type_idx" ON "chats"("type");
CREATE INDEX IF NOT EXISTS "chats_created_by_idx" ON "chats"("created_by");
CREATE INDEX IF NOT EXISTS "chats_username_idx" ON "chats"("username");
