/**
 * @file app/api/p4/state/route.ts
 * @brief Renvoie l'état courant d'une salle de Puissance 4 (polling client).
 *
 * GET : query `roomId` (requis) et `token` (optionnel, pour déduire `you`).
 *       Renvoie { ok, roomId, status, board, turn, winner, you, players, updatedAt }
 *       où `players` indique la présence des joueurs R et J.
 * Codes d'erreur : 400 (roomId manquant), 404 (salle introuvable).
 */
import { NextResponse } from 'next/server';
import { inferPlayer, parseBoard, readRoom } from '../_shared';

/**
 * Lit l'état d'une salle P4.
 * @param req Requête HTTP GET, query `roomId` (requis), `token` (optionnel).
 * @returns 200 { ok, ... } décrit dans l'en-tête ; 400/404 selon l'erreur.
 */
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
