'use client';
import { useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { useMessageStore, type Message } from '@/stores/message-store';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import { wsClient } from '@/lib/ws';

import { hasLoadedChat, markChatLoaded, unmarkChatLoaded } from '@/lib/message-cache';
import { unwrapGrpcStructMetadata } from '@/lib/utils';
import { parseStoryMetaFromRaw, synthesizeStoryPreviewIfNeeded } from '@/lib/story-message-meta';

const EMPTY_MESSAGES: Message[] = [];
const EMPTY_TYPING: { userId: string; username: string }[] = [];

/** Proto ContentType enum → frontend string. REST API returns numbers. */
const PROTO_TO_CONTENT_TYPE: Record<number, string> = {
  1: 'text',
  2: 'image',
  3: 'video',
  4: 'audio',
  5: 'document',
  6: 'voice',
  7: 'sticker',
  8: 'gif',
  9: 'location',
  10: 'contact',
  11: 'poll',
  12: 'system',
  13: 'video_note',
};

/** gRPC loader enums: String — приходит имя enum (CONTENT_TYPE_IMAGE), а не число. */
const PROTO_ENUM_NAME_TO_CONTENT_TYPE: Record<string, string> = {
  CONTENT_TYPE_TEXT: 'text',
  CONTENT_TYPE_IMAGE: 'image',
  CONTENT_TYPE_VIDEO: 'video',
  CONTENT_TYPE_AUDIO: 'audio',
  CONTENT_TYPE_FILE: 'document',
  CONTENT_TYPE_VOICE: 'voice',
  CONTENT_TYPE_STICKER: 'sticker',
  CONTENT_TYPE_GIF: 'gif',
  CONTENT_TYPE_LOCATION: 'location',
  CONTENT_TYPE_CONTACT: 'contact',
  CONTENT_TYPE_POLL: 'poll',
  CONTENT_TYPE_SYSTEM: 'system',
  CONTENT_TYPE_VIDEO_NOTE: 'video_note',
  CONTENT_TYPE_UNSPECIFIED: 'text',
};

export function resolveContentType(raw: Record<string, unknown>): string {
  const v = raw.contentType ?? raw.content_type;
  if (v === undefined || v === null) return 'text';
  if (typeof v === 'number') return PROTO_TO_CONTENT_TYPE[v] ?? 'text';
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return 'text';
    const fromEnum = PROTO_ENUM_NAME_TO_CONTENT_TYPE[s];
    if (fromEnum) return fromEnum;
    return s;
  }
  return 'text';
}

function parseMessageCreatedAt(value: unknown): string {
  if (value == null) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'seconds' in value) {
    const sec = Number((value as { seconds?: number }).seconds) || 0;
    const ns = Number((value as { nanos?: number }).nanos) || 0;
    return new Date(sec * 1000 + ns / 1_000_000).toISOString();
  }
  return new Date().toISOString();
}

function getMediaPreviewText(contentType: string): string {
  switch (contentType) {
    case 'image': return 'Фото';
    case 'video': return 'Видео';
    case 'audio': return 'Аудио';
    case 'voice': return 'Голосовое сообщение';
    case 'video_note': return 'Видеосообщение';
    case 'document': return 'Документ';
    case 'sticker': return 'Стикер';
    default: return 'Сообщение';
  }
}

/** Заполняет replyToPreview из списка сообщений, если на сообщение есть ответ и превью отсутствует. */
export function hydrateReplyPreview(msg: Message, allInChat: Message[]): Message {
  if (!msg.replyToId || msg.replyToPreview) return msg;
  const replied = allInChat.find((m) => m.id === msg.replyToId);
  if (!replied) return msg;
  const text =
    replied.textContent?.trim() ||
    getMediaPreviewText(replied.contentType);
  return {
    ...msg,
    replyToPreview: { senderName: replied.senderName, text },
  };
}

function normalizeMessage(raw: Record<string, unknown>, chatId: string, currentUserId: string, isSavedChat?: boolean): Message {
  const id = String(raw.id ?? raw.message_id ?? '').trim();
  const senderId = String(raw.senderId ?? raw.sender_id ?? '');
  const isMine = isSavedChat ? true : (senderId && currentUserId ? senderId === currentUserId : false);
  const contentType = resolveContentType(raw);
  const mediaIdRaw = raw.mediaId ?? raw.media_id;
  const mediaId = (() => {
    if (mediaIdRaw == null) return undefined;
    const s = typeof mediaIdRaw === 'string' ? mediaIdRaw.trim() : String(mediaIdRaw ?? '');
    return s || undefined;
  })();
  const directMeta =
    ((raw.mediaMetadata ?? raw.media_metadata) as Message['mediaMetadata'] | null | undefined) ?? null;
  let mediaMetadata: Message['mediaMetadata'] = directMeta;
  const metaFlat = unwrapGrpcStructMetadata(raw.metadata) ?? {};
  const { replyToStoryId, storyReactionEmoji, replyToStoryPreview: storyPreviewFromMeta } =
    parseStoryMetaFromRaw(raw);
  const replyToStoryPreview = synthesizeStoryPreviewIfNeeded(
    replyToStoryId,
    storyPreviewFromMeta,
    contentType,
    mediaId,
  );
  if (
    (!mediaMetadata?.duration && (contentType === 'voice' || contentType === 'video' || contentType === 'video_note'))
  ) {
    const dur = metaFlat?.duration;
    if (typeof dur === 'number' && Number.isFinite(dur)) {
      mediaMetadata = { ...mediaMetadata, duration: dur };
    }
  }
  return {
    id,
    chatId,
    senderId,
    senderName: String(raw.senderName ?? raw.sender_name ?? raw.sender_display_name ?? ''),
    senderAvatar: ((raw.senderAvatar ?? raw.sender_avatar ?? raw.sender_avatar_url) as string) || null,
    senderIsPremium: Boolean(raw.senderIsPremium ?? raw.sender_is_premium),
    senderPremiumBadgeEmoji: String(raw.senderPremiumBadgeEmoji ?? raw.sender_premium_badge_emoji ?? ''),
    senderIsVerified: Boolean(raw.senderIsVerified ?? raw.sender_is_verified),
    senderIsOfficial: Boolean(raw.senderIsOfficial ?? raw.sender_is_official),
    contentType,
    textContent: (raw.textContent ?? raw.text_content) as string | null ?? null,
    mediaUrl: (raw.mediaUrl ?? raw.media_url) as string | null ?? null,
    mediaId,
    mediaThumbnail: (raw.mediaThumbnail ?? raw.media_thumbnail) as string | null ?? null,
    mediaMetadata,
    replyToId: (raw.replyToId ?? raw.reply_to_id) as string | null ?? null,
    replyToPreview: (raw.replyToPreview ?? raw.reply_to_preview) as Message['replyToPreview'] ?? null,
    replyToStoryId,
    replyToStoryPreview,
    storyReactionEmoji,
    forwardFrom: (() => {
      const f = raw.forwardFrom ?? raw.forward_from;
      if (!f || typeof f !== 'object') return null;
      const o = f as Record<string, unknown>;
      const chatTitle = (o.chatTitle ?? o.chat_title ?? '') as string;
      const senderName = (o.senderName ?? o.sender_name ?? '') as string;
      if (!chatTitle && !senderName) return null;
      return { chatTitle: chatTitle || '', senderName: senderName || '' };
    })(),
    reactions: Array.isArray(raw.reactions) ? (raw.reactions as Message['reactions']) : [],
    isEdited: Boolean(raw.isEdited ?? raw.is_edited),
    isPinned: Boolean(raw.isPinned ?? raw.is_pinned),
    isMine,
    status: (raw.status as Message['status']) ?? 'sent',
    viewCount: (() => {
      const v = raw.viewCount ?? raw.view_count;
      if (v == null) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    })(),
    createdAt: parseMessageCreatedAt(raw.createdAt ?? raw.created_at ?? raw.sent_at),
    editedAt: (raw.editedAt ?? raw.edited_at) as string | null ?? null,
  };
}

export interface UseMessagesOptions {
  /** В «Избранном» все сообщения считаются своими (заметки пользователя). */
  isSavedChat?: boolean;
}

export function useMessages(chatId: string | null, options?: UseMessagesOptions) {
  const messages = useMessageStore((s) => (chatId ? s.messagesByChat[chatId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES));
  const setMessages = useMessageStore((s) => s.setMessages);
  const addMessage = useMessageStore((s) => s.addMessage);
  const prependMessages = useMessageStore((s) => s.prependMessages);
  const updateMessage = useMessageStore((s) => s.updateMessage);
  const typingUsers = useMessageStore((s) => (chatId ? s.typingUsers[chatId] ?? EMPTY_TYPING : EMPTY_TYPING));
  const currentUserId = useAuthStore((s) => s.user?.id ?? '');
  const chats = useChatStore((s) => s.chats);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const updateChat = useChatStore((s) => s.updateChat);
  const fetchInProgressRef = useRef(false);
  const lastReadMessageIdRef = useRef<string | null>(null);

  const isSavedChat = options?.isSavedChat ?? Boolean(chatId && chats?.find((c) => c.id === chatId)?.type === 'saved');

  const fetchMessages = useCallback(async () => {
    if (!chatId) return;
    if (hasLoadedChat(chatId) || fetchInProgressRef.current) return;
    fetchInProgressRef.current = true;
    markChatLoaded(chatId);
    try {
      const res = await api.get<{ messages: unknown[] }>(`/chats/${chatId}/messages?limit=50`);
      const list = Array.isArray(res?.messages) ? res.messages : [];
      const normalized = list
        .map((m) => normalizeMessage(typeof m === 'object' && m && !Array.isArray(m) ? (m as Record<string, unknown>) : {}, chatId, currentUserId, isSavedChat))
        .filter((m) => m.id);
      const fromFetch = normalized.reverse();
      const current = useMessageStore.getState().messagesByChat[chatId] ?? [];
      const fetchIds = new Set(fromFetch.map((m) => m.id));
      const newerFromWs = current.filter((m) => !fetchIds.has(m.id));
      const merged = [...fromFetch, ...newerFromWs].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      const hydrated = merged.map((m) => hydrateReplyPreview(m, merged));
      setMessages(chatId, hydrated);
    } catch {
      unmarkChatLoaded(chatId);
    } finally {
      fetchInProgressRef.current = false;
    }
  }, [chatId, currentUserId, isSavedChat, setMessages]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Отмечаем чат прочитанным при просмотре: отправляем message.read и сбрасываем счётчик
  useEffect(() => {
    if (!chatId || isSavedChat || chatId !== activeChatId || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    const lastId = lastMsg?.id;
    if (!lastId || lastReadMessageIdRef.current === lastId) return;
    lastReadMessageIdRef.current = lastId;
    wsClient.send('message.read', { chatId, messageId: lastId });
    updateChat(chatId, { unreadCount: 0 });
  }, [chatId, activeChatId, messages, isSavedChat, updateChat]);

  const sendMessage = useCallback(
    async (
      text: string,
      replyToId?: string,
      mediaIds?: string[],
      contentType?: string,
      mediaUrl?: string | null,
    ) => {
      if (!chatId) return;
      const hasText = typeof text === 'string' && text.trim().length > 0;
      const hasMedia = Array.isArray(mediaIds) && mediaIds.length > 0;
      if (!hasText && !hasMedia) return;

      const ct = contentType || 'text';
      const replyingTo = useMessageStore.getState().replyingTo;
      const replyToPreview =
        replyToId && replyingTo?.id === replyToId
          ? {
              senderName: replyingTo.senderName,
              text:
                replyingTo.textContent?.trim() ||
                getMediaPreviewText(replyingTo.contentType),
            }
          : null;
      const tempId = `temp-${Date.now()}`;
      const optimistic: Message = {
        id: tempId,
        chatId,
        senderId: '',
        senderName: 'Вы',
        senderAvatar: null,
        contentType: ct,
        textContent: hasText ? text.trim() : null,
        mediaUrl: mediaUrl ?? null,
        mediaId: mediaIds?.[0],
        mediaThumbnail: null,
        mediaMetadata: null,
        replyToId: replyToId || null,
        replyToPreview,
        forwardFrom: null,
        reactions: [],
        isEdited: false,
        isPinned: false,
        isMine: true,
        status: 'sending',
        createdAt: new Date().toISOString(),
        editedAt: null,
      };
      addMessage(chatId, optimistic);

      try {
        wsClient.send('message.send', {
          chatId,
          contentType: ct,
          textContent: hasText ? text.trim() : '',
          replyToId,
          mediaId: mediaIds?.[0] ?? '',
        });
      } catch {}
    },
    [chatId, addMessage],
  );

  const sendVideoNote = useCallback(
    (mediaId: string, replyToId?: string, mediaUrl?: string | null, durationSec?: number) => {
      if (!chatId) return;
      const replyingTo = useMessageStore.getState().replyingTo;
      const replyToPreview =
        replyToId && replyingTo?.id === replyToId
          ? {
              senderName: replyingTo.senderName,
              text:
                replyingTo.textContent?.trim() ||
                getMediaPreviewText(replyingTo.contentType),
            }
          : null;
      const tempId = `temp-video-note-${Date.now()}`;
      const optimistic: Message = {
        id: tempId,
        chatId,
        senderId: '',
        senderName: 'Вы',
        senderAvatar: null,
        contentType: 'video_note',
        textContent: null,
        mediaUrl: mediaUrl ?? null,
        mediaId,
        mediaThumbnail: null,
        mediaMetadata: durationSec ? { duration: Math.round(durationSec) } : null,
        replyToId: replyToId || null,
        replyToPreview,
        forwardFrom: null,
        reactions: [],
        isEdited: false,
        isPinned: false,
        isMine: true,
        status: 'sending',
        createdAt: new Date().toISOString(),
        editedAt: null,
      };
      addMessage(chatId, optimistic);
      try {
        wsClient.send('message.send', {
          chatId,
          contentType: 'video_note',
          textContent: '',
          mediaId,
          replyToId,
          metadata:
            durationSec != null && Number.isFinite(durationSec)
              ? { duration: Math.round(durationSec) }
              : {},
        });
      } catch {}
    },
    [chatId, addMessage],
  );

  const sendVoiceMessage = useCallback(
    (mediaId: string, replyToId?: string, mediaUrl?: string | null, durationSec?: number) => {
      if (!chatId) return;
      const replyingTo = useMessageStore.getState().replyingTo;
      const replyToPreview =
        replyToId && replyingTo?.id === replyToId
          ? {
              senderName: replyingTo.senderName,
              text:
                replyingTo.textContent?.trim() ||
                getMediaPreviewText(replyingTo.contentType),
            }
          : null;
      const tempId = `temp-voice-${Date.now()}`;
      const optimistic: Message = {
        id: tempId,
        chatId,
        senderId: '',
        senderName: 'Вы',
        senderAvatar: null,
        contentType: 'voice',
        textContent: null,
        mediaUrl: mediaUrl ?? null,
        mediaId,
        mediaThumbnail: null,
        mediaMetadata: durationSec ? { duration: Math.round(durationSec) } : null,
        replyToId: replyToId || null,
        replyToPreview,
        forwardFrom: null,
        reactions: [],
        isEdited: false,
        isPinned: false,
        isMine: true,
        status: 'sending',
        createdAt: new Date().toISOString(),
        editedAt: null,
      };
      addMessage(chatId, optimistic);
      try {
        wsClient.send('message.send', {
          chatId,
          contentType: 'voice',
          textContent: '',
          mediaId,
          replyToId,
          metadata:
            durationSec != null && Number.isFinite(durationSec)
              ? { duration: Math.round(durationSec) }
              : {},
        });
      } catch {}
    },
    [chatId, addMessage],
  );

  const editMessage = useCallback(
    async (messageId: string, newText: string) => {
      if (!chatId) return;
      try {
        await api.patch(`/messages/${messageId}?chatId=${encodeURIComponent(chatId)}`, { text: newText });
        updateMessage(chatId, messageId, {
          textContent: newText,
          isEdited: true,
          editedAt: new Date().toISOString(),
        });
      } catch {}
    },
    [chatId, updateMessage],
  );

  return { messages, typingUsers, sendMessage, sendVoiceMessage, sendVideoNote, editMessage, fetchMessages };
}
