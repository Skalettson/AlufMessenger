import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(__dirname, '../../../.env') });

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { BOT_PROTO_PATH } from '@aluf/proto';
import { GRPC_PACKAGES } from '@aluf/shared';
import { AppModule } from './app.module';

async function bootstrap() {
  const grpcPort = process.env.BOT_SERVICE_GRPC_PORT || '50060';
  const httpPort = process.env.BOT_SERVICE_PORT || 3002;

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: GRPC_PACKAGES.BOT,
      protoPath: BOT_PROTO_PATH,
      url: `0.0.0.0:${grpcPort}`,
      loader: {
        keepCase: false,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(httpPort);

  console.log(`Bot service gRPC listening on port ${grpcPort}`);
  console.log(`Bot service HTTP listening on port ${httpPort}`);
}

bootstrap();
