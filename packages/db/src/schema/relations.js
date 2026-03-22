"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reactionsRelations = exports.notificationTokensRelations = exports.notificationPreferencesRelations = exports.inviteLinksRelations = exports.chatFoldersRelations = exports.callParticipantsRelations = exports.callsRelations = exports.botsRelations = exports.encryptionKeysRelations = exports.storyViewsRelations = exports.storiesRelations = exports.userCustomEmojiRelations = exports.customEmojiRelations = exports.userMusicPlaylistTracksRelations = exports.userMusicPlaylistsRelations = exports.userMusicTracksRelations = exports.mediaFilesRelations = exports.userStickerPacksRelations = exports.stickerPacksRelations = exports.uploadSessionsRelations = exports.messageStatusRelations = exports.messagesRelations = exports.chatMembersRelations = exports.chatsRelations = exports.contactsRelations = exports.sessionsRelations = exports.usersRelations = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const users_1 = require("./users");
const sessions_1 = require("./sessions");
const contacts_1 = require("./contacts");
const chats_1 = require("./chats");
const chat_members_1 = require("./chat-members");
const messages_1 = require("./messages");
const message_status_1 = require("./message-status");
const media_files_1 = require("./media-files");
const upload_sessions_1 = require("./upload-sessions");
const stories_1 = require("./stories");
const story_views_1 = require("./story-views");
const encryption_keys_1 = require("./encryption-keys");
const bots_1 = require("./bots");
const calls_1 = require("./calls");
const call_participants_1 = require("./call-participants");
const chat_folders_1 = require("./chat-folders");
const invite_links_1 = require("./invite-links");
const notification_tokens_1 = require("./notification-tokens");
const notification_preferences_1 = require("./notification-preferences");
const reactions_1 = require("./reactions");
const sticker_packs_1 = require("./sticker-packs");
const user_sticker_packs_1 = require("./user-sticker-packs");
const custom_emoji_1 = require("./custom-emoji");
const user_custom_emoji_1 = require("./user-custom-emoji");
const user_music_tracks_1 = require("./user-music-tracks");
const user_music_playlists_1 = require("./user-music-playlists");
const user_music_playlist_tracks_1 = require("./user-music-playlist-tracks");
exports.usersRelations = (0, drizzle_orm_1.relations)(users_1.users, ({ one, many }) => ({
    sessions: many(sessions_1.sessions),
    contacts: many(contacts_1.contacts, { relationName: 'userContacts' }),
    contactOf: many(contacts_1.contacts, { relationName: 'contactTarget' }),
    chatMemberships: many(chat_members_1.chatMembers),
    sentMessages: many(messages_1.messages),
    createdChats: many(chats_1.chats),
    mediaFiles: many(media_files_1.mediaFiles),
    uploadSessions: many(upload_sessions_1.uploadSessions),
    stories: many(stories_1.stories),
    encryptionKeys: many(encryption_keys_1.encryptionKeys),
    notificationTokens: many(notification_tokens_1.notificationTokens),
    notificationPreferences: one(notification_preferences_1.notificationPreferences),
    chatFolders: many(chat_folders_1.chatFolders),
    createdStickerPacks: many(sticker_packs_1.stickerPacks),
    userStickerPacks: many(user_sticker_packs_1.userStickerPacks),
    createdCustomEmoji: many(custom_emoji_1.customEmoji),
    userCustomEmoji: many(user_custom_emoji_1.userCustomEmoji),
    musicTracks: many(user_music_tracks_1.userMusicTracks),
    musicPlaylists: many(user_music_playlists_1.userMusicPlaylists),
}));
exports.sessionsRelations = (0, drizzle_orm_1.relations)(sessions_1.sessions, ({ one }) => ({
    user: one(users_1.users, {
        fields: [sessions_1.sessions.userId],
        references: [users_1.users.id],
    }),
}));
exports.contactsRelations = (0, drizzle_orm_1.relations)(contacts_1.contacts, ({ one }) => ({
    user: one(users_1.users, {
        fields: [contacts_1.contacts.userId],
        references: [users_1.users.id],
        relationName: 'userContacts',
    }),
    contactUser: one(users_1.users, {
        fields: [contacts_1.contacts.contactUserId],
        references: [users_1.users.id],
        relationName: 'contactTarget',
    }),
}));
exports.chatsRelations = (0, drizzle_orm_1.relations)(chats_1.chats, ({ one, many }) => ({
    creator: one(users_1.users, {
        fields: [chats_1.chats.createdBy],
        references: [users_1.users.id],
    }),
    members: many(chat_members_1.chatMembers),
    messages: many(messages_1.messages),
    calls: many(calls_1.calls),
    inviteLinks: many(invite_links_1.inviteLinks),
}));
exports.chatMembersRelations = (0, drizzle_orm_1.relations)(chat_members_1.chatMembers, ({ one }) => ({
    chat: one(chats_1.chats, {
        fields: [chat_members_1.chatMembers.chatId],
        references: [chats_1.chats.id],
    }),
    user: one(users_1.users, {
        fields: [chat_members_1.chatMembers.userId],
        references: [users_1.users.id],
    }),
}));
exports.messagesRelations = (0, drizzle_orm_1.relations)(messages_1.messages, ({ one, many }) => ({
    chat: one(chats_1.chats, {
        fields: [messages_1.messages.chatId],
        references: [chats_1.chats.id],
    }),
    sender: one(users_1.users, {
        fields: [messages_1.messages.senderId],
        references: [users_1.users.id],
    }),
    replyTo: one(messages_1.messages, {
        fields: [messages_1.messages.replyToId],
        references: [messages_1.messages.id],
        relationName: 'messageReplies',
    }),
    statuses: many(message_status_1.messageStatus),
    reactions: many(reactions_1.reactions),
}));
exports.messageStatusRelations = (0, drizzle_orm_1.relations)(message_status_1.messageStatus, ({ one }) => ({
    message: one(messages_1.messages, {
        fields: [message_status_1.messageStatus.messageId],
        references: [messages_1.messages.id],
    }),
    user: one(users_1.users, {
        fields: [message_status_1.messageStatus.userId],
        references: [users_1.users.id],
    }),
}));
exports.uploadSessionsRelations = (0, drizzle_orm_1.relations)(upload_sessions_1.uploadSessions, ({ one }) => ({
    user: one(users_1.users, {
        fields: [upload_sessions_1.uploadSessions.userId],
        references: [users_1.users.id],
    }),
}));
exports.stickerPacksRelations = (0, drizzle_orm_1.relations)(sticker_packs_1.stickerPacks, ({ one, many }) => ({
    creator: one(users_1.users, {
        fields: [sticker_packs_1.stickerPacks.creatorId],
        references: [users_1.users.id],
    }),
    userStickerPacks: many(user_sticker_packs_1.userStickerPacks),
}));
exports.userStickerPacksRelations = (0, drizzle_orm_1.relations)(user_sticker_packs_1.userStickerPacks, ({ one }) => ({
    user: one(users_1.users, {
        fields: [user_sticker_packs_1.userStickerPacks.userId],
        references: [users_1.users.id],
    }),
    stickerPack: one(sticker_packs_1.stickerPacks, {
        fields: [user_sticker_packs_1.userStickerPacks.stickerPackId],
        references: [sticker_packs_1.stickerPacks.id],
    }),
}));
exports.mediaFilesRelations = (0, drizzle_orm_1.relations)(media_files_1.mediaFiles, ({ one, many }) => ({
    uploader: one(users_1.users, {
        fields: [media_files_1.mediaFiles.uploaderId],
        references: [users_1.users.id],
    }),
    stickerPack: one(sticker_packs_1.stickerPacks, {
        fields: [media_files_1.mediaFiles.stickerPackId],
        references: [sticker_packs_1.stickerPacks.id],
    }),
    musicTracksAsAudio: many(user_music_tracks_1.userMusicTracks, { relationName: 'trackAudio' }),
    musicTracksAsCover: many(user_music_tracks_1.userMusicTracks, { relationName: 'trackCover' }),
    musicPlaylistsAsCover: many(user_music_playlists_1.userMusicPlaylists),
}));
exports.userMusicTracksRelations = (0, drizzle_orm_1.relations)(user_music_tracks_1.userMusicTracks, ({ one, many }) => ({
    user: one(users_1.users, {
        fields: [user_music_tracks_1.userMusicTracks.userId],
        references: [users_1.users.id],
    }),
    audioFile: one(media_files_1.mediaFiles, {
        fields: [user_music_tracks_1.userMusicTracks.audioMediaId],
        references: [media_files_1.mediaFiles.id],
        relationName: 'trackAudio',
    }),
    coverFile: one(media_files_1.mediaFiles, {
        fields: [user_music_tracks_1.userMusicTracks.coverMediaId],
        references: [media_files_1.mediaFiles.id],
        relationName: 'trackCover',
    }),
    playlistEntries: many(user_music_playlist_tracks_1.userMusicPlaylistTracks),
}));
exports.userMusicPlaylistsRelations = (0, drizzle_orm_1.relations)(user_music_playlists_1.userMusicPlaylists, ({ one, many }) => ({
    user: one(users_1.users, {
        fields: [user_music_playlists_1.userMusicPlaylists.userId],
        references: [users_1.users.id],
    }),
    coverFile: one(media_files_1.mediaFiles, {
        fields: [user_music_playlists_1.userMusicPlaylists.coverMediaId],
        references: [media_files_1.mediaFiles.id],
    }),
    tracks: many(user_music_playlist_tracks_1.userMusicPlaylistTracks),
}));
exports.userMusicPlaylistTracksRelations = (0, drizzle_orm_1.relations)(user_music_playlist_tracks_1.userMusicPlaylistTracks, ({ one }) => ({
    playlist: one(user_music_playlists_1.userMusicPlaylists, {
        fields: [user_music_playlist_tracks_1.userMusicPlaylistTracks.playlistId],
        references: [user_music_playlists_1.userMusicPlaylists.id],
    }),
    track: one(user_music_tracks_1.userMusicTracks, {
        fields: [user_music_playlist_tracks_1.userMusicPlaylistTracks.trackId],
        references: [user_music_tracks_1.userMusicTracks.id],
    }),
}));
exports.customEmojiRelations = (0, drizzle_orm_1.relations)(custom_emoji_1.customEmoji, ({ one, many }) => ({
    creator: one(users_1.users, {
        fields: [custom_emoji_1.customEmoji.creatorId],
        references: [users_1.users.id],
    }),
    media: one(media_files_1.mediaFiles, {
        fields: [custom_emoji_1.customEmoji.mediaId],
        references: [media_files_1.mediaFiles.id],
    }),
    userCustomEmoji: many(user_custom_emoji_1.userCustomEmoji),
}));
exports.userCustomEmojiRelations = (0, drizzle_orm_1.relations)(user_custom_emoji_1.userCustomEmoji, ({ one }) => ({
    user: one(users_1.users, {
        fields: [user_custom_emoji_1.userCustomEmoji.userId],
        references: [users_1.users.id],
    }),
    customEmoji: one(custom_emoji_1.customEmoji, {
        fields: [user_custom_emoji_1.userCustomEmoji.customEmojiId],
        references: [custom_emoji_1.customEmoji.id],
    }),
}));
exports.storiesRelations = (0, drizzle_orm_1.relations)(stories_1.stories, ({ one, many }) => ({
    user: one(users_1.users, {
        fields: [stories_1.stories.userId],
        references: [users_1.users.id],
    }),
    media: one(media_files_1.mediaFiles, {
        fields: [stories_1.stories.mediaId],
        references: [media_files_1.mediaFiles.id],
    }),
    views: many(story_views_1.storyViews),
}));
exports.storyViewsRelations = (0, drizzle_orm_1.relations)(story_views_1.storyViews, ({ one }) => ({
    story: one(stories_1.stories, {
        fields: [story_views_1.storyViews.storyId],
        references: [stories_1.stories.id],
    }),
    viewer: one(users_1.users, {
        fields: [story_views_1.storyViews.viewerId],
        references: [users_1.users.id],
    }),
}));
exports.encryptionKeysRelations = (0, drizzle_orm_1.relations)(encryption_keys_1.encryptionKeys, ({ one }) => ({
    user: one(users_1.users, {
        fields: [encryption_keys_1.encryptionKeys.userId],
        references: [users_1.users.id],
    }),
}));
exports.botsRelations = (0, drizzle_orm_1.relations)(bots_1.bots, ({ one }) => ({
    owner: one(users_1.users, {
        fields: [bots_1.bots.ownerId],
        references: [users_1.users.id],
    }),
    user: one(users_1.users, {
        fields: [bots_1.bots.id],
        references: [users_1.users.id],
    }),
}));
exports.callsRelations = (0, drizzle_orm_1.relations)(calls_1.calls, ({ one, many }) => ({
    chat: one(chats_1.chats, {
        fields: [calls_1.calls.chatId],
        references: [chats_1.chats.id],
    }),
    initiator: one(users_1.users, {
        fields: [calls_1.calls.initiatorId],
        references: [users_1.users.id],
    }),
    participants: many(call_participants_1.callParticipants),
}));
exports.callParticipantsRelations = (0, drizzle_orm_1.relations)(call_participants_1.callParticipants, ({ one }) => ({
    call: one(calls_1.calls, {
        fields: [call_participants_1.callParticipants.callId],
        references: [calls_1.calls.id],
    }),
    user: one(users_1.users, {
        fields: [call_participants_1.callParticipants.userId],
        references: [users_1.users.id],
    }),
}));
exports.chatFoldersRelations = (0, drizzle_orm_1.relations)(chat_folders_1.chatFolders, ({ one }) => ({
    user: one(users_1.users, {
        fields: [chat_folders_1.chatFolders.userId],
        references: [users_1.users.id],
    }),
}));
exports.inviteLinksRelations = (0, drizzle_orm_1.relations)(invite_links_1.inviteLinks, ({ one }) => ({
    chat: one(chats_1.chats, {
        fields: [invite_links_1.inviteLinks.chatId],
        references: [chats_1.chats.id],
    }),
    creator: one(users_1.users, {
        fields: [invite_links_1.inviteLinks.createdBy],
        references: [users_1.users.id],
    }),
}));
exports.notificationPreferencesRelations = (0, drizzle_orm_1.relations)(notification_preferences_1.notificationPreferences, ({ one }) => ({
    user: one(users_1.users, {
        fields: [notification_preferences_1.notificationPreferences.userId],
        references: [users_1.users.id],
    }),
}));
exports.notificationTokensRelations = (0, drizzle_orm_1.relations)(notification_tokens_1.notificationTokens, ({ one }) => ({
    user: one(users_1.users, {
        fields: [notification_tokens_1.notificationTokens.userId],
        references: [users_1.users.id],
    }),
}));
exports.reactionsRelations = (0, drizzle_orm_1.relations)(reactions_1.reactions, ({ one }) => ({
    message: one(messages_1.messages, {
        fields: [reactions_1.reactions.messageId],
        references: [messages_1.messages.id],
    }),
    user: one(users_1.users, {
        fields: [reactions_1.reactions.userId],
        references: [users_1.users.id],
    }),
}));
//# sourceMappingURL=relations.js.map