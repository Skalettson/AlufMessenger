import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import * as crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { bots, users } from '@aluf/db';
import {
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
  ForbiddenError,
  NATS_SUBJECTS,
} from '@aluf/shared';
import { DATABASE_TOKEN, type DrizzleDB } from '../providers/database.provider';
import { REDIS_TOKEN } from '../providers/redis.provider';
import { NATS_TOKEN, type NatsConnection } from '../providers/nats.provider';
import { WebhookService } from './webhook.service';
import type Redis from 'ioredis';
import { StringCodec } from 'nats';

interface MessageServiceGrpc {
  DeleteMessage(req: { messageId: string; chatId: string; deleterId: string; deleteForEveryone: boolean }): Observable<unknown>;
  PinMessage(req: { messageId: string; chatId: string; pinnedBy: string }): Observable<unknown>;
  UnpinMessage(req: { messageId: string; chatId: string; unpinnedBy: string }): Observable<unknown>;
}

interface ChatServiceGrpc {
  GetChat(req: { chatId: string; userId: string }): Observable<unknown>;
}

@Injectable()
export class BotService implements OnModuleInit {
  private readonly sc = StringCodec();
  private messageService!: MessageServiceGrpc;
  private chatService!: ChatServiceGrpc;

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
    @Inject(REDIS_TOKEN) private readonly redis: Redis,
    @Inject(NATS_TOKEN) private readonly nats: NatsConnection,
    @Inject('MESSAGE_SERVICE_PACKAGE') private readonly messageClient: ClientGrpc,
    @Inject('CHAT_SERVICE_PACKAGE') private readonly chatClient: ClientGrpc,
    private readonly webhookService: WebhookService,
  ) {}

  async onModuleInit() {
    this.messageService = this.messageClient.getService<MessageServiceGrpc>('MessageService');
    this.chatService = this.chatClient.getService<ChatServiceGrpc>('ChatService');
    await this.subscribeToMessages();
  }

  async validateBotToken(token: string) {
    const [bot] = await this.db
      .select()
      .from(bots)
      .where(eq(bots.token, token))
      .limit(1);

    if (!bot) {
      throw new UnauthorizedError('Invalid bot token');
    }
    return bot;
  }

  async getMe(botId: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        isBot: users.isBot,
      })
      .from(users)
      .where(eq(users.id, botId))
      .limit(1);

    if (!user) {
      throw new NotFoundError('Bot', botId);
    }

    const [bot] = await this.db
      .select({ description: bots.description, commands: bots.commands })
      .from(bots)
      .where(eq(bots.id, botId))
      .limit(1);

    return {
      id: user.id,
      is_bot: true,
      username: user.username,
      first_name: user.displayName,
      photo_url: user.avatarUrl,
      description: bot?.description ?? null,
      commands: bot?.commands ?? [],
    };
  }

  async sendMessage(
    botId: string,
    chatId: string,
    text: string,
    replyMarkup?: unknown,
    replyToMessageId?: string,
  ) {
    if (!text.trim()) {
      throw new BadRequestError('Message text is required');
    }

    const payload = {
      senderId: botId,
      chatId,
      contentType: 'text',
      textContent: text,
      replyToId: replyToMessageId && replyToMessageId.trim() !== '' ? replyToMessageId.trim() : undefined,
      metadata: replyMarkup ? { replyMarkup } : {},
    };

    this.nats.publish(
      NATS_SUBJECTS.MESSAGE_INCOMING,
      this.sc.encode(JSON.stringify(payload)),
    );

    return {
      chat_id: chatId,
      text,
      from: { id: botId, is_bot: true },
      ...(replyToMessageId ? { reply_to_message: { message_id: replyToMessageId } } : {}),
    };
  }

  async getUpdates(
    botId: string,
    offset: number,
    limit: number,
    timeout: number,
  ) {
    const clampedLimit = Math.min(Math.max(1, limit), 100);
    const queueKey = `bot:updates:${botId}`;

    if (timeout > 0) {
      const timeoutMs = Math.min(timeout, 60) * 1000;
      const startTime = Date.now();

      while (Date.now() - startTime < timeoutMs) {
        const length = await this.redis.llen(queueKey);
        if (length > 0) break;
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    const raw = await this.redis.lrange(queueKey, 0, clampedLimit - 1);
    const updates = raw.map((item) => JSON.parse(item));

    if (offset > 0) {
      const filtered = updates.filter(
        (u: { updateId: number }) => u.updateId >= offset,
      );
      if (filtered.length < updates.length) {
        const removeCount = updates.length - filtered.length;
        await this.redis.ltrim(queueKey, removeCount, -1);
      }
      return filtered;
    }

    return updates;
  }

  async setWebhook(botId: string, url: string | null, secret?: string | null) {
    if (url !== null && url !== '') {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new BadRequestError('Webhook URL должен использовать http или https');
        }
        if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
          throw new BadRequestError('В production webhook URL должен быть HTTPS');
        }
      } catch (err) {
        if (err instanceof BadRequestError) throw err;
        throw new BadRequestError('Некорректный URL webhook');
      }
    }

    const webhookSecret =
      url != null && url !== ''
        ? secret && secret.trim() !== ''
          ? secret.trim()
          : crypto.randomBytes(32).toString('base64url')
        : null;

    await this.db
      .update(bots)
      .set({ webhookUrl: url || null, webhookSecret })
      .where(eq(bots.id, botId));
  }

  async sendMedia(
    botId: string,
    chatId: string,
    contentType: string,
    mediaId: string,
    caption?: string,
    replyMarkup?: unknown,
  ) {
    const payload = {
      senderId: botId,
      chatId,
      contentType,
      textContent: caption ?? null,
      mediaId,
      metadata: replyMarkup ? { replyMarkup } : {},
    };

    this.nats.publish(
      NATS_SUBJECTS.MESSAGE_INCOMING,
      this.sc.encode(JSON.stringify(payload)),
    );

    return {
      chat_id: chatId,
      content_type: contentType,
      media_id: mediaId,
      caption: caption ?? null,
      from: { id: botId, is_bot: true },
    };
  }

  async answerCallbackQuery(
    _botId: string,
    callbackQueryId: string,
    text?: string,
    showAlert?: boolean,
  ) {
    this.nats.publish(
      'aluf.bot.callback_answer',
      this.sc.encode(
        JSON.stringify({ callbackQueryId, text, showAlert: showAlert ?? false }),
      ),
    );
  }

  async editMessageText(
    botId: string,
    chatId: string,
    messageId: string,
    text: string,
    replyMarkup?: unknown,
  ) {
    const payload = {
      senderId: botId,
      chatId,
      messageId,
      textContent: text,
      metadata: replyMarkup ? { replyMarkup } : {},
    };

    this.nats.publish(
      NATS_SUBJECTS.MESSAGE_EDITED,
      this.sc.encode(JSON.stringify(payload)),
    );

    return {
      chat_id: chatId,
      message_id: messageId,
      text,
      from: { id: botId, is_bot: true },
    };
  }

  async deleteMessage(
    botId: string,
    chatId: string,
    messageId: string,
    deleteForEveryone: boolean = true,
  ) {
    await firstValueFrom(
      this.messageService.DeleteMessage({
        messageId,
        chatId,
        deleterId: botId,
        deleteForEveryone,
      }),
    ).catch((err) => {
      const code = err?.code ?? err?.status ?? 13;
      const msg = err?.message ?? 'Delete failed';
      if (code === 5) throw new NotFoundError('Message', messageId);
      if (code === 7) throw new ForbiddenError(msg);
      throw err;
    });
    return { ok: true };
  }

  async getChat(botId: string, chatId: string) {
    const res = await firstValueFrom(
      this.chatService.GetChat({ chatId, userId: botId }),
    ).catch((err) => {
      const code = err?.code ?? err?.status ?? 13;
      const msg = err?.message ?? 'Chat not found';
      if (code === 5) throw new NotFoundError('Chat', chatId);
      if (code === 7) throw new ForbiddenError(msg);
      throw err;
    }) as { id?: string; type?: number; name?: string; memberCount?: number; member_count?: number };
    const typeNum = res.type ?? 0;
    const chatType = typeNum === 1 ? 'private' : typeNum === 2 || typeNum === 4 ? 'group' : typeNum === 3 ? 'channel' : 'private';
    return {
      id: res.id ?? chatId,
      type: chatType,
      title: res.name ?? '',
      ...(typeof (res.memberCount ?? res.member_count) === 'number' ? { member_count: res.memberCount ?? res.member_count } : {}),
    };
  }

  async pinMessage(botId: string, chatId: string, messageId: string) {
    await firstValueFrom(
      this.messageService.PinMessage({ messageId, chatId, pinnedBy: botId }),
    ).catch((err) => {
      const code = err?.code ?? err?.status ?? 13;
      const msg = err?.message ?? 'Pin failed';
      if (code === 5) throw new NotFoundError('Message', messageId);
      if (code === 7) throw new ForbiddenError(msg);
      throw err;
    });
    return { ok: true };
  }

  async unpinMessage(botId: string, chatId: string, messageId: string) {
    await firstValueFrom(
      this.messageService.UnpinMessage({ messageId, chatId, unpinnedBy: botId }),
    ).catch((err) => {
      const code = err?.code ?? err?.status ?? 13;
      const msg = err?.message ?? 'Unpin failed';
      if (code === 5) throw new NotFoundError('Message', messageId);
      if (code === 7) throw new ForbiddenError(msg);
      throw err;
    });
    return { ok: true };
  }

  private async subscribeToMessages() {
    const sub = this.nats.subscribe('aluf.bot.message');

    (async () => {
      for await (const msg of sub) {
        try {
          const data = JSON.parse(this.sc.decode(msg.data)) as {
            botId: string;
            update: Record<string, unknown>;
          };
          await this.deliverUpdate(data.botId, data.update);
        } catch (err) {
          console.error('Error processing bot message:', err);
        }
      }
    })();
  }

  private async deliverUpdate(botId: string, update: Record<string, unknown>) {
    const [bot] = await this.db
      .select({ webhookUrl: bots.webhookUrl, webhookSecret: bots.webhookSecret })
      .from(bots)
      .where(eq(bots.id, botId))
      .limit(1);

    if (bot?.webhookUrl) {
      await this.webhookService.deliverUpdate(
        botId,
        bot.webhookUrl,
        update,
        bot.webhookSecret ?? undefined,
      );
    } else {
      const queueKey = `bot:updates:${botId}`;
      const updateId = Date.now();
      await this.redis.rpush(
        queueKey,
        JSON.stringify({ updateId, ...update }),
      );
      await this.redis.ltrim(queueKey, -1000, -1);
    }
  }
}
