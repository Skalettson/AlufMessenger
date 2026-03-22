import { pgEnum } from 'drizzle-orm/pg-core';

export const chatTypeEnum = pgEnum('chat_type', [
  'private',
  'group',
  'channel',
  'secret',
  'saved',
  'supergroup',
]);

export const memberRoleEnum = pgEnum('member_role', [
  'owner',
  'admin',
  'moderator',
  'member',
]);

export const contentTypeEnum = pgEnum('content_type', [
  'text',
  'image',
  'video',
  'audio',
  'voice',
  'video_note',
  'document',
  'sticker',
  'gif',
  'location',
  'live_location',
  'contact',
  'poll',
  'system',
]);

export const deliveryStatusEnum = pgEnum('delivery_status', [
  'sending',
  'sent',
  'delivered',
  'read',
  'failed',
]);

export const callTypeEnum = pgEnum('call_type', ['voice', 'video']);

export const callStatusEnum = pgEnum('call_status', [
  'ringing',
  'active',
  'ended',
  'missed',
  'declined',
  'busy',
]);

export const authMethodEnum = pgEnum('auth_method', [
  'phone',
  'email',
  'anonymous',
]);

export const uploadStatusEnum = pgEnum('upload_status', [
  'pending',
  'uploading',
  'processing',
  'completed',
  'failed',
]);
