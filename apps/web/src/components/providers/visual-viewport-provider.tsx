'use client';

import { useEffect } from 'react';

/**
 * iOS Safari / PWA / Android: `100dvh` и `innerHeight` не совпадают с видимой областью при клавиатуре.
 * Обновляем --app-vh по VisualViewport — корневой flex уже «укорачивается» до видимой высоты.
 *
 * Важно: не дублировать отступ «под клавиатуру» через padding (старый --vv-keyboard-inset): при
 * innerHeight >> vv.height инсет получался ~высоте клавиатуры и складывался с уже укороченным --app-vh,
 * из‑за чего поле ввода «улетало» вверх от клавиатуры.
 */
export function VisualViewportProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    let raf = 0;

    const apply = () => {
      if (!vv) {
        root.style.setProperty('--app-vh', `${window.innerHeight}px`);
        root.style.setProperty('--vv-offset-top', '0px');
        root.style.setProperty('--vv-keyboard-inset', '0px');
        return;
      }
      const offsetTop = Math.round(vv.offsetTop);
      const h = Math.round(vv.height);
      root.style.setProperty('--app-vh', `${h}px`);
      root.style.setProperty('--vv-offset-top', `${offsetTop}px`);
      // Оставляем 0: высота оболочки уже = vv.height; доп. padding снизу не нужен (см. комментарий выше).
      root.style.setProperty('--vv-keyboard-inset', '0px');
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };

    apply();
    if (vv) {
      vv.addEventListener('resize', schedule, { passive: true });
      vv.addEventListener('scroll', schedule, { passive: true });
    }
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      if (vv) {
        vv.removeEventListener('resize', schedule);
        vv.removeEventListener('scroll', schedule);
      }
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      root.style.removeProperty('--app-vh');
      root.style.removeProperty('--vv-offset-top');
      root.style.removeProperty('--vv-keyboard-inset');
    };
  }, []);

  return <>{children}</>;
}
