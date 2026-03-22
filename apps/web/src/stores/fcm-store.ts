import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FcmState {
  token: string | null;
  isSubscribed: boolean;
  setToken: (token: string | null) => void;
  unsubscribe: () => void;
}

export const useFcmStore = create<FcmState>()(
  persist(
    (set) => ({
      token: null,
      isSubscribed: false,
      setToken: (token) =>
        set({
          token,
          isSubscribed: token !== null,
        }),
      unsubscribe: () =>
        set({
          token: null,
          isSubscribed: false,
        }),
    }),
    {
      name: 'fcm-storage',
    }
  )
);
