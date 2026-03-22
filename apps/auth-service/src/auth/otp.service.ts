import { Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import type { NatsConnection } from 'nats';
import { StringCodec } from 'nats';
import { BadRequestError, RateLimitError, NATS_SUBJECTS } from '@aluf/shared';
import { OTP_LENGTH, OTP_TTL_SECONDS } from '@aluf/shared';
import { REDIS_TOKEN } from '../providers/redis.provider';
import { NATS_TOKEN } from '../providers/nats.provider';

const MAX_VERIFY_ATTEMPTS = 5;
const MAX_OTP_PER_TARGET_PER_HOUR = 3;

interface StoredVerification {
  code: string;
  data: Record<string, unknown>;
  attempts: number;
  target: string;
}

interface EmailNotification {
  to: string;
  template: 'otp' | 'login_alert' | 'welcome';
  data: Record<string, string>;
  subject?: string;
}

@Injectable()
export class OtpService {
  private readonly sc = StringCodec();

  constructor(
    @Inject(REDIS_TOKEN) private readonly redis: Redis,
    @Inject(NATS_TOKEN) private readonly nats: NatsConnection,
  ) {}

  async generateAndStore(
    target: string,
    data: Record<string, unknown>,
    ttl: number = OTP_TTL_SECONDS,
  ): Promise<{ verificationId: string; expiresAt: Date; devCode?: string }> {
    await this.checkRateLimit(target);

    const code = this.generateCode();
    const verificationId = crypto.randomUUID();

    const stored: StoredVerification = {
      code,
      data,
      attempts: 0,
      target,
    };

    await this.redis.setex(
      this.verificationKey(verificationId),
      ttl,
      JSON.stringify(stored),
    );

    await this.incrementTargetCounter(target);

    // Отправляем email с кодом
    await this.sendOtpEmail(target, code);

    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      console.log(`[OTP] Code for ${target}: ${code}`);
    }

    const expiresAt = new Date(Date.now() + ttl * 1000);
    return { verificationId, expiresAt, ...(isDev ? { devCode: code } : {}) };
  }

  private async sendOtpEmail(email: string, code: string): Promise<void> {
    const notification: EmailNotification = {
      to: email,
      template: 'otp',
      data: { code },
      subject: 'Ваш код верификации Aluf',
    };

    try {
      await this.nats.publish(
        NATS_SUBJECTS.EMAIL_SEND,
        this.sc.encode(JSON.stringify(notification)),
      );
    } catch (err) {
      console.error('[OTP] Failed to send email:', err);
      // Не прерываем процесс, код всё равно сохранён в Redis
    }
  }

  /**
   * @param consumeOnSuccess — если false, запись в Redis сохраняется (нужно для входа с 2FA:
   * сначала проверяем email/SMS-код, затем TOTP, и только после успеха вызываем consumeVerification).
   */
  async verify(
    verificationId: string,
    code: string,
    options?: { consumeOnSuccess?: boolean },
  ): Promise<Record<string, unknown>> {
    const consumeOnSuccess = options?.consumeOnSuccess !== false;
    const key = this.verificationKey(verificationId);
    const raw = await this.redis.get(key);

    if (!raw) {
      throw new BadRequestError('Код верификации истёк или не найден');
    }

    const stored: StoredVerification = JSON.parse(raw);

    if (stored.attempts >= MAX_VERIFY_ATTEMPTS) {
      await this.redis.del(key);
      throw new BadRequestError('Превышено максимальное количество попыток');
    }

    if (stored.code !== code) {
      stored.attempts++;
      await this.redis.setex(
        key,
        await this.redis.ttl(key),
        JSON.stringify(stored),
      );
      const remaining = MAX_VERIFY_ATTEMPTS - stored.attempts;
      throw new BadRequestError(`Неверный код. Осталось попыток: ${remaining}`);
    }

    if (consumeOnSuccess) {
      await this.redis.del(key);
    }
    return stored.data;
  }

  /** Удалить одноразовую верификацию после полного успеха (например после проверки 2FA). */
  async consumeVerification(verificationId: string): Promise<void> {
    const key = this.verificationKey(verificationId);
    await this.redis.del(key);
  }

  private generateCode(): string {
    const max = Math.pow(10, OTP_LENGTH);
    const num = crypto.randomInt(0, max);
    return num.toString().padStart(OTP_LENGTH, '0');
  }

  private verificationKey(id: string): string {
    return `otp:verification:${id}`;
  }

  private rateLimitKey(target: string): string {
    return `otp:ratelimit:${target}`;
  }

  private async checkRateLimit(target: string): Promise<void> {
    const key = this.rateLimitKey(target);
    const count = await this.redis.get(key);

    if (count && parseInt(count, 10) >= MAX_OTP_PER_TARGET_PER_HOUR) {
      throw new RateLimitError(3600_000);
    }
  }

  private async incrementTargetCounter(target: string): Promise<void> {
    const key = this.rateLimitKey(target);
    const exists = await this.redis.exists(key);

    if (exists) {
      await this.redis.incr(key);
    } else {
      await this.redis.setex(key, 3600, '1');
    }
  }
}
