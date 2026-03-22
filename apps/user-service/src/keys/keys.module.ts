import { Module } from '@nestjs/common';
import { KeysController } from './keys.controller';
import { KeysService } from './keys.service';
import { DatabaseProvider } from '../providers/database.provider';

@Module({
  controllers: [KeysController],
  providers: [DatabaseProvider, KeysService],
  exports: [KeysService],
})
export class KeysModule {}
