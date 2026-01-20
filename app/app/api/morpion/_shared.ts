import { getDb } from '@/lib/db';

export type MorpionSymbol = 'X' | 'O';
export type MorpionCell = '' | MorpionSymbol;

export type MorpionRoomRow = {
  id: string;
  created_at: string;
  updated_at: string;
  player_x_token: string;
  player_o_token: string | null;
  board_json: string;
  turn: MorpionSymbol;
  winner: MorpionSymbol | 'draw' | null;
  status: 'waiting' | 'playing' | 'finished';
};

export function randomId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function readRoom(roomId: string): MorpionRoomRow | null {
  const db = getDb();
  const row = db
    .prepare(
      'SELECT id, created_at, updated_at, player_x_token, player_o_token, board_json, turn, winner, status FROM crg_morpion_rooms WHERE id = ?;',
    )
    .get(roomId) as MorpionRoomRow | undefined;
  return row ?? null;
}

export function parseBoard(boardJson: string): MorpionCell[] {
  try {
    const raw = JSON.parse(boardJson) as unknown;
    if (!Array.isArray(raw)) return Array(9).fill('') as MorpionCell[];
    const out: MorpionCell[] = Array(9).fill('');
    for (let i = 0; i < 9; i++) {
      const v = raw[i];
      out[i] = v === 'X' || v === 'O' ? v : '';
    }
    return out;
  } catch {
    return Array(9).fill('') as MorpionCell[];
  }
}

export function computeWinner(board: MorpionCell[]): MorpionSymbol | 'draw' | null {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ] as const;

  for (const [a, b, c] of lines) {
    const v = board[a];
    if (v && v === board[b] && v === board[c]) return v;
  }

  const filled = board.every((c) => c === 'X' || c === 'O');
  return filled ? 'draw' : null;
}

export function inferPlayer(room: MorpionRoomRow, token: string | null): MorpionSymbol | null {
  if (!token) return null;
  if (token === room.player_x_token) return 'X';
  if (token === room.player_o_token) return 'O';
  return null;
}
