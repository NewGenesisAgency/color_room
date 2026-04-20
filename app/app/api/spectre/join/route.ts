import { NextResponse } from 'next/server';
import { joinSpectreSession } from '@/lib/spectre';

type Body = { sessionId: string; name?: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    const name = typeof body.name === 'string' ? body.name : undefined;

    if (!sessionId) return NextResponse.json({ ok: false, error: 'missing_session_id' }, { status: 400 });

    const result = joinSpectreSession(sessionId, name);
    if (!result) return NextResponse.json({ ok: false, error: 'join_failed' }, { status: 400 });

    return NextResponse.json({ ok: true, token: result.token, seat: result.seat });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'join_failed' }, { status: 500 });
  }
}
