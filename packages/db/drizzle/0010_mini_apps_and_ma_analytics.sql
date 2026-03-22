CREATE TABLE IF NOT EXISTS "mini_apps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(256) NOT NULL,
  "version" varchar(64) DEFAULT '1.0.0' NOT NULL,
  "description" text,
  "icon" varchar(512),
  "category" varchar(128) DEFAULT 'general' NOT NULL,
  "url" varchar(2048) NOT NULL,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" varchar(32) DEFAULT 'draft' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "mini_apps_status_idx" ON "mini_apps" ("status");
CREATE INDEX IF NOT EXISTS "mini_apps_category_idx" ON "mini_apps" ("category");

CREATE TABLE IF NOT EXISTS "ma_analytics_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL REFERENCES "mini_apps"("id") ON DELETE CASCADE,
  "user_id" uuid,
  "event" varchar(128) NOT NULL,
  "properties" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ma_analytics_app_created_idx" ON "ma_analytics_events" ("app_id", "created_at");
CREATE INDEX IF NOT EXISTS "ma_analytics_event_idx" ON "ma_analytics_events" ("event");
