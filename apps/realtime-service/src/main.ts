import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(__dirname, '../../../.env') });

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = process.env.WS_GATEWAY_PORT || 3001;

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

  app.useWebSocketAdapter(new WsAdapter(app));

  await app.listen(port);
  console.log(`Realtime service listening on port ${port}`);
}

bootstrap();
