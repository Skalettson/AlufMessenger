CREATE TABLE IF NOT EXISTS "ma_payment_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" varchar(128) NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"title" varchar(512) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"amount" numeric(18, 4) NOT NULL,
	"currency" varchar(8) DEFAULT 'RUB' NOT NULL,
	"payload" varchar(512),
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"url" varchar(2048) NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"paid_at" timestamptz
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ma_payment_invoices_app_user_idx" ON "ma_payment_invoices" ("app_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ma_payment_invoices_status_idx" ON "ma_payment_invoices" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ma_payment_invoices_created_idx" ON "ma_payment_invoices" ("created_at");
