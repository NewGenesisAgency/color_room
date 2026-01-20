import { NextResponse } from 'next/server';

import { createOrGetActiveSession, joinGuest, listPlayers, type MpSeat } from '@/lib/multiplayer';

type JoinRequest = { name?: string };

type JoinResponse =
  | { ok: true; sessionId: string; token: string; seat: MpSeat; players: Array<{ seat: MpSeat; name: string }>; state: unknown }
  | { ok: false; error: string };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as JoinRequest;
  const name = typeof body.name === 'string' ? body.name : undefined;

  try {
    const { sessionId, state } = createOrGetActiveSession();
    const joined = joinGuest(sessionId, name);
    if (!joined) return NextResponse.json({ ok: false, error: 'cannot_join' } satisfies JoinResponse, { status: 409 });

    const players = listPlayers(sessionId).map((p) => ({ seat: Number(p.seat) as MpSeat, name: p.name }));

    return NextResponse.json({
      ok: true,
      sessionId,
      token: joined.token,
      seat: joined.seat,
      players,
      state,
    } satisfies JoinResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'join_failed';
    return NextResponse.json({ ok: false, error: msg } satisfies JoinResponse, { status: 500 });
  }
}
