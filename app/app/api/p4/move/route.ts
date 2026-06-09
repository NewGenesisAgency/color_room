import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { computeWinner, dropInColumn, inferPlayer, parseBoard, readRoom, P4_COLS } from '../_shared';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { roomId?: string; token?: string; col?: number };
  const roomId = String(body.roomId ?? '');
  const token = String(body.token ?? '');
  const col = Number(body.col);

  if (!roomId || !token) return NextResponse.json({ ok: false, error: 'missing_params' }, { status: 400 });
  if (!Number.isInteger(col) || col < 0 || col >= P4_COLS) return NextResponse.json({ ok: false, error: 'invalid_col' }, { status: 400 });

  const room = readRoom(roomId);
  if (!room) return NextResponse.json({ ok: false, error: 'room_not_found' }, { status: 404 });
  if (room.status === 'waiting') return NextResponse.json({ ok: false, error: 'waiting_player' }, { status: 409 });
  if (room.status === 'finished') return NextResponse.json({ ok: false, error: 'finished' }, { status: 409 });

  const you = inferPlayer(room, token);
  if (!you) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 403 });
  if (you !== room.turn) return NextResponse.json({ ok: false, error: 'not_your_turn' }, { status: 409 });

  const board = parseBoard(room.board_json);
  const placed = dropInColumn(board, col, you);
  if (placed < 0) return NextResponse.json({ ok: false, error: 'column_full' }, { status: 409 });

  const winner = computeWinner(board);
  const nextTurn = you === 'R' ? 'J' : 'R';
  const nextStatus = winner ? 'finished' : 'playing';

  const db = getDb();
  db.prepare("UPDATE crg_p4_rooms SET board_json = ?, turn = ?, winner = ?, status = ?, updated_at = datetime('now') WHERE id = ?;")
    .run(JSON.stringify(board), winner ? room.turn : nextTurn, winner ?? null, nextStatus, roomId);

  const updated = readRoom(roomId)!;
  return NextResponse.json({ ok: true, board: parseBoard(updated.board_json), turn: updated.turn, winner: updated.winner, status: updated.status });
}
