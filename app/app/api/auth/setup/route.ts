import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { pbkdf2Sync, randomBytes } from 'crypto';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export async function GET() {
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT COUNT(*) as c FROM crg_users WHERE user_type = 'enseignant'")
      .get() as { c: number };
    return NextResponse.json({ hasTeacher: row.c > 0 });
  } catch {
    return NextResponse.json({ hasTeacher: false });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const existing = db
      .prepare("SELECT COUNT(*) as c FROM crg_users WHERE user_type = 'enseignant'")
      .get() as { c: number };
    if (existing.c > 0) {
      return NextResponse.json({ error: 'Un compte enseignant existe déjà' }, { status: 409 });
    }

    const { username, password } = (await req.json()) as { username?: string; password?: string };
    if (!username?.trim() || !password || password.length < 4) {
      return NextResponse.json({ error: 'Nom et mot de passe requis (min 4 car.)' }, { status: 400 });
    }

    const userId = randomBytes(16).toString('hex');
    db.prepare('INSERT INTO crg_users (id, name, user_type, password_hash) VALUES (?, ?, ?, ?)').run(
      userId, username.trim(), 'enseignant', hashPassword(password),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[setup] error:', msg);
    return NextResponse.json({ error: 'Erreur serveur', detail: msg }, { status: 500 });
  }
}
