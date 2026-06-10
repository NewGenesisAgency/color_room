/**
 * @file app/api/admin/users/[id]/route.ts
 * @brief Modification et suppression d'un utilisateur ciblé par son id.
 *
 * PATCH  : met à jour un utilisateur (admin/enseignant). Un enseignant ne peut
 *          modifier que les élèves de ses propres classes. Body JSON
 *          { action?, password?, niveau? }. Actions supportées :
 *          'reset_password' (ou body.password) -> change le mot de passe (>=4 car.) ;
 *          'set_niveau' (ou body.niveau défini) -> met à jour le niveau.
 *          Renvoie { ok } ou erreur 400/401/403.
 * DELETE : supprime un utilisateur (réservé à l'admin). Interdit la suppression
 *          de son propre compte. Renvoie { ok }.
 * Effets de bord DB : UPDATE crg_users (PATCH) ; suppression en cascade dans
 *          crg_sessions, crg_class_members, crg_scores puis crg_users (DELETE).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword, getSessionUser } from '@/lib/auth';

/**
 * Met à jour le mot de passe ou le niveau d'un utilisateur.
 * @param req Requête HTTP PATCH, body { action?, password?, niveau? }.
 * @param params Promesse résolvant { id } : identifiant de l'utilisateur ciblé.
 * @returns 200 { ok } ; 400/401/403 selon l'erreur.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const me = getSessionUser(token);
  if (!me || (me.role !== 'admin' && me.role !== 'enseignant')) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as { action?: string; password?: string; niveau?: string };
  const db = getDb();

  // Profs ne peuvent modifier que des élèves de leurs classes
  if (me.role === 'enseignant') {
    const allowed = db.prepare(`
      SELECT 1 FROM crg_class_members cm
      JOIN crg_classes c ON c.id = cm.class_id
      WHERE cm.user_id = ? AND c.created_by = ?
    `).get(id, me.id);
    if (!allowed) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  const action = body.action;

  if (action === 'reset_password' || body.password) {
    const pwd = body.password;
    if (!pwd || pwd.length < 4) return NextResponse.json({ error: 'Mot de passe trop court' }, { status: 400 });
    db.prepare('UPDATE crg_users SET password_hash = ? WHERE id = ?').run(hashPassword(pwd), id);
  } else if (action === 'set_niveau' || body.niveau !== undefined) {
    db.prepare('UPDATE crg_users SET niveau = ? WHERE id = ?').run(body.niveau || null, id);
  } else {
    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * Supprime définitivement un utilisateur et ses données liées (réservé à l'admin).
 * @param req Requête HTTP DELETE.
 * @param params Promesse résolvant { id } : identifiant de l'utilisateur à supprimer.
 * @returns 200 { ok } ; 400 si auto-suppression ; 401/403 sinon.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const me = getSessionUser(token);
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Réservé à l\'admin' }, { status: 403 });

  const { id } = await params;
  if (id === me.id) return NextResponse.json({ error: 'Impossible de supprimer son propre compte' }, { status: 400 });

  const db = getDb();
  db.prepare('DELETE FROM crg_sessions WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM crg_class_members WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM crg_scores WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM crg_users WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
