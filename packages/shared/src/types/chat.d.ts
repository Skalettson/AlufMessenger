export type ChatType = 'private' | 'group' | 'channel' | 'secret' | 'saved' | 'supergroup';
export interface Chat {
    id: string;
    type: ChatType;
    title: string | null;
    description: string | null;
    avatarUrl: string | null;
    createdBy: string;
    settings: ChatSettings;
    memberCount: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface ChatSettings {
    slowModeInterval: number;
    membersCanSendMessages: boolean;
    membersCanSendMedia: boolean;
    membersCanAddMembers: boolean;
    membersCanPinMessages: boolean;
    membersCanChangeInfo: boolean;
    joinApprovalRequired: boolean;
    antiSpamEnabled: boolean;
    captchaForNewMembers: boolean;
    linkedDiscussionChatId: string | null;
    isPublic?: boolean;
    historyVisibleToNewMembers?: boolean;
    signaturesEnabled?: boolean;
    restrictSavingContent?: boolean;
    defaultBannedRights?: MemberPermissions;
}
export declare const DEFAULT_CHAT_SETTINGS: ChatSettings;
export type MemberRole = 'owner' | 'admin' | 'moderator' | 'member';
export interface ChatMember {
    chatId: string;
    userId: string;
    role: MemberRole;
    permissions: MemberPermissions;
    joinedAt: Date;
    mutedUntil: Date | null;
}
export interface MemberPermissions {
    canDeleteMessages: boolean;
    canBanMembers: boolean;
    canPinMessages: boolean;
    canEditInfo: boolean;
    canInviteMembers: boolean;
    canManageVoiceChats: boolean;
    canPostMessages: boolean;
    canEditMessages: boolean;
    canRestrictMembers?: boolean;
    canPostMedia?: boolean;
    canSendPolls?: boolean;
    canSendStickers?: boolean;
    canManageTopics?: boolean;
    canViewAuditLog?: boolean;
    canDeleteMessagesOfOthers?: boolean;
}
export declare const DEFAULT_MEMBER_PERMISSIONS: MemberPermissions;
export interface ChatFolder {
    id: string;
    userId: string;
    name: string;
    icon: string | null;
    includedChatIds: string[];
    excludedChatIds: string[];
    includeTypes: ChatType[];
    includeUnread: boolean;
    includeMuted: boolean;
    position: number;
}
export interface InviteLink {
    id: string;
    chatId: string;
    createdBy: string;
    code: string;
    name: string | null;
    usageLimit: number | null;
    usageCount: number;
    expiresAt: Date | null;
    requiresApproval: boolean;
    createdAt: Date;
}
/** Статистика сообщения канала */
export interface ChannelMessageStats {
    chatId: string;
    messageId: string;
    views: bigint;
    forwards: bigint;
    reactions: Record<string, number>;
    uniqueViewers: number;
    createdAt: Date;
    updatedAt: Date;
}
/** Дневная статистика канала */
export interface ChannelDailyStats {
    id: string;
    chatId: string;
    date: Date;
    totalSubscribers: number;
    newSubscribers: number;
    unsubscribers: number;
    totalViews: bigint;
    totalReactions: bigint;
    totalForwards: bigint;
    messagesSent: number;
    reach: number;
    createdAt: Date;
    updatedAt: Date;
}
/** Сводная статистика канала */
export interface ChannelStatsSummary {
    chatId: string;
    totalSubscribers: number;
    subscriberGrowth: number;
    totalViews: bigint;
    avgViewsPerPost: number;
    totalReactions: bigint;
    totalForwards: bigint;
    reach: number;
    engagement: number;
    period: {
        from: Date;
        to: Date;
    };
}
/** Подписчик канала */
export interface ChannelSubscriber {
    chatId: string;
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    username: string | null;
    isBot: boolean;
    isPremium: boolean;
    subscribedAt: Date;
    notificationsEnabled: boolean;
    lastActivityAt: Date | null;
}
//# sourceMappingURL=chat.d.ts.map