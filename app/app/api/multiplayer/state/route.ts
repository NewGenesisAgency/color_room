import { NextResponse } from 'next/server';

import { getLatestSession, listPlayers, startNewSession, touchPlayer, type MpSeat } from '@/lib/multiplayer';
import { getDb } from '@/lib/db';

type StateResponse =
  | {
      ok: true;
      sessionId: string;
      status: 'active' | 'finished';
      gameId: string;
      updatedAt: string;
      players: Array<{ seat: MpSeat; name: string; lastSeenAt: string }>;
      you: { seat: MpSeat } | null;
      state: unknown;
    }
  | { ok: false; error: string };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  let latest = getLatestSession();
  if (!latest) return NextResponse.json({ ok: false, error: 'no_session' } satisfies StateResponse, { status: 404 });

  try {
    const st: any = latest.state as any;
    const hasChannels = Boolean(st?.channelBySeat && typeof st.channelBySeat === 'object');
    const hasTargets = Boolean(st?.targetValueBySeat && typeof st.targetValueBySeat === 'object');
    const hasSubs = Boolean(st?.submittedValueBySeat && typeof st.submittedValueBySeat === 'object');
    // endsAtMs can be 0 in lobby mode (waiting for >=2 players)
    const hasEnds = Number.isFinite(Number(st?.endsAtMs ?? 0)) && Number(st.endsAtMs) >= 0;
    if (!hasChannels || !hasTargets || !hasSubs || !hasEnds) {
      startNewSession({ reset: true, durationMs: 2 * 60 * 1000 });
      latest = getLatestSession() ?? latest;
    }
  } catch {
    // ignore
  }

  if (latest.session.status === 'active') {
    try {
      const endsAtMs = Number((latest.state as any)?.endsAtMs ?? 0);
      const durationMs = Number((latest.state as any)?.durationMs ?? 0);
      const playersNow = listPlayers(latest.session.id);

      // lobby -> start when >= 2 players
      if (Number.isFinite(endsAtMs) && endsAtMs <= 0 && playersNow.length >= 2 && Number.isFinite(durationMs) && durationMs > 0) {
        const db = getDb();
        const st: any = latest.state as any;
        st.endsAtMs = Date.now() + durationMs;
        db.prepare("UPDATE crg_mp_sessions SET state_json = ?, updated_at = datetime('now') WHERE id = ?;").run(
          JSON.stringify(st),
          latest.session.id,
        );
        latest = getLatestSession() ?? latest;
      }

      if (Number.isFinite(endsAtMs) && endsAtMs > 0 && Date.now() >= endsAtMs) {
        const db = getDb();
        db.prepare("UPDATE crg_mp_sessions SET status = 'finished', updated_at = datetime('now') WHERE id = ?;").run(latest.session.id);
        latest = getLatestSession() ?? latest;
      }
    } catch {
      // ignore
    }
  }

  let you: { seat: MpSeat } | null = null;
  if (token) {
    const p = touchPlayer(String(token));
    if (p && p.session_id === latest.session.id) you = { seat: Number(p.seat) as MpSeat };
  }

  const players = listPlayers(latest.session.id).map((p) => ({
    seat: Number(p.seat) as MpSeat,
    name: p.name,
    lastSeenAt: p.last_seen_at,
  }));

  return NextResponse.json({
    ok: true,
    sessionId: latest.session.id,
    status: latest.session.status,
    gameId: latest.session.game_id,
    updatedAt: latest.session.updated_at,
    players,
    you,
    state: latest.state,
  } satisfies StateResponse);
}
