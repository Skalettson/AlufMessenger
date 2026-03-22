import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Aluf Messenger',
    short_name: 'Aluf',
    description: 'Быстрый и безопасный мессенджер',
    start_url: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#0088CC',
    scope: '/',
    lang: 'ru',
    dir: 'ltr',
    icons: [
      { src: '/favicon.ico', sizes: '48x48', type: 'image/x-icon', purpose: 'any' },
      { src: '/icon-48.png', sizes: '48x48', type: 'image/png', purpose: 'any' },
      { src: '/icon-72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
      { src: '/icon-96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
      { src: '/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Чаты',
        short_name: 'Чаты',
        description: 'Открыть список чатов',
        url: '/chat',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Контакты',
        short_name: 'Контакты',
        description: 'Открыть контакты',
        url: '/contacts',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Настройки',
        short_name: 'Настройки',
        description: 'Открыть настройки',
        url: '/settings',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
    categories: ['social', 'communication'],
    prefer_related_applications: false,
  } as MetadataRoute.Manifest;
}
