import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { UnauthorizedError } from '@aluf/shared';
import {
  JWT_ACCESS_TOKEN_TTL,
  JWT_REFRESH_TOKEN_TTL,
} from '@aluf/shared';

/** Bump to invalidate all existing tokens (force re-login). */
export const TOKEN_PAYLOAD_VERSION = 1;

export interface AccessTokenPayload {
  sub: string;
  alufId: string;
  username: string;
  jti: string;
  sessionId: string;
  ver?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  sessionId: string;
  ver?: number;
}

@Injectable()
export class JwtService {
  private readonly privateKey: Buffer;
  private readonly publicKey: Buffer;
  private readonly accessTokenTtl: number;
  private readonly refreshTokenTtl: number;

  constructor() {
    const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH;
    const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH;

    if (!privateKeyPath || !publicKeyPath) {
      throw new Error('JWT_PRIVATE_KEY_PATH and JWT_PUBLIC_KEY_PATH must be set');
    }

    this.privateKey = fs.readFileSync(privateKeyPath);
    this.publicKey = fs.readFileSync(publicKeyPath);
    this.accessTokenTtl = Number(process.env.JWT_ACCESS_TOKEN_TTL) || JWT_ACCESS_TOKEN_TTL;
    this.refreshTokenTtl = Number(process.env.JWT_REFRESH_TOKEN_TTL) || JWT_REFRESH_TOKEN_TTL;
  }

  signAccessToken(payload: Omit<AccessTokenPayload, 'jti'>): string {
    const jti = crypto.randomUUID();
    return jwt.sign(
      { ...payload, jti, ver: TOKEN_PAYLOAD_VERSION },
      this.privateKey,
      {
        algorithm: 'RS256',
        expiresIn: this.accessTokenTtl,
        issuer: 'aluf-auth',
      },
    );
  }

  signRefreshToken(payload: Omit<RefreshTokenPayload, 'jti'>): string {
    const jti = crypto.randomUUID();
    return jwt.sign(
      { ...payload, jti, ver: TOKEN_PAYLOAD_VERSION },
      this.privateKey,
      {
        algorithm: 'RS256',
        expiresIn: this.refreshTokenTtl,
        issuer: 'aluf-auth',
      },
    );
  }

  verifyAccessToken(token: string): AccessTokenPayload & { iat: number; exp: number } {
    try {
      return jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
        issuer: 'aluf-auth',
      }) as AccessTokenPayload & { iat: number; exp: number };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Токен доступа истёк');
      }
      throw new UnauthorizedError('Недействительный токен доступа');
    }
  }

  verifyRefreshToken(token: string): RefreshTokenPayload & { iat: number; exp: number } {
    try {
      return jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
        issuer: 'aluf-auth',
      }) as RefreshTokenPayload & { iat: number; exp: number };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Токен обновления истёк');
      }
      throw new UnauthorizedError('Недействительный токен обновления');
    }
  }

  getAccessTokenTtl(): number {
    return this.accessTokenTtl;
  }
}
