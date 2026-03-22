import { Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { users } from '@aluf/db';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ALUF_ID_MIN,
  ALUF_ID_MAX,
  USERNAME_REGEX,
  NATS_SUBJECTS,
} from '@aluf/shared';
import { DATABASE_TOKEN, type DrizzleDB } from '../providers/database.provider';
import { JwtService, TOKEN_PAYLOAD_VERSION } from './jwt.service';
import { OtpService } from './otp.service';
import { SessionService, type DeviceInfo } from './session.service';
import { TwoFactorService } from './two-factor.service';
import type { NatsConnection } from 'nats';
import { NATS_TOKEN } from '../providers/nats.provider';
import { StringCodec } from 'nats';

interface RegisterInput {
  method: 'phone' | 'email';
  phone?: string;
  email?: string;
  username?: string;
  displayName?: string;
}

interface LoginInput {
  method: 'phone' | 'email';
  phone?: string;
  email?: string;
  deviceInfo?: DeviceInfo;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly sc = StringCodec();

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
    private readonly sessionService: SessionService,
    private readonly twoFactorService: TwoFactorService,
    @Inject(NATS_TOKEN) private readonly nats: NatsConnection,
  ) {}

  async register(data: RegisterInput): Promise<{
    verificationId: string;
    expiresAt: Date;
    devCode?: string;
  }> {
    this.validateIdentifier(data.method, data.phone, data.email);

    if (data.username) {
      this.validateUsername(data.username);
      const existing = await this.findUserByUsername(data.username);
      if (existing) {
        throw new ConflictError('Имя пользователя уже занято');
      }
    }

    const existingUser = await this.findUserByIdentifier(data.method, data.phone, data.email);
    if (existingUser) {
      throw new ConflictError(
        data.method === 'phone'
          ? 'Пользователь с этим номером телефона уже существует'
          : 'Пользователь с этим email уже существует',
      );
    }

    const target = data.method === 'phone' ? data.phone! : data.email!;
    return this.otpService.generateAndStore(target, {
      type: 'register',
      method: data.method,
      phone: data.phone,
      email: data.email,
      username: data.username,
      displayName: data.displayName,
    });
  }

  async verifyRegistration(
    verificationId: string,
    code: string,
    deviceInfo?: DeviceInfo,
    ip: string = '0.0.0.0',
  ): Promise<TokenPair> {
    const data = await this.otpService.verify(verificationId, code);

    if (data.type !== 'register') {
      throw new BadRequestError('Неверный тип верификации');
    }

    const alufId = await this.generateAlufId();
    const username = (data.username as string) || this.generateDefaultUsername(alufId);
    const displayName = (data.displayName as string) || username;

    const [user] = await this.db
      .insert(users)
      .values({
        alufId,
        username,
        displayName,
        phone: (data.phone as string) || null,
        email: (data.email as string) || null,
        emailVerified: !!data.email, // Подтверждаем email при успешной верификации
      })
      .returning();

    // Отправляем welcome email
    if (user.email) {
      await this.sendWelcomeEmail(user.email, user.displayName);
    }

    return this.createTokensAndSession(user, deviceInfo, ip);
  }

  async login(data: LoginInput): Promise<{
    verificationId: string;
    expiresAt: Date;
    requires2fa: boolean;
    devCode?: string;
  }> {
    this.validateIdentifier(data.method, data.phone, data.email);

    const user = await this.findUserByIdentifier(data.method, data.phone, data.email);
    if (!user) {
      throw new NotFoundError('Пользователь');
    }

    const target = data.method === 'phone' ? data.phone! : data.email!;
    const result = await this.otpService.generateAndStore(target, {
      type: 'login',
      userId: user.id,
      deviceInfo: data.deviceInfo,
    });

    // Отправляем login_alert email
    if (user.email) {
      await this.sendLoginAlertEmail(user.email, data.deviceInfo);
    }

    return {
      verificationId: result.verificationId,
      expiresAt: result.expiresAt,
      requires2fa: user.twoFactorEnabled,
      ...(result.devCode ? { devCode: result.devCode } : {}),
    };
  }

  async verifyLogin(
    verificationId: string,
    code: string,
    twoFactorCode?: string,
    clientIp?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const ip = (clientIp ?? '').trim() || '0.0.0.0';
    /** Не удаляем OTP до проверки 2FA — иначе первый запрос без TOTP «сжигает» код из письма. */
    const data = await this.otpService.verify(verificationId, code, { consumeOnSuccess: false });

    if (data.type !== 'login') {
      throw new BadRequestError('Неверный тип верификации');
    }

    const userId = data.userId as string;
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const tfa = (twoFactorCode ?? '').trim();

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!tfa) {
        throw new BadRequestError('Требуется код двухфакторной аутентификации');
      }
      const valid = await this.twoFactorService.validateCode(
        userId,
        user.twoFactorSecret,
        tfa,
      );
      if (!valid) {
        throw new UnauthorizedError('Неверный код 2FA');
      }
    }

    await this.otpService.consumeVerification(verificationId);

    const rawDeviceInfo = (data.deviceInfo as DeviceInfo) || {
      platform: 'web',
      deviceName: userAgent?.trim() || 'Unknown Device',
      appVersion: '0.0.0',
      osVersion: null,
    };

    const deviceInfo = this.parseDeviceInfo(rawDeviceInfo);
    return this.createTokensAndSession(user, deviceInfo, ip);
  }

  async refreshToken(refreshTokenStr: string): Promise<TokenPair> {
    const payload = this.jwtService.verifyRefreshToken(refreshTokenStr);
    const ver = (payload as { ver?: number }).ver;
    if (ver !== undefined && ver !== TOKEN_PAYLOAD_VERSION) {
      throw new UnauthorizedError('Недействительный токен обновления');
    }
    const tokenHash = this.sessionService.hashToken(refreshTokenStr);

    const session = await this.sessionService.getSessionByTokenHash(tokenHash);
    if (!session) {
      throw new UnauthorizedError('Сессия не найдена или токен был отозван');
    }

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user) {
      throw new NotFoundError('User', payload.sub);
    }

    const accessToken = this.jwtService.signAccessToken({
      sub: user.id,
      alufId: user.alufId.toString(),
      username: user.username,
      sessionId: session.id,
    });

    const newRefreshToken = this.jwtService.signRefreshToken({
      sub: user.id,
      sessionId: session.id,
    });

    await this.sessionService.updateSessionToken(session.id, newRefreshToken);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.jwtService.getAccessTokenTtl(),
    };
  }

  async validateToken(accessToken: string): Promise<{
    valid: boolean;
    userId: string;
    username: string;
    alufId: string;
    sessionId: string;
  }> {
    const empty = { valid: false as const, userId: '', username: '', alufId: '', sessionId: '' };
    try {
      const payload = this.jwtService.verifyAccessToken(accessToken);
      const ver = (payload as { ver?: number }).ver;
      if (ver !== undefined && ver !== TOKEN_PAYLOAD_VERSION) {
        return empty;
      }
      return {
        valid: true,
        userId: payload.sub ?? '',
        username: payload.username ?? '',
        alufId: payload.alufId ?? '',
        sessionId: payload.sessionId ?? '',
      };
    } catch {
      return empty;
    }
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionService.terminateSession(sessionId);
  }

  async getSessions(userId: string) {
    return this.sessionService.getUserSessions(userId);
  }

  async terminateSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.sessionService.getSession(sessionId);
    if (session.userId !== userId) {
      throw new UnauthorizedError('Нет доступа к этой сессии');
    }
    await this.sessionService.terminateSession(sessionId);
  }

  /** Завершить любую сессию (только для платформенного админа; проверка прав — в gateway). */
  async terminateSessionAdmin(sessionId: string): Promise<void> {
    await this.sessionService.terminateSession(sessionId);
  }

  private parseDeviceInfo(raw: DeviceInfo): DeviceInfo {
    const ua = raw.deviceName || '';
    if (!ua.includes('Mozilla/') && !ua.includes('AppleWebKit')) return raw;

    let browser = 'Браузер';
    let os = '';

    if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('OPR/') || ua.includes('Opera')) browser = 'Opera';
    else if (ua.includes('YaBrowser')) browser = 'Яндекс Браузер';
    else if (ua.includes('Firefox/')) browser = 'Firefox';
    else if (ua.includes('Chrome/') && !ua.includes('Chromium')) browser = 'Chrome';
    else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';

    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS X') || ua.includes('Macintosh')) os = 'macOS';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('Linux')) os = 'Linux';

    return {
      platform: raw.platform || 'web',
      deviceName: os ? `${browser}, ${os}` : browser,
      appVersion: raw.appVersion || '1.0.0',
      osVersion: os || raw.osVersion || '',
    };
  }

  private async createTokensAndSession(
    user: typeof users.$inferSelect,
    deviceInfo: DeviceInfo | undefined,
    ip: string,
  ): Promise<TokenPair> {
    const sessionId = crypto.randomUUID();

    const accessToken = this.jwtService.signAccessToken({
      sub: user.id,
      alufId: user.alufId.toString(),
      username: user.username,
      sessionId,
    });

    const refreshToken = this.jwtService.signRefreshToken({
      sub: user.id,
      sessionId,
    });

    const device: DeviceInfo = deviceInfo || {
      platform: 'unknown',
      deviceName: 'Unknown Device',
      appVersion: '0.0.0',
      osVersion: '',
    };

    await this.sessionService.createSession(user.id, refreshToken, device, ip, sessionId);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.jwtService.getAccessTokenTtl(),
    };
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

      if (!existing) {
        return candidate;
      }
    }
    throw new Error('Failed to generate unique aluf_id after 100 attempts');
  }

  private generateDefaultUsername(alufId: bigint): string {
    return `user_${alufId}`;
  }

  private validateIdentifier(method: string, phone?: string, email?: string): void {
    if (method === 'phone' && !phone) {
      throw new BadRequestError('Номер телефона обязателен для метода phone');
    }
    if (method === 'email' && !email) {
      throw new BadRequestError('Email обязателен для метода email');
    }
  }

  private validateUsername(username: string): void {
    if (!USERNAME_REGEX.test(username)) {
      throw new BadRequestError(
        'Имя пользователя должно начинаться с буквы и содержать только буквы, цифры и символ подчёркивания (3-32 символа)',
      );
    }
  }

  private async findUserByIdentifier(
    method: string,
    phone?: string,
    email?: string,
  ) {
    if (method === 'phone' && phone) {
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.phone, phone))
        .limit(1);
      return user ?? null;
    }
    if (method === 'email' && email) {
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      return user ?? null;
    }
    return null;
  }

  private async findUserByUsername(username: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return user ?? null;
  }

  private async sendWelcomeEmail(email: string, displayName: string): Promise<void> {
    try {
      await this.nats.publish(
        NATS_SUBJECTS.EMAIL_SEND,
        this.sc.encode(
          JSON.stringify({
            to: email,
            template: 'welcome' as const,
            data: { name: displayName },
            subject: 'Добро пожаловать в Aluf!',
          }),
        ),
      );
    } catch (err) {
      console.error('[AuthService] Failed to send welcome email:', err);
    }
  }

  private async sendLoginAlertEmail(
    email: string,
    deviceInfo?: DeviceInfo,
  ): Promise<void> {
    try {
      const now = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
      const device = deviceInfo?.deviceName || 'Неизвестное устройство';
      const platform = deviceInfo?.platform || 'unknown';

      await this.nats.publish(
        NATS_SUBJECTS.EMAIL_SEND,
        this.sc.encode(
          JSON.stringify({
            to: email,
            template: 'login_alert' as const,
            data: {
              time: now,
              device,
              location: platform,
            },
            subject: 'Новый вход в ваш аккаунт Aluf',
          }),
        ),
      );
    } catch (err) {
      console.error('[AuthService] Failed to send login alert email:', err);
    }
  }
}
