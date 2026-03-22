import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  AUTH_PROTO_PATH,
  USER_PROTO_PATH,
  CHAT_PROTO_PATH,
  MESSAGE_PROTO_PATH,
  MEDIA_PROTO_PATH,
  NOTIFICATION_PROTO_PATH,
  CALL_PROTO_PATH,
  SEARCH_PROTO_PATH,
  STORY_PROTO_PATH,
  BOT_PROTO_PATH,
  STICKER_PROTO_PATH,
  CUSTOM_EMOJI_PROTO_PATH,
  MUSIC_PROTO_PATH,
  GRPC_PACKAGES,
} from '@aluf/proto';

const GRPC_LOADER = {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

const GRPC_OPTIONS = {
  maxRetriesPerRequest: 10,
  retryDelay: 500,
};

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
          loader: GRPC_LOADER,
          ...GRPC_OPTIONS,
        },
      },
      {
        name: 'USER_SERVICE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: GRPC_PACKAGES.USER,
          protoPath: USER_PROTO_PATH,
          url: process.env.USER_SERVICE_GRPC_URL || 'localhost:50052',
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
        name: 'MEDIA_SERVICE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: GRPC_PACKAGES.MEDIA,
          protoPath: MEDIA_PROTO_PATH,
          url: process.env.MEDIA_SERVICE_GRPC_URL || 'localhost:50055',
          loader: GRPC_LOADER,
        },
      },
      {
        name: 'NOTIFICATION_SERVICE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: GRPC_PACKAGES.NOTIFICATION,
          protoPath: NOTIFICATION_PROTO_PATH,
          url: process.env.NOTIFICATION_SERVICE_GRPC_URL || 'localhost:50056',
          loader: GRPC_LOADER,
        },
      },
      {
        name: 'CALL_SERVICE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: GRPC_PACKAGES.CALL,
          protoPath: CALL_PROTO_PATH,
          url: process.env.CALL_SERVICE_GRPC_URL || 'localhost:50057',
          loader: GRPC_LOADER,
        },
      },
      {
        name: 'SEARCH_SERVICE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: GRPC_PACKAGES.SEARCH,
          protoPath: SEARCH_PROTO_PATH,
          url: process.env.SEARCH_SERVICE_GRPC_URL || 'localhost:50058',
          loader: GRPC_LOADER,
        },
      },
      {
        name: 'STORY_SERVICE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: GRPC_PACKAGES.STORY,
          protoPath: STORY_PROTO_PATH,
          url: process.env.STORY_SERVICE_GRPC_URL || 'localhost:50059',
          loader: GRPC_LOADER,
        },
      },
      {
        name: 'BOT_SERVICE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: GRPC_PACKAGES.BOT,
          protoPath: BOT_PROTO_PATH,
          url: process.env.BOT_SERVICE_GRPC_URL || 'localhost:50051',
          loader: GRPC_LOADER,
          ...GRPC_OPTIONS,
        },
      },
      {
        name: 'STICKER_SERVICE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: GRPC_PACKAGES.STICKER,
          protoPath: STICKER_PROTO_PATH,
          url: process.env.STICKER_SERVICE_GRPC_URL || 'localhost:50051',
          loader: GRPC_LOADER,
          ...GRPC_OPTIONS,
        },
      },
      {
        name: 'CUSTOM_EMOJI_SERVICE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: GRPC_PACKAGES.CUSTOM_EMOJI,
          protoPath: CUSTOM_EMOJI_PROTO_PATH,
          url: process.env.CUSTOM_EMOJI_SERVICE_GRPC_URL || 'localhost:50051',
          loader: GRPC_LOADER,
          ...GRPC_OPTIONS,
        },
      },
      {
        name: 'MUSIC_SERVICE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: GRPC_PACKAGES.MUSIC,
          protoPath: MUSIC_PROTO_PATH,
          url: process.env.MUSIC_SERVICE_GRPC_URL || 'localhost:50063',
          loader: GRPC_LOADER,
          ...GRPC_OPTIONS,
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class GrpcClientsModule {}
