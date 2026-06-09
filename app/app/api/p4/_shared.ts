import { getDb } from '@/lib/db';

export type P4Disc = 'R' | 'J';
export type P4Cell = '' | P4Disc;

export const P4_COLS = 6;
export const P4_ROWS = 7;
export const P4_CELLS = P4_COLS * P4_ROWS; // 42

export type P4RoomRow = {
  id: string;
  created_at: string;
  updated_at: string;
  player_r_token: string | null;
  player_j_token: string | null;
  board_json: string;
  turn: P4Disc;
  winner: P4Disc | 'draw' | null;
  status: 'waiting' | 'playing' | 'finished';
};

export function randomId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function readRoom(roomId: string): P4RoomRow | null {
  const db = getDb();
  const row = db
    .prepare('SELECT id, created_at, updated_at, player_r_token, player_j_token, board_json, turn, winner, status FROM crg_p4_rooms WHERE id = ?;')
    .get(roomId) as P4RoomRow | undefined;
  return row ?? null;
}

export function parseBoard(boardJson: string): P4Cell[] {
  try {
    const raw = JSON.parse(boardJson) as unknown;
    const out: P4Cell[] = Array(P4_CELLS).fill('');
    if (Array.isArray(raw)) for (let i = 0; i < P4_CELLS; i++) { const v = raw[i]; out[i] = v === 'R' || v === 'J' ? v : ''; }
    return out;
  } catch {
    return Array(P4_CELLS).fill('') as P4Cell[];
  }
}

/** Joue dans une colonne (gravité). Retourne l'index posé, ou -1 si colonne pleine. */
export function dropInColumn(board: P4Cell[], col: number, disc: P4Disc): number {
  if (col < 0 || col >= P4_COLS) return -1;
  for (let row = P4_ROWS - 1; row >= 0; row--) {
    const idx = row * P4_COLS + col;
    if (!board[idx]) { board[idx] = disc; return idx; }
  }
  return -1;
}

/** 4 alignés (horizontal, vertical, 2 diagonales). */
export function computeWinner(board: P4Cell[]): P4Disc | 'draw' | null {
  const at = (r: number, c: number): P4Cell => (r >= 0 && r < P4_ROWS && c >= 0 && c < P4_COLS ? board[r * P4_COLS + c] : '');
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]] as const;
  for (let r = 0; r < P4_ROWS; r++) {
    for (let c = 0; c < P4_COLS; c++) {
      const v = at(r, c);
      if (!v) continue;
      for (const [dr, dc] of dirs) {
        if (at(r + dr, c + dc) === v && at(r + 2 * dr, c + 2 * dc) === v && at(r + 3 * dr, c + 3 * dc) === v) return v;
      }
    }
  }
  const full = board.every((c) => c === 'R' || c === 'J');
  return full ? 'draw' : null;
}

export function inferPlayer(room: P4RoomRow, token: string | null): P4Disc | null {
  if (!token) return null;
  if (token === room.player_r_token) return 'R';
  if (token === room.player_j_token) return 'J';
  return null;
}
