import { NextResponse } from 'next/server';
import { submitSpectreGuess } from '@/lib/spectre';

type Body = { token: string; r: number; g: number; b: number };

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const token = typeof body.token === 'string' ? body.token : '';
    const r = Number(body.r ?? 0);
    const g = Number(body.g ?? 0);
    const b = Number(body.b ?? 0);

    if (!token) return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });

    const result = submitSpectreGuess(token, r, g, b);
    if (!result) return NextResponse.json({ ok: false, error: 'guess_failed' }, { status: 400 });

    return NextResponse.json({ ok: true, sessionId: result.sessionId, state: result.state });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'guess_failed' }, { status: 500 });
  }
}
