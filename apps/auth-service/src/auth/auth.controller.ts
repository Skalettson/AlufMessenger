import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import {
  AlufError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
} from '@aluf/shared';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';

function toGrpcError(err: unknown): RpcException {
  if (err instanceof AlufError) {
    let code = GrpcStatus.INTERNAL;
    if (err instanceof BadRequestError) code = GrpcStatus.INVALID_ARGUMENT;
    else if (err instanceof NotFoundError) code = GrpcStatus.NOT_FOUND;
    else if (err instanceof UnauthorizedError) code = GrpcStatus.UNAUTHENTICATED;
    else if (err instanceof ConflictError) code = GrpcStatus.ALREADY_EXISTS;
    else if (err instanceof RateLimitError) code = GrpcStatus.RESOURCE_EXHAUSTED;

    return new RpcException({ code, message: err.message });
  }
  return new RpcException({
    code: GrpcStatus.INTERNAL,
    message: err instanceof Error ? err.message : 'Internal server error',
  });
}

interface GrpcTimestamp {
  seconds: number;
  nanos: number;
}

function toGrpcTimestamp(date: Date): GrpcTimestamp {
  const ms = date.getTime();
  return {
    seconds: Math.floor(ms / 1000),
    nanos: (ms % 1000) * 1_000_000,
  };
}

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @GrpcMethod('AuthService', 'Register')
  async register(data: {
    method: number;
    phone: string;
    email: string;
    username: string;
    displayName: string;
  }) {
    try {
      const method = data.method === 1 ? 'phone' : 'email';
      const result = await this.authService.register({
        method,
        phone: data.phone || undefined,
        email: data.email || undefined,
        username: data.username || undefined,
        displayName: data.displayName || undefined,
      });

      return {
        verificationId: result.verificationId,
        expiresAt: toGrpcTimestamp(result.expiresAt),
        devCode: result.devCode || '',
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('AuthService', 'VerifyCode')
  async verifyCode(data: { verificationId: string; code: string }) {
    try {
      const tokens = await this.authService.verifyRegistration(
        data.verificationId,
        data.code,
      );
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('AuthService', 'Login')
  async login(data: {
    method: number;
    phone: string;
    email: string;
    deviceInfo?: { platform: string; deviceName: string; appVersion: string; osVersion: string };
  }) {
    try {
      const method = data.method === 1 ? 'phone' : 'email';
      const result = await this.authService.login({
        method,
        phone: data.phone || undefined,
        email: data.email || undefined,
        deviceInfo: data.deviceInfo ? {
          platform: data.deviceInfo.platform,
          deviceName: data.deviceInfo.deviceName,
          appVersion: data.deviceInfo.appVersion,
          osVersion: data.deviceInfo.osVersion,
        } : undefined,
      });

      return {
        verificationId: result.verificationId,
        expiresAt: toGrpcTimestamp(result.expiresAt),
        requires_2fa: result.requires2fa,
        devCode: result.devCode || '',
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('AuthService', 'VerifyLogin')
  async verifyLogin(data: {
    verificationId: string;
    code: string;
    twoFactorCode: string;
    clientIp?: string;
    client_ip?: string;
    userAgent?: string;
    user_agent?: string;
  }) {
    try {
      const tokens = await this.authService.verifyLogin(
        data.verificationId,
        data.code,
        data.twoFactorCode || undefined,
        (data.clientIp ?? data.client_ip ?? '').trim() || undefined,
        (data.userAgent ?? data.user_agent ?? '').trim() || undefined,
      );
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('AuthService', 'RefreshToken')
  async refreshToken(data: { refreshToken?: string; refresh_token?: string }) {
    const refresh = (data.refreshToken ?? data.refresh_token ?? '').trim();
    if (!refresh) {
      throw toGrpcError(new UnauthorizedError('Токен обновления не передан'));
    }
    try {
      const tokens = await this.authService.refreshToken(refresh);
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('AuthService', 'ValidateToken')
  async validateToken(data: { accessToken?: string; access_token?: string }) {
    const token = (data.accessToken ?? data.access_token ?? '').trim();
    if (!token) {
      return { valid: false, user_id: '', username: '', aluf_id: '', session_id: '' };
    }
    try {
      const result = await this.authService.validateToken(token);
      const uid = result.userId ? String(result.userId).trim() : '';
      const alufId = result.alufId != null ? String(result.alufId) : '';
      const sid = result.sessionId ?? '';
      return {
        valid: result.valid,
        user_id: uid,
        userId: uid,
        username: result.username ?? '',
        aluf_id: alufId,
        alufId,
        session_id: sid,
        sessionId: sid,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('AuthService', 'Logout')
  async logout(data: { sessionId: string }) {
    try {
      await this.authService.logout(data.sessionId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('AuthService', 'GetSessions')
  async getSessions(data: { userId?: string; user_id?: string }) {
    const userId = (data.userId ?? data.user_id ?? '').trim();
    if (!userId) {
      return { sessions: [] };
    }
    try {
      const sessions = await this.authService.getSessions(userId);
      return {
        sessions: sessions.map((s) => ({
          id: s.id,
          deviceInfo: s.deviceInfo,
          ip: s.ip,
          createdAt: toGrpcTimestamp(s.createdAt),
          lastActiveAt: toGrpcTimestamp(s.lastActiveAt),
        })),
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('AuthService', 'TerminateSession')
  async terminateSession(data: { sessionId: string; userId: string; session_id?: string; user_id?: string }) {
    try {
      const sessionId = data.sessionId ?? data.session_id ?? '';
      const userId = data.userId ?? data.user_id ?? '';
      await this.authService.terminateSession(sessionId, userId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('AuthService', 'TerminateSessionAdmin')
  async terminateSessionAdmin(data: { sessionId?: string; session_id?: string }) {
    try {
      const sessionId = data.sessionId ?? data.session_id ?? '';
      await this.authService.terminateSessionAdmin(sessionId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('AuthService', 'Setup2FA')
  async setup2fa(data: { userId: string }) {
    try {
      const result = await this.twoFactorService.setup(data.userId);
      return {
        secret: result.secret,
        qrCodeUrl: result.qrCodeUrl,
        backupCodes: result.backupCodes,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('AuthService', 'Verify2FA')
  async verify2fa(data: { userId: string; code: string }) {
    try {
      await this.twoFactorService.verify(data.userId, data.code);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('AuthService', 'Disable2FA')
  async disable2fa(data: { userId: string; code: string }) {
    try {
      await this.twoFactorService.disable(data.userId, data.code);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }
}
