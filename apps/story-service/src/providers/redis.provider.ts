import { Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_TOKEN = 'REDIS';

export const RedisProvider: Provider = {
  provide: REDIS_TOKEN,
  useFactory: () => {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error('REDIS_URL environment variable is not set');
    }
    return new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return Math.min(times * 200, 2000);
      },
    });
  },
};
