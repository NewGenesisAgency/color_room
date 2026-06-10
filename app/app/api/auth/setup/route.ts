/**
 * @file app/api/auth/setup/route.ts
 * @brief Initialisation du premier compte enseignant (assistant de configuration).
 *
 * GET  : indique si un compte enseignant existe déjà -> { hasTeacher }.
 * POST : crée le tout premier compte enseignant. Refusé (409) s'il en existe
 *        déjà un. Body JSON { username, password (>=4 car.) }. Renvoie { ok }.
 * Codes d'erreur : 400 (validation), 409 (enseignant déjà présent), 500.
 * Effets de bord DB : INSERT dans crg_users (user_type 'enseignant').
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { pbkdf2Sync, randomBytes } from 'crypto';

/**
 * Hache un mot de passe avec pbkdf2 (sel aléatoire, 100k itérations, sha512).
 * @param password Mot de passe en clair.
 * @returns Chaîne "sel:hash" prête à stocker.
 */
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Indique si un compte enseignant existe déjà.
 * @returns 200 { hasTeacher: boolean }.
 */
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

/**
 * Crée le premier compte enseignant si aucun n'existe encore.
 * @param req Requête HTTP POST, body { username, password }.
 * @returns 200 { ok } ; 400/409/500 selon l'erreur.
 */
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
