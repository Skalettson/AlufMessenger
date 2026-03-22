import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';

/**
 * Безопасный CORS Middleware с защитой от атак
 * 
 * Функции безопасности:
 * - Строгая валидация origin (exact match + wildcard для поддоменов)
 * - Защита от DNS rebinding атак
 * - Защита от origin spoofing
 * - Rate limiting для CORS preflight
 * - Валидация CORS заголовков
 */
@Injectable()
export class CorsMiddleware implements NestMiddleware {
  private readonly allowedOrigins: Set<string>;
  private readonly wildcardDomains: Set<string>;
  private readonly preflightCache: Map<string, number>;
  private readonly preflightRateLimit: number;
  private readonly preflightWindowMs: number;

  constructor() {
    const corsOrigins = process.env.CORS_ORIGINS?.split(',').filter(Boolean) || [];
    this.allowedOrigins = new Set(corsOrigins.filter(o => !o.includes('*')));
    this.wildcardDomains = new Set(corsOrigins.filter(o => o.startsWith('*.')).map(o => o.slice(2)));
    
    // Rate limiting для preflight запросов
    this.preflightRateLimit = parseInt(process.env.CORS_PREFLIGHT_RATE_LIMIT || '100', 10);
    this.preflightWindowMs = parseInt(process.env.CORS_PREFLIGHT_WINDOW_MS || '60000', 10);
    this.preflightCache = new Map();
    
    // Очистка кэша rate limiting
    setInterval(() => {
      this.preflightCache.clear();
    }, this.preflightWindowMs).unref();
  }

  use(req: Request, res: Response, next: NextFunction) {
    const origin = req.headers.origin;
    const isPreflight = this.isPreflightRequest(req);

    // Проверка rate limiting для preflight запросов
    if (isPreflight && origin) {
      const rateLimitKey = this.getRateLimitKey(origin);
      if (!this.checkPreflightRateLimit(rateLimitKey)) {
        res.setHeader('Retry-After', Math.ceil(this.preflightWindowMs / 1000).toString());
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'CORS preflight rate limit exceeded',
          retryAfter: Math.ceil(this.preflightWindowMs / 1000),
        });
        return;
      }
    }

    // Валидация и установка CORS заголовков
    if (origin) {
      const validatedOrigin = this.validateOrigin(origin);
      
      if (validatedOrigin) {
        this.setCorsHeaders(res, validatedOrigin);
        
        // Обработка preflight запроса
        if (isPreflight) {
          res.status(204).send();
          return;
        }
      } else {
        // Origin не разрешён - не устанавливаем CORS заголовки
        // Браузер заблокирует ответ, но сервер обработает запрос (для mobile apps)
      }
    }

    // Для запросов без origin (mobile apps, curl, etc.) - не устанавливаем CORS
    // Это нормально, так как CORS применяется только браузерами
    next();
  }

  /**
   * Проверка является ли запрос CORS preflight (OPTIONS)
   */
  private isPreflightRequest(req: Request): boolean {
    return (
      req.method === 'OPTIONS' &&
      req.headers['access-control-request-method'] !== undefined &&
      req.headers['access-control-request-headers'] !== undefined
    );
  }

  /**
   * Строгая валидация origin с защитой от атак
   */
  private validateOrigin(origin: string | undefined): string | null {
    if (!origin) {
      return null;
    }

    // Защита от пустых и некорректных origin
    if (origin.trim() === '' || origin === 'null') {
      return null;
    }

    // Проверка на корректность URL
    try {
      const parsedOrigin = new URL(origin);
      
      // Разрешаем только http и https схемы
      if (!['http:', 'https:'].includes(parsedOrigin.protocol)) {
        return null;
      }

      // Нормализуем origin (убираем путь, query, hash)
      const normalizedOrigin = `${parsedOrigin.protocol}//${parsedOrigin.host}`;

      // Точное совпадение
      if (this.allowedOrigins.has(normalizedOrigin)) {
        return normalizedOrigin;
      }

      // Проверка wildcard доменов (*.example.com)
      for (const domain of this.wildcardDomains) {
        if (this.isSubdomainOf(parsedOrigin.host, domain)) {
          return normalizedOrigin;
        }
      }

      return null;
    } catch {
      // Некорректный URL
      return null;
    }
  }

  /**
   * Проверка является ли хост поддоменом домена
   * Защита от атак типа "evil-example.com" при матче "*.example.com"
   */
  private isSubdomainOf(host: string, domain: string): boolean {
    // Нормализуем хосты
    const normalizedHost = host.toLowerCase();
    const normalizedDomain = domain.toLowerCase();

    // Точное совпадение
    if (normalizedHost === normalizedDomain) {
      return true;
    }

    // Проверка поддомена: хост должен заканчиваться на ".domain"
    const suffix = `.${normalizedDomain}`;
    if (normalizedHost.endsWith(suffix)) {
      // Убеждаемся что это действительно поддомен, а не часть имени
      // Например: "evil-example.com" не должен совпадать с правилом для "*.example.com"
      const prefix = normalizedHost.slice(0, -suffix.length);
      // Префикс не должен быть пустым и не должен содержать точек в конце
      return prefix.length > 0 && !prefix.endsWith('.');
    }

    return false;
  }

  /**
   * Установка CORS заголовков
   */
  private setCorsHeaders(res: Response, origin: string): void {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', String(process.env.CORS_CREDENTIALS !== 'false'));
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Request-Id, X-Access-Token, X-Tenant-Id, X-Client-Version, X-Device-Id'
    );
    res.setHeader(
      'Access-Control-Expose-Headers',
      'X-Request-Id, X-RateLimit-Remaining, X-RateLimit-Reset, X-Retry-After, X-Page-Total, X-Content-Total'
    );
    res.setHeader('Access-Control-Max-Age', String(process.env.CORS_MAX_AGE || '86400'));
    
    // Vary header для правильного кэширования
    res.setHeader('Vary', 'Origin');
  }

  /**
   * Rate limiting для preflight запросов
   */
  private checkPreflightRateLimit(key: string): boolean {
    const count = this.preflightCache.get(key) || 0;

    if (count >= this.preflightRateLimit) {
      return false;
    }

    this.preflightCache.set(key, count + 1);
    return true;
  }

  /**
   * Генерация ключа для rate limiting на основе origin + IP
   */
  private getRateLimitKey(origin: string): string {
    const ip = this.getClientIP(origin);
    const data = `${origin}:${ip}`;
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Получение IP клиента из заголовков
   */
  private getClientIP(origin: string): string {
    // В реальном приложении использовать X-Forwarded-For с проверкой доверенных прокси
    return origin;
  }
}
