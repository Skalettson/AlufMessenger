'use client';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { ADMIN_USERNAME } from '@/lib/constants';

export function useAuth() {
  const store = useAuthStore();

  useEffect(() => {
    console.log('[useAuth] initialize() called');
    store.initialize();
  }, []);

  return store;
}

export function useIsAdmin(): boolean {
  const user = useAuthStore((s) => s.user);
  return user?.username === ADMIN_USERNAME;
}
