/**
 * @file app/api/p4/move/route.ts
 * @brief Joue un coup (dépose un jeton dans une colonne) dans une salle P4.
 *
 * POST : body JSON { roomId, token, col }. Vérifie que la partie est en cours,
 *        que le token correspond à un joueur et que c'est bien son tour, puis
 *        applique la gravité dans la colonne. Recalcule le vainqueur, met à jour
 *        le tour et le statut. Renvoie { ok, board, turn, winner, status }.
 * Codes d'erreur : 400 (params manquants / colonne invalide), 403 (token non
 *        joueur), 404 (salle introuvable), 409 (en attente, terminée, pas votre
 *        tour, ou colonne pleine).
 * Effets de bord DB : UPDATE de crg_p4_rooms (plateau, tour, vainqueur, statut).
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { computeWinner, dropInColumn, inferPlayer, parseBoard, readRoom, P4_COLS } from '../_shared';

/**
 * Applique un coup d'un joueur dans une colonne.
 * @param req Requête HTTP POST, body { roomId, token, col }.
 * @returns 200 { ok, board, turn, winner, status } ; 400/403/404/409 selon l'erreur.
 */
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
