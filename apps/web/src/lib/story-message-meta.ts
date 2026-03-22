import { unwrapGrpcStructMetadata } from '@/lib/utils';
import type { Message } from '@/stores/message-store';

function strMeta(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

/**
 * Поля истории из metadata сообщения (Struct или плоский JSON).
 * Учитываем числовые id из JSON и дубли ключей на верхнем уровне.
 */
export function parseStoryMetaFromRaw(raw: Record<string, unknown>): {
  replyToStoryId: string | null;
  storyReactionEmoji: string | null;
  replyToStoryPreview: Message['replyToStoryPreview'];
} {
  const unwrapped = unwrapGrpcStructMetadata(raw.metadata);
  const meta: Record<string, unknown> = {
    ...(unwrapped && typeof unwrapped === 'object' ? unwrapped : {}),
  };
  /** REST / старые ответы без вложенного metadata */
  for (const k of [
    'reply_to_story_id',
    'story_reaction_emoji',
    'story_preview_media_id',
    'story_preview_caption',
    'story_owner_name',
  ] as const) {
    if (meta[k] == null && raw[k] != null) meta[k] = raw[k] as unknown;
  }
  const replyToStoryId = strMeta(meta.reply_to_story_id) ?? strMeta((meta as { replyToStoryId?: unknown }).replyToStoryId);
  const storyReactionEmoji =
    strMeta(meta.story_reaction_emoji) ?? strMeta((meta as { storyReactionEmoji?: unknown }).storyReactionEmoji);

  const prevMedia =
    meta.story_preview_media_id ??
    (meta as { storyPreviewMediaId?: unknown }).storyPreviewMediaId;
  const prevCap =
    meta.story_preview_caption ?? (meta as { storyPreviewCaption?: unknown }).storyPreviewCaption;
  const prevOwner = meta.story_owner_name ?? (meta as { storyOwnerName?: unknown }).storyOwnerName;

  const pm = strMeta(prevMedia);
  const pc = strMeta(prevCap);
  const po = strMeta(prevOwner);

  let replyToStoryPreview: Message['replyToStoryPreview'] =
    replyToStoryId && (pm || pc || po)
      ? {
          mediaId: pm,
          caption: pc,
          ownerName: po,
        }
      : null;

  return { replyToStoryId, storyReactionEmoji, replyToStoryPreview };
}

/** Если в metadata нет превью, но вложено то же медиа, что и у истории — строим превью из mediaId. */
export function synthesizeStoryPreviewIfNeeded(
  replyToStoryId: string | null,
  preview: Message['replyToStoryPreview'],
  contentType: string,
  mediaId: string | undefined,
): Message['replyToStoryPreview'] {
  if (!replyToStoryId || preview) return preview;
  if (!mediaId || (contentType !== 'image' && contentType !== 'video')) return preview;
  return {
    mediaId,
    caption: null,
    ownerName: null,
  };
}

/** Медиа в теле сообщения дублирует превью истории (нужно показать только блок истории). */
export function isStoryPreviewMediaDuplicate(message: Message): boolean {
  if (!message.replyToStoryId || !message.replyToStoryPreview?.mediaId || !message.mediaId) return false;
  const a = String(message.replyToStoryPreview.mediaId).trim();
  const b = String(message.mediaId).trim();
  if (!a || a !== b) return false;
  return message.contentType === 'image' || message.contentType === 'video';
}
