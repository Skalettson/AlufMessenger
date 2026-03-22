import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { DatabaseProvider } from '../providers/database.provider';
import { RedisProvider } from '../providers/redis.provider';
import { NatsProvider } from '../providers/nats.provider';
import { GroupChannelRepository } from './group-channel/group-channel.repository';
import { GroupChannelService } from './group-channel/group-channel.service';
import { MemberManagementRepository } from './group-channel/member-management.repository';
import { MemberManagementService } from './group-channel/member-management.service';
import { GroupChannelAdminService } from './group-channel/group-channel-admin.service';

@Module({
  controllers: [ChatController],
  providers: [
    DatabaseProvider,
    RedisProvider,
    NatsProvider,
    ChatService,
    GroupChannelRepository,
    GroupChannelService,
    MemberManagementRepository,
    MemberManagementService,
    GroupChannelAdminService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
