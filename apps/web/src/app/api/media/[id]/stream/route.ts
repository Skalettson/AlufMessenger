import { NextRequest, NextResponse } from 'next/server';

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';

/** Проксирует медиафайл через тот же origin, чтобы избежать CORS и ошибок «Некорректный URI» при загрузке с MinIO. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ message: 'id required' }, { status: 400 });
  }

  const auth =
    request.headers.get('authorization') ??
    request.headers.get('Authorization') ??
    '';
  const xToken = request.headers.get('x-access-token') ?? request.headers.get('X-Access-Token');
  const qToken = request.nextUrl.searchParams.get('token')?.trim() ?? '';
  const token =
    auth.trim().replace(/^Bearer\s+/i, '') ||
    xToken?.trim().replace(/^Bearer\s+/i, '') ||
    qToken;
  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const base = API_GATEWAY_URL.replace(/\/$/, '');
  // API Gateway использует префикс /api, поэтому маршрут /api/v1/media/url/:id
  const gatewayUrl = `${base}/api/v1/media/url/${encodeURIComponent(id)}`;

  let res: Response;
  try {
    res = await fetch(gatewayUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Access-Token': token,
      },
    });
  } catch (err) {
    console.error('[media stream] gateway fetch error', err);
    return NextResponse.json({ message: 'Gateway unavailable' }, { status: 502 });
  }

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { message: text || 'Failed to get media URL' },
      { status: res.status },
    );
  }

  let data: { url?: string };
  try {
    data = await res.json();
  } catch {
    return NextResponse.json({ message: 'Invalid gateway response' }, { status: 502 });
  }

  const mediaUrl = data?.url ?? (data as unknown as { url?: string }).url;
  if (!mediaUrl || typeof mediaUrl !== 'string') {
    return NextResponse.json({ message: 'No media URL' }, { status: 502 });
  }

  let mediaRes: Response;
  try {
    mediaRes = await fetch(mediaUrl, { headers: { Accept: '*/*' } });
  } catch (err) {
    console.error('[media stream] media fetch error', err);
    return NextResponse.json({ message: 'Failed to load media resource' }, { status: 502 });
  }

  if (!mediaRes.ok) {
    return new NextResponse(null, { status: mediaRes.status });
  }

  const contentType = mediaRes.headers.get('content-type') || 'application/octet-stream';
  const body = mediaRes.body;
  if (!body) {
    return NextResponse.json({ message: 'Empty media' }, { status: 502 });
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
