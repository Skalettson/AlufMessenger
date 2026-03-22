'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, Shuffle, Trash2, Loader2, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUiStore } from '@/stores/ui-store';
import { useMusicPlayerStore } from '@/stores/music-player-store';
import { getErrorMessage } from '@/lib/api';
import {
  fetchPlaylist,
  removeTrackFromPlaylist,
  deletePlaylist,
} from '@/lib/music-api';
import { MediaCoverThumb } from '@/components/music/media-cover-thumb';
import type { MusicTrack, PlaylistSummary } from '@/types/music';

export default function PlaylistDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const setQueue = useMusicPlayerStore((s) => s.setQueue);
  const playTrack = useMusicPlayerStore((s) => s.playTrack);

  const [summary, setSummary] = useState<PlaylistSummary | null>(null);
  const [entries, setEntries] = useState<{ position: number; track: MusicTrack }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setErr(null);
    setLoading(true);
    try {
      const res = await fetchPlaylist(id);
      setSummary(res.summary);
      setEntries(res.entries ?? []);
    } catch (e) {
      setErr(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const tracks = entries.map((e) => e.track);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-14 flex-shrink-0 items-center gap-2 border-b border-border px-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="Меню"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => router.push('/music')} aria-label="Назад">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <MediaCoverThumb
            mediaId={summary?.coverMediaId}
            className="h-10 w-10 flex-shrink-0 rounded-lg"
            alt=""
          />
          <h1 className="text-lg font-semibold truncate">{summary?.name ?? '…'}</h1>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!tracks.length}
          onClick={() => setQueue(tracks, 0, false)}
        >
          <Play className="h-4 w-4 mr-1" />
          Все
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={tracks.length < 2}
          onClick={() => setQueue(tracks, 0, true)}
        >
          <Shuffle className="h-4 w-4 mr-1" />
          Shuffle
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive"
          onClick={async () => {
            if (!confirm('Удалить плейлист?')) return;
            try {
              await deletePlaylist(id);
              router.push('/music');
            } catch (e) {
              alert(getErrorMessage(e));
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </header>

      {summary?.description ? (
        <p className="px-4 py-2 text-sm text-muted-foreground border-b border-border">{summary.description}</p>
      ) : null}

      {err && <p className="px-4 py-2 text-sm text-destructive">{err}</p>}

      {loading ? (
        <div className="flex flex-1 justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ScrollArea className="flex-1 px-4 pb-4">
          <ul className="space-y-2 pr-3 pt-2">
            {entries.map((e) => (
              <li
                key={e.track.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-3"
              >
                <button
                  type="button"
                  className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted"
                  onClick={() => playTrack(e.track, { queue: tracks })}
                >
                  <MediaCoverThumb
                    mediaId={e.track.coverMediaId}
                    className="absolute inset-0 h-full w-full"
                    alt=""
                  />
                  <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 shadow-sm backdrop-blur-sm">
                    <Play className="h-3.5 w-3.5 text-primary" />
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{e.track.title}</p>
                  <p className="text-sm text-muted-foreground truncate">{e.track.artist}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    try {
                      await removeTrackFromPlaylist(id, e.track.id);
                      await load();
                    } catch (err) {
                      alert(getErrorMessage(err));
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
            {!entries.length && (
              <p className="text-center text-muted-foreground py-8">Нет треков в плейлисте</p>
            )}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
