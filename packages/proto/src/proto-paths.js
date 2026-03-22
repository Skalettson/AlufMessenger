"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GRPC_PACKAGES = exports.MUSIC_PROTO_PATH = exports.CUSTOM_EMOJI_PROTO_PATH = exports.STICKER_PROTO_PATH = exports.BOT_PROTO_PATH = exports.STORY_PROTO_PATH = exports.SEARCH_PROTO_PATH = exports.CALL_PROTO_PATH = exports.NOTIFICATION_PROTO_PATH = exports.MEDIA_PROTO_PATH = exports.MESSAGE_PROTO_PATH = exports.CHAT_PROTO_PATH = exports.USER_PROTO_PATH = exports.AUTH_PROTO_PATH = void 0;
const path_1 = require("path");
// From dist/, ../proto points to the proto files folder
const base = (0, path_1.join)(__dirname, '../proto');
exports.AUTH_PROTO_PATH = (0, path_1.join)(base, 'auth.proto');
exports.USER_PROTO_PATH = (0, path_1.join)(base, 'user.proto');
exports.CHAT_PROTO_PATH = (0, path_1.join)(base, 'chat.proto');
exports.MESSAGE_PROTO_PATH = (0, path_1.join)(base, 'message.proto');
exports.MEDIA_PROTO_PATH = (0, path_1.join)(base, 'media.proto');
exports.NOTIFICATION_PROTO_PATH = (0, path_1.join)(base, 'notification.proto');
exports.CALL_PROTO_PATH = (0, path_1.join)(base, 'call.proto');
exports.SEARCH_PROTO_PATH = (0, path_1.join)(base, 'search.proto');
exports.STORY_PROTO_PATH = (0, path_1.join)(base, 'story.proto');
exports.BOT_PROTO_PATH = (0, path_1.join)(base, 'bot.proto');
exports.STICKER_PROTO_PATH = (0, path_1.join)(base, 'sticker.proto');
exports.CUSTOM_EMOJI_PROTO_PATH = (0, path_1.join)(base, 'custom_emoji.proto');
exports.MUSIC_PROTO_PATH = (0, path_1.join)(base, 'music.proto');
exports.GRPC_PACKAGES = {
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
};
//# sourceMappingURL=proto-paths.js.map