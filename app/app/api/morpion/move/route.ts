import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';

import { computeWinner, inferPlayer, parseBoard, readRoom, type MorpionCell } from '../_shared';

type MoveRequest = { roomId?: string; token?: string; index?: number };

type MoveResponse =
  | { ok: true; roomId: string; board: MorpionCell[]; turn: 'X' | 'O'; winner: 'X' | 'O' | 'draw' | null; status: 'waiting' | 'playing' | 'finished' }
  | { ok: false; error: string };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as MoveRequest;
  const roomId = String(body.roomId ?? '');
  const token = String(body.token ?? '');
  const index = Number(body.index);

  if (!roomId) return NextResponse.json({ ok: false, error: 'missing roomId' } satisfies MoveResponse, { status: 400 });
  if (!token) return NextResponse.json({ ok: false, error: 'missing token' } satisfies MoveResponse, { status: 400 });
  if (!Number.isFinite(index) || index < 0 || index > 8)
    return NextResponse.json({ ok: false, error: 'invalid index' } satisfies MoveResponse, { status: 400 });

  const room = readRoom(roomId);
  if (!room) return NextResponse.json({ ok: false, error: 'room not found' } satisfies MoveResponse, { status: 404 });

  if (room.status === 'waiting')
    return NextResponse.json({ ok: false, error: 'waiting for second player' } satisfies MoveResponse, { status: 409 });
  if (room.status === 'finished')
    return NextResponse.json({ ok: false, error: 'game finished' } satisfies MoveResponse, { status: 409 });

  const you = inferPlayer(room, token);
  if (!you) return NextResponse.json({ ok: false, error: 'unauthorized token' } satisfies MoveResponse, { status: 403 });
  if (you !== room.turn) return NextResponse.json({ ok: false, error: 'not your turn' } satisfies MoveResponse, { status: 409 });

  const board = parseBoard(room.board_json);
  if (board[index]) return NextResponse.json({ ok: false, error: 'cell already filled' } satisfies MoveResponse, { status: 409 });

  board[index] = you;

  const winner = computeWinner(board);
  const nextTurn: 'X' | 'O' = you === 'X' ? 'O' : 'X';
  const nextStatus: 'playing' | 'finished' = winner ? 'finished' : 'playing';

  const db = getDb();
  db.prepare(
    "UPDATE crg_morpion_rooms SET board_json = ?, turn = ?, winner = ?, status = ?, updated_at = datetime('now') WHERE id = ?;",
  ).run(JSON.stringify(board), winner ? room.turn : nextTurn, winner ?? null, nextStatus, roomId);

  const updated = readRoom(roomId);
  if (!updated) return NextResponse.json({ ok: false, error: 'room not found' } satisfies MoveResponse, { status: 404 });

  return NextResponse.json({
    ok: true,
    roomId: updated.id,
    board: parseBoard(updated.board_json),
    turn: updated.turn,
    winner: updated.winner,
    status: updated.status,
  } satisfies MoveResponse);
}
