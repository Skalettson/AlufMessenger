"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MEMBER_PERMISSIONS = exports.DEFAULT_CHAT_SETTINGS = void 0;
exports.DEFAULT_CHAT_SETTINGS = {
    slowModeInterval: 0,
    membersCanSendMessages: true,
    membersCanSendMedia: true,
    membersCanAddMembers: true,
    membersCanPinMessages: false,
    membersCanChangeInfo: false,
    joinApprovalRequired: false,
    antiSpamEnabled: false,
    captchaForNewMembers: false,
    linkedDiscussionChatId: null,
    isPublic: true,
    historyVisibleToNewMembers: true,
    signaturesEnabled: false,
    restrictSavingContent: false,
    defaultBannedRights: undefined,
};
exports.DEFAULT_MEMBER_PERMISSIONS = {
    canDeleteMessages: false,
    canBanMembers: false,
    canPinMessages: false,
    canEditInfo: false,
    canInviteMembers: false,
    canManageVoiceChats: false,
    canPostMessages: true,
    canEditMessages: false,
    canRestrictMembers: false,
    canPostMedia: true,
    canSendPolls: true,
    canSendStickers: true,
    canManageTopics: false,
    canViewAuditLog: false,
    canDeleteMessagesOfOthers: false,
};
//# sourceMappingURL=chat.js.map