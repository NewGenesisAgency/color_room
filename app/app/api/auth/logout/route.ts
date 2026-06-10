/**
 * @file app/api/auth/logout/route.ts
 * @brief Déconnecte l'utilisateur courant en supprimant sa session.
 *
 * POST : lit le cookie `crg_session`, supprime la ligne correspondante dans
 *        crg_sessions (erreurs ignorées) et efface le cookie. Renvoie { ok }.
 * Effets de bord DB : DELETE sur crg_sessions.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * Invalide la session courante et efface le cookie.
 * @param req Requête HTTP POST (cookie `crg_session`).
 * @returns 200 { ok } avec cookie de session expiré.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get('crg_session')?.value;
  if (token) {
    try {
      getDb().prepare('DELETE FROM crg_sessions WHERE token = ?').run(token);
    } catch { /* ignore */ }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set('crg_session', '', { maxAge: 0, path: '/' });
  return res;
}
