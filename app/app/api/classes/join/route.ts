import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const me = getSessionUser(token);
  if (!me) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { code } = (await req.json()) as { code?: string };
  if (!code?.trim()) return NextResponse.json({ error: 'Code requis' }, { status: 400 });

  const db = getDb();
  const cls = db.prepare('SELECT id, name FROM crg_classes WHERE code = ?').get(code.trim().toUpperCase()) as { id: string; name: string } | undefined;
  if (!cls) return NextResponse.json({ error: 'Code de classe invalide' }, { status: 404 });

  const already = db.prepare('SELECT id FROM crg_class_members WHERE class_id = ? AND user_id = ?').get(cls.id, me.id);
  if (already) return NextResponse.json({ ok: true, className: cls.name, alreadyMember: true });

  db.prepare('INSERT INTO crg_class_members (id, class_id, user_id) VALUES (?, ?, ?)').run(randomBytes(16).toString('hex'), cls.id, me.id);
  return NextResponse.json({ ok: true, className: cls.name });
}
