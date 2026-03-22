import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from './jwt.service';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { TwoFactorService } from './two-factor.service';
import { DatabaseProvider } from '../providers/database.provider';
import { RedisProvider } from '../providers/redis.provider';
import { NatsProvider } from '../providers/nats.provider';

@Module({
  controllers: [AuthController],
  providers: [
    DatabaseProvider,
    RedisProvider,
    NatsProvider,
    AuthService,
    JwtService,
    OtpService,
    SessionService,
    TwoFactorService,
  ],
  exports: [AuthService, JwtService, SessionService],
})
export class AuthModule {}
