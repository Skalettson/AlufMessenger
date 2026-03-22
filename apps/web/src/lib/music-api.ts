import { api } from './api';
import type { MusicTrack, PlaylistEntry, PlaylistSummary } from '@/types/music';

export function normalizeMusicTrack(raw: Record<string, unknown>): MusicTrack {
  const audio =
    (raw.audioMediaId ?? raw.audio_media_id ?? raw.audioMediaID ?? '') as string | undefined;
  const cover =
    (raw.coverMediaId ?? raw.cover_media_id ?? raw.coverMediaID ?? null) as string | null | undefined;
  const isPublicRaw = raw.isPublic ?? raw.is_public;
  const ownerUsernameRaw = raw.ownerUsername ?? raw.owner_username;
  return {
    id: String(raw.id ?? ''),
    userId: raw.userId != null ? String(raw.userId) : raw.user_id != null ? String(raw.user_id) : undefined,
    title: String(raw.title ?? ''),
    artist: String(raw.artist ?? ''),
    genre: String(raw.genre ?? ''),
    audioMediaId: String(audio ?? '').trim(),
    coverMediaId: cover != null && String(cover).trim() ? String(cover).trim() : null,
    createdAt: raw.createdAt != null ? String(raw.createdAt) : undefined,
    ...(typeof isPublicRaw === 'boolean' ? { isPublic: isPublicRaw } : {}),
    ...(ownerUsernameRaw != null && String(ownerUsernameRaw).trim()
      ? { ownerUsername: String(ownerUsernameRaw).trim() }
      : {}),
  };
}

export async function fetchTracks(
  sortBy: 'title' | 'artist' | 'createdAt' = 'createdAt',
  sortDesc = false,
  search?: string,
) {
  const q = new URLSearchParams({ sortBy, sortDesc: String(sortDesc) });
  const s = (search ?? '').trim();
  if (s) q.set('q', s);
  const res = await api.get<{ tracks: unknown[] }>(`/music/tracks?${q.toString()}`);
  const tracks = (res.tracks ?? []).map((t) => normalizeMusicTrack(t as Record<string, unknown>));
  return { tracks };
}

export async function createTrack(body: {
  title: string;
  artist: string;
  genre?: string;
  audioMediaId: string;
  coverMediaId?: string;
  isPublic?: boolean;
}) {
  const res = await api.post<unknown>('/music/tracks', body);
  return normalizeMusicTrack(res as Record<string, unknown>);
}

export async function updateTrackVisibility(trackId: string, isPublic: boolean) {
  const res = await api.patch<unknown>(`/music/tracks/${trackId}`, { isPublic });
  return normalizeMusicTrack(res as Record<string, unknown>);
}

/** Глобальный каталог (публичные треки всех пользователей) */
export async function fetchPublicTracks(search: string, limit = 30) {
  const q = (search ?? '').trim();
  if (!q) return { tracks: [] as MusicTrack[] };
  const res = await api.get<{ tracks: unknown[] }>(
    `/music/tracks/explore?q=${encodeURIComponent(q)}&limit=${limit}`,
  );
  const tracks = (res.tracks ?? []).map((t) => normalizeMusicTrack(t as Record<string, unknown>));
  return { tracks };
}

export async function deleteTrack(id: string) {
  return api.delete<{ ok: boolean }>(`/music/tracks/${id}`);
}

export async function fetchPlaylists(search?: string) {
  const q = (search ?? '').trim();
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  const res = await api.get<{ playlists: unknown[] }>(`/music/playlists${qs}`);
  const playlists = (res.playlists ?? []).map((p) => {
    const o = p as Record<string, unknown>;
    return {
      id: String(o.id ?? ''),
      userId: o.userId != null ? String(o.userId) : o.user_id != null ? String(o.user_id) : undefined,
      name: String(o.name ?? ''),
      description: String(o.description ?? ''),
      coverMediaId: String(o.coverMediaId ?? o.cover_media_id ?? ''),
      trackCount: Number(o.trackCount ?? o.track_count ?? 0),
      createdAt: o.createdAt != null ? String(o.createdAt) : undefined,
    } satisfies PlaylistSummary;
  });
  return { playlists };
}

export async function fetchPlaylist(id: string) {
  const res = await api.get<{ summary: unknown; entries: unknown[] }>(`/music/playlists/${id}`);
  const summary = res.summary as Record<string, unknown>;
  const entries = (res.entries ?? []).map((e) => {
    const row = e as { position?: number; track?: unknown };
    return {
      position: Number(row.position ?? 0),
      track: normalizeMusicTrack((row.track ?? {}) as Record<string, unknown>),
    };
  });
  return {
    summary: {
      id: String(summary.id ?? ''),
      userId:
        summary.userId != null
          ? String(summary.userId)
          : summary.user_id != null
            ? String(summary.user_id)
            : undefined,
      name: String(summary.name ?? ''),
      description: String(summary.description ?? ''),
      coverMediaId: String(summary.coverMediaId ?? summary.cover_media_id ?? ''),
      trackCount: Number(summary.trackCount ?? summary.track_count ?? 0),
      createdAt: summary.createdAt != null ? String(summary.createdAt) : undefined,
    } satisfies PlaylistSummary,
    entries,
  };
}

export async function createPlaylist(body: { name: string; description?: string; coverMediaId: string }) {
  return api.post<PlaylistSummary>('/music/playlists', body);
}

export async function updatePlaylist(
  id: string,
  body: { name?: string; description?: string; coverMediaId?: string },
) {
  return api.patch<PlaylistSummary>(`/music/playlists/${id}`, body);
}

export async function deletePlaylist(id: string) {
  return api.delete<{ ok: boolean }>(`/music/playlists/${id}`);
}

export async function addTrackToPlaylist(playlistId: string, trackId: string, position?: number) {
  return api.post<{ ok: boolean }>(`/music/playlists/${playlistId}/tracks`, { trackId, position });
}

export async function removeTrackFromPlaylist(playlistId: string, trackId: string) {
  return api.delete<{ ok: boolean }>(`/music/playlists/${playlistId}/tracks/${trackId}`);
}

export async function reorderPlaylist(playlistId: string, trackIds: string[]) {
  return api.post<{ ok: boolean }>(`/music/playlists/${playlistId}/reorder`, { trackIds });
}

/**
 * Воспроизведение и обложки — через `useMediaUrl` (`/api/media/:id/stream?token=…`).
 */
