import { z } from 'zod';

export const SendMessageDto = z.object({
  text: z.string().max(4096).optional(),
  replyToId: z.string().optional(),
  mediaIds: z.array(z.string()).optional(),
  forwardFromMessageId: z.string().optional(),
  selfDestructSeconds: z.number().int().positive().optional(),
});
export type SendMessageDto = z.infer<typeof SendMessageDto>;

export const EditMessageDto = z.object({
  text: z.string().max(4096).min(1),
});
export type EditMessageDto = z.infer<typeof EditMessageDto>;

export const ReactDto = z.preprocess(
  (val) => {
    if (typeof val === 'string' && val.trim()) {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  },
  z.object({
    emoji: z.string().min(1).max(8),
  }),
);
export type ReactDto = z.infer<typeof ReactDto>;

function parseForwardBody(val: unknown): unknown {
  if (typeof val === 'number' || typeof val === 'boolean') {
    return {};
  }
  if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val);
      return parseForwardBody(parsed);
    } catch {
      return val;
    }
  }
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const o = val as Record<string, unknown>;
    const toChatIdsRaw = o.toChatIds ?? o.to_chat_ids;
    let toChatIds: string[] | undefined;
    if (Array.isArray(toChatIdsRaw)) {
      toChatIds = toChatIdsRaw.map((x) => (typeof x === 'string' ? x : String(x ?? ''))).filter(Boolean);
    } else if (typeof toChatIdsRaw === 'string') {
      toChatIds = toChatIdsRaw.trim() ? [toChatIdsRaw.trim()] : [];
    } else if (typeof toChatIdsRaw === 'number') {
      toChatIds = [String(toChatIdsRaw)];
    }
    const fromChatIdRaw = o.fromChatId ?? o.from_chat_id;
    const fromChatId =
      typeof fromChatIdRaw === 'string' ? fromChatIdRaw : fromChatIdRaw != null ? String(fromChatIdRaw) : '';
    return {
      fromChatId,
      toChatIds: toChatIds ?? [],
    };
  }
  return val;
}

export const ForwardDto = z.preprocess(
  parseForwardBody,
  z.object({
    fromChatId: z.string().min(1, 'fromChatId обязателен'),
    toChatIds: z
      .array(z.string().min(1))
      .min(1, 'Выберите минимум один чат для пересылки')
      .max(20),
  }),
);
export type ForwardDto = z.infer<typeof ForwardDto>;
