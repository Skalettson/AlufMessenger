import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { eq, and, ne } from 'drizzle-orm';
import { NATS_TOKEN, type NatsConnection } from '../providers/nats.provider';
import { DATABASE_TOKEN, type DrizzleDB } from '../providers/database.provider';
import { NotificationService } from './notification.service';
import { chatMembers } from '@aluf/db';
import { NATS_SUBJECTS } from '@aluf/shared';
import { StringCodec } from 'nats';

interface NotificationEvent {
  recipientIds?: string[];
  recipientId?: string;
  type?: string;
  title?: string;
  body?: string;
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

interface MessageSentEvent {
  id?: string;
  chatId?: string;
  senderId?: string;
  senderDisplayName?: string;
  senderUsername?: string;
  contentType?: string;
  textContent?: string;
  mediaId?: string;
  createdAt?: string;
}

interface CallSignalEvent {
  callId?: string;
  chatId?: string;
  fromUserId?: string;
  toUserId?: string;
  type?: string;
  callType?: 'voice' | 'video';
  isGroup?: boolean;
  recipientIds?: string[];
  payload?: unknown;
}

interface EmailSendEvent {
  to: string;
  template: 'otp' | 'login_alert' | 'welcome' | 'magic_link' | 'generic';
  data: Record<string, string>;
  subject?: string;
}

const TYPE_MAP: Record<string, string> = {
  message: 'message',
  mention: 'mention',
  reaction: 'reaction',
  call: 'call',
  group_invite: 'group_invite',
  contact_joined: 'contact_joined',
  story: 'story',
  system: 'system',
};

@Injectable()
export class NatsListener implements OnModuleInit, OnModuleDestroy {
  private readonly sc = StringCodec();
  private subs: { unsubscribe: () => void | Promise<void> }[] = [];

  constructor(
    @Inject(NATS_TOKEN) private readonly nats: NatsConnection,
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
    private readonly notificationService: NotificationService,
  ) {}

  async onModuleInit(): Promise<void> {
    const sub1 = this.nats.subscribe(NATS_SUBJECTS.NOTIFICATION, {
      callback: (err, msg) => {
        if (err) {
          console.error('NATS aluf.notification error:', err);
          return;
        }
        this.handleNotificationEvent(msg.data);
      },
    });
    this.subs.push(sub1);

    const sub2 = this.nats.subscribe(NATS_SUBJECTS.MESSAGE_SENT, {
      callback: async (err, msg) => {
        if (err) {
          console.error('NATS aluf.message.sent error:', err);
          return;
        }
        await this.handleMessageSentEvent(msg.data);
      },
    });
    this.subs.push(sub2);

    const sub3 = this.nats.subscribe(NATS_SUBJECTS.CALL_SIGNAL, {
      callback: (err, msg) => {
        if (err) {
          console.error('NATS aluf.call.signal error:', err);
          return;
        }
        this.handleCallSignalEvent(msg.data);
      },
    });
    this.subs.push(sub3);

    const sub4 = this.nats.subscribe(NATS_SUBJECTS.EMAIL_SEND, {
      callback: async (err, msg) => {
        if (err) {
          console.error('NATS aluf.email.send error:', err);
          return;
        }
        await this.handleEmailSendEvent(msg.data);
      },
    });
    this.subs.push(sub4);

    console.log('NATS listener subscribed to notification subjects');
  }

  async onModuleDestroy(): Promise<void> {
    for (const sub of this.subs) {
      const result = sub.unsubscribe();
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        await (result as Promise<void>);
      }
    }
  }

  private handleNotificationEvent(data: Uint8Array): void {
    try {
      const payload = JSON.parse(this.sc.decode(data)) as NotificationEvent;
      const recipientIds =
        payload.recipientIds ?? (payload.recipientId ? [payload.recipientId] : []);
      if (recipientIds.length === 0) return;

      const type = TYPE_MAP[payload.type ?? ''] ?? 'system';
      this.notificationService
        .sendNotification({
          recipientIds,
          type: type as Parameters<NotificationService['sendNotification']>[0]['type'],
          title: payload.title ?? 'Notification',
          body: payload.body ?? '',
          iconUrl: payload.iconUrl,
          actionUrl: payload.actionUrl,
          chatId: payload.chatId,
          messageId: payload.messageId,
          senderId: payload.senderId,
          data: payload.data,
          badgeCount: payload.badgeCount,
          sound: payload.sound,
          silent: payload.silent ?? false,
        })
        .catch((err) =>
          console.error('Failed to send notification from NATS:', err),
        );
    } catch (err) {
      console.error('Failed to parse notification event:', err);
    }
  }

  private async handleMessageSentEvent(data: Uint8Array): Promise<void> {
    try {
      const payload = JSON.parse(this.sc.decode(data)) as MessageSentEvent;
      const chatId = payload.chatId;
      const senderId = payload.senderId;
      const messageId = payload.id;

      if (!chatId || !senderId) return;

      const recipientIds = await this.getChatRecipientIds(chatId, senderId);
      if (recipientIds.length === 0) return;

      const displayName = payload.senderDisplayName ?? payload.senderUsername ?? 'Someone';
      const preview = payload.textContent
        ? payload.textContent.slice(0, 100)
        : payload.contentType === 'image'
          ? 'Sent an image'
          : payload.contentType === 'video'
            ? 'Sent a video'
            : 'Sent a message';

      await this.notificationService.sendNotification({
        recipientIds,
        type: 'message',
        title: displayName,
        body: preview,
        chatId,
        messageId,
        senderId,
        data: {
          chatId,
          messageId: messageId ?? '',
          senderId,
          contentType: payload.contentType ?? 'text',
        },
      });
    } catch (err) {
      console.error('Failed to process message sent event:', err);
    }
  }

  private async getChatRecipientIds(
    chatId: string,
    excludeUserId: string,
  ): Promise<string[]> {
    const rows = await this.db
      .select({ userId: chatMembers.userId })
      .from(chatMembers)
      .where(
        and(eq(chatMembers.chatId, chatId), ne(chatMembers.userId, excludeUserId)),
      );
    return rows.map((r) => r.userId);
  }

  private handleCallSignalEvent(data: Uint8Array): void {
    try {
      const payload = JSON.parse(this.sc.decode(data)) as CallSignalEvent;
      
      // Обрабатываем только входящие звонки
      if (payload.type !== 'incoming') return;

      const recipientIds = payload.recipientIds;
      const fromUserId = payload.fromUserId;
      const chatId = payload.chatId;
      const callId = payload.callId;
      const callType = payload.callType ?? 'voice';

      if (!recipientIds || recipientIds.length === 0 || !fromUserId) return;

      this.notificationService
        .sendNotification({
          recipientIds,
          type: 'call',
          title: `Входящий ${callType === 'video' ? 'видео' : 'голосовой'} звонок`,
          body: 'Вам поступает звонок...',
          chatId: chatId ?? '',
          senderId: fromUserId,
          data: {
            callId: callId ?? '',
            chatId: chatId ?? '',
            fromUserId,
            callType,
            isGroup: String(payload.isGroup ?? false),
            signalType: 'incoming',
          },
        })
        .catch((err) =>
          console.error('Failed to send call notification:', err),
        );
    } catch (err) {
      console.error('Failed to parse call signal event:', err);
    }
  }

  private async handleEmailSendEvent(data: Uint8Array): Promise<void> {
    try {
      const payload = JSON.parse(this.sc.decode(data)) as EmailSendEvent;
      
      await this.notificationService.sendEmail(
        payload.to,
        payload.template,
        payload.data,
        payload.subject,
      );
    } catch (err) {
      console.error('Failed to process email send event:', err);
    }
  }
}
