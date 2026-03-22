import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../auth.service';
import { JwtService } from '../jwt.service';
import { OtpService } from '../otp.service';
import { SessionService } from '../session.service';
import { TwoFactorService } from '../two-factor.service';

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
};

const mockJwtService = {
  signAccessToken: vi.fn().mockReturnValue('access-token-123'),
  signRefreshToken: vi.fn().mockReturnValue('refresh-token-456'),
  verifyAccessToken: vi.fn().mockReturnValue({
    sub: 'user-id-1',
    alufId: '123456789',
    username: 'testuser',
    jti: 'jti-1',
    sessionId: 'session-1',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
  }),
  verifyRefreshToken: vi.fn().mockReturnValue({
    sub: 'user-id-1',
    jti: 'jti-2',
    sessionId: 'session-1',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 2592000,
  }),
  getAccessTokenTtl: vi.fn().mockReturnValue(900),
} as unknown as JwtService;

const mockOtpService = {
  generateAndStore: vi.fn().mockResolvedValue({
    verificationId: 'verify-id-1',
    expiresAt: new Date(Date.now() + 300_000),
  }),
  verify: vi.fn().mockResolvedValue({
    type: 'register',
    method: 'phone',
    phone: '+79991234567',
  }),
} as unknown as OtpService;

const mockSessionService = {
  createSession: vi.fn().mockResolvedValue('session-id-1'),
  getSession: vi.fn().mockResolvedValue({
    id: 'session-id-1',
    userId: 'user-id-1',
    tokenHash: 'hash',
    deviceInfo: { platform: 'web', deviceName: 'Chrome', appVersion: '1.0.0', osVersion: 'Win11' },
    ip: '127.0.0.1',
  }),
  getSessionByTokenHash: vi.fn().mockResolvedValue({
    id: 'session-id-1',
    userId: 'user-id-1',
  }),
  getUserSessions: vi.fn().mockResolvedValue([]),
  updateSessionToken: vi.fn().mockResolvedValue(undefined),
  terminateSession: vi.fn().mockResolvedValue(undefined),
  hashToken: vi.fn().mockReturnValue('hashed-token'),
} as unknown as SessionService;

const mockTwoFactorService = {
  setup: vi.fn().mockResolvedValue({
    secret: 'JBSWY3DPEHPK3PXP',
    qrCodeUrl: 'data:image/png;base64,...',
    backupCodes: ['code1', 'code2'],
  }),
  verify: vi.fn().mockResolvedValue(undefined),
  disable: vi.fn().mockResolvedValue(undefined),
  validateCode: vi.fn().mockResolvedValue(true),
} as unknown as TwoFactorService;

let mockNatsConnection: any;

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit.mockResolvedValue([]);
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([{
      id: 'new-user-id',
      alufId: 123456789n,
      username: 'testuser',
      displayName: 'Test User',
      phone: '+79991234567',
      email: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
    }]);

    mockNatsConnection = {
      publish: vi.fn().mockResolvedValue(undefined),
    };

    authService = new AuthService(
      mockDb as any,
      mockJwtService,
      mockOtpService,
      mockSessionService,
      mockTwoFactorService,
      mockNatsConnection,
    );
  });

  describe('register', () => {
    it('should generate OTP and return verification id for phone registration', async () => {
      const result = await authService.register({
        method: 'phone',
        phone: '+79991234567',
        username: 'testuser',
        displayName: 'Test User',
      });

      expect(result.verificationId).toBe('verify-id-1');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockOtpService.generateAndStore).toHaveBeenCalledWith(
        '+79991234567',
        expect.objectContaining({ type: 'register', method: 'phone' }),
      );
    });

    it('should generate OTP for email registration', async () => {
      const result = await authService.register({
        method: 'email',
        email: 'test@example.com',
      });

      expect(result.verificationId).toBe('verify-id-1');
      expect(mockOtpService.generateAndStore).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({ type: 'register', method: 'email' }),
      );
    });

    it('should throw if phone is missing for phone method', async () => {
      await expect(
        authService.register({ method: 'phone' }),
      ).rejects.toThrow('Номер телефона обязателен');
    });

    it('should throw if email is missing for email method', async () => {
      await expect(
        authService.register({ method: 'email' }),
      ).rejects.toThrow('Email обязателен');
    });

    it('should throw on duplicate username', async () => {
      mockDb.limit.mockResolvedValueOnce([{ id: 'existing', username: 'testuser' }]);

      await expect(
        authService.register({
          method: 'phone',
          phone: '+79991234567',
          username: 'testuser',
        }),
      ).rejects.toThrow('Имя пользователя уже занято');
    });
  });

  describe('verifyRegistration', () => {
    it('should create user and return tokens on valid OTP', async () => {
      const result = await authService.verifyRegistration(
        'verify-id-1',
        '123456',
        undefined,
        '127.0.0.1',
      );

      expect(result.accessToken).toBe('access-token-123');
      expect(result.refreshToken).toBe('refresh-token-456');
      expect(result.expiresIn).toBe(900);
      expect(mockOtpService.verify).toHaveBeenCalledWith('verify-id-1', '123456');
    });
  });

  describe('login', () => {
    it('should find user and generate OTP', async () => {
      mockDb.limit.mockResolvedValueOnce([{
        id: 'user-id-1',
        phone: '+79991234567',
        twoFactorEnabled: false,
      }]);

      const result = await authService.login({
        method: 'phone',
        phone: '+79991234567',
      });

      expect(result.verificationId).toBe('verify-id-1');
      expect(result.requires2fa).toBe(false);
    });

    it('should indicate 2FA requirement', async () => {
      mockDb.limit.mockResolvedValueOnce([{
        id: 'user-id-1',
        phone: '+79991234567',
        twoFactorEnabled: true,
      }]);

      const result = await authService.login({
        method: 'phone',
        phone: '+79991234567',
      });

      expect(result.requires2fa).toBe(true);
    });

    it('should throw if user not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        authService.login({ method: 'phone', phone: '+70000000000' }),
      ).rejects.toThrow('не найден');
    });
  });

  describe('verifyLogin', () => {
    it('should return tokens on valid OTP (no 2FA)', async () => {
      vi.mocked(mockOtpService.verify).mockResolvedValueOnce({
        type: 'login',
        userId: 'user-id-1',
        deviceInfo: { platform: 'web', deviceName: 'Chrome', appVersion: '1.0.0', osVersion: 'Win11' },
      });

      mockDb.limit.mockResolvedValueOnce([{
        id: 'user-id-1',
        alufId: 123456789n,
        username: 'testuser',
        twoFactorEnabled: false,
        twoFactorSecret: null,
      }]);

      const result = await authService.verifyLogin('verify-id-1', '123456');

      expect(result.accessToken).toBe('access-token-123');
      expect(result.refreshToken).toBe('refresh-token-456');
    });

    it('should require 2FA code when enabled', async () => {
      vi.mocked(mockOtpService.verify).mockResolvedValueOnce({
        type: 'login',
        userId: 'user-id-1',
      });

      mockDb.limit.mockResolvedValueOnce([{
        id: 'user-id-1',
        alufId: 123456789n,
        username: 'testuser',
        twoFactorEnabled: true,
        twoFactorSecret: 'secret',
      }]);

      await expect(
        authService.verifyLogin('verify-id-1', '123456'),
      ).rejects.toThrow('Требуется код двухфакторной аутентификации');
    });
  });

  describe('validateToken', () => {
    it('should return valid=true for a valid access token', async () => {
      const result = await authService.validateToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user-id-1');
      expect(result.username).toBe('testuser');
      expect(result.alufId).toBe('123456789');
    });

    it('should return valid=false for an invalid token', async () => {
      vi.mocked(mockJwtService.verifyAccessToken).mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      const result = await authService.validateToken('bad-token');
      expect(result.valid).toBe(false);
    });
  });

  describe('refreshToken', () => {
    it('should rotate refresh token and return new pair', async () => {
      mockDb.limit.mockResolvedValueOnce([{
        id: 'user-id-1',
        alufId: 123456789n,
        username: 'testuser',
      }]);

      const result = await authService.refreshToken('old-refresh-token');

      expect(result.accessToken).toBe('access-token-123');
      expect(result.refreshToken).toBe('refresh-token-456');
      expect(mockSessionService.updateSessionToken).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should terminate the session', async () => {
      await authService.logout('session-id-1');
      expect(mockSessionService.terminateSession).toHaveBeenCalledWith('session-id-1');
    });
  });

  describe('getSessions', () => {
    it('should return user sessions', async () => {
      const sessions = await authService.getSessions('user-id-1');
      expect(mockSessionService.getUserSessions).toHaveBeenCalledWith('user-id-1');
      expect(Array.isArray(sessions)).toBe(true);
    });
  });
});
