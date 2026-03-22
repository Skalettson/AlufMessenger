import { Inject, Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { users } from '@aluf/db';
import { BadRequestError, NotFoundError } from '@aluf/shared';
import { DATABASE_TOKEN, type DrizzleDB } from '../providers/database.provider';
import { REDIS_TOKEN } from '../providers/redis.provider';
import Redis from 'ioredis';

const BACKUP_CODES_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;
const ISSUER = 'Aluf Messenger';

// ±3 интервала (90 сек) — компенсация рассинхрона часов и задержек сети (Google Authenticator = локальное время)
authenticator.options = { window: 3 };

@Injectable()
export class TwoFactorService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
    @Inject(REDIS_TOKEN) private readonly redis: Redis,
  ) {}

  async setup(userId: string): Promise<{
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
  }> {
    const user = await this.getUser(userId);

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(
      user.username,
      ISSUER,
      secret,
    );

    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    const backupCodes = this.generateBackupCodes();
    const hashedCodes = backupCodes.map((c) =>
      crypto.createHash('sha256').update(c).digest('hex'),
    );

    await this.redis.setex(
      this.pendingSetupKey(userId),
      600,
      JSON.stringify({ secret, backupCodes: hashedCodes }),
    );

    return { secret, qrCodeUrl, backupCodes };
  }

  async verify(userId: string, code: string): Promise<void> {
    const raw = await this.redis.get(this.pendingSetupKey(userId));
    if (!raw) {
      throw new BadRequestError('Не найдена ожидающая настройка 2FA. Сначала вызовите Setup2FA');
    }

    const { secret, backupCodes } = JSON.parse(raw) as {
      secret: string;
      backupCodes: string[];
    };

    // Используем check() с глобальными настройками window для компенсации рассинхронизации времени
    const isValid = authenticator.check(code, secret);
    if (!isValid) {
      throw new BadRequestError('Неверный код 2FA');
    }

    await this.db
      .update(users)
      .set({
        twoFactorSecret: secret,
        twoFactorEnabled: true,
      })
      .where(eq(users.id, userId));

    await this.redis.set(
      this.backupCodesKey(userId),
      JSON.stringify(backupCodes),
    );

    await this.redis.del(this.pendingSetupKey(userId));
  }

  async disable(userId: string, code: string): Promise<void> {
    const user = await this.getUser(userId);

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestError('2FA не включена');
    }

    const isValid = await this.validateCode(userId, user.twoFactorSecret, code);
    if (!isValid) {
      throw new BadRequestError('Неверный код 2FA');
    }

    await this.db
      .update(users)
      .set({
        twoFactorSecret: null,
        twoFactorEnabled: false,
      })
      .where(eq(users.id, userId));

    await this.redis.del(this.backupCodesKey(userId));
  }

  async validateCode(
    userId: string,
    secret: string,
    code: string,
  ): Promise<boolean> {
    // Используем check() с глобальными настройками window
    if (authenticator.check(code, secret)) {
      return true;
    }

    return this.validateBackupCode(userId, code);
  }

  private async validateBackupCode(userId: string, code: string): Promise<boolean> {
    const raw = await this.redis.get(this.backupCodesKey(userId));
    if (!raw) return false;

    const hashedCodes: string[] = JSON.parse(raw);
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    const index = hashedCodes.indexOf(codeHash);
    if (index === -1) return false;

    hashedCodes.splice(index, 1);
    await this.redis.set(this.backupCodesKey(userId), JSON.stringify(hashedCodes));
    return true;
  }

  private generateBackupCodes(): string[] {
    return Array.from({ length: BACKUP_CODES_COUNT }, () =>
      crypto.randomBytes(BACKUP_CODE_LENGTH / 2).toString('hex'),
    );
  }

  private async getUser(userId: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundError('User', userId);
    }
    return user;
  }

  private pendingSetupKey(userId: string): string {
    return `2fa:pending:${userId}`;
  }

  private backupCodesKey(userId: string): string {
    return `2fa:backup:${userId}`;
  }
}
