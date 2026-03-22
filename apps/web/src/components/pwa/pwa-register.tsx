'use client';

import { useEffect, useMemo, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function PwaRegister() {
  const [canInstall, setCanInstall] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const isIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    let hasRefreshed = false;

    const onControllerChange = () => {
      if (hasRefreshed) return;
      hasRefreshed = true;
      window.location.reload();
    };

    const requestSkipWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    };

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };
    const onAppInstalled = () => {
      setCanInstall(false);
      setInstallEvent(null);
      setDismissed(false);
      setIsStandalone(true);
    };
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);

    setIsOffline(!navigator.onLine);
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true,
    );

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.update();
        requestSkipWaiting(reg);
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              requestSkipWaiting(reg);
            }
          });
        });
      })
      .catch(() => {});

    const updateTimer = window.setInterval(() => {
      navigator.serviceWorker.getRegistration('/').then((reg) => reg?.update()).catch(() => {});
    }, 60_000);

    return () => {
      window.clearInterval(updateTimer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const showInstallBanner = !dismissed && !isStandalone && (canInstall || isIOS);

  return (
    <>
      {showInstallBanner && (
        <div className="fixed bottom-3 left-1/2 z-[120] w-[min(640px,calc(100%-1rem))] -translate-x-1/2 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-xl backdrop-blur">
          <div className="flex items-center gap-2 text-sm">
            <div className="min-w-0 flex-1 text-foreground">
              {canInstall
                ? 'Установите Aluf как приложение для быстрого запуска.'
                : 'На iPhone/iPad: Поделиться -> На экран Домой для установки PWA.'}
            </div>
            {canInstall && installEvent && (
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                onClick={async () => {
                  try {
                    await installEvent.prompt();
                    await installEvent.userChoice;
                  } catch {
                    // ignore
                  } finally {
                    setCanInstall(false);
                    setInstallEvent(null);
                  }
                }}
              >
                Установить
              </button>
            )}
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
              onClick={() => setDismissed(true)}
            >
              Скрыть
            </button>
          </div>
        </div>
      )}

      {isOffline && (
        <div className="fixed right-3 top-3 z-[120] rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground shadow-lg">
          Нет сети - работаем офлайн
        </div>
      )}
    </>
  );
}
