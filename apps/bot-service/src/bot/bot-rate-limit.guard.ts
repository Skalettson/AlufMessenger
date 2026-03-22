import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { REDIS_TOKEN } from '../providers/redis.provider';
import type Redis from 'ioredis';

const RATE_LIMIT_PREFIX = 'bot:ratelimit:';
const RATE_LIMIT_WINDOW_SEC = 60;
const DEFAULT_LIMIT_PER_MIN = 60;

@Injectable()
export class BotRateLimitGuard implements CanActivate {
  private readonly limit: number;

  constructor(@Inject(REDIS_TOKEN) private readonly redis: Redis) {
    this.limit = parseInt(
      process.env.BOT_API_RATE_LIMIT_PER_MIN ?? String(DEFAULT_LIMIT_PER_MIN),
      10,
    ) || DEFAULT_LIMIT_PER_MIN;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ params?: Record<string, string> }>();
    const token = request.params?.token;
    if (!token || typeof token !== 'string') {
      return true;
    }

    const key = `${RATE_LIMIT_PREFIX}${token}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    }

    if (count > this.limit) {
      throw new HttpException(
        {
          ok: false,
          error_code: 429,
          description: 'Too Many Requests: rate limit exceeded',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
