import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyPassword, createSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = (await req.json()) as { username?: string; password?: string };
    if (!username?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
    if (!password) return NextResponse.json({ error: 'Mot de passe requis' }, { status: 400 });

    const db = getDb();
    const user = db.prepare(
      "SELECT id, name, user_type, password_hash, niveau, COALESCE(avatar_color,'#4361ee') as avatar_color, COALESCE(avatar_icon,'User') as avatar_icon FROM crg_users WHERE name = ?"
    ).get(username.trim()) as { id: string; name: string; user_type: string; password_hash: string | null; niveau: string | null; avatar_color: string; avatar_icon: string } | undefined;

    if (!user) return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 });
    if (!user.password_hash) return NextResponse.json({ error: 'Ce compte n\'a pas de mot de passe. Contactez un administrateur.' }, { status: 401 });
    if (!verifyPassword(password, user.password_hash)) return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 });

    const token = createSession(user.id);
    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, username: user.name, role: user.user_type, niveau: user.niveau, avatarColor: user.avatar_color, avatarIcon: user.avatar_icon },
    });
    res.cookies.set('crg_session', token, { httpOnly: true, maxAge: 30 * 24 * 3600, path: '/', sameSite: 'lax' });
    return res;
  } catch (err) {
    console.error('[login]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
