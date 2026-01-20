import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';

import { randomId, readRoom } from '../_shared';

type JoinRoomRequest = { roomId?: string };

type JoinRoomResponse =
  | { ok: true; roomId: string; token: string; symbol: 'O' }
  | { ok: false; error: string };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as JoinRoomRequest;
  const roomId = String(body.roomId ?? '');
  if (!roomId) return NextResponse.json({ ok: false, error: 'missing roomId' } satisfies JoinRoomResponse, { status: 400 });

  const room = readRoom(roomId);
  if (!room) return NextResponse.json({ ok: false, error: 'room not found' } satisfies JoinRoomResponse, { status: 404 });
  if (room.player_o_token)
    return NextResponse.json({ ok: false, error: 'room already full' } satisfies JoinRoomResponse, { status: 409 });

  const token = randomId();
  const db = getDb();
  db.prepare(
    "UPDATE crg_morpion_rooms SET player_o_token = ?, status = 'playing', updated_at = datetime('now') WHERE id = ? AND player_o_token IS NULL;",
  ).run(token, roomId);

  const updated = readRoom(roomId);
  if (!updated || updated.player_o_token !== token) {
    return NextResponse.json({ ok: false, error: 'room already full' } satisfies JoinRoomResponse, { status: 409 });
  }

  return NextResponse.json({ ok: true, roomId, token, symbol: 'O' } satisfies JoinRoomResponse);
}
