'use client';
import { useEffect } from 'react';
import { wsClient } from '@/lib/ws';
import { unwrapGrpcStructMetadata } from '@/lib/utils';
import { parseStoryMetaFromRaw, synthesizeStoryPreviewIfNeeded } from '@/lib/story-message-meta';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useMessageStore } from '@/stores/message-store';
import { useChatStore } from '@/stores/chat-store';
import { useCallStore } from '@/stores/call-store';
import { getAccessToken } from '@/lib/api';
import { addedViaWs } from '@/lib/message-cache';
import { hydrateReplyPreview, resolveContentType } from '@/hooks/use-messages';
import { apiChatToPreview, type ApiChat } from '@/lib/chat-mappers';
import { usePresenceStore } from '@/stores/presence-store';
import { useUiStore } from '@/stores/ui-store';

function makeWsKey(chatId: string, msgId: string): string {
  return `${chatId}:${msgId}`;
}

function normMediaId(v: unknown): string {
  return String(v ?? '').trim().toLowerCase();
}

function getMediaPreviewText(contentType: string): string {
  switch (contentType) {
    case 'image': return '[Фото]';
    case 'video': return '[Видео]';
    case 'audio': return '[Аудио]';
    case 'voice': return '[Голосовое]';
    case 'video_note': return '[Видеосообщение]';
    case 'sticker': return '[Стикер]';
    default: return '[Медиа]';
  }
}

function normalizeMessageStatus(raw: unknown): 'sending' | 'sent' | 'delivered' | 'read' | 'failed' {
  const v = String(raw ?? '').toLowerCase();
  if (!v) return 'sent';
  if (v.includes('read')) return 'read';
  if (v.includes('deliver')) return 'delivered';
  if (v.includes('fail')) return 'failed';
  if (v.includes('send')) return 'sent';
  return 'sent';
}

export function useWebSocket() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const addMessage = useMessageStore((s) => s.addMessage);
  const updateMessage = useMessageStore((s) => s.updateMessage);
  const removeMessage = useMessageStore((s) => s.removeMessage);
  const setTypingUsers = useMessageStore((s) => s.setTypingUsers);
  const updateChat = useChatStore((s) => s.updateChat);
  const addChat = useChatStore((s) => s.addChat);
  const {
    setActiveCall,
    setIncomingCall,
    setOutgoingCall,
    addRemoteStream,
    removeRemoteStream,
    cleanup,
  } = useCallStore();

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = getAccessToken();
    if (!token) return;

    wsClient.connect(token);

    const unsubs = [
      wsClient.on('message.new', async (data: any) => {
        const msg = data as any;
        const msgId = String(msg.id ?? '').trim();
        const chatId = String(msg.chatId ?? '').trim();
        if (!msgId || !chatId) return;

        const wsKey = makeWsKey(chatId, msgId);
        if (addedViaWs.has(wsKey)) return;
        addedViaWs.add(wsKey);
        if (addedViaWs.size > 10000) {
          addedViaWs.clear();
        }

        const state = useMessageStore.getState();
        const existing = state.messagesByChat[chatId] ?? [];
        if (existing.some((m) => m.id === msgId)) return;

        const currentUserId = useAuthStore.getState().user?.id ?? '';
        const isMine = msg.senderId && currentUserId && String(msg.senderId) === String(currentUserId);
        const rawMediaId = String(msg.mediaId ?? msg.media_id ?? '').trim();
        const mediaIdNorm = normMediaId(rawMediaId);
        const contentType = resolveContentType(msg as Record<string, unknown>);

        let mediaUrl: string | null = null;
        if (rawMediaId) {
          try {
            const res = await api.get<{ url?: string }>(`/media/${rawMediaId}`);
            mediaUrl = (res?.url ?? '') || null;
          } catch {}
        }

        const stateAfter = useMessageStore.getState();
        if (stateAfter.messagesByChat[chatId]?.some((m) => m.id === msgId)) {
          return;
        }

        if (isMine) {
          const list = stateAfter.messagesByChat[chatId] ?? [];
          const optimistics = list.filter((m) => m.status === 'sending' && m.isMine && m.id.startsWith('temp-'));
          const wsText = String(msg.textContent ?? '').trim();
          const matching = optimistics.find((m) => {
            if (mediaIdNorm) {
              return normMediaId(m.mediaId) === mediaIdNorm;
            }
            const sameText = String(m.textContent ?? '').trim() === wsText;
            const sameType = String(m.contentType || 'text') === String(contentType || 'text');
            return sameText && sameType;
          });
          if (matching) removeMessage(chatId, matching.id);
        }

        const stateBeforeAdd = useMessageStore.getState();
        const listBeforeAdd = stateBeforeAdd.messagesByChat[chatId] ?? [];
        if (isMine && mediaIdNorm) {
          const duplicateOpt = listBeforeAdd.find(
            (m) => m.status === 'sending' && m.isMine && m.id.startsWith('temp-') && normMediaId(m.mediaId) === mediaIdNorm,
          );
          if (duplicateOpt) removeMessage(chatId, duplicateOpt.id);
        }

        const existingInChat = useMessageStore.getState().messagesByChat[chatId] ?? [];

        let forwardFrom: { chatTitle: string; senderName: string } | null = null;
        if (msg.forwardFromChatId || msg.forwardFromId) {
          const chatTitle = msg.forwardFromChatTitle || '';
          const senderName = msg.forwardFromSenderName || '';
          if (chatTitle || senderName) {
            forwardFrom = { chatTitle, senderName };
          }
        }

        const metaFromWs = unwrapGrpcStructMetadata(msg.metadata);
        const dur = metaFromWs?.duration;
        const mediaMetadata =
          typeof dur === 'number' && Number.isFinite(dur)
            ? { duration: dur }
            : null;
        const { replyToStoryId, storyReactionEmoji, replyToStoryPreview: wsStoryPreview } =
          parseStoryMetaFromRaw(msg as Record<string, unknown>);
        const replyToStoryPreview = synthesizeStoryPreviewIfNeeded(
          replyToStoryId,
          wsStoryPreview,
          contentType,
          rawMediaId || undefined,
        );

        const newMsg = hydrateReplyPreview(
          {
            id: msgId,
            chatId,
            senderId: msg.senderId,
            senderName: isMine ? 'Вы' : (msg.senderDisplayName || msg.senderUsername || ''),
            senderAvatar: msg.senderAvatarUrl || null,
            senderIsPremium: Boolean(msg.senderIsPremium ?? msg.sender_is_premium),
            senderPremiumBadgeEmoji: String(
              msg.senderPremiumBadgeEmoji ?? msg.sender_premium_badge_emoji ?? '',
            ).trim(),
            senderIsVerified: Boolean(msg.senderIsVerified ?? msg.sender_is_verified),
            senderIsOfficial: Boolean(msg.senderIsOfficial ?? msg.sender_is_official),
            contentType,
            textContent: msg.textContent || null,
            mediaUrl,
            mediaId: rawMediaId || undefined,
            mediaThumbnail: null,
            mediaMetadata,
            replyToId: msg.replyToId || null,
            replyToStoryId,
            replyToStoryPreview,
            storyReactionEmoji,
            replyToPreview: null,
            forwardFrom,
            reactions: [],
            isEdited: false,
            isPinned: false,
            isMine: !!isMine,
            status: isMine ? 'sent' : 'delivered',
            createdAt: msg.createdAt || new Date().toISOString(),
            editedAt: null,
          },
          existingInChat,
        );
        addMessage(chatId, newMsg);

        const activeChatId = useChatStore.getState().activeChatId;
        if (chatId !== activeChatId && !isMine) {
          const chats = useChatStore.getState().chats;
          const chat = chats.find((c) => c.id === chatId);
          const prev = chat?.unreadCount ?? 0;
          updateChat(chatId, { unreadCount: prev + 1 });
        }

        const chatExists = useChatStore.getState().chats.some((c) => c.id === chatId);
        if (!chatExists) {
          try {
            const chatRes = await api.get<ApiChat>(`/chats/${chatId}`);
            if (chatRes?.id) {
              const preview = apiChatToPreview(chatRes);
              const unreadForNew = chatId !== activeChatId && !isMine ? 1 : 0;
              addChat({ ...preview, unreadCount: unreadForNew, lastMessageText: msg.textContent || getMediaPreviewText(contentType), lastMessageSender: isMine ? 'Вы' : (msg.senderDisplayName || msg.senderUsername || ''), lastMessageAt: msg.createdAt || new Date().toISOString() });
            } else {
              updateChat(chatId, { lastMessageText: msg.textContent || getMediaPreviewText(contentType), lastMessageSender: isMine ? 'Вы' : (msg.senderDisplayName || msg.senderUsername || ''), lastMessageAt: msg.createdAt || new Date().toISOString() });
            }
          } catch {
            updateChat(chatId, { lastMessageText: msg.textContent || getMediaPreviewText(contentType), lastMessageSender: isMine ? 'Вы' : (msg.senderDisplayName || msg.senderUsername || ''), lastMessageAt: msg.createdAt || new Date().toISOString() });
          }
        } else {
          updateChat(chatId, {
            lastMessageText: msg.textContent || getMediaPreviewText(contentType),
            lastMessageSender: isMine ? 'Вы' : (msg.senderDisplayName || msg.senderUsername || ''),
            lastMessageAt: msg.createdAt || new Date().toISOString(),
          });
        }
      }),
      wsClient.on('message.updated', (data: any) => {
        updateMessage(data.chatId, data.id, { textContent: data.textContent, isEdited: true, editedAt: data.editedAt });
      }),
      wsClient.on('message.deleted', (data: any) => {
        removeMessage(data.chatId, data.id);
      }),
      wsClient.on('typing', (data: any) => {
        const chatId = data.chatId;
        if (data.action === 'start') {
          setTypingUsers(chatId, [{ userId: data.userId, username: data.username }]);
          setTimeout(() => setTypingUsers(chatId, []), 5000);
        } else {
          setTypingUsers(chatId, []);
        }
      }),
      wsClient.on('message.status', (data: any) => {
        const msgId = data.messageId ?? data.id ?? data.message_id;
        if (data.chatId && msgId) {
          updateMessage(data.chatId, msgId, { status: normalizeMessageStatus(data.type ?? data.status) });
        }
      }),
      wsClient.on('message.reaction', (data: unknown) => {
        const d = data as {
          chatId?: string;
          messageId?: string;
          id?: string;
          reactions?: { emoji: string; count: number }[];
        };
        const chatId = d.chatId;
        const messageId = String(d.messageId ?? d.id ?? '').trim();
        if (!chatId || !messageId) return;
        const incoming = Array.isArray(d.reactions) ? d.reactions : [];
        const prev = useMessageStore.getState().messagesByChat[chatId]?.find((m) => m.id === messageId);
        const prevByEmoji = new Map((prev?.reactions ?? []).map((r) => [r.emoji, r]));
        const merged = incoming.map((r) => ({
          emoji: r.emoji,
          count: r.count,
          reacted: prevByEmoji.get(r.emoji)?.reacted ?? false,
        }));
        updateMessage(chatId, messageId, { reactions: merged });
      }),
      wsClient.on('presence', (data: unknown) => {
        const d = data as { userId?: string; status?: string; lastSeenAt?: string | null };
        const userId = d?.userId;
        if (!userId) return;
        usePresenceStore.getState().setPresence(userId, {
          isOnline: d.status === 'online',
          lastSeenAt: d.lastSeenAt ?? undefined,
        });
      }),
      // Обработка событий звонков
      wsClient.on('call.incoming', (data: unknown) => {
        const callData = data as {
          callId: string;
          callerId: string;
          chatId: string;
          type: 'voice' | 'video';
          isGroup: boolean;
        };
        
        // Не показываем входящий звонок если это наш звонок
        if (callData.callerId === currentUserId) return;
        
        const call: import('@/stores/call-store').Call = {
          id: callData.callId,
          roomName: `room_${callData.callId}`,
          chatId: callData.chatId,
          initiatorId: callData.callerId,
          type: callData.type,
          isGroup: callData.isGroup,
          status: 'ringing',
          participants: [],
          startedAt: null,
          endedAt: null,
          createdAt: new Date(),
        };
        
        setIncomingCall(call);

        const chat = useChatStore.getState().chats.find((c) => c.id === callData.chatId);
        useUiStore.getState().setActiveCall({
          callId: callData.callId,
          chatId: callData.chatId,
          chatTitle: chat?.title?.trim() || 'Входящий звонок',
          chatAvatar: chat?.avatarUrl ?? null,
          callType: callData.type === 'video' ? 'video' : 'voice',
          isIncoming: true,
          peerUserId: callData.callerId,
        });
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          try {
            navigator.vibrate([180, 120, 180]);
          } catch {
            /* ignore */
          }
        }
      }),
      wsClient.on('call.signal', (data: unknown) => {
        // WebRTC сигналы обрабатываются в useWebRTC hook
        // Здесь можно добавить дополнительную логику если нужно
      }),
      wsClient.on('call.ended', (data: unknown) => {
        const callData = data as { callId: string; reason?: string };
        const activeCall = useCallStore.getState().activeCall;
        const uiCall = useUiStore.getState().activeCall;

        if (activeCall && activeCall.id === callData.callId) {
          cleanup();
          setActiveCall(null);
          setOutgoingCall(null);
          setIncomingCall(null);
        }
        if (uiCall?.callId === callData.callId) {
          useUiStore.getState().setActiveCall(null);
        }
        if (useCallStore.getState().incomingCall?.id === callData.callId) {
          setIncomingCall(null);
        }
      }),
    ];

    return () => {
      unsubs.forEach((u) => u());
      wsClient.disconnect();
    };
  }, [isAuthenticated, addChat, updateMessage]);
}
