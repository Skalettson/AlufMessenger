"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadStatusEnum = exports.authMethodEnum = exports.callStatusEnum = exports.callTypeEnum = exports.deliveryStatusEnum = exports.contentTypeEnum = exports.memberRoleEnum = exports.chatTypeEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.chatTypeEnum = (0, pg_core_1.pgEnum)('chat_type', [
    'private',
    'group',
    'channel',
    'secret',
    'saved',
    'supergroup',
]);
exports.memberRoleEnum = (0, pg_core_1.pgEnum)('member_role', [
    'owner',
    'admin',
    'moderator',
    'member',
]);
exports.contentTypeEnum = (0, pg_core_1.pgEnum)('content_type', [
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
exports.deliveryStatusEnum = (0, pg_core_1.pgEnum)('delivery_status', [
    'sending',
    'sent',
    'delivered',
    'read',
    'failed',
]);
exports.callTypeEnum = (0, pg_core_1.pgEnum)('call_type', ['voice', 'video']);
exports.callStatusEnum = (0, pg_core_1.pgEnum)('call_status', [
    'ringing',
    'active',
    'ended',
    'missed',
    'declined',
    'busy',
]);
exports.authMethodEnum = (0, pg_core_1.pgEnum)('auth_method', [
    'phone',
    'email',
    'anonymous',
]);
exports.uploadStatusEnum = (0, pg_core_1.pgEnum)('upload_status', [
    'pending',
    'uploading',
    'processing',
    'completed',
    'failed',
]);
//# sourceMappingURL=enums.js.map