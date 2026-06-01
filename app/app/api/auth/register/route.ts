import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword, createSession } from '@/lib/auth';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { username, password, confirmPassword, avatarColor, avatarIcon, classCode } = (await req.json()) as {
      username?: string; password?: string; confirmPassword?: string;
      avatarColor?: string; avatarIcon?: string; classCode?: string;
    };

    if (!username?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
    if (!password || password.length < 4) return NextResponse.json({ error: 'Mot de passe trop court (min 4 caractères)' }, { status: 400 });
    if (password !== confirmPassword) return NextResponse.json({ error: 'Les mots de passe ne correspondent pas' }, { status: 400 });

    const usernameClean = username.trim();
    const color = avatarColor?.trim() || '#4361ee';
    const icon = avatarIcon?.trim() || 'User';

    const db = getDb();
    const existing = db.prepare('SELECT id FROM crg_users WHERE name = ? COLLATE NOCASE').get(usernameClean);
    if (existing) return NextResponse.json({ error: 'Ce nom d\'utilisateur est déjà pris' }, { status: 409 });

    const id = randomBytes(16).toString('hex');
    const hash = hashPassword(password);

    // Tout-ou-rien : si la jonction de classe échoue, l'utilisateur n'est pas créé non plus.
    const insertAll = db.transaction(() => {
      db.prepare("INSERT INTO crg_users (id, name, user_type, password_hash, avatar_color, avatar_icon) VALUES (?, ?, 'apprenant', ?, ?, ?)")
        .run(id, usernameClean, hash, color, icon);
      if (classCode?.trim()) {
        const classRow = db.prepare("SELECT id FROM crg_classes WHERE code = ?").get(classCode.trim().toUpperCase()) as { id: string } | undefined;
        if (classRow) {
          db.prepare('INSERT OR IGNORE INTO crg_class_members (id, class_id, user_id) VALUES (?, ?, ?)').run(randomBytes(16).toString('hex'), classRow.id, id);
        }
      }
    });
    insertAll();

    const token = createSession(id);
    const res = NextResponse.json({
      ok: true,
      user: { id, username: usernameClean, role: 'apprenant', niveau: null, avatarColor: color, avatarIcon: icon },
    });
    res.cookies.set('crg_session', token, { httpOnly: true, maxAge: 7 * 24 * 3600, path: '/', sameSite: 'lax' });
    return res;
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur', detail: String(err) }, { status: 500 });
  }
}
