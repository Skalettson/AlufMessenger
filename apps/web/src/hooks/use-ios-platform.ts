'use client';

import { useEffect, useState } from 'react';

export type IosPlatformState = {
  /** true после гидрации, если Safari / WebView на iPhone, iPod, iPad */
  isIOS: boolean;
  /** мажорная версия iOS/iPadOS из UA или null */
  iosMajor: number | null;
  /** true если IosPlatformProvider выставил data-ios-hig="26" (iOS 26+) */
  isIosHig26: boolean;
  /** PWA «Добавить на экран Домой» / standalone */
  isPwaStandalone: boolean;
};

const initial: IosPlatformState = {
  isIOS: false,
  iosMajor: null,
  isIosHig26: false,
  isPwaStandalone: false,
};

function readFromDocument(): IosPlatformState {
  if (typeof document === 'undefined') return initial;
  const root = document.documentElement;
  const majorStr = root.dataset.iosMajor;
  return {
    isIOS: root.dataset.platform === 'ios',
    iosMajor: majorStr != null && majorStr !== '' ? parseInt(majorStr, 10) : null,
    isIosHig26: root.dataset.iosHig === '26',
    isPwaStandalone: root.dataset.pwaStandalone === 'true',
  };
}

/**
 * Состояние платформы iOS после монтирования (согласовано с {@link IosPlatformProvider} на `<html>`).
 * Для Android смотрите `document.documentElement.dataset.platform === 'android'` и `androidMajor`.
 * На SSR возвращает нули — используйте только в клиентских компонентах после гидрации.
 */
export function useIosPlatform(): IosPlatformState {
  const [state, setState] = useState<IosPlatformState>(initial);

  useEffect(() => {
    setState(readFromDocument());
  }, []);

  return state;
}
