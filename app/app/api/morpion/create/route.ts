import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';

import { randomId } from '../_shared';

type CreateRoomResponse = { roomId: string; token: string; symbol: 'X' };

export async function POST() {
  const roomId = randomId();
  const token = randomId();
  const board = JSON.stringify(Array(9).fill(''));

  const db = getDb();
  db.prepare(
    "INSERT INTO crg_morpion_rooms(id, player_x_token, board_json, turn, status, winner, updated_at) VALUES(?, ?, ?, 'X', 'waiting', NULL, datetime('now'));",
  ).run(roomId, token, board);

  const res: CreateRoomResponse = { roomId, token, symbol: 'X' };
  return NextResponse.json(res);
}
