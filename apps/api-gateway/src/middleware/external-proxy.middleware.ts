import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';

/**
 * Circuit Breaker состояние
 */
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
  successCount: number;
}

/**
 * Конфигурация внешнего API
 */
interface ApiConfig {
  url: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetTimeout: number;
}

/**
 * Безопасный прокси-модуль для внешних API
 * 
 * Функции безопасности:
 * - Circuit Breaker паттерн для защиты от каскадных сбоев
 * - Retry logic с exponential backoff
 * - Timeout защита
 * - Response валидация
 * - SSRF защита
 * - Rate limiting
 */
@Injectable()
export class ExternalProxyMiddleware implements NestMiddleware {
  private readonly circuitBreakers: Map<string, CircuitBreakerState>;
  private readonly rateLimitCache: Map<string, number>;
  
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly circuitBreakerThreshold: number;
  private readonly circuitBreakerResetTimeout: number;
  private readonly rateLimitWindowMs: number;
  private readonly rateLimitMaxRequests: number;

  constructor(private readonly apiConfig: ApiConfig) {
    this.timeout = apiConfig.timeout || parseInt(process.env.PROXY_TIMEOUT_MS || '30000', 10);
    this.maxRetries = apiConfig.maxRetries || parseInt(process.env.PROXY_MAX_RETRIES || '3', 10);
    this.retryDelay = apiConfig.retryDelay || parseInt(process.env.PROXY_RETRY_DELAY_MS || '1000', 10);
    this.circuitBreakerThreshold = apiConfig.circuitBreakerThreshold || parseInt(process.env.PROXY_CIRCUIT_BREAKER_THRESHOLD || '5', 10);
    this.circuitBreakerResetTimeout = apiConfig.circuitBreakerResetTimeout || parseInt(process.env.PROXY_CIRCUIT_BREAKER_RESET_MS || '60000', 10);
    this.rateLimitWindowMs = parseInt(process.env.EXTERNAL_PROXY_RATE_LIMIT_WINDOW_MS || '60000', 10);
    this.rateLimitMaxRequests = parseInt(process.env.EXTERNAL_PROXY_RATE_LIMIT_MAX_REQUESTS || '50', 10);

    this.circuitBreakers = new Map();
    this.rateLimitCache = new Map();

    // Очистка rate limit кэша
    setInterval(() => {
      this.rateLimitCache.clear();
    }, this.rateLimitWindowMs).unref();
  }

  use(req: Request, res: Response, next: NextFunction) {
    const targetUrl = this.apiConfig.url;
    const circuitKey = this.getCircuitKey(targetUrl);

    // Проверка rate limiting
    const rateLimitKey = this.getRateLimitKey(req);
    if (!this.checkRateLimit(rateLimitKey)) {
      res.setHeader('Retry-After', Math.ceil(this.rateLimitWindowMs / 1000).toString());
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'External proxy rate limit exceeded',
        retryAfter: Math.ceil(this.rateLimitWindowMs / 1000),
      });
      return;
    }

    // Проверка Circuit Breaker
    const circuitState = this.getCircuitState(circuitKey);
    if (circuitState.state === 'open') {
      const timeSinceLastFailure = Date.now() - circuitState.lastFailureTime;
      
      if (timeSinceLastFailure >= this.circuitBreakerResetTimeout) {
        // Переход в half-open состояние
        this.setCircuitState(circuitKey, 'half-open', circuitState.failures);
      } else {
        // Circuit открыт - отклоняем запрос
        res.status(503).json({
          error: 'Service Unavailable',
          message: 'External service temporarily unavailable',
          retryAfter: Math.ceil((this.circuitBreakerResetTimeout - timeSinceLastFailure) / 1000),
        });
        return;
      }
    }

    // Валидация целевого URL (SSRF защита)
    if (!this.validateTargetUrl(targetUrl)) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Invalid target URL configuration',
      });
      return;
    }

    // Создание прокси с retry logic
    const proxyHandler = createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      secure: targetUrl.startsWith('https://'),
      timeout: this.timeout,
      proxyTimeout: this.timeout,
      onProxyReq: this.onProxyReq.bind(this),
      onProxyRes: this.onProxyRes.bind(this, circuitKey),
      // bind only circuitKey here; proxy will call (err, req, res)
      onError: this.onError.bind(this, circuitKey),
      filter: this.filterRequest.bind(this),
    } as any);

    // Выполнение запроса с retry logic
    this.executeWithRetry(proxyHandler, req, res, circuitKey, 0, next);
  }

  /**
   * Выполнение запроса с retry logic и exponential backoff
   */
  private async executeWithRetry(
    proxyHandler: RequestHandler,
    req: Request,
    res: Response,
    circuitKey: string,
    attempt: number,
    next: NextFunction
  ): Promise<void> {
    try {
      return new Promise((resolve, reject) => {
        const mockNext = (err?: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        };
        proxyHandler(req, res, mockNext);
      });
    } catch (error: any) {
      // Обновление Circuit Breaker
      this.recordFailure(circuitKey);

      // Проверка возможности retry
      if (attempt < this.maxRetries && this.isRetryableError(error)) {
        const delay = this.calculateRetryDelay(attempt);
        console.log(`[ExternalProxy] Retry attempt ${attempt + 1}/${this.maxRetries} after ${delay}ms`);
        
        await this.sleep(delay);
        return this.executeWithRetry(proxyHandler, req, res, circuitKey, attempt + 1, next);
      }

      // Все retry исчерпаны
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Bad Gateway',
          message: 'Failed to connect to external service',
          attempts: attempt + 1,
        });
      }
      next();
    }
  }

  /**
   * Обработка запроса к прокси
   */
  private onProxyReq(proxyReq: any, req: Request, _res: Response): void {
    // Установка таймаута
    proxyReq.setTimeout(this.timeout);

    // Добавление заголовков
    proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
    proxyReq.setHeader('X-Real-IP', this.getClientIP(req));
    proxyReq.setHeader('X-Request-Id', req.headers['x-request-id'] as string || this.generateRequestId());
    
    // Удаление hop-by-hop заголовков
    proxyReq.removeHeader('connection');
    proxyReq.removeHeader('keep-alive');
    proxyReq.removeHeader('transfer-encoding');
  }

  /**
   * Обработка ответа от прокси
   */
  private onProxyRes(circuitKey: string, proxyRes: any, req: Request, res: Response): void {
    const statusCode = proxyRes.statusCode;

    // Обновление Circuit Breaker на основе статуса ответа
    if (statusCode >= 200 && statusCode < 300) {
      this.recordSuccess(circuitKey);
    } else if (statusCode >= 500 || statusCode === 429) {
      this.recordFailure(circuitKey);
    }

    // Добавление заголовков безопасности
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Proxy-Response', 'true');
    res.setHeader('X-Retry-Count', (req as any).retryCount || '0');

    // Проброс заголовков от внешнего API (с фильтрацией)
    const allowedHeaders = [
      'content-type',
      'cache-control',
      'etag',
      'last-modified',
      'x-rate-limit-remaining',
      'x-rate-limit-reset',
    ];
    
    for (const header of allowedHeaders) {
      if (proxyRes.headers[header]) {
        res.setHeader(header.toLowerCase(), proxyRes.headers[header]);
      }
    }
  }

  /**
   * Обработка ошибок прокси
   */
  private onError(circuitKey: string, err: any, _req: Request, res: Response): void {
    console.error('[ExternalProxy] Error:', err?.message ?? err);
    
    // Обновление Circuit Breaker
    this.recordFailure(circuitKey);

    if (!res.headersSent) {
      const statusCode = this.mapErrorCode(err);
      res.status(statusCode).json({
        error: 'Bad Gateway',
        message: 'Failed to proxy request to external service',
        errorCode: (err && (err as any).code) || 'UNKNOWN',
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
   * Валидация целевого URL (SSRF защита)
   */
  private validateTargetUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();

      // Проверка на допустимые протоколы
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return false;
      }

      // Разрешаем localhost для development
      if (process.env.NODE_ENV === 'development') {
        return true;
      }

      // Блокировка localhost и внутренних IP в production
      const blockedPatterns = [
        /^localhost$/i,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
        /^169\.254\./,
        /^0\.0\.0\.0$/,
        /^::1$/,
        /^fc00:/i, // Unique local IPv6
        /^fe80:/i, // Link-local IPv6
      ];

      for (const pattern of blockedPatterns) {
        if (pattern.test(hostname)) {
          console.warn(`[ExternalProxy] Blocked SSRF attempt: ${hostname}`);
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Проверка является ли ошибка retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableCodes = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'EPIPE'];
    return retryableCodes.includes(error.code);
  }

  /**
   * Расчёт задержки для retry с exponential backoff и jitter
   */
  private calculateRetryDelay(attempt: number): number {
    const exponentialDelay = this.retryDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
    return Math.min(exponentialDelay + jitter, 30000); // Max 30s
  }

  /**
   * Маппинг кодов ошибок HTTP
   */
  private mapErrorCode(error: any): number {
    const errorMap: Record<string, number> = {
      'ECONNREFUSED': 502,
      'ETIMEDOUT': 504,
      'ECONNRESET': 502,
      'EAI_AGAIN': 502,
      'ENOTFOUND': 502,
    };
    return errorMap[error.code] || 502;
  }

  /**
   * Получение состояния Circuit Breaker
   */
  private getCircuitState(key: string): CircuitBreakerState {
    const state = this.circuitBreakers.get(key);
    
    if (!state) {
      return {
        failures: 0,
        lastFailureTime: 0,
        state: 'closed',
        successCount: 0,
      };
    }

    return state;
  }

  /**
   * Установка состояния Circuit Breaker
   */
  private setCircuitState(key: string, state: CircuitBreakerState['state'], failures: number): void {
    this.circuitBreakers.set(key, {
      failures,
      lastFailureTime: Date.now(),
      state,
      successCount: 0,
    });
  }

  /**
   * Запись успешного запроса
   */
  private recordSuccess(key: string): void {
    const state = this.getCircuitState(key);
    
    if (state.state === 'half-open') {
      state.successCount++;
      
      // После нескольких успехов закрываем Circuit Breaker
      if (state.successCount >= 3) {
        this.setCircuitState(key, 'closed', 0);
      }
    } else if (state.state === 'closed') {
      // Сброс счётчика неудач при успехе
      state.failures = Math.max(0, state.failures - 1);
    }
  }

  /**
   * Запись неудачного запроса
   */
  private recordFailure(key: string): void {
    const state = this.getCircuitState(key);
    state.failures++;
    state.lastFailureTime = Date.now();

    // Открытие Circuit Breaker при превышении порога
    if (state.failures >= this.circuitBreakerThreshold && state.state !== 'open') {
      this.setCircuitState(key, 'open', state.failures);
      console.warn(`[ExternalProxy] Circuit Breaker opened for ${key} after ${state.failures} failures`);
    }
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
   * Генерация ключа для Circuit Breaker
   */
  private getCircuitKey(url: string): string {
    return createHash('sha256').update(url).digest('hex');
  }

  /**
   * Генерация ключа для rate limiting
   */
  private getRateLimitKey(req: Request): string {
    const ip = this.getClientIP(req);
    return createHash('sha256').update(`${ip}:${req.url}`).digest('hex');
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

  /**
   * Генерация Request ID
   */
  private generateRequestId(): string {
    return createHash('sha256').update(`${Date.now()}:${Math.random()}`).digest('hex').slice(0, 32);
  }

  /**
   * Sleep утилита
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
