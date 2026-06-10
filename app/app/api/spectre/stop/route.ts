/**
 * @file app/api/spectre/stop/route.ts
 * @brief Arrête une session Spectre en cours.
 *
 * POST : body JSON { token }. Arrête la session associée au token (l'autorisation
 *        est gérée par stopSpectreSession). Renvoie { ok, sessionId }.
 * Codes d'erreur : 400 (token manquant / arrêt refusé), 500 (erreur).
 * Effets de bord : passage de la session Spectre à l'état arrêté.
 */
import { NextResponse } from 'next/server';
import { stopSpectreSession } from '@/lib/spectre';

type Body = { token: string };

/**
 * Arrête la session Spectre liée au token fourni.
 * @param req Requête HTTP POST, body { token }.
 * @returns 200 { ok, sessionId } ; 400/500 selon l'erreur.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const token = typeof body.token === 'string' ? body.token : '';
    if (!token) return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });

    const result = stopSpectreSession(token);
    if (!result) return NextResponse.json({ ok: false, error: 'stop_failed' }, { status: 400 });

    return NextResponse.json({ ok: true, sessionId: result.sessionId });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'stop_failed' }, { status: 500 });
  }
}
