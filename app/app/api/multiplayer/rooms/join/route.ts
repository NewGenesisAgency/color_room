/**
 * @file app/api/multiplayer/rooms/join/route.ts
 * @brief Rejoint un salon multijoueur via son code à 6 caractères.
 *
 * POST : body JSON { code, name? }. Le code est normalisé (majuscules, sans
 *        espaces) et doit faire exactement 6 caractères (400 sinon). Ajoute le
 *        joueur au salon et renvoie { ok, ...result } (token, siège, état).
 * Codes d'erreur : 400 (code invalide), 404 (salon introuvable), 500 (erreur).
 * Effets de bord : ajout d'un joueur au salon.
 */
import { NextResponse } from 'next/server';
import { joinByCode } from '@/lib/multiplayer';

/**
 * Inscrit un joueur dans un salon identifié par son code.
 * @param req Requête HTTP POST, body { code, name? }.
 * @returns 200 { ok, ...result } ; 400/404/500 selon l'erreur.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as { code?: string; name?: string };
    const code = String(body.code ?? '').trim().toUpperCase();
    if (code.length !== 6) return NextResponse.json({ ok: false, error: 'invalid_code' }, { status: 400 });
    const result = joinByCode(code, body.name);
    if (!result) return NextResponse.json({ ok: false, error: 'room_not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
