import { NestFactory } from '@nestjs/core';
import { WebSocketAdapter } from './websocket/websocket.adapter.js';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get('MA_PLATFORM_PORT', 3030);
  const corsOrigin = configService.get('MA_CORS_ORIGIN', '*');

  // CORS
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Aluf-App-Id'],
  });

  // WebSocket адаптер
  app.useWebSocketAdapter(new WebSocketAdapter(app));

  // Global prefix
  app.setGlobalPrefix('api/ma');

  await app.listen(port);
  
  logger.log(`🚀 Aluf MA Platform запущен на порту ${port}`);
  logger.log(`📡 WebSocket: ws://localhost:${port}/ws`);
  logger.log(`🌐 API: http://localhost:${port}/api/ma`);
}

bootstrap().catch((error) => {
  console.error('Failed to start MA Platform:', error);
  process.exit(1);
});
