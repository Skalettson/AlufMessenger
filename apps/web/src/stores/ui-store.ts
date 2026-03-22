import { create } from 'zustand';
import type { ChatPreview } from '@/stores/chat-store';

type Theme = 'light' | 'dark' | 'system';
type ModalType =
  | 'new-chat'
  | 'new-group'
  | 'profile'
  | 'profile-card'
  | 'chat-info'
  | 'chat-search'
  | 'forward'
  | 'media-viewer'
  | null;

export interface ActiveCall {
  callId: string;
  chatId: string;
  chatTitle: string;
  chatAvatar: string | null;
  callType: 'voice' | 'video';
  isIncoming: boolean;
  /** Второй участник (личный чат), для WebRTC 1:1 */
  peerUserId?: string | null;
}

export interface PendingChatDelete {
  chat: ChatPreview;
  type: 'me' | 'everyone';
}

interface UiState {
  theme: Theme;
  sidebarOpen: boolean;
  activeModal: ModalType;
  modalData: unknown;
  mediaViewerIndex: number;
  activeCall: ActiveCall | null;
  pendingChatDelete: PendingChatDelete | null;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  openModal: (modal: ModalType, data?: unknown) => void;
  closeModal: () => void;
  setMediaViewerIndex: (index: number) => void;
  setActiveCall: (call: ActiveCall | null) => void;
  setPendingChatDelete: (payload: PendingChatDelete | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: 'system',
  sidebarOpen: true,
  activeModal: null,
  modalData: null,
  mediaViewerIndex: 0,
  activeCall: null,
  pendingChatDelete: null,

  setTheme: (theme) => {
    set({ theme });
    if (typeof window !== 'undefined') {
      localStorage.setItem('aluf-theme', theme);
      applyTheme(theme);
    }
  },
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openModal: (modal, data) => set({ activeModal: modal, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),
  setMediaViewerIndex: (index) => set({ mediaViewerIndex: index }),
  setActiveCall: (call) => set({ activeCall: call }),
  setPendingChatDelete: (payload) => set({ pendingChatDelete: payload }),
}));

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', isDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}

if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('aluf-theme') as Theme | null;
  if (saved) {
    useUiStore.getState().setTheme(saved);
  }
}
