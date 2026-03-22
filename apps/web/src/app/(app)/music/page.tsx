'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Music,
  Plus,
  Play,
  Trash2,
  ListMusic,
  Loader2,
  ArrowUpDown,
  Upload,
  Menu,
  ArrowLeft,
  Globe2,
  Library,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUiStore } from '@/stores/ui-store';
import { useMusicPlayerStore } from '@/stores/music-player-store';
import { getErrorMessage } from '@/lib/api';
import {
  fetchTracks,
  fetchPlaylists,
  fetchPublicTracks,
  createTrack,
  deleteTrack,
  createPlaylist,
  addTrackToPlaylist,
  updateTrackVisibility,
} from '@/lib/music-api';
import { MediaCoverThumb } from '@/components/music/media-cover-thumb';
import { uploadFileWithAbort } from '@/lib/upload';
import { cn } from '@/lib/utils';
import type { MusicTrack, PlaylistSummary } from '@/types/music';

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const GENRE_SUGGESTIONS = [
  'Поп', 'Рок', 'Рэп', 'Хип-хоп', 'Электроника', 'Джаз', 'Классика', 'Другое',
];

export default function MusicPage() {
  const router = useRouter();
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const playTrack = useMusicPlayerStore((s) => s.playTrack);

  const [tab, setTab] = useState<'tracks' | 'playlists'>('tracks');
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [publicTracks, setPublicTracks] = useState<MusicTrack[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'createdAt'>('createdAt');
  const [sortDesc, setSortDesc] = useState(true);
  const [musicSearch, setMusicSearch] = useState('');
  const [debouncedMusicSearch, setDebouncedMusicSearch] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedMusicSearch(musicSearch.trim()), 350);
    return () => clearTimeout(t);
  }, [musicSearch]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [addPlOpen, setAddPlOpen] = useState(false);
  const [addPlTrackId, setAddPlTrackId] = useState<string | null>(null);
  const [createPlOpen, setCreatePlOpen] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const [tr, pl] = await Promise.all([
        fetchTracks(sortBy, sortDesc, debouncedMusicSearch),
        fetchPlaylists(debouncedMusicSearch),
      ]);
      setTracks(tr.tracks ?? []);
      setPlaylists(pl.playlists ?? []);
    } catch (e) {
      setErr(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortDesc, debouncedMusicSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const catalogQueue = useMemo(
    () => publicTracks.filter((t) => !tracks.some((m) => m.id === t.id)),
    [publicTracks, tracks],
  );

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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => router.push('/chat')}
          aria-label="К чату"
          title="К чату"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold flex items-center gap-2 min-w-0">
          <Music className="h-5 w-5 text-primary shrink-0" />
          <span className="truncate">Моя музыка</span>
        </h1>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'tracks' | 'playlists')} className="flex flex-1 min-h-0 flex-col">
        <div className="px-4 pt-3 shrink-0 space-y-3">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="tracks">Треки</TabsTrigger>
            <TabsTrigger value="playlists">Плейлисты</TabsTrigger>
          </TabsList>
          <div className="max-w-md">
            <Input
              type="search"
              placeholder="Поиск: моя библиотека и глобальный каталог…"
              value={musicSearch}
              onChange={(e) => setMusicSearch(e.target.value)}
              className="h-10"
              aria-label="Поиск музыки"
            />
          </div>
        </div>

        <TabsContent value="tracks" className="flex-1 min-h-0 overflow-hidden mt-0 px-4 pb-4">
          <div className="flex flex-wrap items-center gap-2 py-3">
            <Button type="button" onClick={() => setUploadOpen(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Загрузить трек
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowUpDown className="h-4 w-4" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="title">По названию</option>
                <option value="artist">По исполнителю</option>
                <option value="createdAt">По дате</option>
              </select>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sortDesc}
                  onChange={(e) => setSortDesc(e.target.checked)}
                />
                По убыванию
              </label>
            </div>
          </div>
          {err && <p className="text-sm text-destructive mb-2">{err}</p>}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[calc(100%-5rem)]">
              <div className="space-y-6 pr-3">
                <section>
                  <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Library className="h-4 w-4" />
                    Моя библиотека
                    <span className="ml-auto text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                      мои треки
                    </span>
                  </h2>
                  <ul className="space-y-2">
                    {tracks.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-3"
                      >
                        <button
                          type="button"
                          className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted"
                          onClick={() => playTrack(t, { queue: tracks })}
                          aria-label="Воспроизвести"
                        >
                          <MediaCoverThumb
                            mediaId={t.coverMediaId}
                            className="absolute inset-0 h-full w-full"
                            alt=""
                          />
                          <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 shadow-sm backdrop-blur-sm">
                            <Play className="h-4 w-4 text-primary" />
                          </span>
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{t.title}</p>
                          <p className="text-sm text-muted-foreground truncate">{t.artist}</p>
                          {t.genre ? (
                            <p className="text-xs text-muted-foreground mt-0.5">{t.genre}</p>
                          ) : null}
                          <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="rounded border-border"
                              checked={Boolean(t.isPublic)}
                              onChange={async (e) => {
                                try {
                                  await updateTrackVisibility(t.id, e.target.checked);
                                  await load();
                                } catch (err) {
                                  alert(getErrorMessage(err));
                                }
                              }}
                            />
                            В глобальном каталоге
                          </label>
                        </div>
                        <div className="flex flex-shrink-0 gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAddPlTrackId(t.id);
                              setAddPlOpen(true);
                            }}
                          >
                            <ListMusic className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={async () => {
                              if (!confirm('Удалить трек?')) return;
                              try {
                                await deleteTrack(t.id);
                                await load();
                              } catch (e) {
                                alert(getErrorMessage(e));
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                    {!tracks.length && (
                      <p className="text-center text-muted-foreground py-8">Нет треков. Загрузите первый.</p>
                    )}
                  </ul>
                </section>

                {debouncedMusicSearch ? (
                  <section>
                    <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <Globe2 className="h-4 w-4" />
                      Глобальный каталог
                      <span className="ml-auto text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        у всех
                      </span>
                    </h2>
                    <ul className="space-y-2">
                      {catalogQueue.map((t) => (
                        <li
                          key={`pub-${t.id}`}
                          className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3"
                        >
                          <button
                            type="button"
                            className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted"
                            onClick={() => playTrack(t, { queue: catalogQueue })}
                            aria-label="Воспроизвести"
                          >
                            <MediaCoverThumb
                              mediaId={t.coverMediaId}
                              className="absolute inset-0 h-full w-full"
                              alt=""
                            />
                            <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 shadow-sm backdrop-blur-sm">
                              <Play className="h-4 w-4 text-primary" />
                            </span>
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{t.title}</p>
                            <p className="text-sm text-muted-foreground truncate">{t.artist}</p>
                            {t.ownerUsername ? (
                              <p className="text-xs text-muted-foreground mt-0.5">@{t.ownerUsername}</p>
                            ) : null}
                          </div>
                        </li>
                      ))}
                      {!catalogQueue.length && (
                        <p className="text-sm text-muted-foreground py-4">
                          В каталоге ничего не найдено по запросу.
                        </p>
                      )}
                    </ul>
                  </section>
                ) : null}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="playlists" className="flex-1 min-h-0 overflow-hidden mt-0 px-4 pb-4">
          <div className="py-3">
            <Button type="button" onClick={() => setCreatePlOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Новый плейлист
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[calc(100%-4rem)]">
              <ul className="grid gap-3 sm:grid-cols-2 pr-3">
                {playlists.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => router.push(`/music/playlists/${p.id}`)}
                      className={cn(
                        'flex w-full gap-3 rounded-xl border border-border bg-card/50 p-4 text-left transition-colors',
                        'hover:bg-accent/50',
                      )}
                    >
                      <MediaCoverThumb
                        mediaId={p.coverMediaId}
                        className="h-16 w-16 flex-shrink-0 rounded-lg"
                        alt=""
                        iconClassName="h-7 w-7"
                      />
                      <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {p.trackCount} треков
                      </p>
                      </div>
                    </button>
                  </li>
                ))}
                {!playlists.length && (
                  <p className="text-center text-muted-foreground py-8 col-span-full">
                    Нет плейлистов
                  </p>
                )}
              </ul>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      <UploadTrackDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onDone={async () => {
          setUploadOpen(false);
          await load();
        }}
      />

      <CreatePlaylistDialog
        open={createPlOpen}
        onClose={() => setCreatePlOpen(false)}
        onDone={async () => {
          setCreatePlOpen(false);
          await load();
        }}
      />

      <Dialog open={addPlOpen} onOpenChange={(o) => !o && setAddPlOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить в плейлист</DialogTitle>
            <DialogDescription>Выберите плейлист</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {playlists.map((p) => (
              <Button
                key={p.id}
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={async () => {
                  if (!addPlTrackId) return;
                  try {
                    await addTrackToPlaylist(p.id, addPlTrackId);
                    setAddPlOpen(false);
                    setAddPlTrackId(null);
                    await load();
                  } catch (e) {
                    alert(getErrorMessage(e));
                  }
                }}
              >
                {p.name}
              </Button>
            ))}
            {!playlists.length && (
              <p className="text-sm text-muted-foreground">Сначала создайте плейлист</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UploadTrackDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [genre, setGenre] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [busy, setBusy] = useState(false);
  const [abortFn, setAbortFn] = useState<(() => void) | null>(null);

  const reset = () => {
    setTitle('');
    setArtist('');
    setGenre('');
    setIsPublic(false);
    setAudioFile(null);
    setCoverFile(null);
    setProgress(0);
    setPhase('');
    setAbortFn(null);
  };

  const handleCancel = () => {
    abortFn?.();
    setBusy(false);
    setProgress(0);
    setPhase('');
  };

  const submit = async () => {
    if (!audioFile || !title.trim() || !artist.trim()) {
      alert('Укажите файл, название и исполнителя');
      return;
    }
    if (audioFile.size > MAX_AUDIO_BYTES) {
      alert('Файл больше 50 МБ');
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      setPhase('Аудио…');
      const u1 = uploadFileWithAbort(audioFile, undefined, setProgress);
      setAbortFn(() => u1.abort);
      const audioMedia = await u1.promise;
      setAbortFn(null);

      let coverMediaId: string | undefined;
      if (coverFile) {
        setPhase('Обложка…');
        setProgress(0);
        const u2 = uploadFileWithAbort(coverFile, undefined, setProgress);
        setAbortFn(() => u2.abort);
        const cover = await u2.promise;
        coverMediaId = cover.id;
        setAbortFn(null);
      }

      await createTrack({
        title: title.trim(),
        artist: artist.trim(),
        genre: genre.trim(),
        audioMediaId: audioMedia.id,
        coverMediaId,
        isPublic,
      });
      reset();
      onDone();
    } catch (e) {
      alert(getErrorMessage(e));
    } finally {
      setBusy(false);
      setAbortFn(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (reset(), onClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Загрузить трек</DialogTitle>
          <DialogDescription>До 50 МБ. Форматы: mp3, m4a, ogg и др.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="m-title">Название</Label>
            <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="m-artist">Исполнитель</Label>
            <Input id="m-artist" value={artist} onChange={(e) => setArtist(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="m-genre">Жанр</Label>
            <Input id="m-genre" value={genre} onChange={(e) => setGenre(e.target.value)} list="genre-list" />
            <datalist id="genre-list">
              {GENRE_SUGGESTIONS.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <div>
            <Label>Аудиофайл</Label>
            <Input
              type="file"
              accept="audio/*,.mp3,.m4a,.ogg,.aac,.flac,.wav"
              onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <Label>Обложка (необязательно)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-border"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Показывать в глобальном каталоге (поиск у всех пользователей)
          </label>
          {busy && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{phase}</p>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          {busy ? (
            <Button type="button" variant="outline" onClick={handleCancel}>
              Отменить загрузку
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => (reset(), onClose())}>
            Закрыть
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreatePlaylistDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName('');
    setDescription('');
    setCoverFile(null);
    setProgress(0);
  };

  const submit = async () => {
    if (!name.trim() || !coverFile) {
      alert('Нужны название и обложка');
      return;
    }
    setBusy(true);
    try {
      const u = uploadFileWithAbort(coverFile, undefined, setProgress);
      const cover = await u.promise;
      await createPlaylist({
        name: name.trim(),
        description: description.trim(),
        coverMediaId: cover.id,
      });
      reset();
      onDone();
    } catch (e) {
      alert(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (reset(), onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый плейлист</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Название</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Описание</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Обложка</Label>
            <Input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
          </div>
          {busy && (
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => (reset(), onClose())}>
            Отмена
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy}>
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
