import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY, RequestUser } from '../decorators/public.decorator';
import { JwtVerifierService } from '../auth/jwt-verifier.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtVerifier: JwtVerifierService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user: RequestUser }>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Токен не предоставлен');
    }

    const payload = this.jwtVerifier.verify(token);
    if (!payload) {
      throw new UnauthorizedException('Недействительный токен');
    }

    request.user = {
      userId: payload.userId,
      sessionId: payload.sessionId ?? '',
    };
    return true;
  }

  private extractToken(request: Request): string | null {
    const auth = this.getHeader(request, 'authorization');
    if (auth) {
      const match = auth.trim().match(/^Bearer\s+([^\s,]+)/i);
      if (match) return match[1].trim();
    }
    const xToken = this.getHeader(request, 'x-access-token');
    if (xToken) {
      const t = xToken.trim().replace(/^Bearer\s+/i, '').trim();
      if (t) return t;
    }
    return null;
  }

  /** Получить заголовок как строку (Express может вернуть string | string[]). */
  private getHeader(request: Request, name: string): string | null {
    const raw = request.headers[name.toLowerCase()] ?? request.headers[name];
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw) && raw.length > 0) return raw[raw.length - 1];
    return null;
  }
}
