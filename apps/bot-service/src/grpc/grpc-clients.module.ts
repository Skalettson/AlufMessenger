import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  CHAT_PROTO_PATH,
  MESSAGE_PROTO_PATH,
  GRPC_PACKAGES,
} from '@aluf/proto';

const GRPC_LOADER = {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'MESSAGE_SERVICE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: GRPC_PACKAGES.MESSAGE,
          protoPath: MESSAGE_PROTO_PATH,
          url: process.env.MESSAGE_SERVICE_GRPC_URL || 'localhost:50054',
          loader: GRPC_LOADER,
        },
      },
      {
        name: 'CHAT_SERVICE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: GRPC_PACKAGES.CHAT,
          protoPath: CHAT_PROTO_PATH,
          url: process.env.CHAT_SERVICE_GRPC_URL || 'localhost:50053',
          loader: GRPC_LOADER,
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class GrpcClientsModule {}
