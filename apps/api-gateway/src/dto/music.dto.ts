import { z } from 'zod';

export const CreateMusicTrackDto = z.object({
  title: z.string().min(1).max(512),
  artist: z.string().min(1).max(512),
  genre: z.string().max(128).optional().default(''),
  audioMediaId: z.string().uuid(),
  coverMediaId: z.string().uuid().optional(),
  /** Показывать в глобальном поиске / каталоге */
  isPublic: z.boolean().optional().default(false),
});
export type CreateMusicTrackDto = z.infer<typeof CreateMusicTrackDto>;

export const UpdateMusicTrackDto = z.object({
  isPublic: z.boolean(),
});
export type UpdateMusicTrackDto = z.infer<typeof UpdateMusicTrackDto>;

export const CreatePlaylistDto = z.object({
  name: z.string().min(1).max(256),
  description: z.string().max(2000).optional().default(''),
  coverMediaId: z.string().uuid(),
});
export type CreatePlaylistDto = z.infer<typeof CreatePlaylistDto>;

export const UpdatePlaylistDto = z.object({
  name: z.string().min(1).max(256).optional(),
  description: z.string().max(2000).optional(),
  coverMediaId: z.string().uuid().optional(),
});
export type UpdatePlaylistDto = z.infer<typeof UpdatePlaylistDto>;

export const AddTrackToPlaylistDto = z.object({
  trackId: z.string().uuid(),
  position: z.number().int().min(0).optional(),
});
export type AddTrackToPlaylistDto = z.infer<typeof AddTrackToPlaylistDto>;

export const ReorderPlaylistDto = z.object({
  trackIds: z.array(z.string().uuid()).min(1),
});
export type ReorderPlaylistDto = z.infer<typeof ReorderPlaylistDto>;
