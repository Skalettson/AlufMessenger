import type { Metadata, Viewport } from 'next';
import { QueryProvider } from './providers';
import { AppearanceProvider } from '@/components/theme/appearance-provider';
import { VisualViewportProvider } from '@/components/providers/visual-viewport-provider';
import { IosPlatformProvider } from '@/components/providers/ios-platform-provider';
import { PwaRegister } from '@/components/pwa/pwa-register';
import { FcmProvider } from '@/components/fcm/fcm-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aluf Messenger',
  description: 'Быстрый и безопасный мессенджер',
  applicationName: 'Aluf Messenger',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Aluf',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  formatDetection: {
    telephone: false,
    email: false,
  },
  icons: {
    icon: '/favicon.ico',
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  /** Chrome/Android: вьюпорт сжимается при открытой клавиатуре (дополняет --app-vh на iOS) */
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0088CC' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a2e' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className="h-full overflow-hidden">
      <body className="antialiased h-full min-h-0 overflow-hidden overscroll-none">
        <QueryProvider>
          <AppearanceProvider>
            <IosPlatformProvider>
              <VisualViewportProvider>
                {/* Высота = VisualViewport на iOS (клавиатура), иначе fallback 100dvh */}
                <div className="app-shell flex h-[var(--app-vh,100dvh)] min-h-0 flex-col overflow-hidden">
                  {children}
                </div>
              </VisualViewportProvider>
            </IosPlatformProvider>
            <PwaRegister />
            <FcmProvider />
          </AppearanceProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
