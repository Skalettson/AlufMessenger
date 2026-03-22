import { Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_TOKEN = 'REDIS';

export const RedisProvider: Provider = {
  provide: REDIS_TOKEN,
  useFactory: () => {
    // Use Redis host (Docker network) with stable connection settings
    const url = process.env.REDIS_URL || 'redis://redis:6379';
    
    const redis = new Redis(url, {
      // Connection
      maxRetriesPerRequest: null, // Unlimited retries for stable connection
      retryStrategy(times) {
        const delay = Math.min(times * 300, 3000);
        console.log(`[Redis] Retry ${times}, delay ${delay}ms`);
        return delay;
      },
      reconnectOnError(err) {
        console.error('[Redis] Reconnect on error:', err.message);
        return 2; // force reconnect
      },
      // Timeouts
      connectTimeout: 10000,
      commandTimeout: 5000,
      // Keep connection alive
      keepAlive: 10000, // TCP keepalive every 10s
      family: 4, // Use IPv4
      // Stability settings
      enableReadyCheck: true,
      enableOfflineQueue: true,
      // Don't disconnect on idle
      disconnectTimeout: 0,
    });

    redis.on('error', (err) => {
      console.error('[Redis] Error:', err.message);
    });

    redis.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    redis.on('close', () => {
      console.log('[Redis] Connection closed');
    });

    redis.on('reconnecting', (delay: number) => {
      console.log(`[Redis] Reconnecting in ${delay}ms`);
    });

    return redis;
  },
};
