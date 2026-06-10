/**
 * @file app/api/classes/[id]/route.ts
 * @brief Détail et suppression d'une classe ciblée par son id.
 *
 * GET    : renvoie la classe et la liste de ses membres (réservé enseignant/admin).
 *          Un enseignant ne peut consulter que ses propres classes. Renvoie
 *          { ok, class, members } où chaque membre a { id, username, niveau,
 *          avatar_color, joined_at }.
 * DELETE : supprime la classe et ses adhésions (réservé enseignant/admin ;
 *          un enseignant seulement pour ses propres classes). Renvoie { ok }.
 * Codes d'erreur : 401 (non connecté), 403 (rôle/propriété insuffisants),
 *          404 (classe introuvable).
 * Effets de bord DB : DELETE sur crg_class_members puis crg_classes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

/**
 * Récupère une classe et la liste de ses membres.
 * @param req Requête HTTP GET (cookie `crg_session`).
 * @param params Promesse résolvant { id } : identifiant de la classe.
 * @returns 200 { ok, class, members } ; 401/403/404 selon l'erreur.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const me = getSessionUser(token);
  if (!me || (me.role !== 'admin' && me.role !== 'enseignant')) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const { id } = await params;
  const db = getDb();

  const cls = db.prepare('SELECT * FROM crg_classes WHERE id = ?').get(id) as { id: string; name: string; code: string; created_by: string; niveau: string | null } | undefined;
  if (!cls) return NextResponse.json({ error: 'Classe introuvable' }, { status: 404 });
  if (me.role === 'enseignant' && cls.created_by !== me.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const members = db.prepare(`
    SELECT u.id, u.name as username, u.niveau, COALESCE(u.avatar_color,'#4361ee') as avatar_color, cm.joined_at
    FROM crg_users u
    JOIN crg_class_members cm ON cm.user_id = u.id
    WHERE cm.class_id = ?
    ORDER BY cm.joined_at ASC
  `).all(id);

  return NextResponse.json({ ok: true, class: cls, members });
}

/**
 * Supprime une classe et toutes ses adhésions.
 * @param req Requête HTTP DELETE (cookie `crg_session`).
 * @param params Promesse résolvant { id } : identifiant de la classe à supprimer.
 * @returns 200 { ok } ; 401/403/404 selon l'erreur.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const me = getSessionUser(token);
  if (!me || (me.role !== 'admin' && me.role !== 'enseignant')) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const { id } = await params;
  const db = getDb();
  const cls = db.prepare('SELECT created_by FROM crg_classes WHERE id = ?').get(id) as { created_by: string } | undefined;
  if (!cls) return NextResponse.json({ error: 'Classe introuvable' }, { status: 404 });
  if (me.role === 'enseignant' && cls.created_by !== me.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  db.prepare('DELETE FROM crg_class_members WHERE class_id = ?').run(id);
  db.prepare('DELETE FROM crg_classes WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
