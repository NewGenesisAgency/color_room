import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { randomId, readRoom, type P4Disc } from '../_shared';

// Un téléphone rejoint : 1er joueur = R (rose), 2e = J (bleu).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { roomId?: string };
  const roomId = String(body.roomId ?? '');
  if (!roomId) return NextResponse.json({ ok: false, error: 'missing_room' }, { status: 400 });

  const room = readRoom(roomId);
  if (!room) return NextResponse.json({ ok: false, error: 'room_not_found' }, { status: 404 });

  const db = getDb();
  const token = randomId();
  let disc: P4Disc;

  if (!room.player_r_token) {
    db.prepare("UPDATE crg_p4_rooms SET player_r_token = ?, updated_at = datetime('now') WHERE id = ? AND player_r_token IS NULL;").run(token, roomId);
    disc = 'R';
  } else if (!room.player_j_token) {
    db.prepare("UPDATE crg_p4_rooms SET player_j_token = ?, status = 'playing', updated_at = datetime('now') WHERE id = ? AND player_j_token IS NULL;").run(token, roomId);
    disc = 'J';
  } else {
    return NextResponse.json({ ok: false, error: 'room_full' }, { status: 409 });
  }

  const updated = readRoom(roomId);
  if (!updated || (disc === 'R' && updated.player_r_token !== token) || (disc === 'J' && updated.player_j_token !== token)) {
    return NextResponse.json({ ok: false, error: 'join_conflict' }, { status: 409 });
  }
  return NextResponse.json({ ok: true, roomId, token, disc });
}
