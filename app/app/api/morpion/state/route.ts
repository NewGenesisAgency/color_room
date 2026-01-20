import { NextResponse } from 'next/server';

import { inferPlayer, parseBoard, readRoom } from '../_shared';

export type MorpionStateResponse =
  | {
      ok: true;
      roomId: string;
      status: 'waiting' | 'playing' | 'finished';
      board: Array<'' | 'X' | 'O'>;
      turn: 'X' | 'O';
      winner: 'X' | 'O' | 'draw' | null;
      you: 'X' | 'O' | null;
      players: { x: boolean; o: boolean };
      updatedAt: string;
    }
  | { ok: false; error: string };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const roomId = url.searchParams.get('roomId');
  const token = url.searchParams.get('token');
  if (!roomId) return NextResponse.json({ ok: false, error: 'missing roomId' } satisfies MorpionStateResponse, { status: 400 });

  const room = readRoom(roomId);
  if (!room) return NextResponse.json({ ok: false, error: 'room not found' } satisfies MorpionStateResponse, { status: 404 });

  const board = parseBoard(room.board_json);
  const you = inferPlayer(room, token);

  return NextResponse.json({
    ok: true,
    roomId: room.id,
    status: room.status,
    board,
    turn: room.turn,
    winner: room.winner,
    you,
    players: { x: true, o: Boolean(room.player_o_token) },
    updatedAt: room.updated_at,
  } satisfies MorpionStateResponse);
}
