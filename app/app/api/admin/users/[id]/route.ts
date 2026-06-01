import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword, getSessionUser } from '@/lib/auth';

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
