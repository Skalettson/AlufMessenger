import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ message: 'id required' }, { status: 400 });
  }

  const base = process.env.MA_PLATFORM_INTERNAL_URL?.replace(/\/$/, '') || 'http://127.0.0.1:3030';
  const token = process.env.MA_DASHBOARD_API_TOKEN?.trim() ?? '';

  const res = await fetch(`${base}/api/ma/apps/${encodeURIComponent(id)}`, {
    method: 'DELETE',
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
