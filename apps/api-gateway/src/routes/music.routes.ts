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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, type Observable } from 'rxjs';
import { CurrentUser } from '../decorators/public.decorator';
import type { RequestUser } from '../decorators/public.decorator';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import {
  CreateMusicTrackDto,
  UpdateMusicTrackDto,
  CreatePlaylistDto,
  UpdatePlaylistDto,
  AddTrackToPlaylistDto,
  ReorderPlaylistDto,
} from '../dto/music.dto';

interface MusicLibraryGrpc {
  ListTracks(req: Record<string, unknown>): Observable<unknown>;
  GetTrack(req: Record<string, unknown>): Observable<unknown>;
  CreateTrack(req: Record<string, unknown>): Observable<unknown>;
  UpdateTrack(req: Record<string, unknown>): Observable<unknown>;
  SearchPublicTracks(req: Record<string, unknown>): Observable<unknown>;
  DeleteTrack(req: Record<string, unknown>): Observable<unknown>;
  ListPlaylists(req: Record<string, unknown>): Observable<unknown>;
  GetPlaylist(req: Record<string, unknown>): Observable<unknown>;
  CreatePlaylist(req: Record<string, unknown>): Observable<unknown>;
  UpdatePlaylist(req: Record<string, unknown>): Observable<unknown>;
  DeletePlaylist(req: Record<string, unknown>): Observable<unknown>;
  AddTrackToPlaylist(req: Record<string, unknown>): Observable<unknown>;
  RemoveTrackFromPlaylist(req: Record<string, unknown>): Observable<unknown>;
  ReorderPlaylist(req: Record<string, unknown>): Observable<unknown>;
}

function mapTrack(raw: Record<string, unknown>) {
  const created = raw.createdAt ?? raw.created_at;
  let createdIso: string | undefined;
  if (created && typeof created === 'object' && created !== null && 'seconds' in created) {
    const s = (created as { seconds: number }).seconds;
    createdIso = new Date(s * 1000).toISOString();
  }
  const audio = String(raw.audioMediaId ?? raw.audio_media_id ?? '').trim();
  const coverRaw = raw.coverMediaId ?? raw.cover_media_id;
  const cover =
    coverRaw != null && String(coverRaw).trim() ? String(coverRaw).trim() : null;
  const isPublicRaw = raw.isPublic ?? raw.is_public;
  const ownerUsernameRaw = raw.ownerUsername ?? raw.owner_username;
  return {
    id: raw.id,
    userId: raw.userId ?? raw.user_id,
    title: raw.title,
    artist: raw.artist,
    genre: raw.genre ?? '',
    audioMediaId: audio,
    coverMediaId: cover,
    createdAt: createdIso,
    ...(typeof isPublicRaw === 'boolean' ? { isPublic: isPublicRaw } : {}),
    ...(ownerUsernameRaw != null && String(ownerUsernameRaw).trim()
      ? { ownerUsername: String(ownerUsernameRaw).trim() }
      : {}),
  };
}

function mapPlaylistSummary(raw: Record<string, unknown>) {
  const created = raw.createdAt ?? raw.created_at;
  let createdIso: string | undefined;
  if (created && typeof created === 'object' && created !== null && 'seconds' in created) {
    const s = (created as { seconds: number }).seconds;
    createdIso = new Date(s * 1000).toISOString();
  }
  const coverRaw = raw.coverMediaId ?? raw.cover_media_id;
  const cover = coverRaw != null && String(coverRaw).trim() ? String(coverRaw).trim() : '';
  return {
    id: raw.id,
    userId: raw.userId ?? raw.user_id,
    name: raw.name,
    description: raw.description ?? '',
    coverMediaId: cover,
    trackCount: raw.trackCount ?? raw.track_count ?? 0,
    createdAt: createdIso,
  };
}

const SORT_MAP: Record<string, number> = {
  title: 1,
  artist: 2,
  createdAt: 3,
  created_at: 3,
};

@Controller('v1/music')
@ApiTags('Music')
@ApiBearerAuth()
export class MusicRoutesController implements OnModuleInit {
  private music!: MusicLibraryGrpc;

  constructor(@Inject('MUSIC_SERVICE_PACKAGE') private readonly musicClient: ClientGrpc) {}

  onModuleInit() {
    this.music = this.musicClient.getService<MusicLibraryGrpc>('MusicLibrary');
  }

  @Get('tracks')
  @ApiOperation({ summary: 'Список треков пользователя' })
  @ApiQuery({ name: 'q', required: false, description: 'Поиск по названию, исполнителю, жанру' })
  async listTracks(
    @CurrentUser() user: RequestUser,
    @Query('sortBy') sortBy?: string,
    @Query('sortDesc') sortDesc?: string,
    @Query('q') search?: string,
  ) {
    const uid = user.userId;
    const sortField = SORT_MAP[sortBy ?? 'createdAt'] ?? 3;
    const desc = sortDesc === 'true' || sortDesc === '1';
    const q = (search ?? '').trim();
    const res = (await firstValueFrom(
      this.music.ListTracks({
        userId: uid,
        sortBy: sortField,
        sortDesc: desc,
        ...(q ? { query: q } : {}),
      }),
    )) as { tracks?: unknown[] };
    const tracks = (res.tracks ?? []).map((t) => mapTrack(t as Record<string, unknown>));
    return { tracks };
  }

  @Get('tracks/explore')
  @ApiOperation({ summary: 'Поиск по публичному каталогу (глобально)' })
  @ApiQuery({ name: 'q', required: true, description: 'Строка поиска' })
  @ApiQuery({ name: 'limit', required: false })
  async explorePublicTracks(
    @CurrentUser() user: RequestUser,
    @Query('q') search: string,
    @Query('limit') limit?: string,
  ) {
    const q = (search ?? '').trim();
    if (!q) {
      return { tracks: [] };
    }
    const lim = limit != null ? Math.min(100, Math.max(1, Number(limit) || 30)) : 30;
    const res = (await firstValueFrom(
      this.music.SearchPublicTracks({
        viewerUserId: user.userId,
        query: q,
        limit: lim,
      }),
    )) as { tracks?: unknown[] };
    const tracks = (res.tracks ?? []).map((t) => mapTrack(t as Record<string, unknown>));
    return { tracks };
  }

  @Get('tracks/:id')
  @ApiOperation({ summary: 'Получить трек' })
  async getTrack(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const raw = (await firstValueFrom(
      this.music.GetTrack({ userId: user.userId, trackId: id }),
    )) as Record<string, unknown>;
    return mapTrack(raw);
  }

  @Post('tracks')
  @ApiOperation({ summary: 'Создать трек (после загрузки файлов в /media)' })
  async createTrack(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(CreateMusicTrackDto)) body: CreateMusicTrackDto,
  ) {
    const raw = (await firstValueFrom(
      this.music.CreateTrack({
        userId: user.userId,
        title: body.title,
        artist: body.artist,
        genre: body.genre ?? '',
        audioMediaId: body.audioMediaId,
        coverMediaId: body.coverMediaId,
        isPublic: body.isPublic ?? false,
      }),
    )) as Record<string, unknown>;
    return mapTrack(raw);
  }

  @Patch('tracks/:id')
  @ApiOperation({ summary: 'Обновить трек (видимость в каталоге)' })
  async updateTrack(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateMusicTrackDto)) body: UpdateMusicTrackDto,
  ) {
    const raw = (await firstValueFrom(
      this.music.UpdateTrack({
        userId: user.userId,
        trackId: id,
        isPublic: body.isPublic,
      }),
    )) as Record<string, unknown>;
    return mapTrack(raw);
  }

  @Delete('tracks/:id')
  @ApiOperation({ summary: 'Удалить трек' })
  async deleteTrack(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await firstValueFrom(this.music.DeleteTrack({ userId: user.userId, trackId: id }));
    return { ok: true };
  }

  @Get('playlists')
  @ApiOperation({ summary: 'Список плейлистов' })
  @ApiQuery({ name: 'q', required: false, description: 'Поиск по названию и описанию' })
  async listPlaylists(@CurrentUser() user: RequestUser, @Query('q') search?: string) {
    const q = (search ?? '').trim();
    const res = (await firstValueFrom(
      this.music.ListPlaylists({
        userId: user.userId,
        ...(q ? { query: q } : {}),
      }),
    )) as { playlists?: unknown[] };
    const playlists = (res.playlists ?? []).map((p) =>
      mapPlaylistSummary(p as Record<string, unknown>),
    );
    return { playlists };
  }

  @Get('playlists/:id')
  @ApiOperation({ summary: 'Плейлист с треками' })
  async getPlaylist(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const res = (await firstValueFrom(
      this.music.GetPlaylist({ userId: user.userId, playlistId: id }),
    )) as {
      summary?: Record<string, unknown>;
      entries?: { track?: Record<string, unknown>; position?: number }[];
    };
    const summary = mapPlaylistSummary((res.summary ?? {}) as Record<string, unknown>);
    const entries = (res.entries ?? []).map((e) => ({
      position: e.position ?? 0,
      track: mapTrack((e.track ?? {}) as Record<string, unknown>),
    }));
    return { summary, entries };
  }

  @Post('playlists')
  @ApiOperation({ summary: 'Создать плейлист' })
  async createPlaylist(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(CreatePlaylistDto)) body: CreatePlaylistDto,
  ) {
    const raw = (await firstValueFrom(
      this.music.CreatePlaylist({
        userId: user.userId,
        name: body.name,
        description: body.description ?? '',
        coverMediaId: body.coverMediaId,
      }),
    )) as Record<string, unknown>;
    return mapPlaylistSummary(raw);
  }

  @Patch('playlists/:id')
  @ApiOperation({ summary: 'Обновить плейлист' })
  async updatePlaylist(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePlaylistDto)) body: UpdatePlaylistDto,
  ) {
    const raw = (await firstValueFrom(
      this.music.UpdatePlaylist({
        userId: user.userId,
        playlistId: id,
        name: body.name,
        description: body.description,
        coverMediaId: body.coverMediaId,
      }),
    )) as Record<string, unknown>;
    return mapPlaylistSummary(raw);
  }

  @Delete('playlists/:id')
  @ApiOperation({ summary: 'Удалить плейлист' })
  async deletePlaylist(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await firstValueFrom(this.music.DeletePlaylist({ userId: user.userId, playlistId: id }));
    return { ok: true };
  }

  @Post('playlists/:id/tracks')
  @ApiOperation({ summary: 'Добавить трек в плейлист' })
  async addTrack(
    @CurrentUser() user: RequestUser,
    @Param('id') playlistId: string,
    @Body(new ZodValidationPipe(AddTrackToPlaylistDto)) body: AddTrackToPlaylistDto,
  ) {
    await firstValueFrom(
      this.music.AddTrackToPlaylist({
        userId: user.userId,
        playlistId,
        trackId: body.trackId,
        position: body.position,
      }),
    );
    return { ok: true };
  }

  @Delete('playlists/:playlistId/tracks/:trackId')
  @ApiOperation({ summary: 'Убрать трек из плейлиста' })
  async removeTrack(
    @CurrentUser() user: RequestUser,
    @Param('playlistId') playlistId: string,
    @Param('trackId') trackId: string,
  ) {
    await firstValueFrom(
      this.music.RemoveTrackFromPlaylist({
        userId: user.userId,
        playlistId,
        trackId,
      }),
    );
    return { ok: true };
  }

  @Post('playlists/:id/reorder')
  @ApiOperation({ summary: 'Изменить порядок треков' })
  async reorder(
    @CurrentUser() user: RequestUser,
    @Param('id') playlistId: string,
    @Body(new ZodValidationPipe(ReorderPlaylistDto)) body: ReorderPlaylistDto,
  ) {
    await firstValueFrom(
      this.music.ReorderPlaylist({
        userId: user.userId,
        playlistId,
        trackIdsInOrder: body.trackIds,
      }),
    );
    return { ok: true };
  }
}
