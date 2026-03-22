import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { StringCodec, Subscription, JetStreamSubscription, ConsumerOptsBuilder, consumerOpts } from 'nats';
import { NATS_TOKEN, type NatsClients } from '../providers/nats.provider';
import { NATS_SUBJECTS } from '@aluf/shared';
import { ConnectionManager } from './connection-manager';

interface NatsMessage {
  chatId?: string;
  userId?: string;
  targetUserId?: string;
  [key: string]: unknown;
}

@Injectable()
export class NatsSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsSubscriber.name);
  private readonly sc = StringCodec();
  private readonly subscriptions: (Subscription | JetStreamSubscription)[] = [];

  constructor(
    @Inject(NATS_TOKEN) private readonly nats: NatsClients,
    private readonly connectionManager: ConnectionManager,
  ) {}

  async onModuleInit() {
    await this.subscribeCoreSubjects();
    await this.subscribeBroadcastChannel();
    this.logger.log('NATS subscriptions initialized');
  }

  async onModuleDestroy() {
    for (const sub of this.subscriptions) {
      if ('unsubscribe' in sub) {
        sub.unsubscribe();
      }
    }
  }

  private async subscribeCoreSubjects(): Promise<void> {
    const opts = this.buildConsumerOpts('realtime-message-sent');
    const sub = await this.nats.js.subscribe(NATS_SUBJECTS.MESSAGE_SENT, opts);
    this.subscriptions.push(sub);
    this.consumeJetStream(sub, (data) => {
      if (data.chatId) {
        this.connectionManager.broadcastToChat(data.chatId, 'message.new', data);
      }
    });

    const editOpts = this.buildConsumerOpts('realtime-message-edited');
    const editSub = await this.nats.js.subscribe(NATS_SUBJECTS.MESSAGE_EDITED, editOpts);
    this.subscriptions.push(editSub);
    this.consumeJetStream(editSub, (data) => {
      if (data.chatId) {
        this.connectionManager.broadcastToChat(data.chatId as string, 'message.updated', data);
      }
    });

    const delOpts = this.buildConsumerOpts('realtime-message-deleted');
    const delSub = await this.nats.js.subscribe(NATS_SUBJECTS.MESSAGE_DELETED, delOpts);
    this.subscriptions.push(delSub);
    this.consumeJetStream(delSub, (data) => {
      if (data.chatId) {
        this.connectionManager.broadcastToChat(data.chatId as string, 'message.deleted', data);
      }
    });

    const readSub = this.nats.nc.subscribe(NATS_SUBJECTS.MESSAGE_READ);
    this.subscriptions.push(readSub);
    this.consumeCore(readSub, (data) => {
      if (data.chatId) {
        this.connectionManager.broadcastToChat(data.chatId as string, 'message.status', {
          ...data,
          type: 'read',
        });
      }
    });

    const deliveredSub = this.nats.nc.subscribe(NATS_SUBJECTS.MESSAGE_DELIVERED);
    this.subscriptions.push(deliveredSub);
    this.consumeCore(deliveredSub, (data) => {
      if (data.chatId) {
        this.connectionManager.broadcastToChat(data.chatId as string, 'message.status', {
          ...data,
          type: 'delivered',
        });
      }
    });

    const typingSub = this.nats.nc.subscribe(NATS_SUBJECTS.TYPING);
    this.subscriptions.push(typingSub);
    this.consumeCore(typingSub, (data) => {
      if (data.chatId) {
        this.connectionManager.broadcastToChat(
          data.chatId as string,
          'typing',
          data,
          data.userId as string | undefined,
        );
      }
    });

    const reactionSub = this.nats.nc.subscribe(NATS_SUBJECTS.MESSAGE_REACTION);
    this.subscriptions.push(reactionSub);
    this.consumeCore(reactionSub, (data) => {
      if (data.chatId) {
        this.connectionManager.broadcastToChat(data.chatId as string, 'message.reaction', data);
      }
    });

    const presenceSub = this.nats.nc.subscribe(NATS_SUBJECTS.PRESENCE);
    this.subscriptions.push(presenceSub);
    this.consumeCore(presenceSub, (data) => {
      const userId = data?.userId;
      if (!userId) return;
      const status = data?.status === 'online' ? 'online' : 'offline';
      const lastSeenAt = data?.timestamp ?? data?.lastSeenAt ?? null;
      this.connectionManager.broadcastToAll('presence', {
        userId,
        status,
        lastSeenAt: typeof lastSeenAt === 'string' ? lastSeenAt : lastSeenAt != null ? String(lastSeenAt) : null,
      });
    });

    const callSub = this.nats.nc.subscribe(NATS_SUBJECTS.CALL_SIGNAL);
    this.subscriptions.push(callSub);
    this.consumeCore(callSub, (data) => {
      /** Входящий звонок: рассылаем каждому из recipientIds */
      if (data.type === 'incoming' && Array.isArray(data.recipientIds)) {
        const callTypeRaw = data.callType ?? data.call_type;
        const isVideo =
          callTypeRaw === 'video' ||
          callTypeRaw === 2 ||
          String(callTypeRaw).toUpperCase().includes('VIDEO');
        const callerId = String(data.initiatorId ?? data.fromUserId ?? '').trim();
        const chatId = String(data.chatId ?? '').trim();
        const callId = String(data.callId ?? '').trim();
        for (const uid of data.recipientIds as string[]) {
          if (!uid || uid === callerId) continue;
          this.connectionManager.broadcastToUser(uid, 'call.incoming', {
            callId,
            callerId,
            chatId,
            type: isVideo ? 'video' : 'voice',
            isGroup: Boolean(data.isGroup),
          });
        }
        return;
      }

      // Если указан конкретный получатель - отправляем только ему
      if (data.toUserId) {
        this.connectionManager.broadcastToUser(
          data.toUserId as string,
          'call.signal',
          {
            callId: data.callId,
            fromUserId: data.fromUserId,
            type: data.type,
            payload: data.payload,
          },
        );
      } else if (data.chatId) {
        // Для групповых звонков - всем участникам чата кроме отправителя
        this.connectionManager.broadcastToChat(
          data.chatId as string,
          'call.signal',
          {
            callId: data.callId,
            fromUserId: data.fromUserId,
            type: data.type,
            payload: data.payload,
          },
          data.fromUserId as string | undefined,
        );
      }
    });

    const notifSub = this.nats.nc.subscribe(NATS_SUBJECTS.NOTIFICATION);
    this.subscriptions.push(notifSub);
    this.consumeCore(notifSub, (data) => {
      if (data.targetUserId) {
        this.connectionManager.broadcastToUser(
          data.targetUserId as string,
          'notification',
          data,
        );
      }
    });
  }

  private async subscribeBroadcastChannel(): Promise<void> {
    const sub = this.nats.nc.subscribe('aluf.ws.broadcast.>');
    this.subscriptions.push(sub);

    (async () => {
      for await (const msg of sub) {
        try {
          const payload = JSON.parse(this.sc.decode(msg.data)) as {
            chatId: string;
            event: string;
            data: unknown;
            excludeUserId?: string;
            origin?: string;
          };

          await this.connectionManager.broadcastToChatLocal(
            payload.chatId,
            payload.event,
            payload.data,
            payload.excludeUserId,
            payload.origin,
          );
        } catch (err) {
          this.logger.error('Failed to process broadcast message', err);
        }
      }
    })();
  }

  private buildConsumerOpts(durableName: string): ConsumerOptsBuilder {
    const opts = consumerOpts();
    // В dev используем уникальный суффикс (PID), чтобы при перезапуске не было "duplicate subscription"
    const suffix =
      process.env.NODE_ENV === 'production' ? '' : `-${process.pid}`;
    const name = `${durableName}${suffix}`;
    opts.durable(name);
    opts.deliverTo(`_deliver_${name}`);
    opts.ackExplicit();
    opts.maxDeliver(3);
    return opts;
  }

  private consumeJetStream(
    sub: JetStreamSubscription,
    handler: (data: NatsMessage) => void,
  ): void {
    (async () => {
      for await (const msg of sub) {
        try {
          const data = JSON.parse(this.sc.decode(msg.data)) as NatsMessage;
          handler(data);
          msg.ack();
        } catch (err) {
          this.logger.error(`Failed to process JetStream message on ${msg.subject}`, err);
          msg.nak();
        }
      }
    })();
  }

  private consumeCore(
    sub: Subscription,
    handler: (data: NatsMessage) => void,
  ): void {
    (async () => {
      for await (const msg of sub) {
        try {
          const data = JSON.parse(this.sc.decode(msg.data)) as NatsMessage;
          handler(data);
        } catch (err) {
          this.logger.error(`Failed to process core NATS message on ${msg.subject}`, err);
        }
      }
    })();
  }
}
