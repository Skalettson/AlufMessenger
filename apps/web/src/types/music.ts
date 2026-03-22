export interface MusicTrack {
  id: string;
  userId?: string;
  title: string;
  artist: string;
  genre: string;
  audioMediaId: string;
  coverMediaId?: string | null;
  createdAt?: string;
  /** Виден в глобальном каталоге */
  isPublic?: boolean;
  /** @username владельца (для треков из каталога) */
  ownerUsername?: string;
}

export interface PlaylistSummary {
  id: string;
  userId?: string;
  name: string;
  description: string;
  coverMediaId: string;
  trackCount: number;
  createdAt?: string;
}

export interface PlaylistEntry {
  position: number;
  track: MusicTrack;
}
