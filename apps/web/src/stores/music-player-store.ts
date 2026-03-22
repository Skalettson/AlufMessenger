import { create } from 'zustand';
import type { MusicTrack } from '@/types/music';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface PlayTrackOptions {
  /** Очередь воспроизведения (например весь список на экране). Если не задана — только этот трек. */
  queue?: MusicTrack[];
}

export interface MusicPlayerState {
  queue: MusicTrack[];
  currentIndex: number;
  isPlaying: boolean;
  visible: boolean;
  setQueue: (tracks: MusicTrack[], startIndex?: number, shuffle?: boolean) => void;
  setPlaying: (v: boolean) => void;
  setVisible: (v: boolean) => void;
  next: () => void;
  prev: () => void;
  close: () => void;
  playTrack: (track: MusicTrack, options?: PlayTrackOptions) => void;
  currentTrack: () => MusicTrack | null;
}

export const useMusicPlayerStore = create<MusicPlayerState>((set, get) => ({
  queue: [],
  currentIndex: 0,
  isPlaying: false,
  visible: false,

  setQueue: (tracks, startIndex = 0, shuffle = false) => {
    const list = tracks.length ? [...tracks] : [];
    if (shuffle && list.length > 1) {
      const startPos = Math.max(0, Math.min(startIndex, list.length - 1));
      const startTrack = list[startPos];
      const shuffled = shuffleArray(list);
      const newStart = shuffled.findIndex((t) => t.id === startTrack.id);
      set({
        queue: shuffled,
        currentIndex: newStart >= 0 ? newStart : 0,
        isPlaying: true,
        visible: true,
      });
    } else {
      set({
        queue: list,
        currentIndex: Math.max(0, Math.min(startIndex, Math.max(0, list.length - 1))),
        isPlaying: list.length > 0,
        visible: list.length > 0,
      });
    }
  },

  setPlaying: (isPlaying) => set({ isPlaying }),
  setVisible: (visible) => set({ visible }),

  next: () => {
    const { queue, currentIndex } = get();
    if (!queue.length) return;
    const nextIdx = (currentIndex + 1) % queue.length;
    set({ currentIndex: nextIdx, isPlaying: true });
  },

  prev: () => {
    const { queue, currentIndex } = get();
    if (!queue.length) return;
    const prevIdx = (currentIndex - 1 + queue.length) % queue.length;
    set({ currentIndex: prevIdx, isPlaying: true });
  },

  close: () => {
    set({
      queue: [],
      currentIndex: 0,
      isPlaying: false,
      visible: false,
    });
  },

  playTrack: (track, options) => {
    const raw = options?.queue?.filter((t) => t.audioMediaId?.trim());
    const q = raw && raw.length ? [...raw] : [track];
    const idx = Math.max(
      0,
      q.findIndex((t) => t.id === track.id),
    );
    set({
      queue: q,
      currentIndex: idx >= 0 ? idx : 0,
      isPlaying: true,
      visible: true,
    });
  },

  currentTrack: () => {
    const { queue, currentIndex } = get();
    if (!queue.length || currentIndex < 0 || currentIndex >= queue.length) return null;
    return queue[currentIndex] ?? null;
  },
}));
