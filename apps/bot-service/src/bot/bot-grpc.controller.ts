import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { AlufError, BadRequestError, NotFoundError } from '@aluf/shared';
import { BotManagerService, type BotInfo, type WebhookStatusInfo } from './bot-manager.service';

function toGrpcError(err: unknown): RpcException {
  if (err instanceof AlufError) {
    let code = GrpcStatus.INTERNAL;
    if (err instanceof BadRequestError) code = GrpcStatus.INVALID_ARGUMENT;
    else if (err instanceof NotFoundError) code = GrpcStatus.NOT_FOUND;
    return new RpcException({ code, message: (err as Error).message });
  }
  return new RpcException({
    code: GrpcStatus.INTERNAL,
    message: err instanceof Error ? err.message : 'Internal server error',
  });
}

function toGrpcTimestamp(date: Date): { seconds: number; nanos: number } {
  const ms = date.getTime();
  return {
    seconds: Math.floor(ms / 1000),
    nanos: (ms % 1000) * 1_000_000,
  };
}

function toProtoWebhookStatus(s?: WebhookStatusInfo | null) {
  if (!s) return undefined;
  return {
    lastDeliveryAt: s.lastDeliveryAt ?? '',
    lastSuccessAt: s.lastSuccessAt ?? '',
    lastError: s.lastError ?? '',
    lastStatusCode: s.lastStatusCode ?? 0,
  };
}

function toProtoBotInfo(info: BotInfo) {
  return {
    id: info.id,
    username: info.username,
    displayName: info.displayName,
    avatarUrl: info.avatarUrl ?? '',
    description: info.description ?? '',
    commands: info.commands.map((c) => ({ command: c.command, description: c.description })),
    webhookUrl: info.webhookUrl ?? '',
    isInline: info.isInline,
    createdAt: toGrpcTimestamp(info.createdAt),
    webhookStatus: toProtoWebhookStatus(info.webhookStatus),
    chatCount: info.chatCount ?? 0,
  };
}

@Controller()
export class BotGrpcController {
  constructor(private readonly botManager: BotManagerService) {}

  @GrpcMethod('BotService', 'CreateBot')
  async createBot(data: {
    owner_id?: string;
    ownerId?: string;
    username: string;
    display_name?: string;
    displayName?: string;
    description?: string;
    avatar_url?: string;
    avatarUrl?: string;
  }) {
    try {
      const ownerId = data.owner_id ?? data.ownerId ?? '';
      const displayName = data.display_name ?? data.displayName ?? '';
      const description = data.description ?? null;
      const avatarUrl = data.avatar_url ?? data.avatarUrl ?? null;
      const result = await this.botManager.createBot(ownerId, data.username, displayName, description, avatarUrl);
      return {
        id: result.id,
        username: result.username,
        displayName: result.displayName,
        token: result.token,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('BotService', 'ListBots')
  async listBots(data: { owner_id?: string; ownerId?: string }) {
    try {
      const ownerId = data.owner_id ?? data.ownerId ?? '';
      const { bots, limit } = await this.botManager.listBots(ownerId);
      return { bots: bots.map(toProtoBotInfo), limit };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('BotService', 'GetBot')
  async getBot(data: { owner_id?: string; ownerId?: string; bot_id?: string; botId?: string }) {
    try {
      const ownerId = data.owner_id ?? data.ownerId ?? '';
      const botId = data.bot_id ?? data.botId ?? '';
      const bot = await this.botManager.getBot(ownerId, botId);
      return toProtoBotInfo(bot);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('BotService', 'UpdateBot')
  async updateBot(data: {
    owner_id?: string;
    ownerId?: string;
    bot_id?: string;
    botId?: string;
    description?: string;
    commands?: { command: string; description: string }[];
    webhook_url?: string;
    webhookUrl?: string;
    is_inline?: boolean;
    isInline?: boolean;
  }) {
    try {
      const ownerId = data.owner_id ?? data.ownerId ?? '';
      const botId = data.bot_id ?? data.botId ?? '';
      const payload: {
        description?: string | null;
        commands?: { command: string; description: string }[];
        webhookUrl?: string | null;
        isInline?: boolean;
      } = {};
      if (data.description !== undefined) payload.description = data.description || null;
      if (data.commands !== undefined) payload.commands = data.commands;
      if (data.webhook_url !== undefined || data.webhookUrl !== undefined) payload.webhookUrl = (data.webhook_url ?? data.webhookUrl) || null;
      if (data.is_inline !== undefined || data.isInline !== undefined) payload.isInline = data.is_inline ?? data.isInline ?? false;

      const bot = await this.botManager.updateBot(ownerId, botId, payload);
      return toProtoBotInfo(bot);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('BotService', 'DeleteBot')
  async deleteBot(data: { owner_id?: string; ownerId?: string; bot_id?: string; botId?: string }) {
    try {
      const ownerId = data.owner_id ?? data.ownerId ?? '';
      const botId = data.bot_id ?? data.botId ?? '';
      await this.botManager.deleteBot(botId, ownerId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('BotService', 'RegenerateToken')
  async regenerateToken(data: { owner_id?: string; ownerId?: string; bot_id?: string; botId?: string }) {
    try {
      const ownerId = data.owner_id ?? data.ownerId ?? '';
      const botId = data.bot_id ?? data.botId ?? '';
      const { token } = await this.botManager.regenerateToken(botId, ownerId);
      return { token };
    } catch (err) {
      throw toGrpcError(err);
    }
  }
}
