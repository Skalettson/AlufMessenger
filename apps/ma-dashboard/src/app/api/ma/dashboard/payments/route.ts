import { NextResponse } from 'next/server';

/**
 * Прокси сводки по счетам: токен `MA_DASHBOARD_API_TOKEN` только на сервере Next.
 */
export async function GET() {
  const base = process.env.MA_PLATFORM_INTERNAL_URL?.replace(/\/$/, '') || 'http://127.0.0.1:3030';
  const token = process.env.MA_DASHBOARD_API_TOKEN?.trim() ?? '';

  const res = await fetch(`${base}/api/ma/dashboard/payments`, {
    cache: 'no-store',
    headers: {
      ...(token ? { 'X-Ma-Dashboard-Token': token } : {}),
    },
  });

  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  return NextResponse.json(data, { status: res.status });
}
