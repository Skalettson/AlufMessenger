import { NextResponse } from 'next/server';

/**
 * Совместимость: WebRTC без LiveKit — токен не нужен, комната логическая.
 * Клиенты ходят в API Gateway /v1/calls/:id/token; этот route может не использоваться.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: callId } = await params;
  return NextResponse.json({
    roomName: `call_${callId}`,
    token: '',
    livekitUrl: '',
  });
}
