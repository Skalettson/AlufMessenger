import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(__dirname, '../../../.env') });

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { MESSAGE_PROTO_PATH } from '@aluf/proto';
import { GRPC_PACKAGES } from '@aluf/shared';
import { AppModule } from './app.module';

async function bootstrap() {
  const grpcPort = process.env.MESSAGE_SERVICE_GRPC_PORT || '50054';

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: GRPC_PACKAGES.MESSAGE,
      protoPath: MESSAGE_PROTO_PATH,
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

  const httpPort = process.env.MESSAGE_SERVICE_HTTP_PORT || 3014;
  await app.listen(httpPort);

  console.log(`Message service gRPC listening on port ${grpcPort}`);
  console.log(`Message service HTTP health check on port ${httpPort}`);
}

bootstrap();
