import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword, getSessionUser } from '@/lib/auth';
import { randomBytes } from 'crypto';

function requireAdminOrProf(req: NextRequest) {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return null;
  const user = getSessionUser(token);
  if (!user || (user.role !== 'admin' && user.role !== 'enseignant')) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const me = requireAdminOrProf(req);
  if (!me) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const role = searchParams.get('role');

  let query = "SELECT id, name as username, user_type, niveau, COALESCE(avatar_color,'#4361ee') as avatar_color, COALESCE(avatar_icon,'User') as avatar_icon, created_at FROM crg_users";
  const params: string[] = [];
  if (role) { query += ' WHERE user_type = ?'; params.push(role); }
  // Profs ne voient que les élèves de leurs classes
  if (me.role === 'enseignant') {
    query = `SELECT DISTINCT u.id, u.name as username, u.user_type, u.niveau, COALESCE(u.avatar_color,'#4361ee') as avatar_color, COALESCE(u.avatar_icon,'User') as avatar_icon, u.created_at
             FROM crg_users u
             JOIN crg_class_members cm ON cm.user_id = u.id
             JOIN crg_classes c ON c.id = cm.class_id
             WHERE c.created_by = ? AND u.user_type = 'apprenant'`;
    params.push(me.id);
  }
  query += ' ORDER BY created_at DESC';
  const users = db.prepare(query).all(...params);
  return NextResponse.json({ ok: true, users });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const me = getSessionUser(token);
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Réservé à l\'admin' }, { status: 403 });

  const { username, password, role, avatarColor } = (await req.json()) as {
    username?: string; password?: string; role?: string; avatarColor?: string;
  };
  if (!username?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
  if (!password || password.length < 4) return NextResponse.json({ error: 'Mot de passe trop court' }, { status: 400 });
  if (!['enseignant', 'admin'].includes(role ?? '')) return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });

  const db = getDb();
  const existing = db.prepare('SELECT id FROM crg_users WHERE name = ?').get(username.trim());
  if (existing) return NextResponse.json({ error: 'Nom déjà pris' }, { status: 409 });

  const id = randomBytes(16).toString('hex');
  db.prepare('INSERT INTO crg_users (id, name, user_type, password_hash, avatar_color) VALUES (?, ?, ?, ?, ?)').run(
    id, username.trim(), role, hashPassword(password), avatarColor || (role === 'admin' ? '#ef4444' : '#7c3aed'),
  );
  return NextResponse.json({ ok: true, id });
}
