import { NextResponse } from 'next/server';

import { stopSession } from '@/lib/multiplayer';

type StopRequest = { token?: string };

type StopResponse =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as StopRequest;
  const token = typeof body.token === 'string' ? body.token : '';

  if (!token) return NextResponse.json({ ok: false, error: 'missing_token' } satisfies StopResponse, { status: 400 });

  try {
    const res = stopSession(token);
    if (!res) return NextResponse.json({ ok: false, error: 'only_seat1_can_stop' } satisfies StopResponse, { status: 403 });
    return NextResponse.json({ ok: true, sessionId: res.sessionId } satisfies StopResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'stop_failed';
    return NextResponse.json({ ok: false, error: msg } satisfies StopResponse, { status: 500 });
  }
}
