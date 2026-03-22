import { create } from 'zustand';
import { api, setTokens, clearTokens, loadTokens, getAccessToken, ApiError } from '@/lib/api';
import { clearMessageCache } from '@/lib/message-cache';
import { useMessageStore } from '@/stores/message-store';

interface User {
  id: string;
  alufId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  statusText: string | null;
  statusEmoji: string | null;
  premiumBadgeEmoji: string | null;
  isPremium: boolean;
  isVerified: boolean;
  isOfficial: boolean;
  isOnline: boolean;
  isTwoFactorEnabled: boolean;
}

type FlowType = 'register' | 'login';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  verificationId: string | null;
  devCode: string | null;
  flowType: FlowType | null;
  login: (email: string) => Promise<void>;
  register: (data: { username: string; displayName: string; email: string }) => Promise<void>;
  verify: (code: string, twoFactorCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  initialize: () => Promise<void>;
}

interface OtpResponse {
  verificationId: string;
  devCode?: string;
  requires_2fa?: boolean;
  requires2fa?: boolean;
}

export const useAuthStore = create<AuthState & {
  requires2fa: boolean;
  twoFactorVerified: boolean;
  setRequires2fa: (value: boolean) => void;
  setTwoFactorVerified: (value: boolean) => void;
}>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  verificationId: null,
  devCode: null,
  flowType: null,
  requires2fa: false,
  twoFactorVerified: false,

  login: async (email: string) => {
    const res = await api.post<OtpResponse>(
      '/auth/login',
      { email },
    );
    set({
      verificationId: res.verificationId,
      devCode: res.devCode || null,
      flowType: 'login',
      requires2fa: res.requires_2fa ?? res.requires2fa ?? false,
      twoFactorVerified: false,
    });
  },

  register: async (data) => {
    const res = await api.post<OtpResponse>('/auth/register', data);
    set({
      verificationId: res.verificationId,
      devCode: res.devCode || null,
      flowType: 'register',
    });
  },

  verify: async (code: string, twoFactorCode?: string) => {
    const { verificationId, flowType, requires2fa, twoFactorVerified } = get();
    if (!verificationId) throw new Error('Нет активной верификации');
    
    const deviceInfo = typeof navigator !== 'undefined' ? {
      platform: 'web',
      deviceName: navigator.userAgent || 'Web Browser',
      appVersion: '1.0.0',
      osVersion: navigator.platform || null,
    } : undefined;
    const res = await api.post<{ accessToken?: string; refreshToken?: string; access_token?: string; refresh_token?: string }>(
      '/auth/verify',
      { verificationId, code, type: flowType || 'register', twoFactorCode, deviceInfo },
    );
    const access = res.accessToken ?? res.access_token;
    const refresh = res.refreshToken ?? res.refresh_token;
    if (typeof access !== 'string' || typeof refresh !== 'string') {
      throw new Error('Неверный ответ сервера при входе');
    }
    setTokens(access, refresh);
    console.log('[auth-store] Setting isAuthenticated = true');
    // Сбрасываем verificationId только если 2FA не требуется или уже верифицирован
    // Если требуется 2FA и код не передан (первый шаг) - сохраняем verificationId
    const is2faFirstStep = requires2fa && !twoFactorVerified && !twoFactorCode;
    set({ 
      isAuthenticated: true, 
      verificationId: is2faFirstStep ? verificationId : null, 
      devCode: null, 
      flowType: null, 
      requires2fa: false, 
      twoFactorVerified: !requires2fa || !!twoFactorCode
    });
    console.log('[auth-store] Current state:', get());
    // Загружаем данные пользователя в фоне
    get().fetchCurrentUser().catch(() => {});
  },
  
  setRequires2fa: (value: boolean) => set({ requires2fa: value }),
  setTwoFactorVerified: (value: boolean) => set({ twoFactorVerified: value }),

  logout: async () => {
    try { await api.post('/auth/logout'); } catch {}
    clearTokens();
    clearMessageCache();
    useMessageStore.getState().clearAll();
    set({ user: null, isAuthenticated: false });
  },

  fetchCurrentUser: async () => {
    try {
      console.log('[auth-store] fetchCurrentUser: calling /users/me');
      const data = await api.get<User & { cover_url?: string; is_premium?: boolean; is_verified?: boolean; is_official?: boolean; premium_badge_emoji?: string | null; is_two_factor_enabled?: boolean }>('/users/me');
      console.log('[auth-store] fetchCurrentUser: received data', data);
      const user: User = {
        ...data,
        coverUrl: data.coverUrl ?? data.cover_url ?? null,
        isPremium: data.isPremium ?? data.is_premium ?? false,
        isVerified: data.isVerified ?? data.is_verified ?? false,
        isOfficial: data.isOfficial ?? data.is_official ?? false,
        premiumBadgeEmoji: data.premiumBadgeEmoji ?? data.premium_badge_emoji ?? null,
        isTwoFactorEnabled: data.isTwoFactorEnabled ?? data.is_two_factor_enabled ?? false,
      };
      console.log('[auth-store] fetchCurrentUser: setting user and isLoading=false');
      set({ user, isAuthenticated: true, isLoading: false });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('profile-updated'));
      }
    } catch (err) {
      const isAuthError = err instanceof ApiError && err.status === 401;
      if (isAuthError) {
        clearTokens();
        set({ user: null, isAuthenticated: false, isLoading: false });
      } else {
        // Сетевая ошибка - не сбрасываем сессию, возможно временная проблема
        console.error('[auth-store] fetchCurrentUser: error', err);
        set({ isLoading: false });
      }
    }
  },

  initialize: async () => {
    console.log('[auth-store] initialize() started');
    loadTokens();
    const token = getAccessToken();
    console.log('[auth-store] initialize() token:', token ? 'present' : 'none');
    if (token) {
      try {
        const data = await api.get<User & { cover_url?: string; is_premium?: boolean; is_verified?: boolean; is_official?: boolean; premium_badge_emoji?: string | null; is_two_factor_enabled?: boolean }>('/users/me');
        console.log('[auth-store] initialize() received user data');
        const user: User = {
          ...data,
          coverUrl: data.coverUrl ?? data.cover_url ?? null,
          isPremium: data.isPremium ?? data.is_premium ?? false,
          isVerified: data.isVerified ?? data.is_verified ?? false,
          isOfficial: data.isOfficial ?? data.is_official ?? false,
          premiumBadgeEmoji: data.premiumBadgeEmoji ?? data.premium_badge_emoji ?? null,
          isTwoFactorEnabled: data.isTwoFactorEnabled ?? data.is_two_factor_enabled ?? false,
        };
        set({ user, isAuthenticated: true, isLoading: false });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('profile-updated'));
        }
        console.log('[auth-store] initialize() state updated:', { user: !!user, isAuthenticated: true, isLoading: false });
      } catch (err) {
        const isAuthError = err instanceof ApiError && err.status === 401;
        if (isAuthError) {
          clearTokens();
          set({ user: null, isAuthenticated: false, isLoading: false });
        } else {
          // Сетевая ошибка - не сбрасываем сессию, возможно временная проблема
          console.error('[auth-store] initialize() error', err);
          set({ isLoading: false });
        }
      }
    } else {
      set({ isLoading: false });
    }
  },
}));
