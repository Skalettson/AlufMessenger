import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Standalone output for Docker deployment
  output: 'standalone',
  // Проксирование API запросов на API Gateway
  async rewrites() {
    const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://127.0.0.1:3000';
    return [
      // Исключаем media stream — это обрабатывается Next.js route handler
      {
        source: '/api/media/:id/stream',
        destination: '/api/media/:id/stream', // остаётся на Next.js
      },
      // Все остальные API запросы проксируются на API Gateway
      {
        source: '/api/:path*',
        destination: `${apiGatewayUrl}/api/:path*`,
      },
      {
        source: '/v:version/:path*',
        destination: `${apiGatewayUrl}/v:version/:path*`,
      },
    ];
  },
  // CORS headers для прокси
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Request-Id, X-Access-Token' },
        ],
      },
      /** Явно разрешаем getUserMedia для микрофона/камеры (если прокси не перезапишет). */
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'microphone=(self), camera=(self), display-capture=(self)',
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: '127.0.0.1', port: '9000' },
      { protocol: 'http', hostname: 'localhost', port: '9000' },
      // Set NEXT_PUBLIC_IMAGE_REMOTE_HOST / pattern in private builds; public tree uses a neutral placeholder.
      { protocol: 'https', hostname: 'cdn.example.com' },
    ],
  },
};

export default nextConfig;
