import { NextRequest, NextResponse } from 'next/server';

/**
 * Прокси создания приложения: токен `MA_DASHBOARD_API_TOKEN` остаётся на сервере Next,
 * не попадает в публичный JS (в отличие от NEXT_PUBLIC_*).
 */
export async function POST(req: NextRequest) {
  const base = process.env.MA_PLATFORM_INTERNAL_URL?.replace(/\/$/, '') || 'http://127.0.0.1:3030';
  const token = process.env.MA_DASHBOARD_API_TOKEN?.trim() ?? '';

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const res = await fetch(`${base}/api/ma/apps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Ma-Dashboard-Token': token } : {}),
    },
    body: JSON.stringify(body),
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
