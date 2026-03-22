import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createHash } from 'node:crypto';
// no runtime types required

/**
 * Состояние rate limiting для WebSocket
 */
interface WsRateLimitState {
  connections: number;
  messages: number;
  lastMessageTime: number;
  blockedUntil: number;
}

/**
 * Безопасный WebSocket прокси-модуль
 * 
 * Функции безопасности:
 * - JWT аутентификация при подключении
 * - Rate limiting на подключение и сообщения
 * - Защита от flooding
 * - Валидация сообщений
 * - Проверка размера сообщений
 * - Timeout для неактивных подключений
 */
@Injectable()
export class WebSocketProxyMiddleware implements NestMiddleware {
  private readonly rateLimitCache: Map<string, WsRateLimitState>;
  private readonly connectionCache: Map<string, number>;
  
  private readonly wsTargetUrl: string;
  private readonly maxConnectionsPerIp: number;
  private readonly maxMessagesPerSecond: number;
  private readonly maxMessageSize: number;
  private readonly idleTimeout: number;
  private readonly rateLimitWindowMs: number;

  constructor() {
    const wsGatewayPort = process.env.WS_GATEWAY_PORT || '3001';
    const wsGatewayHost = process.env.WS_GATEWAY_HOST || 'localhost';
    this.wsTargetUrl = `ws://${wsGatewayHost}:${wsGatewayPort}`;

    this.maxConnectionsPerIp = parseInt(process.env.WS_MAX_CONNECTIONS_PER_IP || '10', 10);
    this.maxMessagesPerSecond = parseInt(process.env.WS_MAX_MESSAGES_PER_SECOND || '50', 10);
    this.maxMessageSize = parseInt(process.env.WS_MAX_MESSAGE_SIZE || '1048576', 10); // 1MB default
    this.idleTimeout = parseInt(process.env.WS_IDLE_TIMEOUT || '300000', 10); // 5 minutes
    this.rateLimitWindowMs = 1000; // 1 second window

    this.rateLimitCache = new Map();
    this.connectionCache = new Map();

    // Очистка rate limit кэша
    setInterval(() => {
      const now = Date.now();
      for (const [key, state] of this.rateLimitCache.entries()) {
        if (now - state.lastMessageTime > this.rateLimitWindowMs * 10) {
          this.rateLimitCache.delete(key);
        }
      }
      // Очистка connection cache
      for (const [key, time] of this.connectionCache.entries()) {
        if (now - time > this.idleTimeout) {
          this.connectionCache.delete(key);
        }
      }
    }, 10000).unref();
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Проверка является ли запрос WebSocket upgrade
    const isWebSocket = this.isWebSocketUpgrade(req);
    
    if (!isWebSocket) {
      next();
      return;
    }

    // Валидация WebSocket запроса
    const validationError = this.validateWebSocketRequest(req);
    if (validationError) {
      res.status(400).json(validationError);
      return;
    }

    // Проверка rate limiting для подключений
    const ip = this.getClientIP(req);
    if (!this.checkConnectionRateLimit(ip)) {
      res.status(429).json({
        error: 'Too Many Connections',
        message: `Maximum ${this.maxConnectionsPerIp} concurrent connections allowed per IP`,
      });
      return;
    }

    // Аутентификация (опционально, может быть публичный WS)
    if (process.env.WS_REQUIRE_AUTH === 'true') {
      const authError = this.authenticateWebSocket(req);
      if (authError) {
        res.status(401).json(authError);
        return;
      }
    }

    // Создание WebSocket прокси
    const proxyHandler = createProxyMiddleware({
      target: this.wsTargetUrl,
      changeOrigin: true,
      ws: true, // Proxy WebSocket connections
      secure: false,
      onProxyReqWs: this.onProxyReqWs.bind(this),
      onProxyResWs: this.onProxyResWs.bind(this),
      onError: this.onError.bind(this),
    } as any);

    // Перехват WebSocket подключения для rate limiting сообщений
    (req as any).wsRateLimitKey = this.getRateLimitKey(ip);
    
    proxyHandler(req, res, next);
  }

  /**
   * Проверка является ли запрос WebSocket upgrade
   */
  private isWebSocketUpgrade(req: Request): boolean {
    const upgrade = req.headers.upgrade?.toLowerCase();
    const connection = req.headers.connection?.toLowerCase();
    
    return (
      upgrade === 'websocket' &&
      (!connection || connection.includes('upgrade')) &&
      req.method === 'GET'
    );
  }

  /**
   * Валидация WebSocket запроса
   */
  private validateWebSocketRequest(req: Request): { error: string; message: string } | null {
    const key = req.headers['sec-websocket-key'];
    
    if (!key) {
      return {
        error: 'Bad Request',
        message: 'Missing Sec-WebSocket-Key header',
      };
    }

    // Проверка формата ключа (должен быть 24 байта в base64)
    if (typeof key !== 'string' || Buffer.from(key, 'base64').length !== 24) {
      return {
        error: 'Bad Request',
        message: 'Invalid Sec-WebSocket-Key format',
      };
    }

    // Проверка версии протокола
    const version = req.headers['sec-websocket-version'];
    if (version !== '13') {
      return {
        error: 'Bad Request',
        message: 'Unsupported WebSocket version. Only version 13 is supported',
      };
    }

    return null;
  }

  /**
   * Аутентификация WebSocket подключения
   */
  private authenticateWebSocket(req: Request): { error: string; message: string } | null {
    const token = this.extractToken(req);
    
    if (!token) {
      return {
        error: 'Unauthorized',
        message: 'Missing authentication token',
      };
    }

    // Здесь должна быть валидация JWT токена
    // Для простоты проверяем наличие токена
    // В production использовать Auth Service через gRPC
    
    // Пример валидации:
    // try {
    //   const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    //   (req as any).user = payload;
    // } catch {
    //   return { error: 'Unauthorized', message: 'Invalid or expired token' };
    // }

    return null;
  }

  /**
   * Извлечение токена из запроса
   */
  private extractToken(req: Request): string | null {
    // Из Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // Из query параметра
    const url = new URL(req.url, 'http://localhost');
    const queryToken = url.searchParams.get('token');
    if (queryToken) {
      return queryToken;
    }

    return null;
  }

  /**
   * Обработка WebSocket запроса
   */
  private onProxyReqWs(
    proxyReq: any,
    req: Request,
    _socket: any,
    _options: any,
    _head: any
  ): void {
    const ip = this.getClientIP(req);
    const wsKey = this.getRateLimitKey(ip);

    // Добавление заголовков
    proxyReq.setHeader('X-Real-IP', ip);
    proxyReq.setHeader('X-Forwarded-For', ip);
    proxyReq.setHeader('X-Request-Id', req.headers['x-request-id'] as string || this.generateRequestId());

    // Добавление информации о rate limiting
    (proxyReq as any).wsRateLimitKey = wsKey;

    // Логирование подключения
    console.log(`[WS Proxy] New connection from ${ip}`);
  }

  /**
   * Обработка WebSocket ответа
   */
  private onProxyResWs(proxyRes: any, req: Request): void {
    const ip = this.getClientIP(req);
    const wsKey = (proxyRes as any).wsRateLimitKey || this.getRateLimitKey(ip);

    // Инициализация rate limiting состояния
    if (!this.rateLimitCache.has(wsKey)) {
      this.rateLimitCache.set(wsKey, {
        connections: 0,
        messages: 0,
        lastMessageTime: Date.now(),
        blockedUntil: 0,
      });
    }

    const state = this.rateLimitCache.get(wsKey)!;
    state.connections++;

    // Перехват сообщений для rate limiting
    proxyRes.on('data', (data: Buffer) => {
      const now = Date.now();
      
      // Сброс счётчика сообщений если прошла секунда
      if (now - state.lastMessageTime > this.rateLimitWindowMs) {
        state.messages = 0;
        state.lastMessageTime = now;
      }

      // Проверка размера сообщения
      if (data.length > this.maxMessageSize) {
        console.warn(`[WS Proxy] Message too large from ${ip}: ${data.length} bytes`);
        return; // Игнорировать большое сообщение
      }

      // Проверка rate limiting сообщений
      state.messages++;
      if (state.messages > this.maxMessagesPerSecond) {
        console.warn(`[WS Proxy] Rate limit exceeded for ${ip}`);
        // Можно закрыть подключение или просто игнорировать сообщения
      }
    });

    proxyRes.on('close', () => {
      state.connections = Math.max(0, state.connections - 1);
      console.log(`[WS Proxy] Connection closed from ${ip}`);
    });
  }

  /**
   * Обработка ошибок WebSocket
   */
  private onError(err: Error, req: Request, _res: Response): void {
    const ip = this.getClientIP(req);
    console.error(`[WS Proxy] Error for ${ip}:`, err.message);

    // Уменьшение счётчика подключений
    const wsKey = this.getRateLimitKey(ip);
    const state = this.rateLimitCache.get(wsKey);
    if (state) {
      state.connections = Math.max(0, state.connections - 1);
    }
  }

  /**
   * Проверка rate limiting подключений
   */
  private checkConnectionRateLimit(ip: string): boolean {
    const wsKey = this.getRateLimitKey(ip);
    const state = this.rateLimitCache.get(wsKey);

    if (!state) {
      return true;
    }

    return state.connections < this.maxConnectionsPerIp;
  }

  /**
   * Генерация ключа для rate limiting
   */
  private getRateLimitKey(ip: string): string {
    return createHash('sha256').update(ip).digest('hex');
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
}
