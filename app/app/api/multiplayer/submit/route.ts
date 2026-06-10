/**
 * @file app/api/multiplayer/submit/route.ts
 * @brief Soumet la valeur de canal proposée par un joueur dans la session.
 *
 * POST : body JSON { token, value }. `value` doit être un nombre fini. Identifie
 *        le joueur par son token et enregistre sa proposition dans l'état de jeu.
 *        Renvoie { ok, sessionId, state } (état mis à jour).
 * Codes d'erreur : 400 (token ou valeur manquant/invalide), 403 (non autorisé ou
 *        pas de session), 500 (erreur).
 * Effets de bord : mise à jour de l'état de la session multijoueur.
 */
import { NextResponse } from 'next/server';

import { submitChannelValue } from '@/lib/multiplayer';

type SubmitRequest = { token?: string; value?: number };

type SubmitResponse =
  | { ok: true; sessionId: string; state: unknown }
  | { ok: false; error: string };

/**
 * Enregistre la valeur soumise par un joueur.
 * @param req Requête HTTP POST, body { token, value }.
 * @returns 200 { ok, sessionId, state } ; 400/403/500 selon l'erreur.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as SubmitRequest;
  const token = typeof body.token === 'string' ? body.token : '';
  const value = Number(body.value);

  if (!token) return NextResponse.json({ ok: false, error: 'missing_token' } satisfies SubmitResponse, { status: 400 });
  if (!Number.isFinite(value)) return NextResponse.json({ ok: false, error: 'missing_value' } satisfies SubmitResponse, { status: 400 });

  try {
    const res = submitChannelValue(token, value);
    if (!res) return NextResponse.json({ ok: false, error: 'unauthorized_or_no_session' } satisfies SubmitResponse, { status: 403 });
    return NextResponse.json({ ok: true, sessionId: res.sessionId, state: res.state } satisfies SubmitResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'submit_failed';
    return NextResponse.json({ ok: false, error: msg } satisfies SubmitResponse, { status: 500 });
  }
}
