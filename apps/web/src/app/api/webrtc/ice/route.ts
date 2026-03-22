import { NextResponse } from 'next/server';

const DEFAULT_STUN: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/**
 * GET /api/webrtc/ice — список ICE-серверов для звонков.
 * TURN задаётся через TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL (секреты только на сервере).
 *
 * Опционально: WEBRTC_ICE_SERVERS_JSON — полный JSON-массив RTCIceServer[] (переопределяет всё).
 */
export async function GET() {
  const jsonOverride = process.env.WEBRTC_ICE_SERVERS_JSON?.trim();
  if (jsonOverride) {
    try {
      const parsed = JSON.parse(jsonOverride) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return NextResponse.json({ iceServers: parsed }, { headers: { 'Cache-Control': 'private, max-age=60' } });
      }
    } catch {
      /* fall through */
    }
  }

  const servers: RTCIceServer[] = [...DEFAULT_STUN];

  const turnUrlsRaw = process.env.TURN_URLS?.trim();
  const user = process.env.TURN_USERNAME?.trim();
  const cred = process.env.TURN_CREDENTIAL?.trim();

  if (turnUrlsRaw && user && cred) {
    const urls = turnUrlsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const u of urls) {
      servers.push({ urls: u, username: user, credential: cred });
    }
  }

  return NextResponse.json({ iceServers: servers }, { headers: { 'Cache-Control': 'private, max-age=60' } });
}
