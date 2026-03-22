import { create } from 'zustand';

export interface PresenceState {
  isOnline: boolean;
  lastSeenAt?: string | null;
}

interface PresenceStoreState {
  byUserId: Record<string, PresenceState>;
  setPresence: (userId: string, state: PresenceState) => void;
  setBulk: (record: Record<string, PresenceState>) => void;
  get: (userId: string) => PresenceState | undefined;
}

export const usePresenceStore = create<PresenceStoreState>((set, get) => ({
  byUserId: {},
  setPresence: (userId, state) =>
    set((s) => ({
      byUserId: { ...s.byUserId, [userId]: state },
    })),
  setBulk: (record) =>
    set((s) => ({
      byUserId: { ...s.byUserId, ...record },
    })),
  get: (userId) => get().byUserId[userId],
}));
