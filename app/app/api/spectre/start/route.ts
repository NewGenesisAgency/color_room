/**
 * @file app/api/spectre/start/route.ts
 * @brief Démarre (ou réinitialise) une session Spectre et inscrit l'hôte.
 *
 * POST : body JSON { reset?, token?, name?, maxRounds? } (maxRounds défaut 5).
 *        Si `reset` avec token, seul le siège 1 (hôte) est autorisé (403 sinon).
 *        Sans token, l'appelant est le créateur et obtient un siège ; si la
 *        session active réutilisée n'est plus en lobby, une salle neuve est créée
 *        pour ne jamais bloquer le créateur. Renvoie { ok, sessionId, roomCode,
 *        state, token?, seat? }.
 * Codes d'erreur : 403 (reset non autorisé), 500 (création échouée / erreur).
 * Effets de bord : création/réinitialisation de session Spectre, inscription joueur.
 */
import { NextResponse } from 'next/server';
import { startSpectreSession, joinSpectreSession, touchSpectrePlayer, type SpSeat } from '@/lib/spectre';

type Body = { reset?: boolean; token?: string; name?: string; maxRounds?: number };

/**
 * Démarre ou réinitialise une session Spectre.
 * @param req Requête HTTP POST, body { reset?, token?, name?, maxRounds? }.
 * @returns 200 { ok, sessionId, roomCode, state, token?, seat? } ; 403/500 sinon.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const reset = Boolean(body.reset);
    const maxRounds = typeof body.maxRounds === 'number' ? body.maxRounds : 5;
    const name = typeof body.name === 'string' ? body.name : undefined;

    if (reset) {
      const token = typeof body.token === 'string' ? body.token : '';
      if (token) {
        const p = touchSpectrePlayer(token);
        if (!p || Number(p.seat) !== 1) {
          return NextResponse.json({ ok: false, error: 'only_host_can_reset' }, { status: 403 });
        }
      }
    }

    let { sessionId, roomCode, state } = startSpectreSession({ reset, maxRounds });

    const reqToken = typeof body.token === 'string' ? body.token : '';
    if (!reqToken) {
      // Nouveau créateur : il DOIT obtenir un siège.
      let joined = joinSpectreSession(sessionId, name);
      // Si la session active réutilisée n'est plus en lobby (partie abandonnée
      // restée « active »), on repart d'une salle neuve pour ne jamais bloquer
      // le créateur sur l'écran « Connexion… ».
      if (!joined) {
        ({ sessionId, roomCode, state } = startSpectreSession({ reset: true, maxRounds }));
        joined = joinSpectreSession(sessionId, name);
      }
      if (joined) {
        return NextResponse.json({ ok: true, sessionId, roomCode, state, token: joined.token, seat: joined.seat as SpSeat });
      }
      // Échec inattendu : on le signale explicitement au client.
      return NextResponse.json({ ok: false, error: 'create_failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sessionId, roomCode, state });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'start_failed' }, { status: 500 });
  }
}
