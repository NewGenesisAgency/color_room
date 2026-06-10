/**
 * @file app/api/multiplayer/room-start/route.ts
 * @brief Démarre la partie d'un salon multijoueur (réservé à l'hôte).
 *
 * POST : body JSON { token }. Le token doit être celui de l'hôte du salon.
 *        Lance la partie et renvoie { ok, ...result } (état initial).
 * Codes d'erreur : 400 (token manquant), 403 (non hôte ou salon introuvable),
 *        500 (erreur).
 * Effets de bord : transition du salon vers l'état « en cours ».
 */
import { NextResponse } from 'next/server';
import { startRoomGame } from '@/lib/multiplayer';

/**
 * Lance la partie pour le salon de l'hôte identifié par son token.
 * @param req Requête HTTP POST, body { token }.
 * @returns 200 { ok, ...result } ; 400/403/500 selon l'erreur.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as { token?: string };
    if (!body.token) return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });
    const result = startRoomGame(String(body.token));
    if (!result) return NextResponse.json({ ok: false, error: 'forbidden_or_not_found' }, { status: 403 });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
