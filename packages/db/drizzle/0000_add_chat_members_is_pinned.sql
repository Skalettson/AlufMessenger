-- Add is_pinned to chat_members for pin/unpin chats feature
ALTER TABLE "chat_members" ADD COLUMN IF NOT EXISTS "is_pinned" boolean DEFAULT false NOT NULL;
