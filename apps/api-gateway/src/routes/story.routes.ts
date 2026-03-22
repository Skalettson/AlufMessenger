import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  Inject,
  OnModuleInit,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { CurrentUser } from '../decorators/public.decorator';
import type { RequestUser } from '../decorators/public.decorator';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { CreateStoryDto, ReactToStoryDto, ReplyToStoryDto } from '../dto/story.dto';
import { JwtVerifierService } from '../auth/jwt-verifier.service';

const PRIVACY_TO_PROTO: Record<string, number> = {
  everyone: 1,
  contacts: 2,
  selected: 3,
  except: 4,
};

/** gRPC loader keepCase: false — сервис получает camelCase (userId, mediaId). */
interface StoryServiceGrpc {
  CreateStory(req: Record<string, unknown>): Observable<unknown>;
  GetStories(req: { user_id?: string; userId?: string }): Observable<unknown>;
  GetUserStories(req: { target_user_id?: string; targetUserId?: string; viewer_id?: string; viewerId?: string }): Observable<unknown>;
  ViewStory(req: { story_id?: string; storyId?: string; viewer_id?: string; viewerId?: string }): Observable<unknown>;
  GetStoryViewsList(req: { story_id?: string; storyId?: string; owner_id?: string; ownerId?: string }): Observable<unknown>;
  ReactToStory(req: { story_id?: string; storyId?: string; user_id?: string; userId?: string; emoji?: string }): Observable<unknown>;
  GetStoryOwner(req: { story_id?: string; storyId?: string }): Observable<unknown>;
  DeleteStory(req: { story_id?: string; storyId?: string; user_id?: string; userId?: string }): Observable<unknown>;
}

interface ChatServiceGrpcMini {
  CreateChat(req: Record<string, unknown>): Observable<unknown>;
}

interface MessageServiceGrpcMini {
  SendMessage(req: Record<string, unknown>): Observable<unknown>;
}

@Controller('v1/stories')
export class StoryRoutesController implements OnModuleInit {
  private storyService!: StoryServiceGrpc;
  private chatService!: ChatServiceGrpcMini;
  private messageService!: MessageServiceGrpcMini;

  constructor(
    @Inject('STORY_SERVICE_PACKAGE') private readonly storyClient: ClientGrpc,
    @Inject('CHAT_SERVICE_PACKAGE') private readonly chatClient: ClientGrpc,
    @Inject('MESSAGE_SERVICE_PACKAGE') private readonly messageClient: ClientGrpc,
    private readonly jwtVerifier: JwtVerifierService,
  ) {}

  onModuleInit() {
    this.storyService = this.storyClient.getService<StoryServiceGrpc>('StoryService');
    this.chatService = this.chatClient.getService<ChatServiceGrpcMini>('ChatService');
    this.messageService = this.messageClient.getService<MessageServiceGrpcMini>('MessageService');
  }

  /** Лента как в Telegram: группы контактов с историями, has_unseen, latest_story_at. */
  @Get()
  async getStories(@CurrentUser() user: RequestUser, @Req() req: Request) {
    let userId = (user?.userId ?? '').trim();
    if (!userId) {
      const token = this.extractToken(req);
      if (token) {
        const payload = this.jwtVerifier.verify(token);
        if (payload?.userId) userId = payload.userId.trim();
      }
    }
    if (!userId) {
      throw new UnauthorizedException('Токен не предоставлен или недействителен. Войдите снова.');
    }
    const res = await firstValueFrom(
      this.storyService.GetStories({ user_id: userId, userId }),
    );
    const raw = res as { story_groups?: unknown[]; storyGroups?: unknown[] };
    const storyGroups = raw.story_groups ?? raw.storyGroups ?? [];
    return { story_groups: storyGroups };
  }

  private extractToken(req: Request): string | null {
    const auth = (req.headers.authorization ?? req.headers['authorization']) as string | undefined;
    if (auth && typeof auth === 'string') {
      const m = auth.trim().match(/^Bearer\s+([^\s,]+)/i);
      if (m) return m[1].trim();
    }
    const x = (req.headers['x-access-token'] ?? req.headers['X-Access-Token']) as string | undefined;
    if (x && typeof x === 'string') return x.trim().replace(/^Bearer\s+/i, '').trim();
    return null;
  }

  @Post()
  async createStory(@CurrentUser() user: RequestUser, @Req() req: Request) {
    let userId = (user?.userId ?? '').trim();
    if (!userId) {
      const token = this.extractToken(req);
      if (token) {
        const payload = this.jwtVerifier.verify(token);
        if (payload?.userId) userId = payload.userId.trim();
      }
    }
    if (!userId) {
      throw new UnauthorizedException('Токен не предоставлен или недействителен. Войдите снова.');
    }

    const parsed = CreateStoryDto.safeParse(req.body ?? {});
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const message = firstIssue?.message ?? 'Ошибка валидации';
      const details: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.') || 'mediaId';
        if (!details[path]) details[path] = [];
        details[path].push(issue.message);
      }
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message, details },
      });
    }
    const d = parsed.data;
    const mediaId = d.mediaId ?? '';
    if (!mediaId) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'mediaId обязателен' },
      });
    }
    const body = {
      user_id: userId,
      userId,
      media_id: mediaId,
      mediaId,
      caption: d.caption ?? '',
      privacy: PRIVACY_TO_PROTO[d.privacy] ?? 2,
      allowed_user_ids: d.allowedUserIds ?? [],
      excluded_user_ids: d.excludedUserIds ?? [],
      ttl_hours: d.ttlHours,
    };
    return firstValueFrom(this.storyService.CreateStory(body));
  }

  /** Истории одного пользователя (по клику на круг). */
  @Get('user/:userId')
  async getUserStories(
    @CurrentUser() user: RequestUser,
    @Param('userId') targetUserId: string,
  ) {
    return firstValueFrom(
      this.storyService.GetUserStories({
        target_user_id: targetUserId,
        targetUserId,
        viewer_id: user.userId,
        viewerId: user.userId,
      }),
    );
  }

  @Post(':id/view')
  async viewStory(@CurrentUser() user: RequestUser, @Param('id') storyId: string) {
    return firstValueFrom(
      this.storyService.ViewStory({
        story_id: storyId,
        storyId,
        viewer_id: user.userId,
        viewerId: user.userId,
      }),
    );
  }

  /** Кто смотрел историю (только для автора). */
  @Get(':id/views')
  async getStoryViewsList(
    @CurrentUser() user: RequestUser,
    @Param('id') storyId: string,
  ) {
    return firstValueFrom(
      this.storyService.GetStoryViewsList({
        story_id: storyId,
        storyId,
        owner_id: user.userId,
        ownerId: user.userId,
      }),
    );
  }

  @Post(':id/react')
  async reactToStory(
    @CurrentUser() user: RequestUser,
    @Param('id') storyId: string,
    @Body(new ZodValidationPipe(ReactToStoryDto)) body: ReactToStoryDto,
  ) {
    const emoji = body.emoji.trim();
    const res = await firstValueFrom(
      this.storyService.ReactToStory({
        story_id: storyId,
        storyId,
        user_id: user.userId,
        userId: user.userId,
        emoji,
      }),
    );

    /** Как в Telegram: реакция дублируется сообщением в личный чат с автором истории. */
    try {
      const ownerRes = (await firstValueFrom(
        this.storyService.GetStoryOwner({ story_id: storyId, storyId }),
      )) as {
        owner_user_id?: string;
        ownerUserId?: string;
        media_id?: string;
        mediaId?: string;
        caption?: string;
        owner_display_name?: string;
        ownerDisplayName?: string;
      };
      const ownerUserId = (ownerRes.owner_user_id ?? ownerRes.ownerUserId ?? '').trim();
      const previewMediaId = (ownerRes.media_id ?? ownerRes.mediaId ?? '').trim();
      const storyCaption = (ownerRes.caption ?? '').trim().slice(0, 1024);
      const storyOwnerName = (ownerRes.owner_display_name ?? ownerRes.ownerDisplayName ?? '').trim().slice(0, 128);
      if (ownerUserId && ownerUserId !== user.userId) {
        const chatRaw = (await firstValueFrom(
          this.chatService.CreateChat({
            type: 1,
            name: '',
            description: '',
            avatarUrl: '',
            creatorId: user.userId,
            memberIds: [ownerUserId],
          }),
        )) as Record<string, unknown>;
        const chatId = String(chatRaw.id ?? chatRaw.chat_id ?? '').trim();
        if (chatId) {
          await firstValueFrom(
            this.messageService.SendMessage({
              chatId,
              senderId: user.userId,
              contentType: 1,
              textContent: emoji,
              mediaId: '',
              replyToId: '',
              metadata: {
                reply_to_story_id: storyId,
                story_reaction_emoji: emoji,
                ...(previewMediaId ? { story_preview_media_id: previewMediaId } : {}),
                ...(storyCaption ? { story_preview_caption: storyCaption } : {}),
                ...(storyOwnerName ? { story_owner_name: storyOwnerName } : {}),
              },
              selfDestructSeconds: 0,
            }),
          );
        }
      }
    } catch {
      /* реакция в story-service уже сохранена; чат — best-effort */
    }

    return res;
  }

  /** Ответ текстом в личный чат с автором истории (как в Telegram). */
  @Post(':id/reply')
  async replyToStory(
    @CurrentUser() user: RequestUser,
    @Param('id') storyId: string,
    @Body(new ZodValidationPipe(ReplyToStoryDto)) body: ReplyToStoryDto,
  ) {
    const ownerRes = (await firstValueFrom(
      this.storyService.GetStoryOwner({ story_id: storyId, storyId }),
    )) as {
      owner_user_id?: string;
      ownerUserId?: string;
      media_id?: string;
      mediaId?: string;
      caption?: string;
      owner_display_name?: string;
      ownerDisplayName?: string;
    };
    const ownerUserId = (ownerRes.owner_user_id ?? ownerRes.ownerUserId ?? '').trim();
    if (!ownerUserId) {
      throw new BadRequestException({ error: { code: 'NOT_FOUND', message: 'История не найдена' } });
    }
    if (ownerUserId === user.userId) {
      throw new BadRequestException({ error: { code: 'INVALID', message: 'Нельзя ответить на свою историю' } });
    }

    const chatRaw = (await firstValueFrom(
      this.chatService.CreateChat({
        type: 1,
        name: '',
        description: '',
        avatarUrl: '',
        creatorId: user.userId,
        memberIds: [ownerUserId],
      }),
    )) as Record<string, unknown>;

    const chatId = String(chatRaw.id ?? chatRaw.chat_id ?? '').trim();
    if (!chatId) {
      throw new BadRequestException({ error: { code: 'CHAT_ERROR', message: 'Не удалось создать чат' } });
    }

    const previewMediaId = (ownerRes.media_id ?? ownerRes.mediaId ?? '').trim();
    const storyCaption = (ownerRes.caption ?? '').trim().slice(0, 1024);
    const storyOwnerName = (ownerRes.owner_display_name ?? ownerRes.ownerDisplayName ?? '').trim().slice(0, 128);
    const metadata: Record<string, unknown> = {
      reply_to_story_id: storyId,
      ...(previewMediaId ? { story_preview_media_id: previewMediaId } : {}),
      ...(storyCaption ? { story_preview_caption: storyCaption } : {}),
      ...(storyOwnerName ? { story_owner_name: storyOwnerName } : {}),
    };
    const msg = await firstValueFrom(
      this.messageService.SendMessage({
        chatId,
        senderId: user.userId,
        contentType: 1,
        textContent: body.text.trim(),
        mediaId: '',
        replyToId: '',
        metadata,
        selfDestructSeconds: 0,
      }),
    );

    return { chatId, message: msg };
  }

  @Delete(':id')
  async deleteStory(@CurrentUser() user: RequestUser, @Param('id') storyId: string) {
    return firstValueFrom(
      this.storyService.DeleteStory({
        story_id: storyId,
        storyId,
        user_id: user.userId,
        userId: user.userId,
      }),
    );
  }
}
