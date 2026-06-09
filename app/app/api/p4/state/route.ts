import { NextResponse } from 'next/server';
import { inferPlayer, parseBoard, readRoom } from '../_shared';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const roomId = url.searchParams.get('roomId');
  const token = url.searchParams.get('token');
  if (!roomId) return NextResponse.json({ ok: false, error: 'missing_room' }, { status: 400 });

  const room = readRoom(roomId);
  if (!room) return NextResponse.json({ ok: false, error: 'room_not_found' }, { status: 404 });

  return NextResponse.json({
    ok: true,
    roomId: room.id,
    status: room.status,
    board: parseBoard(room.board_json),
    turn: room.turn,
    winner: room.winner,
    you: inferPlayer(room, token),
    players: { r: Boolean(room.player_r_token), j: Boolean(room.player_j_token) },
    updatedAt: room.updated_at,
  });
}
