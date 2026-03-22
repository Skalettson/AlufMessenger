import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

/** Корень монорепозитория — нужен для корректного standalone + file tracing (pnpm workspace). */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(__dirname, '../..');

const nextConfig: NextConfig = {
  /** Served under https://domain/ma-dashboard/ — Next prefixes `/_next` automatically */
  basePath: '/ma-dashboard',
  output: 'standalone',
  /** Без этого в Docker часто «успешный» build, но в рантайме 404 на `/_next/static` и чанках. */
  outputFileTracingRoot: monorepoRoot,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.aluf.app',
      },
    ],
  },
};

export default nextConfig;
