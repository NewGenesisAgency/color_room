/**
 * @file app/api/spectre/join/route.ts
 * @brief Rejoint une session Spectre via un code de salle ou un sessionId.
 *
 * POST : body JSON { sessionId? | code?, name? }. Accepte soit un room_code court
 *        (6 caractères), soit un sessionId long (rétro-compatibilité). Inscrit le
 *        joueur et renvoie { ok, token, seat, sessionId, roomCode }.
 * Codes d'erreur : 400 (identifiant manquant / adhésion refusée), 500 (erreur).
 * Effets de bord : ajout d'un joueur à la session Spectre.
 */
import { NextResponse } from 'next/server';
import { joinSpectreSession, getSpectreSessionById } from '@/lib/spectre';

// Accepte soit sessionId (long, rétro-compat), soit code (room_code court 6 chars)
type Body = { sessionId?: string; code?: string; name?: string };

/**
 * Inscrit un joueur dans une session Spectre.
 * @param req Requête HTTP POST, body { sessionId? | code?, name? }.
 * @returns 200 { ok, token, seat, sessionId, roomCode } ; 400/500 selon l'erreur.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const codeOrId = (typeof body.code === 'string' ? body.code : typeof body.sessionId === 'string' ? body.sessionId : '').trim();
    const name = typeof body.name === 'string' ? body.name : undefined;

    if (!codeOrId) return NextResponse.json({ ok: false, error: 'missing_session_id' }, { status: 400 });

    const result = joinSpectreSession(codeOrId, name);
    if (!result) return NextResponse.json({ ok: false, error: 'join_failed' }, { status: 400 });

    const session = getSpectreSessionById(result.sessionId);
    const roomCode = session?.session.room_code ?? result.sessionId;

    return NextResponse.json({ ok: true, token: result.token, seat: result.seat, sessionId: result.sessionId, roomCode });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'join_failed' }, { status: 500 });
  }
}
