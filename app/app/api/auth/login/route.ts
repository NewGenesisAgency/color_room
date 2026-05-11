import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { pbkdf2Sync, randomBytes } from 'crypto';

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const verify = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return verify === hash;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, niveau, role } = body as {
      username?: string;
      password?: string;
      niveau?: string;
      role?: string;
    };

    if (!username?.trim()) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
    }

    const db = getDb();

    if (role === 'enseignant') {
      if (!password) {
        return NextResponse.json({ error: 'Mot de passe requis' }, { status: 400 });
      }
      const user = db
        .prepare("SELECT * FROM crg_users WHERE username = ? AND role = 'enseignant'")
        .get(username.trim()) as { id: string; username: string; role: string; password_hash: string } | undefined;

      if (!user || !verifyPassword(password, user.password_hash)) {
        return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 });
      }

      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      const sessionId = randomBytes(16).toString('hex');
      db.prepare('INSERT INTO crg_sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)').run(
        sessionId, user.id, token, expiresAt,
      );

      const res = NextResponse.json({
        ok: true,
        user: { id: user.id, username: user.username, role: 'enseignant', niveau: null },
      });
      res.cookies.set('crg_session', token, {
        httpOnly: true, maxAge: 7 * 24 * 3600, path: '/', sameSite: 'lax',
      });
      return res;
    }

    // Apprenant — no password, session only
    let user = db
      .prepare("SELECT * FROM crg_users WHERE username = ? AND role = 'apprenant'")
      .get(username.trim()) as { id: string; username: string; role: string; niveau: string } | undefined;

    if (!user) {
      const userId = randomBytes(16).toString('hex');
      db.prepare('INSERT INTO crg_users (id, username, role, niveau) VALUES (?, ?, ?, ?)').run(
        userId, username.trim(), 'apprenant', niveau ?? 'lycee',
      );
      user = db.prepare('SELECT * FROM crg_users WHERE id = ?').get(userId) as typeof user;
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const sessionId = randomBytes(16).toString('hex');
    db.prepare('INSERT INTO crg_sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)').run(
      sessionId, user!.id, token, expiresAt,
    );

    const res = NextResponse.json({
      ok: true,
      user: { id: user!.id, username: user!.username, role: 'apprenant', niveau: user!.niveau },
    });
    res.cookies.set('crg_session', token, {
      httpOnly: true, maxAge: 7 * 24 * 3600, path: '/', sameSite: 'lax',
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
