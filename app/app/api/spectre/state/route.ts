/**
 * @file app/api/spectre/state/route.ts
 * @brief Instantané d'état d'une session Spectre (polling client).
 *
 * GET : query optionnelle `token`. La session est résolue en priorité via le
 *       token du joueur (et non « la dernière session globale ») pour ne pas
 *       mélanger plusieurs parties. Avance automatiquement la phase si son minuteur
 *       a expiré. Masque la couleur cible (targetR/G/B = -1) pendant la phase
 *       'guess' pour empêcher la triche par inspection réseau. Renvoie { ok,
 *       sessionId, roomCode, status, updatedAt, players, you, state }.
 * Codes d'erreur : 404 (aucune session), 500 (erreur).
 * Effets de bord : advanceSpectrePhase si le minuteur de phase est échu ;
 *       touchSpectrePlayer met à jour la présence du joueur.
 */
import { NextResponse } from 'next/server';
import { getLatestSpectreSession, getSpectreSessionById, listSpectrePlayers, touchSpectrePlayer, advanceSpectrePhase } from '@/lib/spectre';

/**
 * Renvoie l'état courant de la session Spectre du joueur (ou de la plus récente).
 * @param req Requête HTTP GET, query optionnelle `token`.
 * @returns 200 { ok, ... } décrit dans l'en-tête ; 404/500 selon l'erreur.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') ?? '';

    // On résout d'abord la session du joueur via son token (et non « la dernière
    // session globale »), pour ne pas mélanger plusieurs parties simultanées ni
    // renvoyer une partie étrangère après restauration depuis localStorage.
    let me: { seat: number } | null = null;
    let latest = null as ReturnType<typeof getLatestSpectreSession>;
    if (token) {
      const p = touchSpectrePlayer(token);
      if (p) {
        me = { seat: Number(p.seat) };
        latest = getSpectreSessionById(p.session_id);
      }
    }
    if (!latest) latest = getLatestSpectreSession();
    if (!latest) return NextResponse.json({ ok: false, error: 'no_session' }, { status: 404 });

    // Auto-advance if phase timer expired
    if (latest.session.status === 'active') {
      const { state } = latest;
      const now = Date.now();
      if (state.phaseEndsAtMs > 0 && now >= state.phaseEndsAtMs &&
          (state.phase === 'reveal' || state.phase === 'guess' || state.phase === 'result')) {
        advanceSpectrePhase(latest.session.id);
        latest = getSpectreSessionById(latest.session.id) ?? latest;
      }
    }

    const you: { seat: number } | null = me;

    const players = listSpectrePlayers(latest.session.id).map((p) => ({
      seat: Number(p.seat),
      name: p.name,
    }));

    // Mask target color during guess phase to prevent cheating via network inspection
    const safeState = { ...latest.state };
    if (safeState.phase === 'guess') {
      safeState.targetR = -1;
      safeState.targetG = -1;
      safeState.targetB = -1;
    }

    return NextResponse.json({
      ok: true,
      sessionId: latest.session.id,
      roomCode: latest.session.room_code ?? latest.session.id,
      status: latest.session.status,
      updatedAt: latest.session.updated_at,
      players,
      you,
      state: safeState,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'state_failed' }, { status: 500 });
  }
}
