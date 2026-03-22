import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import {
  AlufError,
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  UnauthorizedError,
} from '@aluf/shared';
import { MessageService } from './message.service';

const PROTO_TO_DB_CONTENT_TYPE: Record<number, string> = {
  1: 'text',
  2: 'image',
  3: 'video',
  4: 'audio',
  5: 'document',
  6: 'voice',
  7: 'sticker',
  8: 'gif',
  9: 'location',
  10: 'contact',
  11: 'poll',
  12: 'system',
  13: 'video_note',
};

const DB_TO_PROTO_CONTENT_TYPE: Record<string, number> = {
  text: 1,
  image: 2,
  video: 3,
  audio: 4,
  document: 5,
  voice: 6,
  video_note: 13,
  sticker: 7,
  gif: 8,
  location: 9,
  live_location: 9,
  contact: 10,
  poll: 11,
  system: 12,
};

function toGrpcError(err: unknown): RpcException {
  if (err instanceof AlufError) {
    let code = GrpcStatus.INTERNAL;
    if (err instanceof BadRequestError) code = GrpcStatus.INVALID_ARGUMENT;
    else if (err instanceof NotFoundError) code = GrpcStatus.NOT_FOUND;
    else if (err instanceof ForbiddenError) code = GrpcStatus.PERMISSION_DENIED;
    else if (err instanceof UnauthorizedError) code = GrpcStatus.UNAUTHENTICATED;
    else if (err instanceof ConflictError) code = GrpcStatus.ALREADY_EXISTS;
    return new RpcException({ code, message: err.message });
  }
  return new RpcException({
    code: GrpcStatus.INTERNAL,
    message: err instanceof Error ? err.message : 'Internal server error',
  });
}

function toGrpcTimestamp(date: Date): { seconds: number; nanos: number } {
  const ms = date.getTime();
  return { seconds: Math.floor(ms / 1000), nanos: (ms % 1000) * 1_000_000 };
}

/** Входящий metadata из gRPC-клиента: plain object или Struct с `fields`. */
function incomingMetadataToPlain(meta: unknown): Record<string, unknown> {
  if (meta == null) return {};
  if (typeof meta !== 'object' || Array.isArray(meta)) return {};
  const o = meta as Record<string, unknown>;
  if (o.fields && typeof o.fields === 'object' && !Array.isArray(o.fields)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o.fields as Record<string, unknown>)) {
      const val = v as Record<string, unknown>;
      if (val && typeof val === 'object') {
        if ('numberValue' in val && val.numberValue !== undefined) out[k] = val.numberValue;
        else if ('stringValue' in val && val.stringValue !== undefined) out[k] = val.stringValue;
        else if ('boolValue' in val && val.boolValue !== undefined) out[k] = val.boolValue;
      }
    }
    return out;
  }
  return { ...(o as Record<string, unknown>) };
}

/** google.protobuf.Struct для gRPC: jsonb из БД → fields + Value (number/string/bool). */
function dbMetadataToGrpcStruct(metadata: unknown): { fields: Record<string, { numberValue?: number; stringValue?: string; boolValue?: boolean }> } {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { fields: {} };
  }
  const fields: Record<string, { numberValue?: number; stringValue?: string; boolValue?: boolean }> = {};
  for (const [k, v] of Object.entries(metadata as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) fields[k] = { numberValue: v };
    else if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'boolean') fields[k] = { boolValue: v };
  }
  return { fields };
}

function toMessageResponse(msg: {
  id: bigint;
  chatId: string;
  senderId: string;
  senderDisplayName?: string;
  senderAvatarUrl?: string | null;
  senderIsPremium?: boolean;
  senderPremiumBadgeEmoji?: string | null;
  senderIsVerified?: boolean;
  senderIsOfficial?: boolean;
  contentType: string;
  textContent: string | null;
  mediaId: string | null;
  replyToId: bigint | null;
  forwardFromId: bigint | null;
  forwardFromChatId: string | null;
  forwardFromChatTitle?: string;
  forwardFromSenderName?: string;
  metadata: unknown;
  isEdited: boolean;
  isPinned: boolean;
  selfDestructAt: Date | null;
  createdAt: Date;
  editedAt: Date | null;
  reactions?: { emoji: string; count: number }[];
}) {
  const forwardFrom =
    msg.forwardFromChatId
      ? {
          chatTitle: msg.forwardFromChatTitle ?? 'Чат',
          senderName: msg.forwardFromSenderName ?? '',
        }
      : undefined;
  const mediaId = msg.mediaId != null && String(msg.mediaId).trim() !== '' ? String(msg.mediaId).trim() : '';
  return {
    id: msg.id.toString(),
    chatId: msg.chatId,
    senderId: msg.senderId,
    senderDisplayName: msg.senderDisplayName ?? '',
    senderAvatarUrl: msg.senderAvatarUrl ?? '',
    senderIsPremium: msg.senderIsPremium ?? false,
    senderPremiumBadgeEmoji: msg.senderPremiumBadgeEmoji ?? '',
    senderIsVerified: msg.senderIsVerified ?? false,
    senderIsOfficial: msg.senderIsOfficial ?? false,
    contentType: DB_TO_PROTO_CONTENT_TYPE[msg.contentType] ?? 0,
    textContent: msg.textContent ?? '',
    mediaId,
    mediaUrl: '',
    replyToId: msg.replyToId?.toString() ?? '',
    forwardedFromId: msg.forwardFromId?.toString() ?? '',
    forwardedFromChatId: msg.forwardFromChatId ?? '',
    forwardFrom,
    reactions: msg.reactions ?? [],
    isPinned: msg.isPinned,
    isEdited: msg.isEdited,
    selfDestructSeconds: msg.selfDestructAt
      ? Math.max(0, Math.floor((msg.selfDestructAt.getTime() - Date.now()) / 1000))
      : 0,
    metadata: dbMetadataToGrpcStruct(msg.metadata),
    createdAt: toGrpcTimestamp(msg.createdAt),
    updatedAt: msg.editedAt ? toGrpcTimestamp(msg.editedAt) : toGrpcTimestamp(msg.createdAt),
  };
}

@Controller()
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @GrpcMethod('MessageService', 'SendMessage')
  async sendMessage(data: {
    chatId: string;
    senderId: string;
    contentType: number;
    textContent: string;
    mediaId: string;
    replyToId: string;
    metadata: Record<string, unknown>;
    selfDestructSeconds: number;
    hideAuthor?: boolean;
  }) {
    try {
      const dbContentType = PROTO_TO_DB_CONTENT_TYPE[data.contentType] ?? 'text';
      const plainMeta = incomingMetadataToPlain(data.metadata);
      const message = await this.messageService.sendMessage(data.chatId, data.senderId, {
        contentType: dbContentType,
        textContent: data.textContent || '',
        mediaId: data.mediaId || '',
        replyToId: data.replyToId || '',
        metadata: plainMeta,
        selfDestructSeconds: data.selfDestructSeconds ?? 0,
        hideAuthor: data.hideAuthor ?? false,
      });
      return toMessageResponse(message);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MessageService', 'GetMessages')
  async getMessages(data: {
    chatId?: string;
    chat_id?: string;
    cursor?: string;
    limit?: number;
    direction?: number;
  }) {
    try {
      const chatId = data.chatId ?? data.chat_id ?? '';
      if (!chatId) {
        throw new BadRequestError('chatId is required');
      }
      const limit = Number.isFinite(data.limit) && (data.limit as number) > 0 ? (data.limit as number) : 50;
      const direction = typeof data.direction === 'number' ? data.direction : 1;
      const result = await this.messageService.getMessages(
        chatId,
        data.cursor?.trim() || undefined,
        limit,
        direction,
      );
      return {
        messages: result.messages.map((m) => {
          const { viewCount, ...rest } = m as typeof m & { viewCount?: number };
          const resp = toMessageResponse(rest);
          if (viewCount != null) (resp as Record<string, unknown>).viewCount = viewCount;
          return resp;
        }),
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MessageService', 'GetMessage')
  async getMessage(data: { messageId: string; chatId: string }) {
    try {
      const message = await this.messageService.getMessage(data.messageId, data.chatId);
      return toMessageResponse(message as Parameters<typeof toMessageResponse>[0]);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MessageService', 'EditMessage')
  async editMessage(data: {
    messageId: string;
    chatId: string;
    editorId: string;
    textContent: string;
  }) {
    try {
      const message = await this.messageService.editMessage(
        data.messageId,
        data.chatId,
        data.editorId,
        data.textContent,
      );
      return toMessageResponse(message);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MessageService', 'DeleteMessage')
  async deleteMessage(data: {
    messageId: string;
    chatId: string;
    deleterId: string;
    deleteForEveryone: boolean;
  }) {
    try {
      await this.messageService.deleteMessage(
        data.messageId,
        data.chatId,
        data.deleterId,
        data.deleteForEveryone ?? false,
      );
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MessageService', 'PinMessage')
  async pinMessage(data: { messageId: string; chatId: string; pinnedBy: string }) {
    try {
      await this.messageService.pinMessage(data.messageId, data.chatId, data.pinnedBy);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MessageService', 'UnpinMessage')
  async unpinMessage(data: { messageId: string; chatId: string; unpinnedBy: string }) {
    try {
      await this.messageService.unpinMessage(data.messageId, data.chatId, data.unpinnedBy);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MessageService', 'GetPinnedMessages')
  async getPinnedMessages(data: { chatId: string }) {
    try {
      const msgs = await this.messageService.getPinnedMessages(data.chatId);
      return {
        messages: msgs.map((m) => toMessageResponse(m as Parameters<typeof toMessageResponse>[0])),
        nextCursor: '',
        hasMore: false,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MessageService', 'ReactToMessage')
  async reactToMessage(data: {
    messageId: string;
    chatId: string;
    userId: string;
    emoji: string;
  }) {
    try {
      await this.messageService.reactToMessage(
        data.messageId,
        data.chatId,
        data.userId,
        data.emoji,
      );
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MessageService', 'ForwardMessage')
  async forwardMessage(data: {
    messageId: string;
    fromChatId: string;
    toChatId: string;
    senderId: string;
  }) {
    try {
      const message = await this.messageService.forwardMessage(
        data.messageId,
        data.fromChatId,
        data.toChatId,
        data.senderId,
      );
      return toMessageResponse(message);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MessageService', 'ClearChatMessages')
  async clearChatMessages(data: { chatId?: string; chat_id?: string; userId?: string; user_id?: string }) {
    try {
      const chatId = data.chatId ?? data.chat_id ?? '';
      const userId = data.userId ?? data.user_id ?? '';
      await this.messageService.clearChatMessages(chatId, userId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MessageService', 'ClearChatMessagesAdmin')
  async clearChatMessagesAdmin(data: { chatId?: string; chat_id?: string }) {
    try {
      const chatId = data.chatId ?? data.chat_id ?? '';
      await this.messageService.clearChatMessagesAdmin(chatId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }
}
