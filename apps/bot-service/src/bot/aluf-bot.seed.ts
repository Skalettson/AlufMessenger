import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { bots, users } from '@aluf/db';
import { ALUF_BOT_USERNAME, ALUF_SYSTEM_USERNAME, ALUF_ID_MIN, ALUF_ID_MAX } from '@aluf/shared';
import { DATABASE_TOKEN, type DrizzleDB } from '../providers/database.provider';
import * as crypto from 'crypto';

const SYSTEM_OWNER_ID = '00000000-0000-0000-0000-000000000001';
const SYSTEM_ALUF_ID = 100_000_000n;

@Injectable()
export class AlufBotSeedService implements OnModuleInit {
  private readonly logger = new Logger(AlufBotSeedService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
  ) {}

  async onModuleInit() {
    await this.ensureAlufBotExists();
  }

  private readonly ALUF_BOT_COMMANDS = [
    { command: 'start', description: 'Начать диалог' },
    { command: 'help', description: 'Все команды' },
    { command: 'premium', description: 'Узнать про Aluf Premium' },
    { command: 'subscribe', description: 'Подключить Aluf Premium' },
    { command: 'unsubscribe', description: 'Отключить подписку' },
    { command: 'support', description: 'Поддержка' },
    { command: 'about', description: 'О мессенджере Aluf' },
  ] as const;

  private async ensureAlufBotExists(): Promise<void> {
    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, ALUF_BOT_USERNAME))
      .limit(1);

    if (existing) {
      await this.db
        .update(users)
        .set({
          avatarUrl: '/icon-192.png',
          displayName: 'Aluf Bot',
        })
        .where(eq(users.id, existing.id));
      await this.db
        .update(bots)
        .set({
          commands: [...this.ALUF_BOT_COMMANDS],
          description: 'Официальный бот Aluf. Premium, поддержка и справка.',
        })
        .where(eq(bots.id, existing.id));
      this.logger.log(`Aluf Bot already exists, commands and avatar updated: ${existing.id}`);
      return;
    }

    const [systemOwner] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, SYSTEM_OWNER_ID))
      .limit(1);

    if (!systemOwner) {
      await this.db.insert(users).values({
        id: SYSTEM_OWNER_ID,
        alufId: SYSTEM_ALUF_ID,
        username: ALUF_SYSTEM_USERNAME,
        displayName: 'Aluf System',
        isBot: false,
      });
      this.logger.log('System owner user created');
    }

    const botAlufId = await this.generateAlufId();
    const [botUser] = await this.db
      .insert(users)
      .values({
        alufId: botAlufId,
        username: ALUF_BOT_USERNAME,
        displayName: 'Aluf Bot',
        isBot: true,
        avatarUrl: '/icon-192.png',
      })
      .returning({ id: users.id, username: users.username });

    if (!botUser) {
      this.logger.warn('Failed to create Aluf Bot user');
      return;
    }

    const token = crypto.randomBytes(32).toString('base64url');
    await this.db.insert(bots).values({
      id: botUser.id,
      ownerId: SYSTEM_OWNER_ID,
      token,
      description: 'Официальный бот Aluf. Premium, поддержка и справка.',
      commands: [...this.ALUF_BOT_COMMANDS],
    });

    this.logger.log(`Aluf Bot created: ${botUser.id} (@${botUser.username})`);
  }

  private async generateAlufId(): Promise<bigint> {
    const range = ALUF_ID_MAX - ALUF_ID_MIN;
    for (let attempt = 0; attempt < 100; attempt++) {
      const randomBytes = crypto.randomBytes(8);
      const randomBig = BigInt('0x' + randomBytes.toString('hex')) % range;
      const candidate = ALUF_ID_MIN + randomBig;
      const [existing] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.alufId, candidate))
        .limit(1);
      if (!existing) return candidate;
    }
    throw new Error('Failed to generate unique aluf_id');
  }
}
