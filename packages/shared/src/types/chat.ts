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
  // Расширенные настройки групп
  isPublic?: boolean;
  historyVisibleToNewMembers?: boolean;
  signaturesEnabled?: boolean; // показывать автора в каналах
  restrictSavingContent?: boolean; // запретить копирование
  defaultBannedRights?: MemberPermissions;
}

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
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
  // Расширенные права
  canRestrictMembers?: boolean; // мут, бан
  canPostMedia?: boolean;
  canSendPolls?: boolean;
  canSendStickers?: boolean;
  canManageTopics?: boolean;
  canViewAuditLog?: boolean;
  canDeleteMessagesOfOthers?: boolean;
}

export const DEFAULT_MEMBER_PERMISSIONS: MemberPermissions = {
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
  subscriberGrowth: number; // прирост за период
  totalViews: bigint;
  avgViewsPerPost: number;
  totalReactions: bigint;
  totalForwards: bigint;
  reach: number;
  engagement: number; // процент вовлечённости
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
