import { NextResponse } from 'next/server';

import { submitChannelValue } from '@/lib/multiplayer';

type SubmitRequest = { token?: string; value?: number };

type SubmitResponse =
  | { ok: true; sessionId: string; state: unknown }
  | { ok: false; error: string };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as SubmitRequest;
  const token = typeof body.token === 'string' ? body.token : '';
  const value = Number(body.value);

  if (!token) return NextResponse.json({ ok: false, error: 'missing_token' } satisfies SubmitResponse, { status: 400 });
  if (!Number.isFinite(value)) return NextResponse.json({ ok: false, error: 'missing_value' } satisfies SubmitResponse, { status: 400 });

  try {
    const res = submitChannelValue(token, value);
    if (!res) return NextResponse.json({ ok: false, error: 'unauthorized_or_no_session' } satisfies SubmitResponse, { status: 403 });
    return NextResponse.json({ ok: true, sessionId: res.sessionId, state: res.state } satisfies SubmitResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'submit_failed';
    return NextResponse.json({ ok: false, error: msg } satisfies SubmitResponse, { status: 500 });
  }
}
