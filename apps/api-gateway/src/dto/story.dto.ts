import { z } from 'zod';

function extractMediaId(o: Record<string, unknown>): string {
  const keys = ['mediaId', 'media_id', 'mediaid', 'MediaId', 'MEDIA_ID', 'mediaID', 'media-id'];
  for (const k of keys) {
    const c = (o as Record<string, unknown>)[k];
    if (c != null && c !== '') {
      const s = typeof c === 'string' ? c : String(c);
      const t = s.trim();
      if (t) return t;
    }
  }
  const nestedKeys = ['body', 'data', 'payload', 'input'];
  for (const k of nestedKeys) {
    const sub = (o as Record<string, unknown>)[k];
    if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
      const id = extractMediaId(sub as Record<string, unknown>);
      if (id) return id;
    }
  }
  return '';
}

function preprocessBody(val: unknown): unknown {
  let o: Record<string, unknown> | null = null;
  if (typeof val === 'string' && val.trim()) {
    try {
      o = JSON.parse(val) as Record<string, unknown>;
    } catch {
      return val;
    }
  } else if (val && typeof val === 'object' && !Array.isArray(val)) {
    o = val as Record<string, unknown>;
  }
  if (o) {
    const id = extractMediaId(o);
    return { ...o, mediaId: id || undefined, media_id: id || undefined };
  }
  return val;
}

const mediaIdSchema = z
  .union([z.string(), z.number().transform(String)])
  .optional()
  .transform((v) => (v != null ? String(v).trim() : undefined));

/** Как в Telegram: контакты, выбранные, все кроме. TTL 6/12/24/48 ч (премиум — все, иначе только 24). */
export const CreateStoryDto = z.preprocess(
  preprocessBody,
  z
    .object({
      mediaId: mediaIdSchema,
      media_id: mediaIdSchema,
      caption: z.string().max(1024).optional(),
      privacy: z.enum(['everyone', 'contacts', 'selected', 'except']).default('contacts'),
      allowedUserIds: z.array(z.string().optional()).optional(),
      excludedUserIds: z.array(z.string().optional()).optional(),
      ttlHours: z.number().int().min(6).max(48).default(24),
    })
    .refine((d) => ((d.mediaId ?? d.media_id ?? '') || '').length >= 1, {
      message: 'mediaId обязателен',
      path: ['mediaId'],
    })
    .transform((d) => {
      const mediaId = ((d.mediaId ?? d.media_id ?? '') || '').trim();
      return {
        mediaId,
        caption: d.caption,
        privacy: d.privacy,
        allowedUserIds: (d.allowedUserIds ?? []).filter(Boolean) as string[],
        excludedUserIds: (d.excludedUserIds ?? []).filter(Boolean) as string[],
        ttlHours: d.ttlHours,
      };
    }),
);
export type CreateStoryDto = z.infer<typeof CreateStoryDto>;

export const ReactToStoryDto = z.preprocess(
  (val) => {
    if (typeof val === 'string' && val.trim()) {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  },
  z.object({
    emoji: z.string().min(1).max(10),
  }),
);
export type ReactToStoryDto = z.infer<typeof ReactToStoryDto>;

export const ReplyToStoryDto = z.object({
  text: z.string().min(1).max(4096),
});
export type ReplyToStoryDto = z.infer<typeof ReplyToStoryDto>;
