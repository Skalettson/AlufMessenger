import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MEDIA_PROTO_PATH } from '@aluf/proto';
import { GRPC_PACKAGES } from '@aluf/shared';
import { DatabaseProvider } from '../providers/database.provider';
import { MusicLibraryService } from './music-library.service';
import { MusicLibraryGrpcController } from './music-library.grpc.controller';

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
        name: 'MEDIA_SERVICE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: GRPC_PACKAGES.MEDIA,
          protoPath: MEDIA_PROTO_PATH,
          url: process.env.MEDIA_SERVICE_GRPC_URL || 'localhost:50055',
          loader: GRPC_LOADER,
        },
      },
    ]),
  ],
  controllers: [MusicLibraryGrpcController],
  providers: [DatabaseProvider, MusicLibraryService],
  exports: [MusicLibraryService],
})
export class MusicModule {}
