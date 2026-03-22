import { z } from 'zod';

export const UpdateProfileDto = z.object({
  displayName: z.string().min(1).max(64).optional(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z][a-zA-Z0-9_]{2,31}$/).optional(),
  bio: z.string().max(500).optional(),
  // Поддерживаем оба поля: avatarFileId (storageKey) и avatarUrl (для обратной совместимости)
  avatarFileId: z.string().optional(),
  avatarUrl: z.string().optional(),
  coverUrl: z.string().optional(),
  premiumBadgeEmoji: z.string().max(16).optional().nullable(),
});
export type UpdateProfileDto = z.infer<typeof UpdateProfileDto>;

export const AddContactDto = z.object({
  userId: z.string().min(1),
  firstName: z.string().max(64).optional(),
  lastName: z.string().max(64).optional(),
});
export type AddContactDto = z.infer<typeof AddContactDto>;

export const UpdateContactDto = z.object({
  firstName: z.string().max(64).optional(),
  lastName: z.string().max(64).optional(),
  /** Одно поле «как в контактах»; если задано, имеет приоритет над firstName/lastName. */
  nickname: z.string().max(64).optional(),
});
export type UpdateContactDto = z.infer<typeof UpdateContactDto>;

export const UpdatePrivacyDto = z.object({
  lastSeen: z.enum(['everyone', 'contacts', 'nobody']).optional(),
  profilePhoto: z.enum(['everyone', 'contacts', 'nobody']).optional(),
  about: z.enum(['everyone', 'contacts', 'nobody']).optional(),
  forwardedMessages: z.enum(['everyone', 'contacts', 'nobody']).optional(),
  groups: z.enum(['everyone', 'contacts', 'nobody']).optional(),
  calls: z.enum(['everyone', 'contacts', 'nobody']).optional(),
  readReceipts: z.boolean().optional(),
});
export type UpdatePrivacyDto = z.infer<typeof UpdatePrivacyDto>;
