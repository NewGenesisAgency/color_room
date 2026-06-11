/**
 * @file app/api/auth/register/route.ts
 * @brief Inscription d'un nouvel apprenant, avec jonction optionnelle à une classe.
 *
 * POST : body JSON { username, password, confirmPassword, avatarColor?,
 *        avatarIcon?, classCode? }. Valide les champs, vérifie l'unicité du nom
 *        (insensible à la casse), crée l'utilisateur (type 'apprenant') et, si un
 *        code de classe valide est fourni, l'inscrit à cette classe - le tout dans
 *        une transaction tout-ou-rien. Ouvre une session et pose le cookie
 *        `crg_session`. Renvoie { ok, user }.
 * Codes d'erreur : 400 (validation), 409 (nom déjà pris), 500 (erreur serveur).
 * Effets de bord DB : INSERT dans crg_users, éventuellement crg_class_members,
 *        et création de session.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword, createSession } from '@/lib/auth';
import { randomBytes } from 'crypto';

/**
 * Crée un compte apprenant et l'inscrit éventuellement à une classe.
 * @param req Requête HTTP POST, body décrit ci-dessus.
 * @returns 200 { ok, user } + cookie de session ; 400/409/500 selon l'erreur.
 */
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
    res.cookies.set('crg_session', token, { httpOnly: true, maxAge: 30 * 24 * 3600, path: '/', sameSite: 'lax' });
    return res;
  } catch (err) {
    console.error('[register]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
