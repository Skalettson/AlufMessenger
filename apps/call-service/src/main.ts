import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(__dirname, '../../../.env') });

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { CALL_PROTO_PATH } from '@aluf/proto';
import { GRPC_PACKAGES } from '@aluf/shared';
import { AppModule } from './app.module';

async function bootstrap() {
  const grpcPort = process.env.CALL_SERVICE_GRPC_PORT || '50057';

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: GRPC_PACKAGES.CALL,
      protoPath: CALL_PROTO_PATH,
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

  const httpPort = process.env.CALL_SERVICE_HTTP_PORT || 3017;
  await app.listen(httpPort);

  console.log(`Call service gRPC listening on port ${grpcPort}`);
  console.log(`Call service HTTP health check on port ${httpPort}`);
}

bootstrap();
