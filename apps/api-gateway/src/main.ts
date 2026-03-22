import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(__dirname, '../../../.env') });

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './filters/http-exception.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

/** Drizzle bigint / gRPC int64 → JSON (иначе Express падает: Do not know how to serialize a BigInt). */
declare global {
  interface BigInt {
    toJSON(): string;
  }
}
BigInt.prototype.toJSON = function toJSON(this: bigint) {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          connectSrc: [
            "'self'",
            'wss:',
            'ws:',
            'https:',
            // Narrow with CSP_CONNECT_EXTRA (comma-separated origins) in private deployments if needed.
            ...(process.env.CSP_CONNECT_EXTRA?.split(',').map((s) => s.trim()).filter(Boolean) ?? []),
          ],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      originAgentCluster: true,
    }),
  );
  app.use(compression());

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [];

      // Разрешаем запросы без origin (mobile apps, extensions)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Разрешаем wildcard
      if (allowedOrigins.includes('*')) {
        callback(null, true);
        return;
      }
      
      // Проверяем точное совпадение
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      
      // Проверяем поддомены (например, *.example.com из CORS_ORIGINS)
      const wildcardOrigins = allowedOrigins.filter(o => o.startsWith('*.'));
      for (const wildcard of wildcardOrigins) {
        const baseDomain = wildcard.slice(2); // убираем "*."
        if (origin.endsWith(baseDomain)) {
          callback(null, true);
          return;
        }
      }
      
      callback(null, false);
    },
    credentials: process.env.CORS_CREDENTIALS !== 'false',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Access-Token', 'X-Tenant-Id'],
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-Retry-After'],
    maxAge: parseInt(process.env.CORS_MAX_AGE || '86400', 10),
  });

  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Aluf Messenger API')
    .setDescription('REST API для мессенджера Aluf — аутентификация, пользователи, чаты, сообщения, медиа, звонки, истории, поиск')
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT Access Token (RS256)',
    })
    .addTag('Auth', 'Регистрация, вход, OTP, JWT, 2FA')
    .addTag('Users', 'Профили, контакты, блокировки, приватность')
    .addTag('Chats', 'Личные чаты, группы, каналы, ссылки-приглашения')
    .addTag('Messages', 'Отправка, редактирование, удаление, пины, реакции')
    .addTag('Media', 'Загрузка файлов, получение URL, обработка изображений')
    .addTag('Calls', 'VoIP/видео звонки, сигналинг, WebRTC')
    .addTag('Stories', 'Истории (24h TTL), просмотры, реакции')
    .addTag('Search', 'Глобальный поиск пользователей, сообщений, чатов')
    .addTag('Music', 'Моя музыка: треки и плейлисты')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Simple health check endpoint (no auth required)
  app.use('/health', (_req: any, res: any) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const port = parseInt(process.env.API_GATEWAY_PORT || '3000', 10);
  const host = process.env.API_GATEWAY_HOST || '0.0.0.0';

  await app.listen(port, host);
  console.log(`API Gateway listening on ${host}:${port}`);
}

bootstrap();
