export type NotificationType =
  | 'new_message'
  | 'mention'
  | 'reply'
  | 'reaction'
  | 'call_incoming'
  | 'call_missed'
  | 'group_invite'
  | 'channel_post'
  | 'story_reaction'
  | 'contact_joined'
  | 'login_alert';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  imageUrl: string | null;
  data: Record<string, string>;
  isRead: boolean;
  createdAt: Date;
}

export interface NotificationPreferences {
  userId: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  showPreview: boolean;
  sound: string;
  vibration: boolean;
  mutedChatIds: string[];
  mutedUntil: Date | null;
}

export interface PushPayload {
  token: string;
  platform: 'fcm' | 'apns' | 'web';
  notification: {
    title: string;
    body: string;
    imageUrl?: string;
  };
  data: Record<string, string>;
}
