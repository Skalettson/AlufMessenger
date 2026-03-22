export declare const chatTypeEnum: import("drizzle-orm/pg-core").PgEnum<["private", "group", "channel", "secret", "saved", "supergroup"]>;
export declare const memberRoleEnum: import("drizzle-orm/pg-core").PgEnum<["owner", "admin", "moderator", "member"]>;
export declare const contentTypeEnum: import("drizzle-orm/pg-core").PgEnum<["text", "image", "video", "audio", "voice", "video_note", "document", "sticker", "gif", "location", "live_location", "contact", "poll", "system"]>;
export declare const deliveryStatusEnum: import("drizzle-orm/pg-core").PgEnum<["sending", "sent", "delivered", "read", "failed"]>;
export declare const callTypeEnum: import("drizzle-orm/pg-core").PgEnum<["voice", "video"]>;
export declare const callStatusEnum: import("drizzle-orm/pg-core").PgEnum<["ringing", "active", "ended", "missed", "declined", "busy"]>;
export declare const authMethodEnum: import("drizzle-orm/pg-core").PgEnum<["phone", "email", "anonymous"]>;
export declare const uploadStatusEnum: import("drizzle-orm/pg-core").PgEnum<["pending", "uploading", "processing", "completed", "failed"]>;
//# sourceMappingURL=enums.d.ts.map