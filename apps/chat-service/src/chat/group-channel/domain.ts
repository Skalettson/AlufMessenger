export type GroupChannelType = 'group' | 'channel' | 'supergroup';

export interface CreateGroupChannelInput {
  type: GroupChannelType;
  creatorId: string;
  title: string;
  description?: string;
  avatarUrl?: string;
  username?: string;
  memberIds?: string[];
}

export interface GroupChannelPermissions {
  canDeleteMessages: boolean;
  canBanMembers: boolean;
  canPinMessages: boolean;
  canEditInfo: boolean;
  canInviteMembers: boolean;
  canManageVoiceChats: boolean;
  canPostMessages: boolean;
  canEditMessages: boolean;
  canRestrictMembers: boolean;
  canPostMedia: boolean;
  canSendPolls: boolean;
  canSendStickers: boolean;
  canManageTopics: boolean;
  canViewAuditLog: boolean;
  canDeleteMessagesOfOthers: boolean;
}
