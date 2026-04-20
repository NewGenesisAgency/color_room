import { NextResponse } from 'next/server';
import { advanceSpectrePhase, touchSpectrePlayer, getLatestSpectreSession } from '@/lib/spectre';

type Body = { token: string; sessionId?: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const token = typeof body.token === 'string' ? body.token : '';
    if (!token) return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });

    const player = touchSpectrePlayer(token);
    if (!player || Number(player.seat) !== 1) {
      return NextResponse.json({ ok: false, error: 'only_host_can_advance' }, { status: 403 });
    }

    const result = advanceSpectrePhase(player.session_id);
    if (!result) return NextResponse.json({ ok: false, error: 'advance_failed' }, { status: 400 });

    const latest = getLatestSpectreSession();
    return NextResponse.json({ ok: true, state: result.state, sessionId: player.session_id, status: latest?.session.status ?? 'active' });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'advance_failed' }, { status: 500 });
  }
}
