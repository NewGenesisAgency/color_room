import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

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
