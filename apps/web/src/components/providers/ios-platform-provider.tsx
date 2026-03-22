'use client';

import { useEffect } from 'react';

/** iPhone / iPod touch */
function isAppleMobileUA(ua: string): boolean {
  return /iPhone|iPod/.test(ua);
}

/** iPad (включая desktop UA на iPadOS) */
function isIPad(ua: string): boolean {
  if (/iPad/.test(ua)) return true;
  if (typeof navigator === 'undefined') return false;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export function isIOSClient(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return isAppleMobileUA(ua) || isIPad(ua);
}

/** Chrome / WebView на Android (не путать с десктопом) */
export function isAndroidClient(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

/** Мажорная версия iOS/iPadOS из UA (например 18 для iOS 18) */
export function parseIOSMajorVersion(ua: string): number | null {
  const m = /OS (\d+)[._](\d+)/.exec(ua);
  if (!m) return null;
  return parseInt(m[1], 10);
}

/** Мажорная версия Android из UA (13, 14, 15…) */
export function parseAndroidMajorVersion(ua: string): number | null {
  const m = /Android (\d+)/.exec(ua);
  if (!m) return null;
  return parseInt(m[1], 10);
}

function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function clearPlatformAttrs(root: HTMLElement) {
  delete root.dataset.platform;
  delete root.dataset.iosMajor;
  delete root.dataset.iosHig;
  delete root.dataset.androidMajor;
  delete root.dataset.pwaStandalone;
  root.classList.remove('ios-pwa', 'android-pwa');
}

/**
 * Помечает `<html>` для стилей под **Safari / PWA (iOS)** и **Chrome / PWA (Android)**:
 * safe-area, шрифты, скролл, вырезы (iPhone 13–17+, Android 13+).
 */
export function IosPlatformProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const ua = navigator.userAgent;

    if (isIOSClient()) {
      clearPlatformAttrs(root);
      root.dataset.platform = 'ios';
      const major = parseIOSMajorVersion(ua);
      if (major != null) {
        root.dataset.iosMajor = String(major);
        if (major >= 26) {
          root.dataset.iosHig = '26';
        }
      }
      if (isStandalonePWA()) {
        root.dataset.pwaStandalone = 'true';
        root.classList.add('ios-pwa');
      }
      return () => {
        clearPlatformAttrs(root);
      };
    }

    if (isAndroidClient()) {
      clearPlatformAttrs(root);
      root.dataset.platform = 'android';
      const am = parseAndroidMajorVersion(ua);
      if (am != null) {
        root.dataset.androidMajor = String(am);
      }
      if (isStandalonePWA()) {
        root.dataset.pwaStandalone = 'true';
        root.classList.add('android-pwa');
      }
      return () => {
        clearPlatformAttrs(root);
      };
    }

    root.dataset.platform = 'other';
    return () => {
      delete root.dataset.platform;
    };
  }, []);

  return <>{children}</>;
}
