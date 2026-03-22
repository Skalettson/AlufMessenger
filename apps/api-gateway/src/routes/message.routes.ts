import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Inject,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, forkJoin, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CurrentUser } from '../decorators/public.decorator';
import type { RequestUser } from '../decorators/public.decorator';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { SendMessageDto, EditMessageDto, ReactDto, ForwardDto } from '../dto/message.dto';

/** Разворачивает google.protobuf.Struct (metadata) в плоский объект для JSON API. */
function unwrapGrpcStructMetadata(meta: unknown): Record<string, unknown> | null {
  if (meta == null) return null;
  if (typeof meta !== 'object' || Array.isArray(meta)) return null;
  const o = meta as Record<string, unknown>;
  if (o.fields && typeof o.fields === 'object' && !Array.isArray(o.fields)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o.fields as Record<string, unknown>)) {
      const val = v as Record<string, unknown>;
      if (val && typeof val === 'object') {
        if ('numberValue' in val) out[k] = val.numberValue;
        else if ('stringValue' in val) out[k] = val.stringValue;
        else if ('boolValue' in val) out[k] = val.boolValue;
      }
    }
    return out;
  }
  return o;
}

function resolveMediaMetadata(m: Record<string, unknown>): unknown {
  const direct = m.mediaMetadata ?? m.media_metadata;
  if (direct != null && typeof direct === 'object' && !Array.isArray(direct)) return direct;
  const fromMeta = unwrapGrpcStructMetadata(m.metadata);
  return fromMeta && Object.keys(fromMeta).length > 0 ? fromMeta : null;
}

/** Приводит сообщение из gRPC (snake_case или camelCase) к camelCase для фронта; важно для mediaId/contentType после перезагрузки. */
function toCamelCaseMessage(m: Record<string, unknown>): Record<string, unknown> {
  const id = m.id ?? m.message_id;
  const createdAt = m.createdAt ?? m.created_at;
  const mediaIdRaw = m.mediaId ?? m.media_id;
  const mediaId = mediaIdRaw != null && String(mediaIdRaw).trim() !== '' ? String(mediaIdRaw).trim() : '';
  return {
    id: id != null ? String(id) : '',
    chatId: m.chatId ?? m.chat_id ?? '',
    senderId: m.senderId ?? m.sender_id ?? '',
    senderName: m.senderName ?? m.sender_display_name ?? '',
    senderAvatar: m.senderAvatarUrl ?? m.sender_avatar_url ?? null,
    senderIsPremium: m.senderIsPremium ?? m.sender_is_premium ?? false,
    senderPremiumBadgeEmoji:
      m.senderPremiumBadgeEmoji ?? m.sender_premium_badge_emoji ?? '',
    senderIsVerified: m.senderIsVerified ?? m.sender_is_verified ?? false,
    senderIsOfficial: m.senderIsOfficial ?? m.sender_is_official ?? false,
    contentType: m.contentType ?? m.content_type ?? 1,
    textContent: m.textContent ?? m.text_content ?? '',
    mediaId,
    mediaUrl: m.mediaUrl ?? m.media_url ?? '',
    mediaThumbnail: m.mediaThumbnail ?? m.media_thumbnail ?? null,
    mediaMetadata: resolveMediaMetadata(m),
    metadata: unwrapGrpcStructMetadata(m.metadata),
    replyToId: m.replyToId ?? m.reply_to_id ?? '',
    forwardFrom: m.forwardFrom ?? m.forward_from,
    isEdited: m.isEdited ?? m.is_edited ?? false,
    isPinned: m.isPinned ?? m.is_pinned ?? false,
    viewCount: m.viewCount ?? m.view_count ?? undefined,
    createdAt: createdAt ?? null,
    editedAt: m.editedAt ?? m.edited_at ?? null,
    reactions: m.reactions ?? [],
  };
}

interface MessageServiceGrpc {
  GetMessages(req: { chatId: string; cursor?: string; limit?: number; direction?: number }): Observable<unknown>;
  SendMessage(req: SendMessageDto & { chatId: string; senderId: string }): Observable<unknown>;
  EditMessage(req: { messageId: string; chatId: string; editorId: string; textContent: string }): Observable<unknown>;
  DeleteMessage(req: { messageId: string; chatId: string; deleterId: string; deleteForEveryone: boolean }): Observable<unknown>;
  PinMessage(req: { messageId: string; chatId: string; pinnedBy: string }): Observable<unknown>;
  UnpinMessage(req: { messageId: string; chatId: string; unpinnedBy: string }): Observable<unknown>;
  GetPinnedMessages(req: { chatId: string }): Observable<unknown>;
  ReactToMessage(req: { messageId: string; chatId: string; userId: string; emoji: string }): Observable<unknown>;
  ForwardMessage(req: { messageId: string; fromChatId: string; toChatId: string; senderId: string }): Observable<unknown>;
  ClearChatMessages(req: { chatId: string; userId: string }): Observable<unknown>;
}

@Controller('v1')
export class MessageRoutesController implements OnModuleInit {
  private messageService!: MessageServiceGrpc;

  constructor(
    @Inject('MESSAGE_SERVICE_PACKAGE') private readonly messageClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.messageService = this.messageClient.getService<MessageServiceGrpc>('MessageService');
  }

  @Get('chats/:chatId/messages')
  getMessages(
    @CurrentUser() _user: RequestUser,
    @Param('chatId') chatId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const validLimit = Number.isNaN(limitNum) || limitNum < 1 ? 50 : Math.min(limitNum, 200);
    return firstValueFrom(
      this.messageService.GetMessages({
        chatId: String(chatId ?? ''),
        cursor: cursor && cursor.trim() ? cursor.trim() : undefined,
        limit: validLimit,
        direction: 1, // MESSAGE_DIRECTION_BEFORE (history backwards)
      }).pipe(
        map((res: unknown) => {
          const r = res as { messages?: unknown[]; nextCursor?: string; hasMore?: boolean };
          const messages = Array.isArray(r?.messages) ? r.messages : [];
          return {
            messages: messages.map((m: unknown) => toCamelCaseMessage(m as Record<string, unknown>)),
            nextCursor: r?.nextCursor ?? '',
            hasMore: r?.hasMore ?? false,
          };
        }),
      ),
    );
  }

  @Post('chats/:chatId/messages')
  sendMessage(
    @CurrentUser() user: RequestUser,
    @Param('chatId') chatId: string,
    @Body(new ZodValidationPipe(SendMessageDto)) body: SendMessageDto,
  ) {
    return firstValueFrom(
      this.messageService.SendMessage({ ...body, chatId, senderId: user.userId }),
    );
  }

  @Patch('messages/:id')
  editMessage(
    @CurrentUser() user: RequestUser,
    @Param('id') messageId: string,
    @Body(new ZodValidationPipe(EditMessageDto)) body: EditMessageDto,
    @Query('chatId') chatId: string,
  ) {
    if (!chatId?.trim()) throw new BadRequestException('chatId is required');
    return firstValueFrom(
      this.messageService.EditMessage({
        messageId,
        chatId: chatId.trim(),
        editorId: user.userId,
        textContent: body.text,
      }),
    );
  }

  @Delete('messages/:id')
  deleteMessage(
    @CurrentUser() user: RequestUser,
    @Param('id') messageId: string,
    @Query('chatId') chatId: string,
    @Query('deleteForEveryone') deleteForEveryone?: string,
  ) {
    if (!chatId?.trim()) throw new BadRequestException('chatId is required');
    return firstValueFrom(
      this.messageService.DeleteMessage({
        messageId,
        chatId: chatId.trim(),
        deleterId: user.userId,
        deleteForEveryone: deleteForEveryone === 'true' || deleteForEveryone === '1',
      }),
    );
  }

  @Delete('chats/:chatId/messages')
  clearChatMessages(@CurrentUser() user: RequestUser, @Param('chatId') chatId: string) {
    return firstValueFrom(
      this.messageService.ClearChatMessages({ chatId, userId: user.userId }),
    );
  }

  @Post('messages/:id/pin')
  pinMessage(
    @CurrentUser() user: RequestUser,
    @Param('id') messageId: string,
    @Query('chatId') chatId: string,
  ) {
    if (!chatId?.trim()) throw new BadRequestException('chatId is required');
    return firstValueFrom(
      this.messageService.PinMessage({
        messageId,
        chatId: chatId.trim(),
        pinnedBy: user.userId,
      }),
    );
  }

  @Delete('messages/:id/pin')
  unpinMessage(
    @CurrentUser() user: RequestUser,
    @Param('id') messageId: string,
    @Query('chatId') chatId: string,
  ) {
    if (!chatId?.trim()) throw new BadRequestException('chatId is required');
    return firstValueFrom(
      this.messageService.UnpinMessage({
        messageId,
        chatId: chatId.trim(),
        unpinnedBy: user.userId,
      }),
    );
  }

  @Get('chats/:chatId/pinned')
  getPinnedMessages(@Param('chatId') chatId: string) {
    return firstValueFrom(this.messageService.GetPinnedMessages({ chatId }));
  }

  @Post('messages/:id/react')
  reactToMessage(
    @CurrentUser() user: RequestUser,
    @Param('id') messageId: string,
    @Body(new ZodValidationPipe(ReactDto)) body: ReactDto,
    @Query('chatId') chatId: string,
  ) {
    if (!chatId?.trim()) throw new BadRequestException('chatId is required');
    return firstValueFrom(
      this.messageService.ReactToMessage({
        messageId,
        chatId: chatId.trim(),
        userId: user.userId,
        emoji: body.emoji,
      }),
    );
  }

  @Post('messages/:id/forward')
  forwardMessage(
    @CurrentUser() user: RequestUser,
    @Param('id') messageId: string,
    @Body(new ZodValidationPipe(ForwardDto)) body: ForwardDto,
  ) {
    const { fromChatId, toChatIds } = body;
    const calls = toChatIds.map((toChatId) =>
      this.messageService.ForwardMessage({
        messageId,
        fromChatId,
        toChatId,
        senderId: user.userId,
      }),
    );
    return firstValueFrom(
      forkJoin(calls).pipe(map((results) => results[results.length - 1])),
    );
  }
}
