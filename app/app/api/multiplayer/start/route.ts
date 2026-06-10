/**
 * @file app/api/multiplayer/start/route.ts
 * @brief Démarre (ou réinitialise) la session multijoueur active (legacy).
 *
 * POST : body JSON { reset?, token?, name? }. Si `reset`, seul le joueur du siège 1
 *        (ou un appel sans joueur présent) est autorisé (403 sinon). Crée une
 *        nouvelle session de 2 minutes. Si aucun token n'est fourni, l'appelant
 *        est considéré comme l'hôte et rejoint immédiatement le siège 1.
 *        Renvoie { ok, sessionId, state, token?, seat? }.
 * Codes d'erreur : 403 (reset non autorisé), 500 (erreur).
 * Effets de bord : création/réinitialisation de la session multijoueur.
 */
import { NextResponse } from 'next/server';

import { getActiveSession, joinGuest, listPlayers, startNewSession, touchPlayer, type MpSeat } from '@/lib/multiplayer';

type StartRequest = { reset?: boolean; token?: string; name?: string };

type StartResponse =
  | { ok: true; sessionId: string; state: unknown; token?: string; seat?: MpSeat }
  | { ok: false; error: string };

/**
 * Démarre ou réinitialise la session multijoueur active.
 * @param req Requête HTTP POST, body { reset?, token?, name? }.
 * @returns 200 { ok, sessionId, state, token?, seat? } ; 403/500 selon l'erreur.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as StartRequest;
    const reset = Boolean(body.reset);
    const name = typeof body.name === 'string' ? body.name : undefined;

    if (reset) {
      const token = typeof body.token === 'string' ? body.token : '';
      if (token) {
        const p = touchPlayer(token);
        if (!p || Number(p.seat) !== 1) {
          return NextResponse.json({ ok: false, error: 'only_seat1_can_reset' } satisfies StartResponse, { status: 403 });
        }
      } else {
        const active = getActiveSession();
        if (active) {
          const players = listPlayers(active.session.id);
          if (players.length > 0) {
            return NextResponse.json({ ok: false, error: 'only_seat1_can_reset' } satisfies StartResponse, { status: 403 });
          }
        }
      }
    }

    const { sessionId, state } = startNewSession({ reset, durationMs: 2 * 60 * 1000 });

    // If start is called without a player token, we treat it as the host creating the session.
    // Create/join immediately to guarantee the starter is seat 1.
    const reqToken = typeof body.token === 'string' ? body.token : '';
    if (!reqToken) {
      const joined = joinGuest(sessionId, name);
      if (joined) {
        return NextResponse.json({ ok: true, sessionId, state, token: joined.token, seat: joined.seat } satisfies StartResponse);
      }
    }

    return NextResponse.json({ ok: true, sessionId, state } satisfies StartResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'start_failed';
    return NextResponse.json({ ok: false, error: msg } satisfies StartResponse, { status: 500 });
  }
}
