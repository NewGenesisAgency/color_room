import { NextResponse } from 'next/server';
import { startSpectreSession, joinSpectreSession, touchSpectrePlayer, type SpSeat } from '@/lib/spectre';

type Body = { reset?: boolean; token?: string; name?: string; maxRounds?: number };

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const reset = Boolean(body.reset);
    const maxRounds = typeof body.maxRounds === 'number' ? body.maxRounds : 5;
    const name = typeof body.name === 'string' ? body.name : undefined;

    if (reset) {
      const token = typeof body.token === 'string' ? body.token : '';
      if (token) {
        const p = touchSpectrePlayer(token);
        if (!p || Number(p.seat) !== 1) {
          return NextResponse.json({ ok: false, error: 'only_host_can_reset' }, { status: 403 });
        }
      }
    }

    const { sessionId, state } = startSpectreSession({ reset, maxRounds });

    const reqToken = typeof body.token === 'string' ? body.token : '';
    if (!reqToken) {
      const joined = joinSpectreSession(sessionId, name);
      if (joined) {
        return NextResponse.json({ ok: true, sessionId, state, token: joined.token, seat: joined.seat as SpSeat });
      }
    }

    return NextResponse.json({ ok: true, sessionId, state });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'start_failed' }, { status: 500 });
  }
}
