import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(__dirname, '../../../.env') });

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { USER_PROTO_PATH, MUSIC_PROTO_PATH } from '@aluf/proto';
import { GRPC_PACKAGES } from '@aluf/shared';
import { AppModule } from './app.module';

async function bootstrap() {
  const grpcPort = process.env.USER_SERVICE_GRPC_PORT || '50052';
  const musicGrpcPort = process.env.MUSIC_SERVICE_GRPC_PORT || '50063';

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

  const grpcLoader = {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  };

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: GRPC_PACKAGES.USER,
      protoPath: USER_PROTO_PATH,
      url: `0.0.0.0:${grpcPort}`,
      loader: grpcLoader,
    },
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: GRPC_PACKAGES.MUSIC,
      protoPath: MUSIC_PROTO_PATH,
      url: `0.0.0.0:${musicGrpcPort}`,
      loader: grpcLoader,
    },
  });

  await app.startAllMicroservices();

  const httpPort = process.env.USER_SERVICE_HTTP_PORT || 3012;
  await app.listen(httpPort);

  console.log(`User service gRPC (User) listening on port ${grpcPort}`);
  console.log(`User service gRPC (MusicLibrary) listening on port ${musicGrpcPort}`);
  console.log(`User service HTTP health check on port ${httpPort}`);
}

bootstrap();
