import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AUTH_PROTO_PATH } from '@aluf/proto';
import { GRPC_PACKAGES } from '@aluf/shared';
import { RedisProvider } from '../providers/redis.provider';
import { NatsProvider } from '../providers/nats.provider';
import { WsGatewayHandler } from './ws.gateway';
import { ConnectionManager } from './connection-manager';
import { NatsSubscriber } from './nats-subscriber';
import { PresenceService } from './presence.service';

const GRPC_LOADER_OPTIONS = {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
} as const;

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: GRPC_PACKAGES.AUTH,
          protoPath: AUTH_PROTO_PATH,
          url: process.env.AUTH_SERVICE_GRPC_URL || 'localhost:50051',
          loader: GRPC_LOADER_OPTIONS,
        },
      },
    ]),
  ],
  providers: [
    RedisProvider,
    NatsProvider,
    WsGatewayHandler,
    ConnectionManager,
    NatsSubscriber,
    PresenceService,
  ],
  exports: [ConnectionManager, PresenceService],
})
export class WsGatewayModule {}
