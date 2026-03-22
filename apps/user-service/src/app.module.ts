import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { KeysModule } from './keys/keys.module';
import { MusicModule } from './music/music.module';
import { DatabaseProvider } from './providers/database.provider';
import { RedisProvider } from './providers/redis.provider';
import { HealthController } from './health.controller';

@Module({
  imports: [UserModule, KeysModule, MusicModule],
  controllers: [HealthController],
  providers: [DatabaseProvider, RedisProvider],
  exports: [DatabaseProvider, RedisProvider],
})
export class AppModule {}
