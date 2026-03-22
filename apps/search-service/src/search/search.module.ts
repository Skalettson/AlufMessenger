import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { NatsListener } from './nats-listener';
import { NatsProvider } from '../providers/nats.provider';

@Module({
  controllers: [SearchController],
  providers: [NatsProvider, SearchService, NatsListener],
  exports: [SearchService],
})
export class SearchModule {}
