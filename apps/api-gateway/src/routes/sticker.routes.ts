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

interface StickerServiceGrpc {
  CreatePack(req: Record<string, unknown>): import('rxjs').Observable<unknown>;
  AddStickerToPack(req: Record<string, unknown>): import('rxjs').Observable<unknown>;
  ListMyPacks(req: { user_id?: string; userId?: string }): import('rxjs').Observable<unknown>;
  ListPublicPacks(req: { search?: string; limit?: number; offset?: number }): import('rxjs').Observable<unknown>;
  AddPackToMe(req: Record<string, unknown>): import('rxjs').Observable<unknown>;
  RemovePackFromMe(req: Record<string, unknown>): import('rxjs').Observable<unknown>;
  GetPackWithStickers(req: { pack_id?: string; packId?: string }): import('rxjs').Observable<unknown>;
  GetPackByStickerMediaId(req: { media_id?: string; mediaId?: string; user_id?: string; userId?: string }): import('rxjs').Observable<unknown>;
  DeletePack(req: Record<string, unknown>): import('rxjs').Observable<unknown>;
  RemoveStickerFromPack(req: Record<string, unknown>): import('rxjs').Observable<unknown>;
}

@Controller('v1/sticker-packs')
export class StickerRoutesController implements OnModuleInit {
  private stickerService!: StickerServiceGrpc;

  constructor(
    @Inject('STICKER_SERVICE_PACKAGE') private readonly stickerClient: ClientGrpc,
    private readonly jwtVerifier: JwtVerifierService,
  ) {}

  onModuleInit() {
    this.stickerService = this.stickerClient.getService<StickerServiceGrpc>('StickerService');
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
  async createPack(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Body() body: { name?: string; isPublic?: boolean; description?: string },
  ) {
    const userId = this.getUserId(user, req);
    if (!userId) {
      throw new UnauthorizedException('Не удалось определить пользователя. Войдите снова.');
    }
    const res = await firstValueFrom(
      this.stickerService.CreatePack({
        creator_id: userId,
        creatorId: userId,
        name: body.name ?? '',
        is_public: body.isPublic ?? true,
        isPublic: body.isPublic ?? true,
        description: body.description ?? '',
      }),
    );
    return res;
  }

  @Get('my')
  async listMyPacks(@CurrentUser() user: RequestUser, @Req() req: Request) {
    const userId = this.getUserId(user, req);
    const res = await firstValueFrom(
      this.stickerService.ListMyPacks({ user_id: userId, userId }),
    );
    const raw = res as { packs?: unknown[] };
    return { packs: raw.packs ?? [] };
  }

  @Get('public')
  async listPublicPacks(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const res = await firstValueFrom(
      this.stickerService.ListPublicPacks({
        search: search?.trim(),
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      }),
    );
    const raw = res as { packs?: unknown[] };
    return { packs: raw.packs ?? [] };
  }

  @Get('by-sticker/:mediaId')
  async getPackByStickerMediaId(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Param('mediaId') mediaId: string,
  ) {
    const userId = this.getUserId(user, req);
    const mid = (mediaId ?? '').trim();
    if (!mid) throw new BadRequestException('mediaId обязателен');
    const res = await firstValueFrom(
      this.stickerService.GetPackByStickerMediaId({
        media_id: mid,
        mediaId: mid,
        user_id: userId,
        userId,
      }),
    );
    return res;
  }

  @Get(':id')
  async getPackWithStickers(@Param('id') packId: string) {
    const res = await firstValueFrom(
      this.stickerService.GetPackWithStickers({ pack_id: packId, packId }),
    );
    return res;
  }

  @Post(':id/stickers')
  async addStickerToPack(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Param('id') packId: string,
    @Body() body: { mediaId?: string; media_id?: string },
  ) {
    const userId = this.getUserId(user, req);
    if (!userId) {
      throw new UnauthorizedException('Не удалось определить пользователя. Войдите снова.');
    }
    const mediaId = (body.mediaId ?? body.media_id ?? '').trim();
    if (!mediaId) {
      throw new BadRequestException('mediaId обязателен');
    }
    await firstValueFrom(
      this.stickerService.AddStickerToPack({
        pack_id: packId,
        packId,
        media_id: mediaId,
        mediaId,
        user_id: userId,
        userId,
      }),
    );
    return { ok: true };
  }

  @Delete(':id/stickers/:mediaId')
  async removeStickerFromPack(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Param() params: { id?: string; mediaId?: string },
  ) {
    const userId = this.getUserId(user, req);
    const packId = (params?.id ?? (req.params as { id?: string })?.id ?? '').trim();
    const mediaId = (params?.mediaId ?? (req.params as { mediaId?: string })?.mediaId ?? '').trim();
    if (!packId || !mediaId) {
      throw new BadRequestException('pack_id и media_id обязательны (передаются в URL: /sticker-packs/:id/stickers/:mediaId)');
    }
    if (!userId) {
      throw new UnauthorizedException('Не удалось определить пользователя. Войдите снова.');
    }
    await firstValueFrom(
      this.stickerService.RemoveStickerFromPack({
        pack_id: packId,
        packId,
        media_id: mediaId,
        mediaId,
        user_id: userId,
        userId,
      }),
    );
    return { ok: true };
  }

  @Post(':id/add-to-me')
  async addPackToMe(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Param('id') packId: string,
  ) {
    const userId = this.getUserId(user, req);
    await firstValueFrom(
      this.stickerService.AddPackToMe({
        user_id: userId,
        userId,
        pack_id: packId,
        packId,
      }),
    );
    return { ok: true };
  }

  @Delete(':id/add-to-me')
  async removePackFromMe(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Param('id') packId: string,
  ) {
    const userId = this.getUserId(user, req);
    await firstValueFrom(
      this.stickerService.RemovePackFromMe({
        user_id: userId,
        userId,
        pack_id: packId,
        packId,
      }),
    );
    return { ok: true };
  }

  @Delete(':id')
  async deletePack(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Param('id') packId: string,
  ) {
    const userId = this.getUserId(user, req);
    await firstValueFrom(
      this.stickerService.DeletePack({
        pack_id: packId,
        packId,
        user_id: userId,
        userId,
      }),
    );
    return { ok: true };
  }
}
