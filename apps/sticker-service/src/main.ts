import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(__dirname, '../../../.env') });

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { STICKER_PROTO_PATH } from '@aluf/proto';
import { GRPC_PACKAGES } from '@aluf/shared';
import { AppModule } from './app.module';

async function bootstrap() {
  const grpcPort = process.env.STICKER_SERVICE_GRPC_PORT || '50061';

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: GRPC_PACKAGES.STICKER,
      protoPath: STICKER_PROTO_PATH,
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

  const httpPort = process.env.STICKER_SERVICE_HTTP_PORT || 3021;
  await app.listen(httpPort);

  console.log(`Sticker service gRPC listening on port ${grpcPort}`);
  console.log(`Sticker service HTTP health check on port ${httpPort}`);
}

bootstrap();
