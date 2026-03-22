import { NextRequest, NextResponse } from 'next/server';
import * as http from 'http';
import * as https from 'https';

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';

/** Headers to forward from the client request to the API Gateway. */
const FORWARD_HEADERS = [
  'authorization',
  'content-type',
  'accept',
  'accept-language',
  'x-access-token',
] as const;

function buildGatewayUrl(pathSegments: string[] | undefined, request: NextRequest): string {
  const path = pathSegments?.length ? pathSegments.join('/') : '';
  const search = request.nextUrl.search;
  const base = API_GATEWAY_URL.replace(/\/$/, '');
  return `${base}/${path}${search}`;
}

function getForwardHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }
  // Явно пробуем оба варианта регистра (NextRequest headers case-insensitive, но надёжнее дублировать)
  const auth =
    request.headers.get('authorization') ??
    request.headers.get('Authorization') ??
    (request.headers as unknown as Record<string, string>)?.['authorization'] ??
    (request.headers as unknown as Record<string, string>)?.['Authorization'];
  const xToken = request.headers.get('x-access-token') ?? request.headers.get('X-Access-Token');
  if (auth && auth.trim()) {
    headers['Authorization'] = auth.trim();
  } else if (xToken && xToken.trim()) {
    const token = xToken.trim().replace(/^Bearer\s+/i, '');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  return proxy(request, context.params, 'GET');
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  return proxy(request, context.params, 'POST');
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  return proxy(request, context.params, 'PATCH');
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  return proxy(request, context.params, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  return proxy(request, context.params, 'DELETE');
}

/** Проксирование через нативный http(s).request — без искажений заголовков (fetch иногда портит длинные Authorization). */
function proxyWithHttp(
  urlStr: string,
  method: string,
  headers: Record<string, string>,
  body: Buffer | undefined,
): Promise<{ status: number; statusText: string; headers: Record<string, string>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    const outHeaders = { ...headers };
    if (body !== undefined && body.length > 0) {
      outHeaders['Content-Length'] = String(body.length);
      if (!outHeaders['content-type'] && !outHeaders['Content-Type']) {
        outHeaders['Content-Type'] = 'application/json; charset=utf-8';
      }
    }
    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: outHeaders,
    };
    const req = client.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const outHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          if (typeof v === 'string') outHeaders[k] = v;
          else if (Array.isArray(v) && v.length) outHeaders[k] = v[v.length - 1];
        }
        resolve({
          status: res.statusCode ?? 500,
          statusText: res.statusMessage ?? '',
          headers: outHeaders,
          body: Buffer.concat(chunks),
        });
      });
    });
    req.on('error', reject);
    if (body !== undefined && body.length > 0) {
      req.write(body);
    }
    req.end();
  });
}

async function proxy(
  request: NextRequest,
  paramsPromise: Promise<{ path?: string[] }>,
  method: string,
) {
  const { path: pathSegments } = await paramsPromise;
  const url = buildGatewayUrl(pathSegments, request);
  const headersObj = getForwardHeaders(request);
  const authFromRequest = request.headers.get('authorization') ?? request.headers.get('Authorization');
  const xToken = request.headers.get('x-access-token') ?? request.headers.get('X-Access-Token');
  if (authFromRequest?.trim()) {
    headersObj['Authorization'] = authFromRequest.trim();
  } else if (xToken?.trim()) {
    const token = xToken.trim().replace(/^Bearer\s+/i, '');
    if (token) headersObj['Authorization'] = `Bearer ${token}`;
  }

  let body: Buffer | undefined;
  if (method !== 'GET' && method !== 'DELETE') {
    const ct = request.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      const rawText = await request.text();
      body = Buffer.from(rawText, 'utf-8');
      headersObj['Content-Type'] = 'application/json; charset=utf-8';
      if (pathSegments?.includes('stories') && method === 'POST') {
        try {
          const p = rawText.trim() ? (JSON.parse(rawText) as Record<string, unknown>) : {};
          const hasMediaId = !!(p?.mediaId ?? p?.media_id);
          console.info('[API proxy] POST /stories body:', {
            hasMediaId,
            keys: Object.keys(p ?? {}),
            mediaId: p?.mediaId ?? p?.media_id ?? '(absent)',
            rawLen: rawText.length,
          });
        } catch {
          console.warn('[API proxy] POST /stories: body not valid JSON');
        }
      }
    } else {
      body = Buffer.from(await request.arrayBuffer());
    }
  }

  try {
    const res = await proxyWithHttp(url, method, headersObj, body);
    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    const contentType = res.headers['content-type'] || '';
    const isJson = contentType.includes('application/json');
    const bodyStr = res.body.toString('utf-8');
    const responseBody = isJson ? (bodyStr ? JSON.parse(bodyStr) : {}) : bodyStr;

    if (isJson) {
      return NextResponse.json(responseBody, { status: res.status, statusText: res.statusText });
    }
    return new NextResponse(responseBody, {
      status: res.status,
      statusText: res.statusText,
      headers: { 'content-type': contentType },
    });
  } catch (err) {
    console.error('[API proxy]', err);
    return NextResponse.json(
      { message: 'Gateway unavailable', error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 502 },
    );
  }
}
