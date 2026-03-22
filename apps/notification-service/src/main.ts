import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(__dirname, '../../../.env') });

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NOTIFICATION_PROTO_PATH } from '@aluf/proto';
import { GRPC_PACKAGES } from '@aluf/shared';
import { AppModule } from './app.module';

async function bootstrap() {
  const grpcPort = process.env.NOTIFICATION_SERVICE_GRPC_PORT || '50056';

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: GRPC_PACKAGES.NOTIFICATION,
      protoPath: NOTIFICATION_PROTO_PATH,
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

  const httpPort = process.env.NOTIFICATION_SERVICE_HTTP_PORT || 3016;
  await app.listen(httpPort);

  console.log(`Notification service gRPC listening on port ${grpcPort}`);
  console.log(`Notification service HTTP health check on port ${httpPort}`);
}

bootstrap();
