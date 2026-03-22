import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { NATS_TOKEN, type NatsConnection } from '../providers/nats.provider';
import { SearchService } from './search.service';
import { StringCodec } from 'nats';
import { NATS_SUBJECTS } from '@aluf/shared';

@Injectable()
export class NatsListener implements OnModuleInit {
  private readonly sc = StringCodec();

  constructor(
    @Inject(NATS_TOKEN) private readonly nats: NatsConnection,
    private readonly searchService: SearchService,
  ) {}

  async onModuleInit() {
    await this.subscribeAll();
  }

  private async subscribeAll() {
    this.subscribe(NATS_SUBJECTS.USER_UPDATED, async (data) => {
      if (!data.id) return;
      await this.searchService.indexDocument('users', data.id as string, {
        username: data.username,
        display_name: data.displayName,
        avatar_url: data.avatarUrl,
        bio: data.bio,
      });
    });

    this.subscribe(NATS_SUBJECTS.MESSAGE_SENT, async (data) => {
      if (!data.id) return;
      await this.searchService.indexDocument('messages', String(data.id), {
        text_content: data.textContent,
        chat_id: data.chatId,
        sender_id: data.senderId,
        content_type: data.contentType,
        created_at: data.createdAt
          ? Math.floor(new Date(data.createdAt as string).getTime() / 1000)
          : undefined,
      });
    });

    this.subscribe(NATS_SUBJECTS.MESSAGE_EDITED, async (data) => {
      if (!data.id) return;
      await this.searchService.indexDocument('messages', String(data.id), {
        text_content: data.textContent,
      });
    });

    this.subscribe(NATS_SUBJECTS.MESSAGE_DELETED, async (data) => {
      if (!data.id) return;
      await this.searchService.deleteDocument('messages', String(data.id));
    });

    this.subscribe(NATS_SUBJECTS.CHAT_UPDATED, async (data) => {
      if (!data.id) return;
      await this.searchService.indexDocument('chats', data.id as string, {
        title: data.title,
        description: data.description,
        type: data.type,
        avatar_url: data.avatarUrl,
      });
    });
  }

  private subscribe(
    subject: string,
    handler: (data: Record<string, unknown>) => Promise<void>,
  ) {
    const sub = this.nats.subscribe(subject);
    (async () => {
      for await (const msg of sub) {
        try {
          const data = JSON.parse(this.sc.decode(msg.data)) as Record<string, unknown>;
          await handler(data);
        } catch (err) {
          console.error(`Error processing NATS message on ${subject}:`, err);
        }
      }
    })();
  }
}
