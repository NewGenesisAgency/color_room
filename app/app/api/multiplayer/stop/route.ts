/**
 * @file app/api/multiplayer/stop/route.ts
 * @brief Arrête la session multijoueur en cours (réservé au siège 1).
 *
 * POST : body JSON { token }. Seul le joueur du siège 1 peut arrêter la session.
 *        Renvoie { ok, sessionId } en cas de succès.
 * Codes d'erreur : 400 (token manquant), 403 (non siège 1), 500 (erreur).
 * Effets de bord : passage de la session à l'état arrêté.
 */
import { NextResponse } from 'next/server';

import { stopSession } from '@/lib/multiplayer';

type StopRequest = { token?: string };

type StopResponse =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };

/**
 * Arrête la session multijoueur courante.
 * @param req Requête HTTP POST, body { token } (doit être le siège 1).
 * @returns 200 { ok, sessionId } ; 400/403/500 selon l'erreur.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as StopRequest;
  const token = typeof body.token === 'string' ? body.token : '';

  if (!token) return NextResponse.json({ ok: false, error: 'missing_token' } satisfies StopResponse, { status: 400 });

  try {
    const res = stopSession(token);
    if (!res) return NextResponse.json({ ok: false, error: 'only_seat1_can_stop' } satisfies StopResponse, { status: 403 });
    return NextResponse.json({ ok: true, sessionId: res.sessionId } satisfies StopResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'stop_failed';
    return NextResponse.json({ ok: false, error: msg } satisfies StopResponse, { status: 500 });
  }
}
