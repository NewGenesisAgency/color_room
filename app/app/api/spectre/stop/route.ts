import { NextResponse } from 'next/server';
import { stopSpectreSession } from '@/lib/spectre';

type Body = { token: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const token = typeof body.token === 'string' ? body.token : '';
    if (!token) return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });

    const result = stopSpectreSession(token);
    if (!result) return NextResponse.json({ ok: false, error: 'stop_failed' }, { status: 400 });

    return NextResponse.json({ ok: true, sessionId: result.sessionId });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'stop_failed' }, { status: 500 });
  }
}
