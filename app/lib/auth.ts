import { pbkdf2Sync, randomBytes } from 'crypto';
import { getDb } from './db';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const verify = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return verify === hash;
}

export function createSession(userId: string): string {
  const db = getDb();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  db.prepare('INSERT INTO crg_sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)').run(
    randomBytes(16).toString('hex'), userId, token, expiresAt,
  );
  return token;
}

export type SessionUser = {
  id: string; username: string; role: string;
  niveau: string | null; avatarColor: string; avatarIcon: string;
};

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

// Renouvelle la date d'expiration d'une session valide (sliding window 30 jours).
export function renewSession(token: string): void {
  const db = getDb();
  const newExpiry = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  db.prepare('UPDATE crg_sessions SET expires_at = ? WHERE token = ?').run(newExpiry, token);
}
