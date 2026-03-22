import { Module } from '@nestjs/common';
import { SearchModule } from './search/search.module';
import { NatsProvider } from './providers/nats.provider';
import { HealthController } from './health.controller';

@Module({
  imports: [SearchModule],
  controllers: [HealthController],
  providers: [NatsProvider],
  exports: [NatsProvider],
})
export class AppModule {}
