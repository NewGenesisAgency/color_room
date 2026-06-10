/**
 * @file app/api/auth/me/classes/route.ts
 * @brief Liste les classes auxquelles appartient l'utilisateur courant.
 *
 * GET : lit le cookie `crg_session`. Si connecté, renvoie { classes } où chaque
 *       entrée est { name, niveau } (jointure crg_class_members/crg_classes,
 *       triée par nom). Si non connecté ou erreur, renvoie { classes: [] }.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

/**
 * Récupère les classes de l'utilisateur courant.
 * @param req Requête HTTP GET (cookie `crg_session`).
 * @returns 200 { classes } (vide si non authentifié).
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return NextResponse.json({ classes: [] });
  try {
    const user = getSessionUser(token);
    if (!user) return NextResponse.json({ classes: [] });
    const db = getDb();
    const rows = db.prepare(`
      SELECT c.name, c.niveau
      FROM crg_class_members m
      JOIN crg_classes c ON c.id = m.class_id
      WHERE m.user_id = ?
      ORDER BY c.name ASC
    `).all(user.id) as { name: string; niveau: string | null }[];
    return NextResponse.json({ classes: rows });
  } catch {
    return NextResponse.json({ classes: [] });
  }
}
