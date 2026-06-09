import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { randomId, P4_CELLS } from '../_shared';

// L'hôte (Color Room) crée une salle vide ; les 2 joueurs rejoignent ensuite.
export async function POST() {
  const roomId = randomId();
  const board = JSON.stringify(Array(P4_CELLS).fill(''));
  const db = getDb();
  db.prepare(
    "INSERT INTO crg_p4_rooms(id, board_json, turn, status, winner, updated_at) VALUES(?, ?, 'R', 'waiting', NULL, datetime('now'));",
  ).run(roomId, board);
  return NextResponse.json({ ok: true, roomId });
}
