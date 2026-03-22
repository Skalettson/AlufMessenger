import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Inject,
  OnModuleInit,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CurrentUser } from '../decorators/public.decorator';
import type { RequestUser } from '../decorators/public.decorator';
import { JwtVerifierService } from '../auth/jwt-verifier.service';

interface CustomEmojiServiceGrpc {
  CreateEmoji(req: Record<string, unknown>): import('rxjs').Observable<unknown>;
  ListMyEmoji(req: { user_id?: string; userId?: string }): import('rxjs').Observable<unknown>;
  ListPublicEmoji(req: { search?: string; limit?: number; offset?: number }): import('rxjs').Observable<unknown>;
  AddEmojiToMe(req: Record<string, unknown>): import('rxjs').Observable<unknown>;
  RemoveEmojiFromMe(req: Record<string, unknown>): import('rxjs').Observable<unknown>;
  GetEmojiByShortcode(req: { shortcode?: string }): import('rxjs').Observable<unknown>;
  GetEmojiByIds(req: { ids?: string[] }): import('rxjs').Observable<unknown>;
  DeleteEmoji(req: Record<string, unknown>): import('rxjs').Observable<unknown>;
}

@Controller('v1/custom-emoji')
export class CustomEmojiRoutesController implements OnModuleInit {
  private customEmojiService!: CustomEmojiServiceGrpc;

  constructor(
    @Inject('CUSTOM_EMOJI_SERVICE_PACKAGE') private readonly client: ClientGrpc,
    private readonly jwtVerifier: JwtVerifierService,
  ) {}

  onModuleInit() {
    this.customEmojiService = this.client.getService<CustomEmojiServiceGrpc>('CustomEmojiService');
  }

  private getUserId(user: RequestUser | undefined, req: Request): string {
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
    return userId;
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
  async createEmoji(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Body() body: { mediaId?: string; media_id?: string; shortcode?: string },
  ) {
    const userId = this.getUserId(user, req);
    const mediaId = (body.mediaId ?? body.media_id ?? '').trim();
    const shortcode = (body.shortcode ?? '').trim();
    if (!userId) {
      throw new UnauthorizedException('Не удалось определить пользователя. Войдите снова.');
    }
    if (!mediaId || !shortcode) {
      throw new BadRequestException('mediaId и shortcode обязательны');
    }
    const res = await firstValueFrom(
      this.customEmojiService.CreateEmoji({
        creator_id: userId,
        creatorId: userId,
        media_id: mediaId,
        mediaId,
        shortcode,
      }),
    );
    return res;
  }

  @Get('my')
  async listMyEmoji(@CurrentUser() user: RequestUser, @Req() req: Request) {
    const userId = this.getUserId(user, req);
    const res = await firstValueFrom(
      this.customEmojiService.ListMyEmoji({ user_id: userId, userId }),
    );
    const raw = res as { emoji?: unknown[] };
    return { emoji: raw.emoji ?? [] };
  }

  @Get('public')
  async listPublicEmoji(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const res = await firstValueFrom(
      this.customEmojiService.ListPublicEmoji({
        search: search?.trim(),
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      }),
    );
    const raw = res as { emoji?: unknown[] };
    return { emoji: raw.emoji ?? [] };
  }

  @Get('by-shortcode/:code')
  async getByShortcode(@Param('code') code: string) {
    const shortcode = decodeURIComponent(code);
    const res = await firstValueFrom(
      this.customEmojiService.GetEmojiByShortcode({ shortcode }),
    );
    return res;
  }

  @Post('by-ids')
  async getByIds(@Body() body: { ids?: string[] }) {
    const ids = body.ids ?? [];
    const res = await firstValueFrom(
      this.customEmojiService.GetEmojiByIds({ ids }),
    );
    const raw = res as { emoji?: unknown[] };
    return { emoji: raw.emoji ?? [] };
  }

  @Post(':id/add-to-me')
  async addToMe(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Param('id') emojiId: string,
  ) {
    const userId = this.getUserId(user, req);
    await firstValueFrom(
      this.customEmojiService.AddEmojiToMe({
        user_id: userId,
        userId,
        emoji_id: emojiId,
        emojiId,
      }),
    );
    return { ok: true };
  }

  @Delete(':id/add-to-me')
  async removeFromMe(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Param('id') emojiId: string,
  ) {
    const userId = this.getUserId(user, req);
    await firstValueFrom(
      this.customEmojiService.RemoveEmojiFromMe({
        user_id: userId,
        userId,
        emoji_id: emojiId,
        emojiId,
      }),
    );
    return { ok: true };
  }

  @Delete(':id')
  async deleteEmoji(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Param('id') emojiId: string,
  ) {
    const userId = this.getUserId(user, req);
    await firstValueFrom(
      this.customEmojiService.DeleteEmoji({
        emoji_id: emojiId,
        emojiId,
        user_id: userId,
        userId,
      }),
    );
    return { ok: true };
  }
}
