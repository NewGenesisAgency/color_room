/**
 * @file lib/auth.ts
 * @brief Authentification : hachage de mots de passe et sessions persistantes.
 *
 * Mots de passe hachés avec PBKDF2-HMAC-SHA512 (100 000 itérations, sel
 * aléatoire de 16 octets) au format `sel:hash`. Les sessions sont stockées en
 * base (table `crg_sessions`) avec un jeton aléatoire de 32 octets et une
 * expiration glissante de 30 jours. better-sqlite3 est synchrone : aucune de
 * ces fonctions n'est `async`.
 */
import { pbkdf2Sync, randomBytes } from 'crypto';
import { getDb } from './db';

/**
 * @brief Hache un mot de passe en clair pour le stockage.
 * @param password Mot de passe en clair.
 * @returns Chaîne `sel:hash` (hex) à enregistrer en base.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * @brief Vérifie un mot de passe en clair contre un haché stocké.
 * @param password Mot de passe en clair saisi.
 * @param stored Haché au format `sel:hash` issu de hashPassword().
 * @returns true si le mot de passe correspond.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const verify = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return verify === hash;
}

/**
 * @brief Crée une nouvelle session pour un utilisateur.
 *
 * Purge au passage les sessions expirées de cet utilisateur, puis insère un
 * jeton valable 30 jours.
 *
 * @param userId Identifiant de l'utilisateur.
 * @returns Le jeton de session (à poser en cookie).
 */
export function createSession(userId: string): string {
  const db = getDb();
  const token = randomBytes(32).toString('hex');
  // 30 jours - cohérent avec le maxAge cookie et renewSession()
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  // Purger les sessions expirées de cet utilisateur au passage
  db.prepare('DELETE FROM crg_sessions WHERE user_id = ? AND expires_at < datetime(\'now\')').run(userId);
  db.prepare('INSERT INTO crg_sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)').run(
    randomBytes(16).toString('hex'), userId, token, expiresAt,
  );
  return token;
}

/** @brief Profil utilisateur résolu à partir d'un jeton de session. */
export type SessionUser = {
  id: string; username: string; role: string;
  niveau: string | null; avatarColor: string; avatarIcon: string;
};

/**
 * @brief Résout l'utilisateur courant à partir d'un jeton de session.
 * @param token Jeton de session (cookie).
 * @returns Le profil utilisateur, ou null si le jeton est invalide/expiré.
 */
export function getSessionUser(token: string): SessionUser | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT s.user_id as id, u.name as username, u.user_type as role,
           u.niveau, COALESCE(u.avatar_color, '#4361ee') as avatarColor,
           COALESCE(u.avatar_icon, 'User') as avatarIcon
    FROM crg_sessions s
    JOIN crg_users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token) as SessionUser | undefined;
  return row ?? null;
}

/**
 * @brief Prolonge l'expiration d'une session valide (fenêtre glissante de 30 jours).
 * @param token Jeton de session à renouveler.
 */
export function renewSession(token: string): void {
  const db = getDb();
  const newExpiry = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  db.prepare('UPDATE crg_sessions SET expires_at = ? WHERE token = ?').run(newExpiry, token);
}
