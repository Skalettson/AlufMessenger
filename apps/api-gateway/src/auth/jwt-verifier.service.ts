import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';

/** Result of successful JWT verification (access token payload). */
export interface JwtPayload {
  sub: string;
  sessionId?: string;
}

/**
 * Verifies access tokens locally using the same public key as auth-service.
 */
@Injectable()
export class JwtVerifierService implements OnModuleInit {
  private readonly logger = new Logger(JwtVerifierService.name);
  private publicKey: Buffer | null = null;
  private loadedFrom: string | null = null;

  onModuleInit() {
    const envPath = process.env.JWT_PUBLIC_KEY_PATH;
    const cwd = process.cwd();
    // Сначала ключ auth-service (тот же, которым подписываются токены), иначе можно подхватить другой ключ из .env
    const candidates: string[] = [
      path.join(cwd, 'apps/auth-service/keys/public.pem'),
      path.join(cwd, '../auth-service/keys/public.pem'),
      path.resolve(__dirname, '..', '..', '..', 'auth-service', 'keys', 'public.pem'),
    ];
    if (envPath) {
      candidates.push(path.isAbsolute(envPath) ? envPath : path.join(cwd, envPath));
    }
    candidates.push(path.join(cwd, 'keys/public.pem'));

    for (const filePath of candidates) {
      try {
        const resolved = path.resolve(filePath);
        if (fs.existsSync(resolved)) {
          this.publicKey = fs.readFileSync(resolved);
          this.loadedFrom = resolved;
          this.logger.log('JWT public key loaded from: ' + resolved);
          return;
        }
      } catch {
        // ignore
      }
    }
    this.logger.warn('JWT public key NOT loaded - no file found among candidates');
  }

  /** Для отладки: путь к загруженному ключу или null. */
  getLoadedFrom(): string | null {
    return this.loadedFrom;
  }

  /**
   * Verify access token and return userId (sub) and sessionId.
   * Returns null if the public key is not loaded or verification fails.
   */
  verify(token: string): { userId: string; sessionId: string } | null {
    if (!this.publicKey) return null;

    const t = token.trim();
    if (!t) return null;

    try {
      const payload = jwt.verify(t, this.publicKey, {
        algorithms: ['RS256'],
        issuer: 'aluf-auth',
      }) as JwtPayload & { iat?: number; exp?: number };

      const userId = typeof payload.sub === 'string' ? payload.sub.trim() : '';
      const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';

      if (!userId) return null;

      return { userId, sessionId };
    } catch (err) {
      this.logger.warn(
        `JWT verify failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
