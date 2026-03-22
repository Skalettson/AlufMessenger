import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { StringCodec } from 'nats';
import { NATS_SUBJECTS } from '@aluf/shared';
import { NATS_TOKEN, type NatsConnection } from '../providers/nats.provider';
import { MessageService } from './message.service';

interface IncomingPayload {
  chatId: string;
  senderId: string;
  contentType?: string;
  textContent?: string;
  mediaId?: string;
  replyToId?: string;
  metadata?: Record<string, unknown>;
  selfDestructSeconds?: number;
}

@Injectable()
export class MessageIncomingSubscriber implements OnModuleInit {
  private readonly logger = new Logger(MessageIncomingSubscriber.name);
  private readonly sc = StringCodec();

  constructor(
    @Inject(NATS_TOKEN) private readonly nats: NatsConnection,
    private readonly messageService: MessageService,
  ) {}

  onModuleInit() {
    const sub = this.nats.subscribe(NATS_SUBJECTS.MESSAGE_INCOMING);
    (async () => {
      for await (const msg of sub) {
        try {
          const data = JSON.parse(this.sc.decode(msg.data)) as IncomingPayload;
          if (!data.chatId || !data.senderId) continue;
          await this.messageService.sendMessage(data.chatId, data.senderId, {
            contentType: data.contentType || 'text',
            textContent: data.textContent ?? '',
            mediaId: data.mediaId ?? '',
            replyToId: data.replyToId ?? '',
            metadata: data.metadata ?? {},
            selfDestructSeconds: data.selfDestructSeconds ?? 0,
          });
        } catch (err) {
          this.logger.error('MESSAGE_INCOMING handle error', err);
        }
      }
    })();
    this.logger.log('Subscribed to MESSAGE_INCOMING');
  }
}
