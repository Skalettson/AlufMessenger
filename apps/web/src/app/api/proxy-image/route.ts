import { NextRequest, NextResponse } from 'next/server';

function isAllowedUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase();
    const port = url.port || (url.protocol === 'https:' ? '443' : '80');
    const allowedHosts = ['localhost', '127.0.0.1', 'minio'];
    if (!allowedHosts.includes(host)) return false;
    return port === '9000' || port === '9001';
  } catch {
    return false;
  }
}

/** Проксирует изображение с MinIO/хранилища на тот же origin, чтобы аватар и обложка грузились без CORS/403. */
export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get('url');
  if (!urlParam?.trim()) {
    return NextResponse.json({ message: 'url required' }, { status: 400 });
  }

  const decoded = decodeURIComponent(urlParam.trim());
  if (!isAllowedUrl(decoded)) {
    return NextResponse.json({ message: 'URL not allowed' }, { status: 403 });
  }

  try {
    const res = await fetch(decoded, {
      headers: { Accept: 'image/*,*/*' },
    });
    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const body = res.body;
    if (!body) return new NextResponse(null, { status: 502 });
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ message: 'Failed to fetch image' }, { status: 502 });
  }
}
