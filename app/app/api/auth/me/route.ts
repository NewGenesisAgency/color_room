/**
 * @file app/api/auth/me/route.ts
 * @brief Renvoie l'utilisateur de la session courante et prolonge la session.
 *
 * GET : lit le cookie `crg_session`. Si valide, renouvelle la session
 *       (fenêtre glissante de 30 jours), réémet le cookie et renvoie { user }.
 *       Si absent/invalide, renvoie { user: null }.
 * Effets de bord DB : renewSession met à jour l'expiration en base.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, renewSession } from '@/lib/auth';

/**
 * Récupère l'utilisateur courant et rafraîchit la session.
 * @param req Requête HTTP GET (cookie `crg_session`).
 * @returns 200 { user } si connecté, sinon { user: null }.
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return NextResponse.json({ user: null });
  try {
    const user = getSessionUser(token);
    if (!user) return NextResponse.json({ user: null });

    // Sliding window : renouvelle la session à chaque visite (30 jours glissants)
    renewSession(token);
    const res = NextResponse.json({ user });
    res.cookies.set('crg_session', token, {
      httpOnly: true,
      maxAge: 30 * 24 * 3600,
      path: '/',
      sameSite: 'lax',
    });
    return res;
  } catch {
    return NextResponse.json({ user: null });
  }
}
