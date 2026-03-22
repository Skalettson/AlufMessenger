import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NatsListener } from './nats-listener';
import { FcmProvider } from './push/fcm.provider';
import { ApnsProvider } from './push/apns.provider';
import { WebPushProvider } from './push/web-push.provider';
import { EmailProvider } from './email.provider';
import { DatabaseProvider } from '../providers/database.provider';
import { NatsProvider } from '../providers/nats.provider';

@Module({
  controllers: [NotificationController],
  providers: [
    DatabaseProvider,
    NatsProvider,
    FcmProvider,
    ApnsProvider,
    WebPushProvider,
    EmailProvider,
    NotificationService,
    NatsListener,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
