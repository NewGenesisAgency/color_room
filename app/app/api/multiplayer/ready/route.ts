/**
 * @file app/api/multiplayer/ready/route.ts
 * @brief Bascule l'état « prêt » d'un joueur dans son salon multijoueur.
 *
 * POST : body JSON { token, ready? }. `ready` vaut true sauf si explicitement
 *        false. Identifie le joueur par son token et met à jour son indicateur.
 *        Renvoie { ok } (false si le token est inconnu).
 * Codes d'erreur : 400 (token manquant), 500 (erreur).
 * Effets de bord : mise à jour de l'état du joueur dans le salon.
 */
import { NextResponse } from 'next/server';
import { setPlayerReady } from '@/lib/multiplayer';

/**
 * Met à jour l'indicateur « prêt » d'un joueur.
 * @param req Requête HTTP POST, body { token, ready? }.
 * @returns 200 { ok } ; 400 (token manquant) / 500 (erreur).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as { token?: string; ready?: boolean };
    if (!body.token) return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });
    const ok = setPlayerReady(String(body.token), Boolean(body.ready !== false));
    return NextResponse.json({ ok });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
