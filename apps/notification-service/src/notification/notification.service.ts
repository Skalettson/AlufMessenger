import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import {
  notificationTokens,
  notificationPreferences,
  users,
} from '@aluf/db';
import { DATABASE_TOKEN, type DrizzleDB } from '../providers/database.provider';
import { FcmProvider } from './push/fcm.provider';
import { ApnsProvider } from './push/apns.provider';
import { WebPushProvider } from './push/web-push.provider';
import { EmailProvider } from './email.provider';

export type NotificationType =
  | 'message'
  | 'mention'
  | 'reaction'
  | 'call'
  | 'group_invite'
  | 'contact_joined'
  | 'story'
  | 'system';

export type TokenPlatform = 'fcm' | 'apns' | 'web_push';

export interface UserPreferences {
  messagesEnabled: boolean;
  mentionsEnabled: boolean;
  reactionsEnabled: boolean;
  callsEnabled: boolean;
  groupInvitesEnabled: boolean;
  contactJoinedEnabled: boolean;
  storiesEnabled: boolean;
  showPreview: boolean;
  defaultSound: string;
  vibrate: boolean;
  ledEnabled: boolean;
  ledColor: string;
}

export interface SendNotificationParams {
  recipientIds: string[];
  type: NotificationType;
  title: string;
  body: string;
  iconUrl?: string;
  actionUrl?: string;
  chatId?: string;
  messageId?: string;
  senderId?: string;
  data?: Record<string, string>;
  badgeCount?: number;
  sound?: string;
  silent?: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  messagesEnabled: true,
  mentionsEnabled: true,
  reactionsEnabled: true,
  callsEnabled: true,
  groupInvitesEnabled: true,
  contactJoinedEnabled: true,
  storiesEnabled: true,
  showPreview: true,
  defaultSound: 'default',
  vibrate: true,
  ledEnabled: true,
  ledColor: '#ffffff',
};

const TYPE_TO_PREF: Record<NotificationType, keyof UserPreferences> = {
  message: 'messagesEnabled',
  mention: 'mentionsEnabled',
  reaction: 'reactionsEnabled',
  call: 'callsEnabled',
  group_invite: 'groupInvitesEnabled',
  contact_joined: 'contactJoinedEnabled',
  story: 'storiesEnabled',
  system: 'messagesEnabled',
};

const PROTO_PLATFORM_TO_DB: Record<number, TokenPlatform> = {
  1: 'fcm',
  2: 'apns',
  3: 'web_push',
};

@Injectable()
export class NotificationService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
    private readonly fcmProvider: FcmProvider,
    private readonly apnsProvider: ApnsProvider,
    private readonly webPushProvider: WebPushProvider,
    private readonly emailProvider: EmailProvider,
  ) {}

  async sendNotification(params: SendNotificationParams): Promise<void> {
    const {
      recipientIds,
      type,
      title,
      body,
      iconUrl,
      actionUrl,
      chatId,
      messageId,
      senderId,
      data = {},
      badgeCount = 0,
      sound,
      silent = false,
    } = params;

    const prefKey = TYPE_TO_PREF[type];
    if (!prefKey) return;

    for (const userId of recipientIds) {
      const prefs = await this.getUserPreferences(userId);
      const enabled = prefs[prefKey];
      if (!enabled) continue;

      const tokens = await this.db
        .select({ token: notificationTokens.token, platform: notificationTokens.platform })
        .from(notificationTokens)
        .where(eq(notificationTokens.userId, userId));

      const notification = {
        title: prefs.showPreview ? title : 'New notification',
        body: prefs.showPreview ? body : '',
        imageUrl: iconUrl,
      };

      const pushData: Record<string, string> = {
        ...data,
        type,
        chatId: chatId ?? '',
        messageId: messageId ?? '',
        senderId: senderId ?? '',
        actionUrl: actionUrl ?? '',
      };

      const invalidTokens: string[] = [];

      for (const row of tokens) {
        const result = await this.sendToProvider(
          row.platform as TokenPlatform,
          row.token,
          notification,
          pushData,
          {
            badge: badgeCount,
            sound: sound ?? prefs.defaultSound,
            silent,
          },
        );
        if (result.invalidToken) {
          invalidTokens.push(result.invalidToken);
        }
      }

      for (const token of invalidTokens) {
        await this.unregisterToken(userId, token);
      }
    }
  }

  private async sendToProvider(
    platform: TokenPlatform,
    token: string,
    notification: { title?: string; body?: string; imageUrl?: string },
    data: Record<string, string>,
    options: { badge?: number; sound?: string; silent?: boolean },
  ): Promise<{ invalidToken?: string }> {
    if (platform === 'fcm') {
      const result = await this.fcmProvider.send(
        token,
        notification,
        data,
        options,
      );
      return { invalidToken: result.invalidToken };
    }
    if (platform === 'apns') {
      const result = await this.apnsProvider.send(
        token,
        notification,
        data,
        options,
      );
      return { invalidToken: result.invalidToken };
    }
    if (platform === 'web_push') {
      const payload = {
        title: notification.title,
        body: notification.body,
        icon: notification.imageUrl,
        data,
        badge: options.badge,
      };
      const result = await this.webPushProvider.send(token, payload);
      return { invalidToken: result.invalidToken };
    }
    return {};
  }

  async registerToken(
    userId: string,
    token: string,
    platform: TokenPlatform,
    _deviceId?: string,
  ): Promise<void> {
    const platformStr = platform;

    const [existing] = await this.db
      .select()
      .from(notificationTokens)
      .where(
        and(eq(notificationTokens.userId, userId), eq(notificationTokens.token, token)),
      )
      .limit(1);

    if (existing) {
      await this.db
        .update(notificationTokens)
        .set({ platform: platformStr })
        .where(eq(notificationTokens.id, existing.id));
    } else {
      await this.db.insert(notificationTokens).values({
        userId,
        token,
        platform: platformStr,
      });
    }
  }

  async unregisterToken(userId: string, token: string): Promise<void> {
    await this.db
      .delete(notificationTokens)
      .where(
        and(eq(notificationTokens.userId, userId), eq(notificationTokens.token, token)),
      );
  }

  async unregisterTokenByDevice(_userId: string, _deviceId?: string): Promise<void> {
  }

  async getUserPreferences(userId: string): Promise<UserPreferences> {
    const [row] = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (!row) return DEFAULT_PREFERENCES;

    return {
      messagesEnabled: row.messagesEnabled,
      mentionsEnabled: row.mentionsEnabled,
      reactionsEnabled: row.reactionsEnabled,
      callsEnabled: row.callsEnabled,
      groupInvitesEnabled: row.groupInvitesEnabled,
      contactJoinedEnabled: row.contactJoinedEnabled,
      storiesEnabled: row.storiesEnabled,
      showPreview: row.showPreview,
      defaultSound: row.defaultSound ?? 'default',
      vibrate: row.vibrate,
      ledEnabled: row.ledEnabled,
      ledColor: row.ledColor ?? '#ffffff',
    };
  }

  async updatePreferences(
    userId: string,
    prefs: Partial<UserPreferences>,
  ): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    const payload = {
      messagesEnabled: prefs.messagesEnabled,
      mentionsEnabled: prefs.mentionsEnabled,
      reactionsEnabled: prefs.reactionsEnabled,
      callsEnabled: prefs.callsEnabled,
      groupInvitesEnabled: prefs.groupInvitesEnabled,
      contactJoinedEnabled: prefs.contactJoinedEnabled,
      storiesEnabled: prefs.storiesEnabled,
      showPreview: prefs.showPreview,
      defaultSound: prefs.defaultSound,
      vibrate: prefs.vibrate,
      ledEnabled: prefs.ledEnabled,
      ledColor: prefs.ledColor,
      updatedAt: new Date(),
    };

    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined),
    ) as Record<string, unknown>;

    if (existing) {
      await this.db
        .update(notificationPreferences)
        .set(cleanPayload as Record<string, never>)
        .where(eq(notificationPreferences.userId, userId));
    } else {
      await this.db.insert(notificationPreferences).values({
        userId,
        ...cleanPayload,
      } as never);
    }
  }

  async sendEmail(
    to: string,
    template: 'otp' | 'magic_link' | 'login_alert' | 'welcome' | 'generic',
    data: Record<string, string>,
    subject?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const subjects: Record<string, string> = {
      otp: 'Your Aluf verification code',
      magic_link: 'Sign in to Aluf',
      login_alert: 'New sign-in to your Aluf account',
      welcome: 'Welcome to Aluf',
      generic: data.subject ?? 'Notification from Aluf',
    };
    return this.emailProvider.sendEmail({
      to,
      subject: subject ?? subjects[template],
      template,
      data,
    });
  }

  async getUserEmail(userId: string): Promise<string | null> {
    const [user] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user?.email ?? null;
  }

  toDbPlatform(protoPlatform: number): TokenPlatform {
    return PROTO_PLATFORM_TO_DB[protoPlatform] ?? 'fcm';
  }

  toProtoType(type: string): number {
    const map: Record<string, number> = {
      message: 1,
      mention: 2,
      reaction: 3,
      call: 4,
      group_invite: 5,
      contact_joined: 6,
      story: 7,
      system: 8,
    };
    return map[type] ?? 0;
  }
}
