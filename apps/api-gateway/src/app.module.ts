import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { GrpcClientsModule } from './grpc/grpc-clients.module';
import { JwtVerifierService } from './auth/jwt-verifier.service';
import { AuthGuard } from './guards/auth.guard';
import { SecurityMiddleware } from './middleware/security.middleware';
import { MediaProxyMiddleware } from './middleware/proxy.middleware';
import { AuthRoutesController } from './routes/auth.routes';
import { UserRoutesController } from './routes/user.routes';
import { ChatRoutesController } from './routes/chat.routes';
import { MessageRoutesController } from './routes/message.routes';
import { MediaRoutesController, MediaStreamController, ProxyImageController } from './routes/media.routes';
import { SearchRoutesController } from './routes/search.routes';
import { CallRoutesController } from './routes/call.routes';
import { StoryRoutesController } from './routes/story.routes';
import { E2eeRoutesController } from './routes/e2ee.routes';
import { BotRoutesController } from './routes/bot.routes';
import { StickerRoutesController } from './routes/sticker.routes';
import { CustomEmojiRoutesController } from './routes/custom-emoji.routes';
import { NotificationRoutesController } from './routes/notification.routes';
import { AdminRoutesController } from './routes/admin.routes';
import { MusicRoutesController } from './routes/music.routes';
import { AdminGuard } from './guards/admin.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
        limit: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '3000', 10),
      },
    ]),
    GrpcClientsModule,
  ],
  controllers: [
    AuthRoutesController,
    UserRoutesController,
    ChatRoutesController,
    MessageRoutesController,
    MediaRoutesController,
    MediaStreamController,
    ProxyImageController,
    SearchRoutesController,
    CallRoutesController,
    StoryRoutesController,
    E2eeRoutesController,
    BotRoutesController,
    StickerRoutesController,
    CustomEmojiRoutesController,
    NotificationRoutesController,
    AdminRoutesController,
    MusicRoutesController,
  ],
  providers: [
    AdminGuard,
    JwtVerifierService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('*');
    consumer.apply(MediaProxyMiddleware).forRoutes('/api/proxy-image');
  }
}
