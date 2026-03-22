/**
 * Aluf Mini-Apps SDK - React Hooks
 * Хуки для интеграции с React приложениями
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlufBridge, createBridge } from '@aluf/ma-core';
import type {
  BridgeConfig,
  PlatformInfo,
  UserContext,
  ChatContext,
  ThemeType,
} from '@aluf/ma-core';

// ============================================
// useAlufApp - основной хук
// ============================================

interface UseAlufAppOptions {
  appId: string;
  debug?: boolean;
  autoInit?: boolean;
}

interface UseAlufAppReturn {
  bridge: AlufBridge | null;
  platform: PlatformInfo | null;
  user: UserContext | null;
  chat: ChatContext | null;
  ready: boolean;
  error: Error | null;
  theme: ThemeType;
  locale: string;
}

export function useAlufApp(options: UseAlufAppOptions): UseAlufAppReturn {
  const [bridge, setBridge] = useState<AlufBridge | null>(null);
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  const [user, setUser] = useState<UserContext | null>(null);
  const [chat, setChat] = useState<ChatContext | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [theme, setTheme] = useState<ThemeType>('auto');
  const [locale, setLocale] = useState('en');

  useEffect(() => {
    if (!options.autoInit) return;

    const config: BridgeConfig = {
      appId: options.appId,
      platform: 'aluf-messenger',
      debug: options.debug,
    };

    const alufBridge = createBridge(config);

    const handleReady = (data: {
      platform: PlatformInfo;
      user: UserContext;
      chat: ChatContext | null;
    }) => {
      setPlatform(data.platform);
      setUser(data.user);
      setChat(data.chat);
      setTheme(data.user.preferences?.theme || 'auto');
      setLocale(data.user.locale || 'en');
      setReady(true);
    };

    const handleError = (err: Error) => {
      setError(err);
    };

    alufBridge.on('ready', handleReady);
    alufBridge.on('error', handleError);

    setBridge(alufBridge);

    return () => {
      alufBridge.off('ready', handleReady);
      alufBridge.off('error', handleError);
    };
  }, [options.appId, options.debug, options.autoInit]);

  return {
    bridge,
    platform,
    user,
    chat,
    ready,
    error,
    theme,
    locale,
  };
}

// ============================================
// useAlufUser - хук пользователя
// ============================================

export function useAlufUser() {
  const [user, setUser] = useState<UserContext | null>(null);

  useEffect(() => {
    const initData = new URLSearchParams(window.location.search).get('alufWebAppData');
    if (!initData) return;

    try {
      const data = JSON.parse(decodeURIComponent(initData));
      setUser(data.user || null);
    } catch {
      // Игнорируем ошибки парсинга
    }
  }, []);

  return user;
}

// ============================================
// useAlufTheme - хук темы
// ============================================

export function useAlufTheme() {
  const [theme, setTheme] = useState<ThemeType>('auto');

  useEffect(() => {
    const initData = new URLSearchParams(window.location.search).get('alufWebAppData');
    if (!initData) return;

    try {
      const data = JSON.parse(decodeURIComponent(initData));
      setTheme(data.user?.preferences?.theme || 'auto');
    } catch {
      // Игнорируем ошибки
    }

    // Слушаем изменения темы
    const handleThemeChange = (event: MessageEvent) => {
      if (event.data?.type === 'themeChange') {
        setTheme(event.data.theme);
      }
    };

    window.addEventListener('message', handleThemeChange);
    return () => window.removeEventListener('message', handleThemeChange);
  }, []);

  return theme;
}

// ============================================
// useAlufMainButton - хук главной кнопки
// ============================================

interface UseAlufMainButtonOptions {
  text: string;
  color?: string;
  textColor?: string;
  disabled?: boolean;
  visible?: boolean;
  progress?: boolean;
}

export function useAlufMainButton(
  options: UseAlufMainButtonOptions,
  onClick?: () => void
) {
  const bridge = useAlufApp({ appId: 'hook', autoInit: false }).bridge;

  useEffect(() => {
    if (!bridge) return;

    bridge.ui.setMainButton({
      text: options.text,
      color: options.color,
      textColor: options.textColor,
      disabled: options.disabled,
      visible: options.visible ?? true,
      progress: options.progress,
    });

    return () => {
      bridge.ui.hideMainButton();
    };
  }, [bridge, options]);

  useEffect(() => {
    if (!bridge || !onClick) return;
    const unsub = bridge.ui.onMainButtonClick(onClick);
    return () => { unsub(); };
  }, [bridge, onClick]);
}

// ============================================
// useAlufBackButton - хук кнопки назад
// ============================================

export function useAlufBackButton(onClick?: () => void) {
  const bridge = useAlufApp({ appId: 'hook', autoInit: false }).bridge;

  useEffect(() => {
    if (!bridge) return;

    bridge.ui.setBackButton({ visible: true });

    return () => {
      bridge.ui.hideBackButton();
    };
  }, [bridge]);

  useEffect(() => {
    if (!bridge || !onClick) return;
    const unsub = bridge.ui.onBackButtonClick(onClick);
    return () => { unsub(); };
  }, [bridge, onClick]);
}

// ============================================
// useAlufStorage - хук хранилища
// ============================================

export function useAlufStorage<T>(
  key: string,
  initialValue: T,
  scope: 'user' | 'app' | 'global' = 'app'
) {
  const [value, setValue] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const bridge = useAlufApp({ appId: 'hook', autoInit: false }).bridge;

  useEffect(() => {
    if (!bridge) return;

    const load = async () => {
      try {
        const stored = await bridge.storage.get<T>(key, { scope });
        if (stored !== null) {
          setValue(stored);
        }
      } catch {
        // Используем initialValue
      }
      setLoading(false);
    };

    load();
  }, [bridge, key, scope]);

  const setValuePersist = useCallback(
    async (newValue: T | ((prev: T) => T)) => {
      if (!bridge) return;

      const valueToSet =
        typeof newValue === 'function'
          ? (newValue as (prev: T) => T)(value)
          : newValue;

      setValue(valueToSet);
      await bridge.storage.set(key, valueToSet, { scope });
    },
    [bridge, key, scope, value]
  );

  return [value, setValuePersist, loading] as const;
}

// ============================================
// useAlufBot - хук для интеграции с ботом
// ============================================

export function useAlufBot() {
  const bridge = useAlufApp({ appId: 'hook', autoInit: false }).bridge;

  const sendMessage = useCallback(
    async (text: string) => {
      if (!bridge) throw new Error('Bridge not initialized');
      return bridge.bot.sendMessage('', text);
    },
    [bridge]
  );

  const getInitData = useCallback(() => {
    if (!bridge) return null;
    return bridge.bot.getInitData();
  }, [bridge]);

  return {
    sendMessage,
    getInitData,
    bridge,
  };
}

// ============================================
// useAlufViewport - хук вьюпорта
// ============================================

export function useAlufViewport() {
  const [height, setHeight] = useState(window.innerHeight);
  const [width, setWidth] = useState(window.innerWidth);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setHeight(window.innerHeight);
      setWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const expand = useCallback(async (bridge: AlufBridge | null) => {
    if (!bridge) return;
    await bridge.ui.expand();
    setIsExpanded(true);
  }, []);

  return {
    height,
    width,
    isExpanded,
    expand,
  };
}

// ============================================
// AlufProvider - контекст провайдер
// ============================================

import { createContext, useContext, ReactNode } from 'react';

interface AlufContextValue extends UseAlufAppReturn {
  expand: () => Promise<void>;
}

const AlufContext = createContext<AlufContextValue | null>(null);

interface AlufProviderProps {
  appId: string;
  debug?: boolean;
  children: ReactNode;
}

export function AlufProvider({ appId, debug, children }: AlufProviderProps) {
  const appState = useAlufApp({ appId, debug, autoInit: true });

  const expand = useCallback(async () => {
    if (appState.bridge) {
      await appState.bridge.ui.expand();
    }
  }, [appState.bridge]);

  const value = useMemo<AlufContextValue>(
    () => ({ ...appState, expand }),
    [appState, expand]
  );

  return (
    <AlufContext.Provider value={value}>{children}</AlufContext.Provider>
  );
}

export function useAluf() {
  const context = useContext(AlufContext);
  if (!context) {
    throw new Error('useAluf must be used within AlufProvider');
  }
  return context;
}
