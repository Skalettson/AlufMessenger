import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { chatMembers, users } from '@aluf/db';
import { NATS_SUBJECTS } from '@aluf/shared';

import { DATABASE_TOKEN, type DrizzleDB } from '../providers/database.provider';
import { NATS_TOKEN, type NatsConnection } from '../providers/nats.provider';
import { BotService } from './bot.service';
import { StringCodec } from 'nats';

const ALUF_BOT_USERNAME = 'AlufBot';

/** Тексты ответов бота (единое место для правок) */
const REPLIES = {
  start: (name?: string) =>
    `Привет${name ? `, ${name}` : ''}! Я официальный бот Aluf. 👋\n\n` +
    `/premium — информация о подписке\n` +
    `/subscribe — подключить Aluf Premium\n` +
    `/support — поддержка\n` +
    `/help — все команды`,
  help:
    '**Команды бота:**\n' +
    '/start — начать диалог\n' +
    '/premium — информация об Aluf Premium\n' +
    '/subscribe — подключить подписку\n' +
    '/unsubscribe — отключить подписку\n' +
    '/support — связь с поддержкой\n' +
    '/about — о мессенджере Aluf\n' +
    '/help — эта справка',
  premium:
    '✨ **Aluf Premium** — подписка с расширенными возможностями:\n\n' +
    '• Файлы до 8 ГБ и приоритетная загрузка\n' +
    '• До 10 реакций на сообщение, до 200 закреплённых\n' +
    '• Группы до 200 000 участников\n' +
    '• Истории до 7 дней, до 20 ботов\n' +
    '• Самоуничтожение сообщений до 7 дней\n' +
    '• Эксклюзивные стикерпаки\n' +
    '• Расширенное хранение истории без ограничения по времени\n' +
    '• Приоритетная поддержка\n\n' +
    'Подключить: /subscribe',
  alreadyPremium: 'У вас уже активна подписка Aluf Premium. ✨',
  subscribed:
    '✅ **Подписка Aluf Premium подключена.**\n\n' +
    'Обновите страницу или перезайдите в Настройки → Профиль, чтобы увидеть изменения.',
  notSubscribed: 'У вас нет активной подписки Aluf Premium.',
  unsubscribed: 'Подписка Aluf Premium отключена. Чтобы снова подключить — напишите /subscribe.',
  support:
    '**Поддержка Aluf**\n\n' +
    '• В приложении: Настройки → Профиль → кнопка «Поддержка»\n' +
    '• Или опишите вопрос здесь — мы читаем этот чат.\n\n' +
    'По возможности отвечаем в течение 24 часов.',
  about:
    '**Aluf** — современный мессенджер с поддержкой ботов, историй, звонков и групп.\n\n' +
    'Без рекламы в чатах. Ваши данные хранятся под вашим контролем.\n\n' +
    'Premium даёт больше возможностей: /premium',
  premiumHint: 'Информация о подписке: /premium. Подключить: /subscribe',
  unknown: 'Не знаю такую команду. Напишите /help для списка команд.',
  greeting: 'Привет! Чем могу помочь? Напишите /help для списка команд.',
  thanks: 'Пожалуйста! Если появятся вопросы — пишите /help.',
  howAreYou: 'Всё хорошо, работаю. 👋 Чем могу помочь? /help',
  whatCanYouDo: 'Я подскажу про Aluf Premium и поддержку. Напишите /help — покажу все команды.',
} as const;

interface MessageSentPayload {
  id?: string;
  chatId: string;
  senderId: string;
  textContent?: string | null;
  contentType?: string;
}

@Injectable()
export class AlufBotMessageHandler implements OnModuleInit {
  private readonly logger = new Logger(AlufBotMessageHandler.name);
  private readonly sc = StringCodec();

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
    @Inject(NATS_TOKEN) private readonly nats: NatsConnection,
    private readonly botService: BotService,
  ) {}

  async onModuleInit() {
    const [alufBot] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, ALUF_BOT_USERNAME))
      .limit(1);

    if (!alufBot) {
      this.logger.warn('Aluf Bot not found, message handler disabled');
      return;
    }

    const sub = this.nats.subscribe(NATS_SUBJECTS.MESSAGE_SENT);
    (async () => {
      for await (const msg of sub) {
        try {
          const data = JSON.parse(this.sc.decode(msg.data)) as MessageSentPayload;
          if (!data.chatId || !data.senderId) continue;
          if (data.senderId === alufBot.id) continue;
          const text = (data.textContent ?? '').trim();
          if (!text && data.contentType !== 'text') continue;

          const [member] = await this.db
            .select({ userId: chatMembers.userId })
            .from(chatMembers)
            .where(
              and(
                eq(chatMembers.chatId, data.chatId),
                eq(chatMembers.userId, alufBot.id),
              ),
            )
            .limit(1);

          if (!member) continue;

          const reply = await this.getReply(text, data.senderId);
          if (reply) {
            await this.botService.sendMessage(alufBot.id, data.chatId, reply);
          }
        } catch (err) {
          this.logger.error('Aluf Bot handler error', err);
        }
      }
    })();
    this.logger.log('Aluf Bot MESSAGE_SENT subscriber started');
  }

  private async getReply(text: string, userId: string): Promise<string | null> {
    const lower = text.toLowerCase().trim();
    const cmd = lower.split(/\s+/)[0].replace(/^\//, '');

    switch (cmd) {
      case 'start':
        return this.replyStart(userId);
      case 'premium':
      case 'премиум':
        return REPLIES.premium;
      case 'subscribe':
      case 'подключить':
        return this.activatePremium(userId);
      case 'unsubscribe':
      case 'отменить':
      case 'отписаться':
        return this.deactivatePremium(userId);
      case 'support':
      case 'поддержка':
      case 'поддержку':
        return REPLIES.support;
      case 'about':
      case 'info':
        return REPLIES.about;
      case 'help':
      case 'помощь':
      case 'справка':
        return REPLIES.help;
      default:
        return this.replyToKeyword(lower);
    }
  }

  private async replyStart(userId: string): Promise<string> {
    const [row] = await this.db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const name = row?.displayName?.trim();
    const first = name?.split(/\s+/)[0] ?? undefined;
    return REPLIES.start(first);
  }

  private async activatePremium(userId: string): Promise<string> {
    const [row] = await this.db
      .select({ isPremium: users.isPremium })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (row?.isPremium) {
      return REPLIES.alreadyPremium;
    }
    await this.db
      .update(users)
      .set({ isPremium: true, updatedAt: new Date() })
      .where(eq(users.id, userId));
    this.logger.log(`Premium activated for user ${userId}`);
    return REPLIES.subscribed;
  }

  private async deactivatePremium(userId: string): Promise<string> {
    const [row] = await this.db
      .select({ isPremium: users.isPremium })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!row?.isPremium) {
      return REPLIES.notSubscribed;
    }
    await this.db
      .update(users)
      .set({ isPremium: false, updatedAt: new Date() })
      .where(eq(users.id, userId));
    this.logger.log(`Premium deactivated for user ${userId}`);
    return REPLIES.unsubscribed;
  }

  private replyToKeyword(lower: string): string | null {
    if (/привет|здравствуй|хай|hello|hi|добрый\s+день|добрый\s+вечер/i.test(lower)) {
      return REPLIES.greeting;
    }
    if (/спасибо|благодар|thanks|thank\s+you/i.test(lower)) {
      return REPLIES.thanks;
    }
    if (/как\s+дела|как\s+ты|how\s+are\s+you|что\s+нового/i.test(lower)) {
      return REPLIES.howAreYou;
    }
    if (/что\s+умеешь|что\s+можешь|помощь|help|команды/i.test(lower)) {
      return REPLIES.whatCanYouDo;
    }
    if (/premium|премиум|подписка|подписку|оформить/i.test(lower)) {
      return REPLIES.premiumHint;
    }
    return REPLIES.unknown;
  }
}
