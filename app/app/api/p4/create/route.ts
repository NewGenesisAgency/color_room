/**
 * @file app/api/p4/create/route.ts
 * @brief Crée une salle de Puissance 4 vide en attente de joueurs.
 *
 * POST : aucune entrée. L'hôte (Color Room) crée une salle au plateau vide,
 *        tour initial 'R', statut 'waiting'. Renvoie { ok, roomId }.
 * Effets de bord DB : INSERT dans crg_p4_rooms.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { randomId, P4_CELLS } from '../_shared';

/**
 * Crée une salle P4 vide.
 * @returns 200 { ok, roomId }.
 */
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
