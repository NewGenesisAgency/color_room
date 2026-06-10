/**
 * @file app/api/admin/users/route.ts
 * @brief Gestion des comptes utilisateurs réservée aux administrateurs et enseignants.
 *
 * GET  : liste les utilisateurs. Query optionnelle `role` pour filtrer par type.
 *        Un admin voit tout le monde ; un enseignant ne voit que les apprenants
 *        inscrits dans les classes qu'il a créées. Renvoie { ok, users }.
 * POST : crée un compte enseignant ou admin (réservé à l'admin). Body JSON
 *        { username, password (>=4 car.), role ('enseignant'|'admin'), avatarColor? }.
 *        Renvoie { ok, id } ou une erreur 400/403/409.
 * Codes d'erreur : 401 (non connecté), 403 (rôle insuffisant), 400 (validation),
 *        409 (nom déjà pris).
 * Effets de bord DB : insertion dans crg_users.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword, getSessionUser } from '@/lib/auth';
import { randomBytes } from 'crypto';

/**
 * Vérifie que la requête provient d'un admin ou d'un enseignant authentifié.
 * @param req Requête entrante (le cookie `crg_session` porte le jeton).
 * @returns L'utilisateur de session si admin/enseignant, sinon null.
 */
function requireAdminOrProf(req: NextRequest) {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return null;
  const user = getSessionUser(token);
  if (!user || (user.role !== 'admin' && user.role !== 'enseignant')) return null;
  return user;
}

/**
 * Liste les utilisateurs visibles par l'appelant.
 * @param req Requête HTTP GET, query optionnelle `role` pour filtrer par user_type.
 * @returns 200 { ok, users } ; 401 si non autorisé.
 */
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

/**
 * Crée un compte enseignant ou admin (réservé à l'admin).
 * @param req Requête HTTP POST, body { username, password, role, avatarColor? }.
 * @returns 200 { ok, id } ; 401/403/400/409 selon l'erreur.
 */
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
