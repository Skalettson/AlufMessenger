'use client';

import { useEffect } from 'react';

const CHAT_BG_MAP: Record<string, string> = {
  default: 'var(--color-chat-bg)',
  'dark-blue': '#0f1923',
  forest: '#1a2e1a',
  wine: '#2a1520',
  ocean: '#152535',
  charcoal: '#1a1a1a',
  /** Подложка под загруженный фон (затемняется градиентом из --chat-wallpaper-stack) */
  wallpaper: '#0e1621',
};

const FONT_SIZE_MAP: Record<string, string> = {
  small: '13px',
  medium: '14px',
  large: '16px',
};

const BUBBLE_RADIUS_MAP: Record<string, string> = {
  rounded: '1rem',
  sharp: '0.375rem',
};

function applyAppearance() {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const accent = localStorage.getItem('aluf-accent') || '#0088CC';
  const chatBgId = localStorage.getItem('aluf-chat-bg') || 'default';
  const fontSizeId = localStorage.getItem('aluf-font-size') || 'medium';
  const bubbleId = localStorage.getItem('aluf-bubble-style') || 'rounded';

  root.style.setProperty('--color-primary', accent);
  root.style.setProperty('--color-primary-hover', accent);
  root.style.setProperty('--color-ring', accent);
  root.style.setProperty('--color-bubble-mine', accent);
  root.style.setProperty('--color-chat-bg', CHAT_BG_MAP[chatBgId] ?? CHAT_BG_MAP.default);
  root.style.setProperty('--message-font-size', FONT_SIZE_MAP[fontSizeId] ?? FONT_SIZE_MAP.medium);
  root.style.setProperty('--bubble-radius', BUBBLE_RADIUS_MAP[bubbleId] ?? BUBBLE_RADIUS_MAP.rounded);

  const wp = localStorage.getItem('aluf-chat-wallpaper-data');
  if (wp && wp.length > 40) {
    const dimRaw = parseFloat(localStorage.getItem('aluf-chat-wallpaper-dim') || '0.38');
    const dim = Math.min(0.85, Math.max(0, Number.isFinite(dimRaw) ? dimRaw : 0.38));
    root.style.setProperty(
      '--chat-wallpaper-stack',
      `linear-gradient(rgba(0,0,0,${dim}),rgba(0,0,0,${dim})), url(${JSON.stringify(wp)})`,
    );
  } else {
    root.style.removeProperty('--chat-wallpaper-stack');
  }
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyAppearance();
    const handler = () => applyAppearance();
    window.addEventListener('storage', handler);
    window.addEventListener('aluf-appearance', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('aluf-appearance', handler);
    };
  }, []);
  return <>{children}</>;
}

export function dispatchAppearanceUpdate() {
  if (typeof window !== 'undefined') {
    applyAppearance();
    window.dispatchEvent(new Event('aluf-appearance'));
  }
}
