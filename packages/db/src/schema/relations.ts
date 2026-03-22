import { relations } from 'drizzle-orm';
import { users } from './users';
import { sessions } from './sessions';
import { contacts } from './contacts';
import { chats } from './chats';
import { chatMembers } from './chat-members';
import { messages } from './messages';
import { messageStatus } from './message-status';
import { mediaFiles } from './media-files';
import { uploadSessions } from './upload-sessions';
import { stories } from './stories';
import { storyViews } from './story-views';
import { encryptionKeys } from './encryption-keys';
import { bots } from './bots';
import { calls } from './calls';
import { callParticipants } from './call-participants';
import { chatFolders } from './chat-folders';
import { inviteLinks } from './invite-links';
import { notificationTokens } from './notification-tokens';
import { notificationPreferences } from './notification-preferences';
import { reactions } from './reactions';
import { stickerPacks } from './sticker-packs';
import { userStickerPacks } from './user-sticker-packs';
import { customEmoji } from './custom-emoji';
import { userCustomEmoji } from './user-custom-emoji';
import { userMusicTracks } from './user-music-tracks';
import { userMusicPlaylists } from './user-music-playlists';
import { userMusicPlaylistTracks } from './user-music-playlist-tracks';

export const usersRelations = relations(users, ({ one, many }) => ({
  sessions: many(sessions),
  contacts: many(contacts, { relationName: 'userContacts' }),
  contactOf: many(contacts, { relationName: 'contactTarget' }),
  chatMemberships: many(chatMembers),
  sentMessages: many(messages),
  createdChats: many(chats),
  mediaFiles: many(mediaFiles),
  uploadSessions: many(uploadSessions),
  stories: many(stories),
  encryptionKeys: many(encryptionKeys),
  notificationTokens: many(notificationTokens),
  notificationPreferences: one(notificationPreferences),
  chatFolders: many(chatFolders),
  createdStickerPacks: many(stickerPacks),
  userStickerPacks: many(userStickerPacks),
  createdCustomEmoji: many(customEmoji),
  userCustomEmoji: many(userCustomEmoji),
  musicTracks: many(userMusicTracks),
  musicPlaylists: many(userMusicPlaylists),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  user: one(users, {
    fields: [contacts.userId],
    references: [users.id],
    relationName: 'userContacts',
  }),
  contactUser: one(users, {
    fields: [contacts.contactUserId],
    references: [users.id],
    relationName: 'contactTarget',
  }),
}));

export const chatsRelations = relations(chats, ({ one, many }) => ({
  creator: one(users, {
    fields: [chats.createdBy],
    references: [users.id],
  }),
  members: many(chatMembers),
  messages: many(messages),
  calls: many(calls),
  inviteLinks: many(inviteLinks),
}));

export const chatMembersRelations = relations(chatMembers, ({ one }) => ({
  chat: one(chats, {
    fields: [chatMembers.chatId],
    references: [chats.id],
  }),
  user: one(users, {
    fields: [chatMembers.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  replyTo: one(messages, {
    fields: [messages.replyToId],
    references: [messages.id],
    relationName: 'messageReplies',
  }),
  statuses: many(messageStatus),
  reactions: many(reactions),
}));

export const messageStatusRelations = relations(messageStatus, ({ one }) => ({
  message: one(messages, {
    fields: [messageStatus.messageId],
    references: [messages.id],
  }),
  user: one(users, {
    fields: [messageStatus.userId],
    references: [users.id],
  }),
}));

export const uploadSessionsRelations = relations(uploadSessions, ({ one }) => ({
  user: one(users, {
    fields: [uploadSessions.userId],
    references: [users.id],
  }),
}));

export const stickerPacksRelations = relations(stickerPacks, ({ one, many }) => ({
  creator: one(users, {
    fields: [stickerPacks.creatorId],
    references: [users.id],
  }),
  userStickerPacks: many(userStickerPacks),
}));

export const userStickerPacksRelations = relations(
  userStickerPacks,
  ({ one }) => ({
    user: one(users, {
      fields: [userStickerPacks.userId],
      references: [users.id],
    }),
    stickerPack: one(stickerPacks, {
      fields: [userStickerPacks.stickerPackId],
      references: [stickerPacks.id],
    }),
  }),
);

export const mediaFilesRelations = relations(mediaFiles, ({ one, many }) => ({
  uploader: one(users, {
    fields: [mediaFiles.uploaderId],
    references: [users.id],
  }),
  stickerPack: one(stickerPacks, {
    fields: [mediaFiles.stickerPackId],
    references: [stickerPacks.id],
  }),
  musicTracksAsAudio: many(userMusicTracks, { relationName: 'trackAudio' }),
  musicTracksAsCover: many(userMusicTracks, { relationName: 'trackCover' }),
  musicPlaylistsAsCover: many(userMusicPlaylists),
}));

export const userMusicTracksRelations = relations(userMusicTracks, ({ one, many }) => ({
  user: one(users, {
    fields: [userMusicTracks.userId],
    references: [users.id],
  }),
  audioFile: one(mediaFiles, {
    fields: [userMusicTracks.audioMediaId],
    references: [mediaFiles.id],
    relationName: 'trackAudio',
  }),
  coverFile: one(mediaFiles, {
    fields: [userMusicTracks.coverMediaId],
    references: [mediaFiles.id],
    relationName: 'trackCover',
  }),
  playlistEntries: many(userMusicPlaylistTracks),
}));

export const userMusicPlaylistsRelations = relations(
  userMusicPlaylists,
  ({ one, many }) => ({
    user: one(users, {
      fields: [userMusicPlaylists.userId],
      references: [users.id],
    }),
    coverFile: one(mediaFiles, {
      fields: [userMusicPlaylists.coverMediaId],
      references: [mediaFiles.id],
    }),
    tracks: many(userMusicPlaylistTracks),
  }),
);

export const userMusicPlaylistTracksRelations = relations(
  userMusicPlaylistTracks,
  ({ one }) => ({
    playlist: one(userMusicPlaylists, {
      fields: [userMusicPlaylistTracks.playlistId],
      references: [userMusicPlaylists.id],
    }),
    track: one(userMusicTracks, {
      fields: [userMusicPlaylistTracks.trackId],
      references: [userMusicTracks.id],
    }),
  }),
);

export const customEmojiRelations = relations(customEmoji, ({ one, many }) => ({
  creator: one(users, {
    fields: [customEmoji.creatorId],
    references: [users.id],
  }),
  media: one(mediaFiles, {
    fields: [customEmoji.mediaId],
    references: [mediaFiles.id],
  }),
  userCustomEmoji: many(userCustomEmoji),
}));

export const userCustomEmojiRelations = relations(
  userCustomEmoji,
  ({ one }) => ({
    user: one(users, {
      fields: [userCustomEmoji.userId],
      references: [users.id],
    }),
    customEmoji: one(customEmoji, {
      fields: [userCustomEmoji.customEmojiId],
      references: [customEmoji.id],
    }),
  }),
);

export const storiesRelations = relations(stories, ({ one, many }) => ({
  user: one(users, {
    fields: [stories.userId],
    references: [users.id],
  }),
  media: one(mediaFiles, {
    fields: [stories.mediaId],
    references: [mediaFiles.id],
  }),
  views: many(storyViews),
}));

export const storyViewsRelations = relations(storyViews, ({ one }) => ({
  story: one(stories, {
    fields: [storyViews.storyId],
    references: [stories.id],
  }),
  viewer: one(users, {
    fields: [storyViews.viewerId],
    references: [users.id],
  }),
}));

export const encryptionKeysRelations = relations(encryptionKeys, ({ one }) => ({
  user: one(users, {
    fields: [encryptionKeys.userId],
    references: [users.id],
  }),
}));

export const botsRelations = relations(bots, ({ one }) => ({
  owner: one(users, {
    fields: [bots.ownerId],
    references: [users.id],
  }),
  user: one(users, {
    fields: [bots.id],
    references: [users.id],
  }),
}));

export const callsRelations = relations(calls, ({ one, many }) => ({
  chat: one(chats, {
    fields: [calls.chatId],
    references: [chats.id],
  }),
  initiator: one(users, {
    fields: [calls.initiatorId],
    references: [users.id],
  }),
  participants: many(callParticipants),
}));

export const callParticipantsRelations = relations(
  callParticipants,
  ({ one }) => ({
    call: one(calls, {
      fields: [callParticipants.callId],
      references: [calls.id],
    }),
    user: one(users, {
      fields: [callParticipants.userId],
      references: [users.id],
    }),
  }),
);

export const chatFoldersRelations = relations(chatFolders, ({ one }) => ({
  user: one(users, {
    fields: [chatFolders.userId],
    references: [users.id],
  }),
}));

export const inviteLinksRelations = relations(inviteLinks, ({ one }) => ({
  chat: one(chats, {
    fields: [inviteLinks.chatId],
    references: [chats.id],
  }),
  creator: one(users, {
    fields: [inviteLinks.createdBy],
    references: [users.id],
  }),
}));

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
  }),
);

export const notificationTokensRelations = relations(
  notificationTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationTokens.userId],
      references: [users.id],
    }),
  }),
);

export const reactionsRelations = relations(reactions, ({ one }) => ({
  message: one(messages, {
    fields: [reactions.messageId],
    references: [messages.id],
  }),
  user: one(users, {
    fields: [reactions.userId],
    references: [users.id],
  }),
}));
