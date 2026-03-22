import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Inject,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { CurrentUser } from '../decorators/public.decorator';
import type { RequestUser } from '../decorators/public.decorator';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { CreateBotDto, UpdateBotDto } from '../dto/bot.dto';
import { MAX_BOTS_PER_USER } from '@aluf/shared';

interface WebhookStatusGrpc {
  lastDeliveryAt?: string;
  last_delivery_at?: string;
  lastSuccessAt?: string;
  last_success_at?: string;
  lastError?: string;
  last_error?: string;
  lastStatusCode?: number;
  last_status_code?: number;
}

interface BotInfoGrpc {
  id: string;
  username: string;
  displayName?: string;
  display_name?: string;
  avatarUrl?: string;
  description?: string;
  commands?: { command: string; description: string }[];
  webhookUrl?: string;
  webhook_url?: string;
  isInline?: boolean;
  is_inline?: boolean;
  createdAt?: { seconds: number; nanos: number };
  created_at?: { seconds: number; nanos: number };
  webhookStatus?: WebhookStatusGrpc;
  webhook_status?: WebhookStatusGrpc;
  chatCount?: number;
  chat_count?: number;
}

function toIsoTimestamp(ts: { seconds: number; nanos: number } | undefined): string | undefined {
  if (!ts || typeof ts.seconds !== 'number') return undefined;
  return new Date(ts.seconds * 1000 + (ts.nanos || 0) / 1e6).toISOString();
}

function mapWebhookStatus(ws?: WebhookStatusGrpc | null) {
  if (!ws) return undefined;
  const d = ws.lastDeliveryAt ?? ws.last_delivery_at;
  const s = ws.lastSuccessAt ?? ws.last_success_at;
  const e = ws.lastError ?? ws.last_error;
  const c = ws.lastStatusCode ?? ws.last_status_code;
  if (!d && !s && !e && c === undefined) return undefined;
  return {
    lastDeliveryAt: d ?? '',
    lastSuccessAt: s,
    lastError: e,
    lastStatusCode: c,
  };
}

function mapBotInfo(b: BotInfoGrpc) {
  const createdAt = b.createdAt ?? b.created_at;
  const ws = b.webhookStatus ?? b.webhook_status;
  return {
    id: b.id,
    username: b.username,
    displayName: b.displayName ?? b.display_name ?? '',
    avatarUrl: b.avatarUrl ?? '',
    description: b.description ?? null,
    commands: b.commands ?? [],
    webhookUrl: b.webhookUrl ?? b.webhook_url ?? null,
    isInline: b.isInline ?? b.is_inline ?? false,
    createdAt: toIsoTimestamp(createdAt),
    webhookStatus: mapWebhookStatus(ws),
    chatCount: b.chatCount ?? b.chat_count ?? 0,
  };
}

interface BotServiceGrpc {
  CreateBot(req: { ownerId: string; username: string; displayName: string; description?: string; avatarUrl?: string }): Observable<{ id: string; username: string; displayName: string; token: string }>;
  ListBots(req: { ownerId: string }): Observable<{ bots: BotInfoGrpc[]; limit?: number }>;
  GetBot(req: { ownerId: string; botId: string }): Observable<BotInfoGrpc>;
  UpdateBot(req: { ownerId: string; botId: string; description?: string; commands?: { command: string; description: string }[]; webhookUrl?: string; isInline?: boolean }): Observable<BotInfoGrpc>;
  DeleteBot(req: { ownerId: string; botId: string }): Observable<Record<string, never>>;
  RegenerateToken(req: { ownerId: string; botId: string }): Observable<{ token: string }>;
}

@Controller('v1/bots')
export class BotRoutesController implements OnModuleInit {
  private botService!: BotServiceGrpc;

  constructor(
    @Inject('BOT_SERVICE_PACKAGE') private readonly botClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.botService = this.botClient.getService<BotServiceGrpc>('BotService');
  }

  @Post()
  async createBot(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(CreateBotDto)) body: { username: string; displayName: string; description?: string | null; avatarUrl?: string | null },
  ) {
    const userId = (user?.userId ?? '').trim();
    if (!userId) throw new UnauthorizedException('Сессия не определена. Войдите снова.');
    const result = await firstValueFrom(
      this.botService.CreateBot({
        ownerId: userId,
        username: body.username,
        displayName: body.displayName,
        ...(body.description != null && { description: body.description }),
        ...(body.avatarUrl != null && body.avatarUrl !== '' && { avatarUrl: body.avatarUrl }),
      }),
    );
    return {
      id: result.id,
      username: result.username,
      displayName: result.displayName,
      token: result.token,
    };
  }

  @Get()
  async listBots(@CurrentUser() user: RequestUser) {
    const userId = (user?.userId ?? '').trim();
    if (!userId) throw new UnauthorizedException('Сессия не определена. Войдите снова.');
    const res = await firstValueFrom(this.botService.ListBots({ ownerId: userId }));
    const limit = res.limit ?? MAX_BOTS_PER_USER;
    return { bots: (res.bots ?? []).map(mapBotInfo), limit };
  }

  @Get(':id')
  async getBot(@CurrentUser() user: RequestUser, @Param('id') botId: string) {
    const userId = (user?.userId ?? '').trim();
    if (!userId) throw new UnauthorizedException('Сессия не определена. Войдите снова.');
    const bot = await firstValueFrom(this.botService.GetBot({ ownerId: userId, botId }));
    return mapBotInfo(bot);
  }

  @Patch(':id')
  async updateBot(
    @CurrentUser() user: RequestUser,
    @Param('id') botId: string,
    @Body(new ZodValidationPipe(UpdateBotDto)) body: { description?: string | null; commands?: { command: string; description: string }[]; webhookUrl?: string | null; isInline?: boolean },
  ) {
    const userId = (user?.userId ?? '').trim();
    if (!userId) throw new UnauthorizedException('Сессия не определена. Войдите снова.');
    const bot = await firstValueFrom(
      this.botService.UpdateBot({
        ownerId: userId,
        botId,
        description: body.description ?? undefined,
        commands: body.commands,
        webhookUrl: body.webhookUrl ?? undefined,
        isInline: body.isInline,
      }),
    );
    return mapBotInfo(bot);
  }

  @Post(':id/regenerate-token')
  async regenerateToken(@CurrentUser() user: RequestUser, @Param('id') botId: string) {
    const userId = (user?.userId ?? '').trim();
    if (!userId) throw new UnauthorizedException('Сессия не определена. Войдите снова.');
    const res = await firstValueFrom(this.botService.RegenerateToken({ ownerId: userId, botId }));
    return { token: res.token };
  }

  @Delete(':id')
  async deleteBot(@CurrentUser() user: RequestUser, @Param('id') botId: string) {
    const userId = (user?.userId ?? '').trim();
    if (!userId) throw new UnauthorizedException('Сессия не определена. Войдите снова.');
    await firstValueFrom(this.botService.DeleteBot({ ownerId: userId, botId }));
    return { ok: true };
  }
}
