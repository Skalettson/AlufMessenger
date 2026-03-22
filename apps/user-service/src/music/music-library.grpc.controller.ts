import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import {
  AlufError,
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '@aluf/shared';
import { MusicLibraryService } from './music-library.service';

function toGrpcError(err: unknown): RpcException {
  if (err instanceof AlufError) {
    let code = GrpcStatus.INTERNAL;
    if (err instanceof BadRequestError) code = GrpcStatus.INVALID_ARGUMENT;
    else if (err instanceof NotFoundError) code = GrpcStatus.NOT_FOUND;
    else if (err instanceof ForbiddenError) code = GrpcStatus.PERMISSION_DENIED;
    else if (err instanceof ConflictError) code = GrpcStatus.ALREADY_EXISTS;

    return new RpcException({ code, message: (err as Error).message });
  }
  return new RpcException({
    code: GrpcStatus.INTERNAL,
    message: err instanceof Error ? err.message : 'Internal server error',
  });
}

@Controller()
export class MusicLibraryGrpcController {
  constructor(private readonly music: MusicLibraryService) {}

  @GrpcMethod('MusicLibrary', 'ListTracks')
  async listTracks(data: {
    userId?: string;
    user_id?: string;
    sortBy?: number | string;
    sort_by?: number | string;
    sortDesc?: boolean;
    sort_desc?: boolean;
    query?: string;
  }) {
    try {
      const userId = (data.userId ?? data.user_id ?? '').trim();
      const sortBy = Number(data.sortBy ?? data.sort_by ?? 0);
      const sortDesc = data.sortDesc ?? data.sort_desc ?? false;
      const searchQuery = (data.query ?? '').trim();
      const sortNames = [
        'TRACK_SORT_FIELD_UNSPECIFIED',
        'TRACK_SORT_FIELD_TITLE',
        'TRACK_SORT_FIELD_ARTIST',
        'TRACK_SORT_FIELD_CREATED_AT',
      ] as const;
      const sortName =
        sortBy === 0 || Number.isNaN(sortBy)
          ? 'TRACK_SORT_FIELD_CREATED_AT'
          : (sortNames[sortBy] ?? 'TRACK_SORT_FIELD_CREATED_AT');
      const tracks = await this.music.listTracks(userId, sortName, sortDesc, searchQuery);
      return { tracks };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MusicLibrary', 'GetTrack')
  async getTrack(data: { userId?: string; user_id?: string; trackId?: string; track_id?: string }) {
    try {
      const userId = (data.userId ?? data.user_id ?? '').trim();
      const trackId = (data.trackId ?? data.track_id ?? '').trim();
      return await this.music.getTrack(userId, trackId);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MusicLibrary', 'CreateTrack')
  async createTrack(data: {
    userId?: string;
    user_id?: string;
    title?: string;
    artist?: string;
    genre?: string;
    audioMediaId?: string;
    audio_media_id?: string;
    coverMediaId?: string;
    cover_media_id?: string;
    isPublic?: boolean;
    is_public?: boolean;
  }) {
    try {
      const userId = (data.userId ?? data.user_id ?? '').trim();
      const audioMediaId = (data.audioMediaId ?? data.audio_media_id ?? '').trim();
      const coverMediaId = (data.coverMediaId ?? data.cover_media_id ?? '').trim() || undefined;
      const isPublic = data.isPublic ?? data.is_public ?? false;
      return await this.music.createTrack(
        userId,
        data.title ?? '',
        data.artist ?? '',
        data.genre ?? '',
        audioMediaId,
        coverMediaId,
        Boolean(isPublic),
      );
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MusicLibrary', 'UpdateTrack')
  async updateTrack(data: {
    userId?: string;
    user_id?: string;
    trackId?: string;
    track_id?: string;
    isPublic?: boolean;
    is_public?: boolean;
  }) {
    try {
      const userId = (data.userId ?? data.user_id ?? '').trim();
      const trackId = (data.trackId ?? data.track_id ?? '').trim();
      const isPublic = data.isPublic ?? data.is_public;
      if (typeof isPublic !== 'boolean') {
        throw new BadRequestError('is_public обязателен');
      }
      return await this.music.updateTrack(userId, trackId, isPublic);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MusicLibrary', 'SearchPublicTracks')
  async searchPublicTracks(data: {
    viewerUserId?: string;
    viewer_user_id?: string;
    query?: string;
    limit?: number;
  }) {
    try {
      const viewerUserId = (data.viewerUserId ?? data.viewer_user_id ?? '').trim();
      const query = (data.query ?? '').trim();
      const limit = data.limit != null ? Number(data.limit) : 30;
      const tracks = await this.music.searchPublicTracks(viewerUserId, query, limit);
      return { tracks };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MusicLibrary', 'DeleteTrack')
  async deleteTrack(data: { userId?: string; user_id?: string; trackId?: string; track_id?: string }) {
    try {
      const userId = (data.userId ?? data.user_id ?? '').trim();
      const trackId = (data.trackId ?? data.track_id ?? '').trim();
      await this.music.deleteTrack(userId, trackId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MusicLibrary', 'ListPlaylists')
  async listPlaylists(data: { userId?: string; user_id?: string; query?: string }) {
    try {
      const userId = (data.userId ?? data.user_id ?? '').trim();
      const searchQuery = (data.query ?? '').trim();
      const playlists = await this.music.listPlaylists(userId, searchQuery);
      return { playlists };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MusicLibrary', 'GetPlaylist')
  async getPlaylist(data: {
    userId?: string;
    user_id?: string;
    playlistId?: string;
    playlist_id?: string;
  }) {
    try {
      const userId = (data.userId ?? data.user_id ?? '').trim();
      const playlistId = (data.playlistId ?? data.playlist_id ?? '').trim();
      return await this.music.getPlaylist(userId, playlistId);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MusicLibrary', 'CreatePlaylist')
  async createPlaylist(data: {
    userId?: string;
    user_id?: string;
    name?: string;
    description?: string;
    coverMediaId?: string;
    cover_media_id?: string;
  }) {
    try {
      const userId = (data.userId ?? data.user_id ?? '').trim();
      const coverMediaId = (data.coverMediaId ?? data.cover_media_id ?? '').trim();
      return await this.music.createPlaylist(
        userId,
        data.name ?? '',
        data.description ?? '',
        coverMediaId,
      );
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MusicLibrary', 'UpdatePlaylist')
  async updatePlaylist(data: {
    userId?: string;
    user_id?: string;
    playlistId?: string;
    playlist_id?: string;
    name?: string;
    description?: string;
    coverMediaId?: string;
    cover_media_id?: string;
  }) {
    try {
      const userId = (data.userId ?? data.user_id ?? '').trim();
      const playlistId = (data.playlistId ?? data.playlist_id ?? '').trim();
      const coverRaw = data.coverMediaId ?? data.cover_media_id;
      return await this.music.updatePlaylist(
        userId,
        playlistId,
        data.name,
        data.description,
        coverRaw !== undefined ? (coverRaw ?? '').trim() || undefined : undefined,
      );
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MusicLibrary', 'DeletePlaylist')
  async deletePlaylist(data: { userId?: string; user_id?: string; playlistId?: string; playlist_id?: string }) {
    try {
      const userId = (data.userId ?? data.user_id ?? '').trim();
      const playlistId = (data.playlistId ?? data.playlist_id ?? '').trim();
      await this.music.deletePlaylist(userId, playlistId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MusicLibrary', 'AddTrackToPlaylist')
  async addTrackToPlaylist(data: {
    userId?: string;
    user_id?: string;
    playlistId?: string;
    playlist_id?: string;
    trackId?: string;
    track_id?: string;
    position?: number;
  }) {
    try {
      const userId = (data.userId ?? data.user_id ?? '').trim();
      const playlistId = (data.playlistId ?? data.playlist_id ?? '').trim();
      const trackId = (data.trackId ?? data.track_id ?? '').trim();
      await this.music.addTrackToPlaylist(userId, playlistId, trackId, data.position);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MusicLibrary', 'RemoveTrackFromPlaylist')
  async removeTrackFromPlaylist(data: {
    userId?: string;
    user_id?: string;
    playlistId?: string;
    playlist_id?: string;
    trackId?: string;
    track_id?: string;
  }) {
    try {
      const userId = (data.userId ?? data.user_id ?? '').trim();
      const playlistId = (data.playlistId ?? data.playlist_id ?? '').trim();
      const trackId = (data.trackId ?? data.track_id ?? '').trim();
      await this.music.removeTrackFromPlaylist(userId, playlistId, trackId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MusicLibrary', 'ReorderPlaylist')
  async reorderPlaylist(data: {
    userId?: string;
    user_id?: string;
    playlistId?: string;
    playlist_id?: string;
    trackIdsInOrder?: string[];
    track_ids_in_order?: string[];
  }) {
    try {
      const userId = (data.userId ?? data.user_id ?? '').trim();
      const playlistId = (data.playlistId ?? data.playlist_id ?? '').trim();
      const order = data.trackIdsInOrder ?? data.track_ids_in_order ?? [];
      await this.music.reorderPlaylist(userId, playlistId, order);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }
}
