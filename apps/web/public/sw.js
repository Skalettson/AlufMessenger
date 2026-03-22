const CACHE_NAME = 'aluf-v2';
const STATIC_ASSETS = [
  '/',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-72.png',
  '/icon-96.png',
  '/offline.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Потоковое видео/аудио (сторис и т.п.): не перехватывать через SW.
  // Иначе в Firefox/Chrome fetch() в worker может падать на Range-запросах к /stream — «unexpected error».
  if (url.pathname.startsWith('/api/media/')) {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    // Остальной API: не отдаём устаревший кэш
    event.respondWith(fetch(request));
    return;
  }

  // Never serve HTML fallback for Next.js chunks/assets.
  // If a chunk is missing after deploy, let browser fail normally,
  // so the app can refresh to get the new build manifest.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(fetch(request));
    return;
  }

  if (url.pathname.match(/\.(js|css|woff2?|ttf|otf|ico|png|jpg|jpeg|svg|webp|avif)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/offline.html'))
      )
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

self.addEventListener('push', (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Aluf Messenger', body: event.data.text() };
    }
  }

  const { title = 'Aluf Messenger', body = '', icon, badge, ...rest } = data;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || '/icon-192.png',
      badge: badge || '/icon-72.png',
      data: rest,
      requireInteraction: false,
      silent: false,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
