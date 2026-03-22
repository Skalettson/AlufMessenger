import { create } from 'zustand';

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  senderIsPremium?: boolean;
  senderPremiumBadgeEmoji?: string;
  senderIsVerified?: boolean;
  senderIsOfficial?: boolean;
  contentType: string;
  textContent: string | null;
  mediaUrl: string | null;
  mediaId?: string | null;
  mediaThumbnail: string | null;
  mediaMetadata: { width?: number; height?: number; duration?: number; fileName?: string; fileSize?: number } | null;
  replyToId: string | null;
  replyToPreview: { senderName: string; text: string } | null;
  /** Ответ на историю (метаданные сообщения, не replyToId). */
  replyToStoryId?: string | null;
  /** Превью истории для отображения над ответом. */
  replyToStoryPreview?: {
    mediaId: string | null;
    caption: string | null;
    ownerName: string | null;
  } | null;
  /** Реакция на историю, продублированная в чат. */
  storyReactionEmoji?: string | null;
  forwardFrom: { chatTitle: string; senderName: string } | null;
  reactions: { emoji: string; count: number; reacted: boolean }[];
  isEdited: boolean;
  isPinned: boolean;
  isMine: boolean;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  viewCount?: number;
  createdAt: string;
  editedAt: string | null;
}

interface MessageState {
  messagesByChat: Record<string, Message[]>;
  typingUsers: Record<string, { userId: string; username: string }[]>;
  replyingTo: Message | null;
  editingMessage: Message | null;
  setMessages: (chatId: string, messages: Message[]) => void;
  addMessage: (chatId: string, message: Message) => void;
  updateMessage: (chatId: string, messageId: string, updates: Partial<Message>) => void;
  removeMessage: (chatId: string, messageId: string) => void;
  setTypingUsers: (chatId: string, users: { userId: string; username: string }[]) => void;
  setReplyingTo: (message: Message | null) => void;
  setEditingMessage: (message: Message | null) => void;
  prependMessages: (chatId: string, messages: Message[]) => void;
  clearAll: () => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  messagesByChat: {},
  typingUsers: {},
  replyingTo: null,
  editingMessage: null,

  setMessages: (chatId, messages) =>
    set((state) => {
      const seen = new Set<string>();
      const deduped = messages.filter((m) => {
        if (!m.id || seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      return { messagesByChat: { ...state.messagesByChat, [chatId]: deduped } };
    }),

  addMessage: (chatId, message) =>
    set((state) => {
      const existing = state.messagesByChat[chatId] || [];
      if (!message.id || existing.some((m) => m.id === message.id)) return state;

      /** Снять оптимистичное temp-* с тем же mediaId или одно с тем же текстом (без медиа), если сервер прислал финальное. */
      const normMedia = (x: unknown) => String(x ?? '').trim().toLowerCase();
      const normText = (t: unknown) => String(t ?? '').trim();
      let pruned = existing;
      if (message.isMine) {
        const nm = message.mediaId ? normMedia(message.mediaId) : '';
        if (nm) {
          pruned = existing.filter((m) => {
            if (m.id === message.id) return false;
            if (!(m.status === 'sending' && m.isMine && m.id.startsWith('temp-'))) return true;
            return normMedia(m.mediaId) !== nm;
          });
        } else {
          let removedOneTextTemp = false;
          pruned = existing.filter((m) => {
            if (m.id === message.id) return false;
            if (!(m.status === 'sending' && m.isMine && m.id.startsWith('temp-'))) return true;
            if (m.mediaId) return true;
            if (removedOneTextTemp) return true;
            const sameText = normText(m.textContent) === normText(message.textContent);
            const sameType = String(m.contentType || 'text') === String(message.contentType || 'text');
            if (sameText && sameType) {
              removedOneTextTemp = true;
              return false;
            }
            return true;
          });
        }
      }

      return { messagesByChat: { ...state.messagesByChat, [chatId]: [...pruned, message] } };
    }),

  updateMessage: (chatId, messageId, updates) =>
    set((state) => ({
      messagesByChat: {
        ...state.messagesByChat,
        [chatId]: (state.messagesByChat[chatId] || []).map((m) =>
          m.id === messageId ? { ...m, ...updates } : m,
        ),
      },
    })),

  removeMessage: (chatId, messageId) =>
    set((state) => ({
      messagesByChat: {
        ...state.messagesByChat,
        [chatId]: (state.messagesByChat[chatId] || []).filter((m) => m.id !== messageId),
      },
    })),

  setTypingUsers: (chatId, users) =>
    set((state) => ({ typingUsers: { ...state.typingUsers, [chatId]: users } })),

  setReplyingTo: (message) => set({ replyingTo: message }),
  setEditingMessage: (message) => set({ editingMessage: message }),

  prependMessages: (chatId, messages) =>
    set((state) => {
      const existing = state.messagesByChat[chatId] || [];
      const existingIds = new Set(existing.map((m) => m.id));
      const toPrepend = messages.filter((m) => m.id && !existingIds.has(m.id));
      for (const m of toPrepend) existingIds.add(m.id);
      const deduped = [...toPrepend, ...existing];
      return { messagesByChat: { ...state.messagesByChat, [chatId]: deduped } };
    }),

  clearAll: () =>
    set({ messagesByChat: {}, typingUsers: {}, replyingTo: null, editingMessage: null }),
}));
