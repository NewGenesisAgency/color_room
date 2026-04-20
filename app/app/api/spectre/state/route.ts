import { NextResponse } from 'next/server';
import { getLatestSpectreSession, listSpectrePlayers, touchSpectrePlayer, advanceSpectrePhase } from '@/lib/spectre';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') ?? '';

    let latest = getLatestSpectreSession();
    if (!latest) return NextResponse.json({ ok: false, error: 'no_session' }, { status: 404 });

    // Auto-advance if phase timer expired
    if (latest.session.status === 'active') {
      const { state } = latest;
      const now = Date.now();
      if (state.phaseEndsAtMs > 0 && now >= state.phaseEndsAtMs &&
          (state.phase === 'reveal' || state.phase === 'guess' || state.phase === 'result')) {
        advanceSpectrePhase(latest.session.id);
        latest = getLatestSpectreSession() ?? latest;
      }
    }

    let you: { seat: number } | null = null;
    if (token) {
      const p = touchSpectrePlayer(token);
      if (p && p.session_id === latest.session.id) you = { seat: Number(p.seat) };
    }

    const players = listSpectrePlayers(latest.session.id).map((p) => ({
      seat: Number(p.seat),
      name: p.name,
    }));

    return NextResponse.json({
      ok: true,
      sessionId: latest.session.id,
      status: latest.session.status,
      updatedAt: latest.session.updated_at,
      players,
      you,
      state: latest.state,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'state_failed' }, { status: 500 });
  }
}
