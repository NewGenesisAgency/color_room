import { NextResponse } from 'next/server';
import { getLatestSpectreSession, getSpectreSessionById, listSpectrePlayers, touchSpectrePlayer, advanceSpectrePhase } from '@/lib/spectre';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') ?? '';

    // On résout d'abord la session du joueur via son token (et non « la dernière
    // session globale »), pour ne pas mélanger plusieurs parties simultanées ni
    // renvoyer une partie étrangère après restauration depuis localStorage.
    let me: { seat: number } | null = null;
    let latest = null as ReturnType<typeof getLatestSpectreSession>;
    if (token) {
      const p = touchSpectrePlayer(token);
      if (p) {
        me = { seat: Number(p.seat) };
        latest = getSpectreSessionById(p.session_id);
      }
    }
    if (!latest) latest = getLatestSpectreSession();
    if (!latest) return NextResponse.json({ ok: false, error: 'no_session' }, { status: 404 });

    // Auto-advance if phase timer expired
    if (latest.session.status === 'active') {
      const { state } = latest;
      const now = Date.now();
      if (state.phaseEndsAtMs > 0 && now >= state.phaseEndsAtMs &&
          (state.phase === 'reveal' || state.phase === 'guess' || state.phase === 'result')) {
        advanceSpectrePhase(latest.session.id);
        latest = getSpectreSessionById(latest.session.id) ?? latest;
      }
    }

    const you: { seat: number } | null = me;

    const players = listSpectrePlayers(latest.session.id).map((p) => ({
      seat: Number(p.seat),
      name: p.name,
    }));

    // Mask target color during guess phase to prevent cheating via network inspection
    const safeState = { ...latest.state };
    if (safeState.phase === 'guess') {
      safeState.targetR = -1;
      safeState.targetG = -1;
      safeState.targetB = -1;
    }

    return NextResponse.json({
      ok: true,
      sessionId: latest.session.id,
      roomCode: latest.session.room_code ?? latest.session.id,
      status: latest.session.status,
      updatedAt: latest.session.updated_at,
      players,
      you,
      state: safeState,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'state_failed' }, { status: 500 });
  }
}
