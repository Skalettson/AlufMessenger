import {
  Controller,
  Get,
  Patch,
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
  Header,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { CurrentUser } from '../decorators/public.decorator';
import type { RequestUser } from '../decorators/public.decorator';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { JwtVerifierService } from '../auth/jwt-verifier.service';
import { UpdateProfileDto, AddContactDto, UpdateContactDto, UpdatePrivacyDto } from '../dto/user.dto';

interface UserServiceGrpc {
  /** gRPC proto-loader (keepCase: false) — поля в camelCase: userId, viewerUserId */
  GetUser(req: { userId?: string; viewerUserId?: string }): Observable<unknown>;
  GetUsersByIds(req: { userIds: string[] }): Observable<unknown>;
  UpdateProfile(req: UpdateProfileDto & { userId: string }): Observable<unknown>;
  SearchUsers(req: { query: string; userId: string; limit?: number; offset?: number }): Observable<unknown>;
  GetUserByUsername(req: { username: string }): Observable<unknown>;
  GetContacts(req: { userId: string; limit?: number; offset?: number }): Observable<unknown>;
  AddContact(req: { userId: string; contactUserId: string; nickname?: string }): Observable<unknown>;
  UpdateContact(req: { userId: string; contactUserId: string; nickname?: string }): Observable<unknown>;
  RemoveContact(req: { userId: string; contactUserId: string }): Observable<unknown>;
  BlockUser(req: { userId: string; blockedUserId: string }): Observable<unknown>;
  UnblockUser(req: { userId: string; blockedUserId: string }): Observable<unknown>;
  GetPrivacy(req: { userId: string }): Observable<unknown>;
  UpdatePrivacy(req: UpdatePrivacyDto & { userId: string }): Observable<unknown>;
}

interface MediaServiceGrpc {
  GetFileUrlByStorageKey(req: { storageKey: string; expiresInSeconds?: number }): Observable<{ url: string; expiresAt: { seconds: number; nanos: number } }>;
}

/**
 * Преобразует storageKey или URL в публичный URL.
 * storageKey → /aluf-media/{key}; full URL от нашего домена → /aluf-media/{key}
 */
async function resolveMediaUrl(
  value: string | null | undefined,
  _mediaService: MediaServiceGrpc | null,
): Promise<string> {
  if (!value?.trim()) return '';

  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const parsed = new URL(value);
      const match = parsed.pathname.match(/\/aluf-media\/(.+)/);
      if (match) return `/aluf-media/${match[1]}`;
    } catch { /* ignore */ }
    return value;
  }

  const storageKey = value.trim().replace(/^\/+/, '');
  return `/aluf-media/${storageKey}`;
}

/** Преобразует ответ от UserService с генерацией presigned URL для медиа */
async function mapUserResponse(
  userData: unknown,
  mediaService: MediaServiceGrpc | null,
): Promise<unknown> {
  const user = userData as Record<string, unknown>;
  if (!user) return user;
  
  const [avatarUrl, coverUrl] = await Promise.all([
    resolveMediaUrl((user.avatarUrl ?? user.avatar_url) as string, mediaService),
    resolveMediaUrl((user.coverUrl ?? user.cover_url) as string, mediaService),
  ]);
  
  return {
    ...user,
    avatarUrl,
    coverUrl,
    isContact: Boolean(user.isContact ?? user.is_contact),
    isTwoFactorEnabled: Boolean(user.isTwoFactorEnabled ?? user.is_two_factor_enabled),
  };
}

@Controller('v1/users')
export class UserRoutesController implements OnModuleInit {
  private userService!: UserServiceGrpc;
  private mediaService: MediaServiceGrpc | null = null;

  constructor(
    @Inject('USER_SERVICE_PACKAGE') private readonly userClient: ClientGrpc,
    @Inject('MEDIA_SERVICE_PACKAGE') private readonly mediaClient: ClientGrpc,
    private readonly jwtVerifier: JwtVerifierService,
  ) {}

  onModuleInit() {
    this.userService = this.userClient.getService<UserServiceGrpc>('UserService');
    try {
      this.mediaService = this.mediaClient.getService<MediaServiceGrpc>('MediaService');
      console.log('[UserRoutes] MediaService connected successfully');
    } catch (err) {
      console.warn('[UserRoutes] MediaService not available:', err instanceof Error ? err.message : err);
      this.mediaService = null;
    }
  }

  @Get('me')
  async getMe(@CurrentUser() user: RequestUser) {
    const userData = await firstValueFrom(this.userService.GetUser({ userId: user.userId }));
    return mapUserResponse(userData, this.mediaService);
  }

  @Get('presence')
  async getPresence(
    @CurrentUser() _user: RequestUser,
    @Query('ids') idsParam?: string,
  ) {
    const ids = typeof idsParam === 'string' && idsParam.trim()
      ? idsParam.split(',').map((id) => id.trim()).filter(Boolean)
      : [];
    if (ids.length === 0) {
      return {};
    }
    const res = await firstValueFrom(
      this.userService.GetUsersByIds({ userIds: ids }),
    ) as { users?: Array<{ id?: string; isOnline?: boolean; lastSeenAt?: unknown }> };
    const users = res?.users ?? [];
    const out: Record<string, { isOnline: boolean; lastSeenAt?: string | null }> = {};
    for (const u of users) {
      const id = u?.id;
      if (id) {
        let lastSeenAt: string | null | undefined;
        if (u.lastSeenAt != null) {
          if (typeof u.lastSeenAt === 'string') lastSeenAt = u.lastSeenAt;
          else if (typeof u.lastSeenAt === 'object' && u.lastSeenAt && 'seconds' in u.lastSeenAt) {
            const sec = (u.lastSeenAt as { seconds?: number }).seconds ?? 0;
            lastSeenAt = new Date(sec * 1000).toISOString();
          }
        }
        out[id] = { isOnline: u.isOnline ?? false, lastSeenAt: lastSeenAt ?? null };
      }
    }
    return out;
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser() user: RequestUser,
    @Req() req: Request & { user?: RequestUser; headers: Record<string, string | string[] | undefined> },
    @Body(new ZodValidationPipe(UpdateProfileDto)) body: UpdateProfileDto,
  ) {
    let userId = (user?.userId ?? '').trim();
    if (!userId) {
      const token = this.extractToken(req);
      if (token) {
        const payload = this.jwtVerifier.verify(token);
        if (payload?.userId) userId = payload.userId;
      }
    }
    if (!userId) {
      throw new UnauthorizedException('Сессия не определена. Войдите снова.');
    }
    
    const updateData: Record<string, unknown> = { ...body };
    if (body.avatarFileId) {
      updateData.avatarUrl = body.avatarFileId;
      delete updateData.avatarFileId;
    }
    
    const result = await firstValueFrom(
      this.userService.UpdateProfile({ ...updateData, userId }),
    );
    
    // Генерируем presigned URL для возвращаемых данных
    return mapUserResponse(result, this.mediaService);
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

  @Get('search')
  searchUsers(
    @CurrentUser() user: RequestUser,
    @Query('q') q: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return firstValueFrom(
      this.userService.SearchUsers({
        query: q,
        userId: user.userId,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      }),
    );
  }

  @Get('me/contacts')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  async getContacts(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const lim = limit ? Math.min(Math.max(parseInt(limit, 10) || 0, 1), 100) : undefined;
    const off = offset ? Math.max(parseInt(offset, 10) || 0, 0) : undefined;
    const result = await firstValueFrom(
      this.userService.GetContacts({
        userId: user.userId,
        ...(lim != null ? { limit: lim } : {}),
        ...(off != null ? { offset: off } : {}),
      }),
    );
    const raw = result as { contacts?: Array<Record<string, unknown>>; totalCount?: number };
    const contacts = await Promise.all(
      (raw.contacts ?? []).map(async (c) => {
        const cu = (c.user ?? c.contact_user) as Record<string, unknown> | null | undefined;
        const mappedUser = cu ? await mapUserResponse(cu, this.mediaService) : null;
        return {
          userId: (c.userId ?? c.user_id) as string,
          contactUserId: (c.contactUserId ?? c.contact_user_id) as string,
          customName: ((c.nickname ?? c.customName) as string | undefined)?.trim() || null,
          isBlocked: Boolean(c.isBlocked ?? c.is_blocked),
          contactUser: mappedUser,
        };
      }),
    );
    return { contacts };
  }

  @Post('me/contacts')
  async addContact(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(AddContactDto)) body: AddContactDto,
  ) {
    const nickname = [body.firstName, body.lastName].filter(Boolean).join(' ').trim() || undefined;
    const raw = (await firstValueFrom(
      this.userService.AddContact({
        userId: user.userId,
        contactUserId: body.userId,
        nickname,
      }),
    )) as Record<string, unknown>;
    const u = (raw.user ?? raw.contact_user) as Record<string, unknown> | undefined;
    const mapped = u ? await mapUserResponse(u, this.mediaService) : null;
    return {
      userId: raw.userId ?? raw.user_id,
      contactUserId: raw.contactUserId ?? raw.contact_user_id,
      nickname: raw.nickname ?? raw.customName,
      isBlocked: raw.isBlocked ?? raw.is_blocked,
      user: mapped,
      contactUser: mapped,
      addedAt: raw.addedAt ?? raw.added_at,
    };
  }

  @Patch('me/contacts/:userId')
  updateContact(
    @CurrentUser() user: RequestUser,
    @Param('userId') targetUserId: string,
    @Body(new ZodValidationPipe(UpdateContactDto)) body: UpdateContactDto,
  ) {
    const nickname =
      body.nickname !== undefined
        ? body.nickname.trim()
        : [body.firstName, body.lastName].filter(Boolean).join(' ').trim();
    return firstValueFrom(
      this.userService.UpdateContact({
        userId: user.userId,
        contactUserId: targetUserId,
        nickname,
      }),
    );
  }

  @Delete('me/contacts/:userId')
  removeContact(@CurrentUser() user: RequestUser, @Param('userId') targetUserId: string) {
    return firstValueFrom(
      this.userService.RemoveContact({ userId: user.userId, contactUserId: targetUserId }),
    );
  }

  @Post('me/block/:userId')
  blockUser(@CurrentUser() user: RequestUser, @Param('userId') targetUserId: string) {
    return firstValueFrom(
      this.userService.BlockUser({ userId: user.userId, blockedUserId: targetUserId }),
    );
  }

  @Delete('me/block/:userId')
  unblockUser(@CurrentUser() user: RequestUser, @Param('userId') targetUserId: string) {
    return firstValueFrom(
      this.userService.UnblockUser({ userId: user.userId, blockedUserId: targetUserId }),
    );
  }

  @Get('me/privacy')
  getPrivacy(@CurrentUser() user: RequestUser) {
    return firstValueFrom(this.userService.GetPrivacy({ userId: user.userId }));
  }

  @Patch('me/privacy')
  updatePrivacy(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(UpdatePrivacyDto)) body: UpdatePrivacyDto) {
    const L: Record<string, number> = { everyone: 1, contacts: 2, nobody: 3 };
    const toLevel = (v?: string) => (v && L[v] !== undefined ? L[v] : undefined);
    return firstValueFrom(
      this.userService.UpdatePrivacy({
        userId: user.userId,
        settings: {
          lastSeen: toLevel(body.lastSeen),
          profilePhoto: toLevel(body.profilePhoto),
          about: toLevel(body.about),
          forwardedMessages: toLevel(body.forwardedMessages),
          groups: toLevel(body.groups),
          calls: toLevel(body.calls),
          readReceipts: body.readReceipts,
        },
      } as any),
    );
  }

  @Get('profile/:userId')
  async getUserById(@CurrentUser() viewer: RequestUser, @Param('userId') userId: string) {
    const id = String(userId ?? '').trim();
    if (!id) {
      throw new BadRequestException('Invalid user id');
    }
    const viewerId = (viewer?.userId ?? '').trim();
    const userData = await firstValueFrom(
      this.userService.GetUser({
        userId: id,
        viewerUserId: viewerId || undefined,
      }),
    );
    return mapUserResponse(userData, this.mediaService);
  }

  @Get(':username')
  async getUserByUsername(@Param('username') username: string) {
    const userData = await firstValueFrom(this.userService.GetUserByUsername({ username }));
    return mapUserResponse(userData, this.mediaService);
  }
}
