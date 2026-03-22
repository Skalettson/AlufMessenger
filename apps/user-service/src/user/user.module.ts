import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { DatabaseProvider } from '../providers/database.provider';
import { RedisProvider } from '../providers/redis.provider';

@Module({
  controllers: [UserController],
  providers: [DatabaseProvider, RedisProvider, UserService],
  exports: [UserService],
})
export class UserModule {}
