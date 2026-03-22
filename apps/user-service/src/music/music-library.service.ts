import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { eq, and, or, asc, desc, sql, max, ilike } from 'drizzle-orm';
import {
  userMusicTracks,
  userMusicPlaylists,
  userMusicPlaylistTracks,
  users,
} from '@aluf/db';
import type { DrizzleDB } from '../providers/database.provider';
import { DATABASE_TOKEN } from '../providers/database.provider';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  MUSIC_MAX_UPLOAD_BYTES,
  MUSIC_LIBRARY_AUDIO_MIME_TYPES,
  SUPPORTED_IMAGE_TYPES,
} from '@aluf/shared';

type TrackSortField = 'TRACK_SORT_FIELD_UNSPECIFIED' | 'TRACK_SORT_FIELD_TITLE' | 'TRACK_SORT_FIELD_ARTIST' | 'TRACK_SORT_FIELD_CREATED_AT';

interface MediaGrpc {
  GetFile(req: { fileId: string }): import('rxjs').Observable<Record<string, unknown>>;
  DeleteFile(req: { fileId: string; deleterId: string }): import('rxjs').Observable<unknown>;
}

function toGrpcTimestamp(date: Date): { seconds: number; nanos: number } {
  const ms = date.getTime();
  return {
    seconds: Math.floor(ms / 1000),
    nanos: (ms % 1000) * 1_000_000,
  };
}

function isAudioMime(m: string): boolean {
  const mLower = m.toLowerCase();
  return (MUSIC_LIBRARY_AUDIO_MIME_TYPES as readonly string[]).includes(mLower);
}

function isImageMime(m: string): boolean {
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(m.toLowerCase());
}

/** Экранирование % и _ для ILIKE */
function escapeIlikePattern(fragment: string): string {
  return fragment.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

@Injectable()
export class MusicLibraryService implements OnModuleInit {
  private media!: MediaGrpc;

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
    @Inject('MEDIA_SERVICE_PACKAGE') private readonly mediaClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.media = this.mediaClient.getService<MediaGrpc>('MediaService');
  }

  private async getMediaRow(fileId: string) {
    const raw = await firstValueFrom(this.media.GetFile({ fileId }));
    return raw as {
      uploaderId?: string;
      uploader_id?: string;
      mimeType?: string;
      mime_type?: string;
      fileSize?: string;
      file_size?: string;
    };
  }

  private async assertAudioOwned(userId: string, mediaId: string) {
    const f = await this.getMediaRow(mediaId);
    const uid = (f.uploaderId ?? f.uploader_id ?? '').trim();
    if (uid !== userId) throw new ForbiddenError('Not your media file');
    const mime = (f.mimeType ?? f.mime_type ?? '').trim();
    if (!isAudioMime(mime)) {
      throw new BadRequestError('Файл не является поддерживаемым аудио');
    }
    const size = BigInt(f.fileSize ?? f.file_size ?? '0');
    if (size > BigInt(MUSIC_MAX_UPLOAD_BYTES)) {
      throw new BadRequestError(`Аудио не больше ${MUSIC_MAX_UPLOAD_BYTES / (1024 * 1024)} МБ`);
    }
  }

  private async assertImageOwned(userId: string, mediaId: string) {
    const f = await this.getMediaRow(mediaId);
    const uid = (f.uploaderId ?? f.uploader_id ?? '').trim();
    if (uid !== userId) throw new ForbiddenError('Not your media file');
    const mime = (f.mimeType ?? f.mime_type ?? '').trim();
    if (!isImageMime(mime)) {
      throw new BadRequestError('Обложка должна быть изображением');
    }
  }

  private async deleteMediaFile(userId: string, fileId: string) {
    await firstValueFrom(this.media.DeleteFile({ fileId, deleterId: userId }));
  }

  async listTracks(
    userId: string,
    sortBy: TrackSortField,
    sortDesc: boolean,
    searchQuery?: string,
  ) {
    const col =
      sortBy === 'TRACK_SORT_FIELD_TITLE'
        ? userMusicTracks.title
        : sortBy === 'TRACK_SORT_FIELD_ARTIST'
          ? userMusicTracks.artist
          : userMusicTracks.createdAt;
    const orderFn = sortDesc ? desc : asc;
    const q = (searchQuery ?? '').trim();
    const whereClause =
      q.length > 0
        ? and(
            eq(userMusicTracks.userId, userId),
            or(
              ilike(userMusicTracks.title, `%${escapeIlikePattern(q)}%`),
              ilike(userMusicTracks.artist, `%${escapeIlikePattern(q)}%`),
              ilike(userMusicTracks.genre, `%${escapeIlikePattern(q)}%`),
            ),
          )
        : eq(userMusicTracks.userId, userId);
    const rows = await this.db
      .select()
      .from(userMusicTracks)
      .where(whereClause)
      .orderBy(orderFn(col));

    return rows.map((r) => this.trackRowToResponse(r));
  }

  /** Поля в camelCase — gRPC (keepCase: false) иначе не мапит snake_case из JS-объекта в proto. */
  private trackRowToResponse(
    r: typeof userMusicTracks.$inferSelect,
    extra?: { ownerUsername?: string },
  ) {
    const out: Record<string, unknown> = {
      id: r.id,
      userId: r.userId,
      title: r.title,
      artist: r.artist,
      genre: r.genre,
      audioMediaId: r.audioMediaId,
      createdAt: toGrpcTimestamp(r.createdAt),
      isPublic: r.isPublic,
    };
    if (r.coverMediaId) out.coverMediaId = r.coverMediaId;
    if (extra?.ownerUsername) out.ownerUsername = extra.ownerUsername;
    return out;
  }

  async getTrack(userId: string, trackId: string) {
    const [row] = await this.db
      .select()
      .from(userMusicTracks)
      .where(and(eq(userMusicTracks.id, trackId), eq(userMusicTracks.userId, userId)));
    if (!row) throw new NotFoundError('Track', trackId);
    return this.trackRowToResponse(row);
  }

  async createTrack(
    userId: string,
    title: string,
    artist: string,
    genre: string,
    audioMediaId: string,
    coverMediaId?: string,
    isPublic = false,
  ) {
    const t = title.trim();
    const a = artist.trim();
    if (!t || !a) throw new BadRequestError('Название и исполнитель обязательны');

    await this.assertAudioOwned(userId, audioMediaId);
    if (coverMediaId) {
      await this.assertImageOwned(userId, coverMediaId);
    }

    const [row] = await this.db
      .insert(userMusicTracks)
      .values({
        userId,
        title: t,
        artist: a,
        genre: (genre ?? '').trim(),
        audioMediaId,
        coverMediaId: coverMediaId ?? null,
        isPublic: Boolean(isPublic),
      })
      .returning();

    if (!row) throw new BadRequestError('Не удалось создать трек');
    return this.trackRowToResponse(row);
  }

  async updateTrack(userId: string, trackId: string, isPublic: boolean) {
    const [row] = await this.db
      .select()
      .from(userMusicTracks)
      .where(and(eq(userMusicTracks.id, trackId), eq(userMusicTracks.userId, userId)));
    if (!row) throw new NotFoundError('Track', trackId);

    const [updated] = await this.db
      .update(userMusicTracks)
      .set({ isPublic })
      .where(eq(userMusicTracks.id, trackId))
      .returning();

    if (!updated) throw new NotFoundError('Track', trackId);
    return this.trackRowToResponse(updated);
  }

  /** Публичные треки (каталог). viewerUserId зарезервирован под будущие исключения / лимиты. */
  async searchPublicTracks(_viewerUserId: string, query: string, limitIn: number) {
    const q = (query ?? '').trim();
    const limit = Math.min(100, Math.max(1, Number.isFinite(limitIn) ? limitIn : 30));
    if (!q.length) {
      return [];
    }
    const pattern = `%${escapeIlikePattern(q)}%`;
    const rows = await this.db
      .select({
        track: userMusicTracks,
        ownerUsername: users.username,
      })
      .from(userMusicTracks)
      .innerJoin(users, eq(userMusicTracks.userId, users.id))
      .where(
        and(
          eq(userMusicTracks.isPublic, true),
          or(
            ilike(userMusicTracks.title, pattern),
            ilike(userMusicTracks.artist, pattern),
            ilike(userMusicTracks.genre, pattern),
          ),
        ),
      )
      .orderBy(desc(userMusicTracks.createdAt))
      .limit(limit);

    return rows.map((r) =>
      this.trackRowToResponse(r.track, { ownerUsername: r.ownerUsername }),
    );
  }

  async deleteTrack(userId: string, trackId: string) {
    const [row] = await this.db
      .select()
      .from(userMusicTracks)
      .where(and(eq(userMusicTracks.id, trackId), eq(userMusicTracks.userId, userId)));
    if (!row) throw new NotFoundError('Track', trackId);

    await this.db
      .delete(userMusicPlaylistTracks)
      .where(eq(userMusicPlaylistTracks.trackId, trackId));

    await this.db.delete(userMusicTracks).where(eq(userMusicTracks.id, trackId));

    try {
      await this.deleteMediaFile(userId, row.audioMediaId);
    } catch {
      /* ignore */
    }
    if (row.coverMediaId) {
      try {
        await this.deleteMediaFile(userId, row.coverMediaId);
      } catch {
        /* ignore */
      }
    }
  }

  async listPlaylists(userId: string, searchQuery?: string) {
    const q = (searchQuery ?? '').trim();
    const whereClause =
      q.length > 0
        ? and(
            eq(userMusicPlaylists.userId, userId),
            or(
              ilike(userMusicPlaylists.name, `%${escapeIlikePattern(q)}%`),
              ilike(userMusicPlaylists.description, `%${escapeIlikePattern(q)}%`),
            ),
          )
        : eq(userMusicPlaylists.userId, userId);
    const playlists = await this.db
      .select()
      .from(userMusicPlaylists)
      .where(whereClause)
      .orderBy(desc(userMusicPlaylists.createdAt));

    const counts = await this.db
      .select({
        playlistId: userMusicPlaylistTracks.playlistId,
        c: sql<number>`count(*)::int`.mapWith(Number),
      })
      .from(userMusicPlaylistTracks)
      .groupBy(userMusicPlaylistTracks.playlistId);

    const countMap = new Map(counts.map((x) => [x.playlistId, x.c]));

    return playlists.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.name,
      description: p.description,
      coverMediaId: p.coverMediaId,
      trackCount: countMap.get(p.id) ?? 0,
      createdAt: toGrpcTimestamp(p.createdAt),
    }));
  }

  async getPlaylist(userId: string, playlistId: string) {
    const [pl] = await this.db
      .select()
      .from(userMusicPlaylists)
      .where(and(eq(userMusicPlaylists.id, playlistId), eq(userMusicPlaylists.userId, userId)));
    if (!pl) throw new NotFoundError('Playlist', playlistId);

    const countRows = await this.db
      .select({ c: sql<number>`count(*)::int`.mapWith(Number) })
      .from(userMusicPlaylistTracks)
      .where(eq(userMusicPlaylistTracks.playlistId, playlistId));
    const trackCount = countRows[0]?.c ?? 0;

    const summary = {
      id: pl.id,
      userId: pl.userId,
      name: pl.name,
      description: pl.description,
      coverMediaId: pl.coverMediaId,
      trackCount,
      createdAt: toGrpcTimestamp(pl.createdAt),
    };

    const entries = await this.db
      .select({
        position: userMusicPlaylistTracks.position,
        track: userMusicTracks,
      })
      .from(userMusicPlaylistTracks)
      .innerJoin(userMusicTracks, eq(userMusicPlaylistTracks.trackId, userMusicTracks.id))
      .where(eq(userMusicPlaylistTracks.playlistId, playlistId))
      .orderBy(asc(userMusicPlaylistTracks.position), asc(userMusicTracks.title));

    return {
      summary,
      entries: entries.map((e) => ({
        track: this.trackRowToResponse(e.track),
        position: e.position,
      })),
    };
  }

  async createPlaylist(
    userId: string,
    name: string,
    description: string,
    coverMediaId: string,
  ) {
    const n = name.trim();
    if (!n) throw new BadRequestError('Название плейлиста обязательно');
    await this.assertImageOwned(userId, coverMediaId);

    const [row] = await this.db
      .insert(userMusicPlaylists)
      .values({
        userId,
        name: n,
        description: (description ?? '').trim(),
        coverMediaId,
      })
      .returning();

    if (!row) throw new BadRequestError('Не удалось создать плейлист');

    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description,
      coverMediaId: row.coverMediaId,
      trackCount: 0,
      createdAt: toGrpcTimestamp(row.createdAt),
    };
  }

  async updatePlaylist(
    userId: string,
    playlistId: string,
    name?: string,
    description?: string,
    coverMediaId?: string,
  ) {
    const [pl] = await this.db
      .select()
      .from(userMusicPlaylists)
      .where(and(eq(userMusicPlaylists.id, playlistId), eq(userMusicPlaylists.userId, userId)));
    if (!pl) throw new NotFoundError('Playlist', playlistId);

    if (coverMediaId && coverMediaId !== pl.coverMediaId) {
      await this.assertImageOwned(userId, coverMediaId);
    }

    const patch: Partial<typeof userMusicPlaylists.$inferInsert> = {};
    if (name !== undefined) patch.name = name.trim() || pl.name;
    if (description !== undefined) patch.description = description.trim();
    if (coverMediaId !== undefined) patch.coverMediaId = coverMediaId;

    if (Object.keys(patch).length === 0) {
      const countRows = await this.db
        .select({ c: sql<number>`count(*)::int`.mapWith(Number) })
        .from(userMusicPlaylistTracks)
        .where(eq(userMusicPlaylistTracks.playlistId, playlistId));
      return {
        id: pl.id,
        userId: pl.userId,
        name: pl.name,
        description: pl.description,
        coverMediaId: pl.coverMediaId,
        trackCount: countRows[0]?.c ?? 0,
        createdAt: toGrpcTimestamp(pl.createdAt),
      };
    }

    const oldCover = pl.coverMediaId;
    const [row] = await this.db
      .update(userMusicPlaylists)
      .set(patch)
      .where(eq(userMusicPlaylists.id, playlistId))
      .returning();

    if (!row) throw new NotFoundError('Playlist', playlistId);

    if (coverMediaId && coverMediaId !== oldCover && oldCover) {
      try {
        await this.deleteMediaFile(userId, oldCover);
      } catch {
        /* ignore */
      }
    }

    const countRows = await this.db
      .select({ c: sql<number>`count(*)::int`.mapWith(Number) })
      .from(userMusicPlaylistTracks)
      .where(eq(userMusicPlaylistTracks.playlistId, playlistId));

    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description,
      coverMediaId: row.coverMediaId,
      trackCount: countRows[0]?.c ?? 0,
      createdAt: toGrpcTimestamp(row.createdAt),
    };
  }

  async deletePlaylist(userId: string, playlistId: string) {
    const [pl] = await this.db
      .select()
      .from(userMusicPlaylists)
      .where(and(eq(userMusicPlaylists.id, playlistId), eq(userMusicPlaylists.userId, userId)));
    if (!pl) throw new NotFoundError('Playlist', playlistId);

    await this.db.delete(userMusicPlaylists).where(eq(userMusicPlaylists.id, playlistId));

    try {
      await this.deleteMediaFile(userId, pl.coverMediaId);
    } catch {
      /* ignore */
    }
  }

  async addTrackToPlaylist(
    userId: string,
    playlistId: string,
    trackId: string,
    position?: number,
  ) {
    const [pl] = await this.db
      .select()
      .from(userMusicPlaylists)
      .where(and(eq(userMusicPlaylists.id, playlistId), eq(userMusicPlaylists.userId, userId)));
    if (!pl) throw new NotFoundError('Playlist', playlistId);

    const [tr] = await this.db
      .select()
      .from(userMusicTracks)
      .where(and(eq(userMusicTracks.id, trackId), eq(userMusicTracks.userId, userId)));
    if (!tr) throw new NotFoundError('Track', trackId);

    const existing = await this.db
      .select()
      .from(userMusicPlaylistTracks)
      .where(
        and(
          eq(userMusicPlaylistTracks.playlistId, playlistId),
          eq(userMusicPlaylistTracks.trackId, trackId),
        ),
      );
    if (existing.length) {
      throw new BadRequestError('Трек уже в плейлисте');
    }

    let pos = position;
    if (pos === undefined || pos < 0) {
      const [mx] = await this.db
        .select({ m: max(userMusicPlaylistTracks.position) })
        .from(userMusicPlaylistTracks)
        .where(eq(userMusicPlaylistTracks.playlistId, playlistId));
      const prev = mx?.m;
      pos = (typeof prev === 'number' ? prev : prev != null ? Number(prev) : -1) + 1;
    }

    await this.db.insert(userMusicPlaylistTracks).values({
      playlistId,
      trackId,
      position: pos ?? 0,
    });
  }

  async removeTrackFromPlaylist(userId: string, playlistId: string, trackId: string) {
    const [pl] = await this.db
      .select()
      .from(userMusicPlaylists)
      .where(and(eq(userMusicPlaylists.id, playlistId), eq(userMusicPlaylists.userId, userId)));
    if (!pl) throw new NotFoundError('Playlist', playlistId);

    const del = await this.db
      .delete(userMusicPlaylistTracks)
      .where(
        and(
          eq(userMusicPlaylistTracks.playlistId, playlistId),
          eq(userMusicPlaylistTracks.trackId, trackId),
        ),
      )
      .returning();
    if (!del.length) throw new NotFoundError('Playlist entry', `${playlistId}/${trackId}`);
  }

  async reorderPlaylist(userId: string, playlistId: string, trackIdsInOrder: string[]) {
    const [pl] = await this.db
      .select()
      .from(userMusicPlaylists)
      .where(and(eq(userMusicPlaylists.id, playlistId), eq(userMusicPlaylists.userId, userId)));
    if (!pl) throw new NotFoundError('Playlist', playlistId);

    const current = await this.db
      .select({ trackId: userMusicPlaylistTracks.trackId })
      .from(userMusicPlaylistTracks)
      .where(eq(userMusicPlaylistTracks.playlistId, playlistId));
    const set = new Set(current.map((c) => c.trackId));
    if (trackIdsInOrder.length !== set.size || trackIdsInOrder.some((id) => !set.has(id))) {
      throw new BadRequestError('Список треков должен совпадать с плейлистом');
    }

    let i = 0;
    for (const tid of trackIdsInOrder) {
      await this.db
        .update(userMusicPlaylistTracks)
        .set({ position: i++ })
        .where(
          and(
            eq(userMusicPlaylistTracks.playlistId, playlistId),
            eq(userMusicPlaylistTracks.trackId, tid),
          ),
        );
    }
  }
}
