import { create } from 'zustand';

const FOLDERS_STORAGE_KEY = 'aluf_chat_folders';
const ARCHIVED_STORAGE_KEY = 'aluf_archived_chats';

/** Папки пользователя (чат в папке = отображается во вкладке папки). */
export const USER_FOLDERS = [{ id: 'personal', name: 'Личное' }] as const;

export interface ChatPreview {
  id: string;
  type: 'private' | 'group' | 'channel' | 'secret' | 'saved' | 'supergroup';
  title: string | null;
  description: string | null;
  avatarUrl: string | null;
  memberCount: number;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  lastMessageSender: string | null;
  unreadCount: number;
  isMuted: boolean;
  isPinned: boolean;
  /** Публичный username канала (для ссылки /c/username) */
  username?: string | null;
  /** Для личных чатов — собеседник бот */
  isBot?: boolean;
  /** Для личных чатов — у собеседника Premium */
  isPremium?: boolean;
  /** Кастомный эмодзи бейджа Premium у собеседника (личные чаты) */
  premiumBadgeEmoji?: string | null;
  /** Для личных чатов — подтвержденный аккаунт */
  isVerified?: boolean;
  /** Для личных чатов — официальный аккаунт */
  isOfficial?: boolean;
  /** Роль текущего пользователя (owner, admin, member) */
  myRole?: string;
  /** Может ли текущий пользователь публиковать (для каналов — только админы) */
  canPostMessages?: boolean;
  /** Для личных чатов — id собеседника (для отображения онлайн-статуса) */
  otherUserId?: string | null;
  /** С сервера (синхронизация архива) */
  isArchived?: boolean;
}

interface ChatState {
  chats: ChatPreview[];
  activeChatId: string | null;
  isLoading: boolean;
  searchQuery: string;
  activeFolder: string;
  /** chatId -> массив id папок, в которых состоит чат (персистится в localStorage; серверный sync — в планах через chat_folders). */
  chatFolderIds: Record<string, string[]>;
  /** chatId -> в архиве (персистится в localStorage). */
  archivedChatIds: Record<string, boolean>;
  /** Прокрутить к сообщению после поиска (сбрасывается в MessageList). */
  pendingScrollToMessageId: string | null;
  setPendingScrollToMessageId: (id: string | null) => void;
  setChats: (chats: ChatPreview[]) => void;
  setActiveChatId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setActiveFolder: (folder: string) => void;
  updateChat: (id: string, updates: Partial<ChatPreview>) => void;
  addChat: (chat: ChatPreview) => void;
  removeChat: (id: string) => void;
  setLoading: (loading: boolean) => void;
  addChatToFolder: (chatId: string, folderId: string) => void;
  removeChatFromFolder: (chatId: string, folderId: string) => void;
  isChatInFolder: (chatId: string, folderId: string) => boolean;
  setChatArchived: (chatId: string, archived: boolean) => void;
  isChatArchived: (chatId: string) => boolean;
}

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChatId: null,
  isLoading: false,
  searchQuery: '',
  activeFolder: 'all',
  chatFolderIds: loadJson<Record<string, string[]>>(FOLDERS_STORAGE_KEY, {}),
  archivedChatIds: loadJson<Record<string, boolean>>(ARCHIVED_STORAGE_KEY, {}),
  pendingScrollToMessageId: null,
  setPendingScrollToMessageId: (id) => set({ pendingScrollToMessageId: id }),

  setChats: (chats) =>
    set((state) => {
      const archived: Record<string, boolean> = { ...state.archivedChatIds };
      for (const c of chats) {
        if (typeof c.isArchived === 'boolean') {
          if (c.isArchived) archived[c.id] = true;
          else delete archived[c.id];
        }
      }
      saveJson(ARCHIVED_STORAGE_KEY, archived);
      return { chats, archivedChatIds: archived, isLoading: false };
    }),
  setActiveChatId: (id) => set({ activeChatId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveFolder: (folder) => set({ activeFolder: folder }),
  updateChat: (id, updates) =>
    set((state) => ({
      chats: state.chats.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  addChat: (chat) =>
    set((state) => {
      const idx = state.chats.findIndex((c) => c.id === chat.id);
      if (idx >= 0) {
        return { chats: state.chats.map((c) => (c.id === chat.id ? { ...c, ...chat } : c)) };
      }
      return { chats: [chat, ...state.chats] };
    }),
  removeChat: (id) =>
    set((state) => ({
      chats: state.chats.filter((c) => c.id !== id),
      activeChatId: state.activeChatId === id ? null : state.activeChatId,
    })),
  setLoading: (loading) => set({ isLoading: loading }),

  addChatToFolder: (chatId, folderId) =>
    set((state) => {
      const prev = state.chatFolderIds[chatId] ?? [];
      if (prev.includes(folderId)) return state;
      const next = { ...state.chatFolderIds, [chatId]: [...prev, folderId] };
      saveJson(FOLDERS_STORAGE_KEY, next);
      return { chatFolderIds: next };
    }),
  removeChatFromFolder: (chatId, folderId) =>
    set((state) => {
      const prev = state.chatFolderIds[chatId] ?? [];
      if (!prev.includes(folderId)) return state;
      const nextIds = prev.filter((id) => id !== folderId);
      const next = nextIds.length
        ? { ...state.chatFolderIds, [chatId]: nextIds }
        : (() => {
            const { [chatId]: _, ...rest } = state.chatFolderIds;
            return rest;
          })();
      saveJson(FOLDERS_STORAGE_KEY, next);
      return { chatFolderIds: next };
    }),
  isChatInFolder: (chatId, folderId) => (get().chatFolderIds[chatId] ?? []).includes(folderId),
  setChatArchived: (chatId, archived) =>
    set((state) => {
      const next = archived
        ? { ...state.archivedChatIds, [chatId]: true }
        : (() => {
            const { [chatId]: _, ...rest } = state.archivedChatIds;
            return rest;
          })();
      saveJson(ARCHIVED_STORAGE_KEY, next);
      return { archivedChatIds: next };
    }),
  isChatArchived: (chatId) => !!get().archivedChatIds[chatId],
}));
