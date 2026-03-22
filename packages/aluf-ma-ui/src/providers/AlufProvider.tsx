/**
 * AlufProvider
 * Провайдер темы и конфигурации для UI компонентов
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  useMemo,
  useCallback,
} from 'react';
import type React from 'react';

export type ThemeType = 'light' | 'dark' | 'auto';
export type ColorScheme = 'light' | 'dark';

export interface AlufProviderProps {
  appId: string;
  children: ReactNode;
  defaultTheme?: ThemeType;
  debug?: boolean;
}

interface AlufContextValue {
  appId: string;
  theme: ThemeType;
  colorScheme: ColorScheme;
  setTheme: (theme: ThemeType) => void;
  isDark: boolean;
  ready: boolean;
}

const AlufContext = createContext<AlufContextValue | null>(null);

export function AlufProvider({
  appId,
  children,
  defaultTheme = 'auto',
  debug = false,
}: AlufProviderProps) {
  const [theme, setTheme] = useState<ThemeType>(defaultTheme);
  const [colorScheme, setColorScheme] = useState<ColorScheme>('light');
  const [ready, setReady] = useState(false);

  // Определяем системную тему
  const getSystemColorScheme = useCallback((): ColorScheme => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }, []);

  // Обновляем цветовую схему
  useEffect(() => {
    const updateColorScheme = () => {
      const newScheme = theme === 'auto' ? getSystemColorScheme() : theme;
      setColorScheme(newScheme);

      // Применяем класс к документу
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(newScheme);

      if (debug) {
        console.log('[AlufProvider] Theme updated:', newScheme);
      }
    };

    updateColorScheme();

    // Слушим изменения системной темы
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => updateColorScheme();
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
    return undefined;
  }, [theme, getSystemColorScheme, debug]);

  // Инициализация
  useEffect(() => {
    // Получаем тему из initData
    const initData = new URLSearchParams(window.location.search).get(
      'alufWebAppData'
    );
    if (initData) {
      try {
        const data = JSON.parse(decodeURIComponent(initData));
        if (data.user?.preferences?.theme) {
          setTheme(data.user.preferences.theme);
        }
      } catch {
        // Игнорируем ошибки
      }
    }

    // Слушим изменения темы от платформы
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'themeChange') {
        setTheme(event.data.theme);
      }
    };

    window.addEventListener('message', handleMessage);
    setReady(true);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const value = useMemo(
    () => ({
      appId,
      theme,
      colorScheme,
      setTheme,
      isDark: colorScheme === 'dark',
      ready,
    }),
    [appId, theme, colorScheme, setTheme, ready]
  );

  return (
    <AlufContext.Provider value={value}>{children}</AlufContext.Provider>
  );
}

// ============================================
// Hooks
// ============================================

export function useAlufTheme() {
  const context = useContext(AlufContext);
  if (!context) {
    throw new Error('useAlufTheme must be used within AlufProvider');
  }
  return {
    theme: context.theme,
    setTheme: context.setTheme,
    isDark: context.isDark,
    colorScheme: context.colorScheme,
  };
}

export function useAlufColorScheme() {
  const context = useContext(AlufContext);
  if (!context) {
    throw new Error('useAlufColorScheme must be used within AlufProvider');
  }
  return context.colorScheme;
}

export function useAlufAppId() {
  const context = useContext(AlufContext);
  if (!context) {
    throw new Error('useAlufAppId must be used within AlufProvider');
  }
  return context.appId;
}

export function useAlufReady() {
  const context = useContext(AlufContext);
  if (!context) {
    throw new Error('useAlufReady must be used within AlufProvider');
  }
  return context.ready;
}

// ============================================
// HOC
// ============================================

export function withAluf<P extends object>(
  Component: React.ComponentType<P>
) {
  return function AlufWrappedComponent(props: P) {
    return (
      <AlufProvider appId="hoc-app">
        <Component {...props} />
      </AlufProvider>
    );
  };
}
