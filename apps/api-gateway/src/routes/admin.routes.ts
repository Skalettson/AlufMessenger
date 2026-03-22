import {
  Controller,
  Get,
  Delete,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Inject,
  OnModuleInit,
  UseGuards,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { CurrentUser } from '../decorators/public.decorator';
import type { RequestUser } from '../decorators/public.decorator';
import { AdminGuard } from '../guards/admin.guard';

interface UserServiceGrpc {
  GetUser(req: { userId: string }): Observable<unknown>;
  ListUsers?(req: { limit: number; offset: number; search?: string }): Observable<{ users: unknown[]; totalCount: number }>;
  GetAdminStats?(): Observable<{ totalUsers: number; newUsers24h: number }>;
  AdminUpdateUser?(req: { userId: string; isVerified?: boolean; isOfficial?: boolean; isPremium?: boolean; isBot?: boolean }): Observable<unknown>;
}

interface ChatServiceGrpc {
  GetChat(req: { chatId: string; userId: string }): Observable<unknown>;
  ListChats?(req: { limit: number; offset: number; type?: number }): Observable<{ chats: unknown[]; totalCount: number }>;
  DeleteChatAdmin?(req: { chatId: string }): Observable<unknown>;
}

interface AuthServiceGrpc {
  GetSessions(req: { userId: string }): Observable<{ sessions: unknown[] }>;
  TerminateSessionAdmin(req: { sessionId: string }): Observable<unknown>;
}

interface MessageServiceGrpc {
  ClearChatMessagesAdmin(req: { chatId: string }): Observable<unknown>;
}

@Controller('v1/admin')
@UseGuards(AdminGuard)
export class AdminRoutesController implements OnModuleInit {
  private userService!: UserServiceGrpc;
  private chatService!: ChatServiceGrpc;
  private authService!: AuthServiceGrpc;
  private messageService!: MessageServiceGrpc;

  constructor(
    @Inject('USER_SERVICE_PACKAGE') private readonly userClient: ClientGrpc,
    @Inject('CHAT_SERVICE_PACKAGE') private readonly chatClient: ClientGrpc,
    @Inject('AUTH_SERVICE_PACKAGE') private readonly authClient: ClientGrpc,
    @Inject('MESSAGE_SERVICE_PACKAGE') private readonly messageClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.userService = this.userClient.getService<UserServiceGrpc>('UserService');
    this.chatService = this.chatClient.getService<ChatServiceGrpc>('ChatService');
    this.authService = this.authClient.getService<AuthServiceGrpc>('AuthService');
    this.messageService = this.messageClient.getService<MessageServiceGrpc>('MessageService');
  }

  @Get('system/health')
  async getSystemHealth(@CurrentUser() _user: RequestUser) {
    const timeoutMs = 5000;
    const services: { name: string; url: string }[] = [
      { name: 'auth-service', url: process.env.AUTH_SERVICE_HTTP_URL || 'http://localhost:3010' },
      { name: 'user-service', url: process.env.USER_SERVICE_HTTP_URL || 'http://localhost:3012' },
      { name: 'chat-service', url: process.env.CHAT_SERVICE_HTTP_URL || 'http://localhost:3013' },
      { name: 'message-service', url: process.env.MESSAGE_SERVICE_HTTP_URL || 'http://localhost:3014' },
      { name: 'media-service', url: process.env.MEDIA_SERVICE_HTTP_URL || 'http://localhost:3015' },
      { name: 'notification-service', url: process.env.NOTIFICATION_SERVICE_HTTP_URL || 'http://localhost:3016' },
      { name: 'call-service', url: process.env.CALL_SERVICE_HTTP_URL || 'http://localhost:3017' },
      { name: 'search-service', url: process.env.SEARCH_SERVICE_HTTP_URL || 'http://localhost:3018' },
      { name: 'story-service', url: process.env.STORY_SERVICE_HTTP_URL || 'http://localhost:3019' },
      { name: 'realtime-service', url: process.env.REALTIME_SERVICE_HTTP_URL || 'http://localhost:3001' },
      { name: 'bot-service', url: process.env.BOT_SERVICE_HTTP_URL || 'http://localhost:3002' },
      { name: 'sticker-service', url: process.env.STICKER_SERVICE_HTTP_URL || 'http://localhost:3021' },
      { name: 'custom-emoji-service', url: process.env.CUSTOM_EMOJI_SERVICE_HTTP_URL || 'http://localhost:3022' },
    ];
    const results = await Promise.all(
      services.map(async (s) => {
        const base = s.url.replace(/\/$/, '');
        const url = base + (base.endsWith('/health') ? '' : '/health');
        const start = Date.now();
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), timeoutMs);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeout);
          const body = await res.json().catch(() => ({}));
          const latencyMs = Date.now() - start;
          return {
            name: s.name,
            status: res.ok ? 'ok' : 'error',
            statusCode: res.status,
            latencyMs,
            timestamp: (body as { timestamp?: string }).timestamp ?? new Date().toISOString(),
          };
        } catch (err) {
          return {
            name: s.name,
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
            latencyMs: Date.now() - start,
            timestamp: new Date().toISOString(),
          };
        }
      }),
    );
    return { services: results };
  }

  @Get('system/info')
  getSystemInfo(@CurrentUser() _user: RequestUser) {
    return {
      nodeEnv: process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  @Get('stats')
  async getStats(@CurrentUser() _user: RequestUser) {
    const [userStats, chatsRes] = await Promise.all([
      this.userService.GetAdminStats ? firstValueFrom(this.userService.GetAdminStats()) : { totalUsers: 0, newUsers24h: 0 },
      this.chatService.ListChats ? firstValueFrom(this.chatService.ListChats({ limit: 1, offset: 0 })) : { totalCount: 0 },
    ]).catch(() => [{ totalUsers: 0, newUsers24h: 0 }, { totalCount: 0 }]);
    const totalUsers = (userStats as { totalUsers?: number; newUsers24h?: number }).totalUsers ?? 0;
    const newUsers24h = (userStats as { newUsers24h?: number }).newUsers24h ?? 0;
    const totalChats = (chatsRes as { totalCount?: number }).totalCount ?? 0;
    return { totalUsers, newUsers24h, totalChats };
  }

  @Get('users')
  async listUsers(
    @CurrentUser() _user: RequestUser,
    @Query('limit') limitParam?: string,
    @Query('offset') offsetParam?: string,
    @Query('search') search?: string,
  ) {
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 20)) : 20;
    const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10) || 0) : 0;
    if (this.userService.ListUsers) {
      return firstValueFrom(
        this.userService.ListUsers({ limit, offset, search: search || undefined }),
      );
    }
    return { users: [], totalCount: 0 };
  }

  @Get('users/:id')
  getUserById(@CurrentUser() _user: RequestUser, @Param('id') id: string) {
    return firstValueFrom(this.userService.GetUser({ userId: id }));
  }

  @Patch('users/:id')
  async updateUser(
    @CurrentUser() _user: RequestUser,
    @Param('id') id: string,
    @Body() body: { isVerified?: boolean; isOfficial?: boolean; isPremium?: boolean; isBot?: boolean },
  ) {
    if (!this.userService.AdminUpdateUser) {
      return { error: 'AdminUpdateUser not available' };
    }
    return firstValueFrom(
      this.userService.AdminUpdateUser({ userId: id, ...body }),
    );
  }

  @Get('users/:id/sessions')
  getUserSessions(@CurrentUser() _user: RequestUser, @Param('id') id: string) {
    return firstValueFrom(this.authService.GetSessions({ userId: id }));
  }

  @Post('sessions/:sessionId/terminate')
  terminateSession(@CurrentUser() _user: RequestUser, @Param('sessionId') sessionId: string) {
    return firstValueFrom(this.authService.TerminateSessionAdmin({ sessionId }));
  }

  @Get('chats')
  async listChats(
    @CurrentUser() _user: RequestUser,
    @Query('limit') limitParam?: string,
    @Query('offset') offsetParam?: string,
    @Query('type') typeParam?: string,
  ) {
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 20)) : 20;
    const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10) || 0) : 0;
    const type = typeParam !== undefined && typeParam !== '' ? parseInt(typeParam, 10) : undefined;
    if (this.chatService.ListChats) {
      return firstValueFrom(
        this.chatService.ListChats({ limit, offset, type }),
      );
    }
    return { chats: [], totalCount: 0 };
  }

  @Get('chats/:id')
  getChatById(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return firstValueFrom(
      this.chatService.GetChat({ chatId: id, userId: user.userId }),
    );
  }

  @Delete('chats/:id')
  deleteChat(@CurrentUser() _user: RequestUser, @Param('id') id: string) {
    if (this.chatService.DeleteChatAdmin) {
      return firstValueFrom(this.chatService.DeleteChatAdmin({ chatId: id }));
    }
    return { ok: false };
  }

  @Post('chats/:id/clear-messages')
  clearChatMessages(@CurrentUser() _user: RequestUser, @Param('id') id: string) {
    return firstValueFrom(this.messageService.ClearChatMessagesAdmin({ chatId: id }));
  }
}
