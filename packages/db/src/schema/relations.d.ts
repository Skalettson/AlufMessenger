export declare const usersRelations: import("drizzle-orm").Relations<"users", {
    sessions: import("drizzle-orm").Many<"sessions">;
    contacts: import("drizzle-orm").Many<"contacts">;
    contactOf: import("drizzle-orm").Many<"contacts">;
    chatMemberships: import("drizzle-orm").Many<"chat_members">;
    sentMessages: import("drizzle-orm").Many<"messages">;
    createdChats: import("drizzle-orm").Many<"chats">;
    mediaFiles: import("drizzle-orm").Many<"media_files">;
    uploadSessions: import("drizzle-orm").Many<"upload_sessions">;
    stories: import("drizzle-orm").Many<"stories">;
    encryptionKeys: import("drizzle-orm").Many<"encryption_keys">;
    notificationTokens: import("drizzle-orm").Many<"notification_tokens">;
    notificationPreferences: import("drizzle-orm").One<"notification_preferences", false>;
    chatFolders: import("drizzle-orm").Many<"chat_folders">;
    createdStickerPacks: import("drizzle-orm").Many<"sticker_packs">;
    userStickerPacks: import("drizzle-orm").Many<"user_sticker_packs">;
    createdCustomEmoji: import("drizzle-orm").Many<"custom_emoji">;
    userCustomEmoji: import("drizzle-orm").Many<"user_custom_emoji">;
    musicTracks: import("drizzle-orm").Many<"user_music_tracks">;
    musicPlaylists: import("drizzle-orm").Many<"user_music_playlists">;
}>;
export declare const sessionsRelations: import("drizzle-orm").Relations<"sessions", {
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const contactsRelations: import("drizzle-orm").Relations<"contacts", {
    user: import("drizzle-orm").One<"users", true>;
    contactUser: import("drizzle-orm").One<"users", true>;
}>;
export declare const chatsRelations: import("drizzle-orm").Relations<"chats", {
    creator: import("drizzle-orm").One<"users", true>;
    members: import("drizzle-orm").Many<"chat_members">;
    messages: import("drizzle-orm").Many<"messages">;
    calls: import("drizzle-orm").Many<"calls">;
    inviteLinks: import("drizzle-orm").Many<"invite_links">;
}>;
export declare const chatMembersRelations: import("drizzle-orm").Relations<"chat_members", {
    chat: import("drizzle-orm").One<"chats", true>;
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const messagesRelations: import("drizzle-orm").Relations<"messages", {
    chat: import("drizzle-orm").One<"chats", true>;
    sender: import("drizzle-orm").One<"users", true>;
    replyTo: import("drizzle-orm").One<"messages", false>;
    statuses: import("drizzle-orm").Many<"message_status">;
    reactions: import("drizzle-orm").Many<"reactions">;
}>;
export declare const messageStatusRelations: import("drizzle-orm").Relations<"message_status", {
    message: import("drizzle-orm").One<"messages", true>;
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const uploadSessionsRelations: import("drizzle-orm").Relations<"upload_sessions", {
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const stickerPacksRelations: import("drizzle-orm").Relations<"sticker_packs", {
    creator: import("drizzle-orm").One<"users", false>;
    userStickerPacks: import("drizzle-orm").Many<"user_sticker_packs">;
}>;
export declare const userStickerPacksRelations: import("drizzle-orm").Relations<"user_sticker_packs", {
    user: import("drizzle-orm").One<"users", true>;
    stickerPack: import("drizzle-orm").One<"sticker_packs", true>;
}>;
export declare const mediaFilesRelations: import("drizzle-orm").Relations<"media_files", {
    uploader: import("drizzle-orm").One<"users", true>;
    stickerPack: import("drizzle-orm").One<"sticker_packs", false>;
    musicTracksAsAudio: import("drizzle-orm").Many<"user_music_tracks">;
    musicTracksAsCover: import("drizzle-orm").Many<"user_music_tracks">;
    musicPlaylistsAsCover: import("drizzle-orm").Many<"user_music_playlists">;
}>;
export declare const userMusicTracksRelations: import("drizzle-orm").Relations<"user_music_tracks", {
    user: import("drizzle-orm").One<"users", true>;
    audioFile: import("drizzle-orm").One<"media_files", true>;
    coverFile: import("drizzle-orm").One<"media_files", false>;
    playlistEntries: import("drizzle-orm").Many<"user_music_playlist_tracks">;
}>;
export declare const userMusicPlaylistsRelations: import("drizzle-orm").Relations<"user_music_playlists", {
    user: import("drizzle-orm").One<"users", true>;
    coverFile: import("drizzle-orm").One<"media_files", true>;
    tracks: import("drizzle-orm").Many<"user_music_playlist_tracks">;
}>;
export declare const userMusicPlaylistTracksRelations: import("drizzle-orm").Relations<"user_music_playlist_tracks", {
    playlist: import("drizzle-orm").One<"user_music_playlists", true>;
    track: import("drizzle-orm").One<"user_music_tracks", true>;
}>;
export declare const customEmojiRelations: import("drizzle-orm").Relations<"custom_emoji", {
    creator: import("drizzle-orm").One<"users", true>;
    media: import("drizzle-orm").One<"media_files", true>;
    userCustomEmoji: import("drizzle-orm").Many<"user_custom_emoji">;
}>;
export declare const userCustomEmojiRelations: import("drizzle-orm").Relations<"user_custom_emoji", {
    user: import("drizzle-orm").One<"users", true>;
    customEmoji: import("drizzle-orm").One<"custom_emoji", true>;
}>;
export declare const storiesRelations: import("drizzle-orm").Relations<"stories", {
    user: import("drizzle-orm").One<"users", true>;
    media: import("drizzle-orm").One<"media_files", true>;
    views: import("drizzle-orm").Many<"story_views">;
}>;
export declare const storyViewsRelations: import("drizzle-orm").Relations<"story_views", {
    story: import("drizzle-orm").One<"stories", true>;
    viewer: import("drizzle-orm").One<"users", true>;
}>;
export declare const encryptionKeysRelations: import("drizzle-orm").Relations<"encryption_keys", {
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const botsRelations: import("drizzle-orm").Relations<"bots", {
    owner: import("drizzle-orm").One<"users", true>;
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const callsRelations: import("drizzle-orm").Relations<"calls", {
    chat: import("drizzle-orm").One<"chats", true>;
    initiator: import("drizzle-orm").One<"users", true>;
    participants: import("drizzle-orm").Many<"call_participants">;
}>;
export declare const callParticipantsRelations: import("drizzle-orm").Relations<"call_participants", {
    call: import("drizzle-orm").One<"calls", true>;
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const chatFoldersRelations: import("drizzle-orm").Relations<"chat_folders", {
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const inviteLinksRelations: import("drizzle-orm").Relations<"invite_links", {
    chat: import("drizzle-orm").One<"chats", true>;
    creator: import("drizzle-orm").One<"users", true>;
}>;
export declare const notificationPreferencesRelations: import("drizzle-orm").Relations<"notification_preferences", {
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const notificationTokensRelations: import("drizzle-orm").Relations<"notification_tokens", {
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const reactionsRelations: import("drizzle-orm").Relations<"reactions", {
    message: import("drizzle-orm").One<"messages", true>;
    user: import("drizzle-orm").One<"users", true>;
}>;
//# sourceMappingURL=relations.d.ts.map