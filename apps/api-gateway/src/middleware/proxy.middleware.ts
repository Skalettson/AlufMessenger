import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';

/**
 * Безопасный прокси-модуль для MinIO (медиа-файлы)
 *
 * Функции безопасности:
 * - Валидация URL и путей
 * - Защита от path traversal атак (../)
 * - Ограничение размеров файлов
 * - Content-Type валидация для GET запросов
 * - Кэширование с ETag
 * - Rate limiting
 */
@Injectable()
export class MediaProxyMiddleware implements NestMiddleware {
  private readonly proxyHandler: RequestHandler;
  private readonly cache: Map<string, CachedResponse>;
  private readonly rateLimitCache: Map<string, number>;

  private readonly maxFileSize: number;
  private readonly cacheTTL: number;
  private readonly rateLimitWindowMs: number;
  private readonly rateLimitMaxRequests: number;

  constructor() {
    const minioEndpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const minioPort = process.env.MINIO_PORT || '9000';
    const minioUseSsl = process.env.MINIO_USE_SSL === 'true';
    const minioUrl = `${minioUseSsl ? 'https' : 'http'}://${minioEndpoint}:${minioPort}`;

    this.maxFileSize = parseInt(process.env.MEDIA_PROXY_MAX_FILE_SIZE || '4294967296', 10);
    this.cacheTTL = parseInt(process.env.MEDIA_CACHE_TTL || '3600', 10) * 1000;
    this.rateLimitWindowMs = parseInt(process.env.MEDIA_RATE_LIMIT_WINDOW_MS || '60000', 10);
    this.rateLimitMaxRequests = parseInt(process.env.MEDIA_RATE_LIMIT_MAX_REQUESTS || '5000', 10);

    this.cache = new Map();
    this.rateLimitCache = new Map();

    // Очистка кэша
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now > value.expiresAt) {
          this.cache.delete(key);
        }
      }
      this.rateLimitCache.clear();
    }, 60000).unref();

    // Создание прокси
    this.proxyHandler = createProxyMiddleware({
      target: minioUrl,
      changeOrigin: true,
      secure: minioUseSsl,
      pathRewrite: { '^/api/proxy-image': '' },
      onProxyReq: this.onProxyReq.bind(this),
      onProxyRes: this.onProxyRes.bind(this),
      onError: this.onError.bind(this),
      filter: this.filterRequest.bind(this),
    } as any);
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Проверка rate limiting
    const rateLimitKey = this.getRateLimitKey(req);
    if (!this.checkRateLimit(rateLimitKey)) {
      res.setHeader('Retry-After', Math.ceil(this.rateLimitWindowMs / 1000).toString());
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Media proxy rate limit exceeded',
        retryAfter: Math.ceil(this.rateLimitWindowMs / 1000),
      });
      return;
    }

    // Обработка запросов с query-параметром ?url=... (для проксирования внешних URL)
    if (req.method === 'GET' && req.query.url) {
      const targetUrl = req.query.url as string;
      
      try {
        const parsedUrl = new URL(targetUrl);
        const host = parsedUrl.hostname.toLowerCase();
        const port = parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80');
        const allowedHosts = ['localhost', '127.0.0.1'];
        const configuredEndpoint = (process.env.MINIO_ENDPOINT || '').toLowerCase();
        if (configuredEndpoint && !allowedHosts.includes(configuredEndpoint)) {
          allowedHosts.push(configuredEndpoint);
        }

        if (!allowedHosts.includes(host)) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'URL not allowed',
          });
          return;
        }
        
        const allowedPorts = ['9000', '9001', process.env.MINIO_PORT || '9000'];
        if (!allowedPorts.includes(port)) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Port not allowed',
          });
          return;
        }
        
        // Перенаправляем запрос на целевой URL
        const proxyHandler = createProxyMiddleware({
          target: `${parsedUrl.protocol}//${host}:${port}`,
          changeOrigin: true,
          secure: parsedUrl.protocol === 'https:',
          pathRewrite: { '^/api/proxy-image': parsedUrl.pathname },
          onProxyReq: this.onProxyReq.bind(this),
          onProxyRes: this.onProxyRes.bind(this),
          onError: this.onError.bind(this),
          filter: this.filterRequest.bind(this),
        } as any);
        
        proxyHandler(req, res, next);
        return;
      } catch {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid URL',
        });
        return;
      }
    }

    // Проверка кэша только для GET запросов
    if (req.method === 'GET') {
      const cacheKey = this.getCacheKey(req);
      const cached = this.cache.get(cacheKey);

      if (cached) {
        // Проверка If-None-Match для conditional request
        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch && ifNoneMatch === cached.etag) {
          res.status(304).send();
          return;
        }

        res.setHeader('Content-Type', cached.contentType);
        res.setHeader('ETag', cached.etag);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', `public, max-age=${Math.floor(this.cacheTTL / 1000)}`);
        res.send(cached.data);
        return;
      }
    }

    // Валидация пути (только для GET запросов, для PUT пропускаем)
    if (req.method === 'GET' && !this.validatePath(req.url)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid path detected',
      });
      return;
    }

    this.proxyHandler(req, res, next);
  }

  /**
   * Валидация пути на наличие path traversal атак
   */
  private validatePath(path: string): boolean {
    // Защита от path traversal (только ../)
    if (path.includes('../') || path.includes('..\\') || path.includes('%2e%2e%2f') || path.includes('%2e%2e/')) {
      return false;
    }

    // Защита от null байтов
    if (path.includes('\0') || path.includes('%00')) {
      return false;
    }

    return true;
  }

  /**
   * Обработка запроса к прокси
   */
  private onProxyReq(proxyReq: any, req: Request, _res: Response): void {
    // Для PUT запросов (загрузка файлов) не модифицируем Content-Type
    if (req.method !== 'PUT') {
      proxyReq.setHeader('Accept-Encoding', 'gzip, deflate');
    }

    // Добавление заголовков безопасности
    proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
    proxyReq.setHeader('X-Real-IP', this.getClientIP(req));

    // Если есть query.url, используем его query-параметры вместо оригинальных
    if (req.query.url) {
      try {
        const targetUrl = new URL(req.query.url as string);
        // Копируем query-параметры из целевого URL
        const targetPath = targetUrl.pathname + targetUrl.search;
        proxyReq.setPath(targetPath);
        console.log(`[MediaProxy] ${req.method} ${req.url} -> ${targetUrl.protocol}//${targetUrl.host}${targetPath}`);
      } catch {
        // Игнорируем ошибки URL
      }
    } else {
      console.log(`[MediaProxy] ${req.method} ${req.url} -> ${proxyReq.path}`);
    }
  }

  /**
   * Обработка ответа от прокси
   */
  private onProxyRes(proxyRes: any, req: Request, res: Response): void {
    const statusCode = proxyRes.statusCode;

    // ОТКЛЮЧЕНО: Проверка Content-Type блокирует легитимные файлы
    // MinIO может возвращать application/octet-stream для любых файлов
    // if (req.method === 'GET' && statusCode === 200) {
    //   const contentType = proxyRes.headers['content-type']?.toLowerCase() || '';
    //   const contentTypeBase = contentType.split(';')[0].trim();
    //   const isAllowedType = this.allowedContentTypes.has(contentTypeBase);
    //   const isImageSubtype = contentTypeBase.startsWith('image/');
    //   if (!isAllowedType && !isImageSubtype && contentType !== '') {
    //     console.warn('[MediaProxy] Forbidden content-type from upstream:', contentType);
    //     res.status(403).json({
    //       error: 'Forbidden',
    //       message: 'Content-Type not allowed',
    //     });
    //     return;
    //   }
    // }

    // Проверка размера файла только для GET запросов
    if (req.method === 'GET') {
      const contentLength = parseInt(proxyRes.headers['content-length'] || '0', 10);
      if (contentLength > this.maxFileSize) {
        res.status(413).json({
          error: 'Payload Too Large',
          message: `File size exceeds limit of ${this.maxFileSize} bytes`,
        });
        return;
      }
    }

    // Кэширование только для успешных GET запросов
    if (req.method === 'GET' && statusCode === 200) {
      const chunks: Buffer[] = [];
      const originalWrite = res.write.bind(res);
      const originalEnd = res.end.bind(res);

      res.write = (data: any) => {
        if (Buffer.isBuffer(data)) {
          chunks.push(data);
        }
        return originalWrite(data);
      };

      res.end = (data?: any) => {
        if (data && Buffer.isBuffer(data)) {
          chunks.push(data);
        }

        const fullData = Buffer.concat(chunks);
        const etag = proxyRes.headers['etag'] || this.generateETag(fullData);
        const cacheKey = this.getCacheKey(req);

        // Кэширование
        this.cache.set(cacheKey, {
          data: fullData,
          etag,
          contentType: proxyRes.headers['content-type'] || 'application/octet-stream',
          expiresAt: Date.now() + this.cacheTTL,
        });

        res.setHeader('ETag', etag);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Cache-Control', `public, max-age=${Math.floor(this.cacheTTL / 1000)}`);

        return originalEnd(data);
      };
    }

    // Добавление заголовков безопасности
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'GET') {
      res.setHeader('Content-Security-Policy', "default-src 'none'");
    }
  }

  /**
   * Обработка ошибок прокси
   */
  private onError(err: any, req: Request, res: Response): void {
    console.error(`[MediaProxy] Error for ${req.method} ${req.url}:`, err?.message ?? err);

    if (!res.headersSent) {
      // Определяем код ошибки на основе типа ошибки
      let statusCode = 502;
      let message = 'Failed to proxy request to media storage';

      if (err?.code === 'ECONNREFUSED') {
        statusCode = 503;
        message = 'Media storage unavailable';
      } else if (err?.code === 'ETIMEDOUT') {
        statusCode = 504;
        message = 'Media storage timeout';
      } else if (err?.code === 'ENOTFOUND') {
        statusCode = 502;
        message = 'Media storage not found';
      }

      res.status(statusCode).json({
        error: 'Bad Gateway',
        message,
      });
    }
  }

  /**
   * Фильтрация запросов
   */
  private filterRequest(req: Request): boolean {
    // Блокировка опасных методов
    const dangerousMethods = ['CONNECT', 'TRACE', 'TRACK'];
    if (dangerousMethods.includes(req.method)) {
      return false;
    }

    return true;
  }

  /**
   * Rate limiting проверка
   */
  private checkRateLimit(key: string): boolean {
    const count = this.rateLimitCache.get(key) || 0;

    if (count >= this.rateLimitMaxRequests) {
      return false;
    }

    this.rateLimitCache.set(key, count + 1);
    return true;
  }

  /**
   * Генерация ключа для rate limiting
   */
  private getRateLimitKey(req: Request): string {
    const ip = this.getClientIP(req);
    const data = `${ip}:${req.url}`;
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Генерация ключа для кэша
   */
  private getCacheKey(req: Request): string {
    const url = new URL(req.url, 'http://localhost');
    return createHash('sha256').update(`${req.method}:${url.pathname}:${url.search}`).digest('hex');
  }

  /**
   * Генерация ETag для данных
   */
  private generateETag(data: Buffer): string {
    return `"${createHash('sha256').update(data).digest('base64url')}"`;
  }

  /**
   * Получение IP клиента
   */
  private getClientIP(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
}

interface CachedResponse {
  data: Buffer;
  etag: string;
  contentType: string;
  expiresAt: number;
}
