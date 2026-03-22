import { join } from 'path';

// From dist/, ../proto points to the proto files folder
const base = join(__dirname, '../proto');

export const AUTH_PROTO_PATH = join(base, 'auth.proto');
export const USER_PROTO_PATH = join(base, 'user.proto');
export const CHAT_PROTO_PATH = join(base, 'chat.proto');
export const MESSAGE_PROTO_PATH = join(base, 'message.proto');
export const MEDIA_PROTO_PATH = join(base, 'media.proto');
export const NOTIFICATION_PROTO_PATH = join(base, 'notification.proto');
export const CALL_PROTO_PATH = join(base, 'call.proto');
export const SEARCH_PROTO_PATH = join(base, 'search.proto');
export const STORY_PROTO_PATH = join(base, 'story.proto');
export const BOT_PROTO_PATH = join(base, 'bot.proto');
export const STICKER_PROTO_PATH = join(base, 'sticker.proto');
export const CUSTOM_EMOJI_PROTO_PATH = join(base, 'custom_emoji.proto');
export const MUSIC_PROTO_PATH = join(base, 'music.proto');

export const GRPC_PACKAGES = {
  AUTH: 'aluf.auth.v1',
  USER: 'aluf.user.v1',
  CHAT: 'aluf.chat.v1',
  MESSAGE: 'aluf.message.v1',
  MEDIA: 'aluf.media.v1',
  NOTIFICATION: 'aluf.notification.v1',
  CALL: 'aluf.call.v1',
  SEARCH: 'aluf.search.v1',
  STORY: 'aluf.story.v1',
  BOT: 'aluf.bot.v1',
  STICKER: 'aluf.sticker.v1',
  CUSTOM_EMOJI: 'aluf.custom_emoji.v1',
  MUSIC: 'aluf.music.v1',
} as const;

export type GrpcServiceKey = keyof typeof GRPC_PACKAGES;
