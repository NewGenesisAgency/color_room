/**
 * @file app/api/spectre/advance/route.ts
 * @brief Fait avancer la phase de jeu Spectre (réservé à l'hôte, siège 1).
 *
 * POST : body JSON { token, sessionId? }. Seul le joueur du siège 1 (hôte) peut
 *        déclencher le passage à la phase suivante. Renvoie { ok, state,
 *        sessionId, status }.
 * Codes d'erreur : 400 (token manquant / avance impossible), 403 (non hôte),
 *        500 (erreur).
 * Effets de bord : transition de phase de la session Spectre.
 */
import { NextResponse } from 'next/server';
import { advanceSpectrePhase, touchSpectrePlayer, getLatestSpectreSession } from '@/lib/spectre';

type Body = { token: string; sessionId?: string };

/**
 * Avance la phase de la session Spectre de l'hôte.
 * @param req Requête HTTP POST, body { token, sessionId? }.
 * @returns 200 { ok, state, sessionId, status } ; 400/403/500 selon l'erreur.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const token = typeof body.token === 'string' ? body.token : '';
    if (!token) return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });

    const player = touchSpectrePlayer(token);
    if (!player || Number(player.seat) !== 1) {
      return NextResponse.json({ ok: false, error: 'only_host_can_advance' }, { status: 403 });
    }

    const result = advanceSpectrePhase(player.session_id);
    if (!result) return NextResponse.json({ ok: false, error: 'advance_failed' }, { status: 400 });

    const latest = getLatestSpectreSession();
    return NextResponse.json({ ok: true, state: result.state, sessionId: player.session_id, status: latest?.session.status ?? 'active' });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'advance_failed' }, { status: 500 });
  }
}
