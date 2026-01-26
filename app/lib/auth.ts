import { cookies } from 'next/headers';
import crypto from 'node:crypto';

import { getDb } from '@/lib/db';

type UserType = 'apprenant' | 'enseignant';

export type SessionUser = {
  id: string;
  name: string;
  userType: UserType;
};

const SESSION_COOKIE = 'crg_session';

export function readSessionToken(): string | null {
  const jar = cookies();
  const v = jar.get(SESSION_COOKIE)?.value;
  return v && v.trim() ? v : null;
}

export function setSessionCookie(token: string) {
  const jar = cookies();
  jar.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });
}

export function clearSessionCookie() {
  const jar = cookies();
  jar.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(8).toString('hex')}`;
}

export function createToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function createOrGetUser(name: string, userType: UserType): SessionUser {
  const db = getDb();
  const cleanName = name.trim();

  const existing = db
    .prepare('SELECT id, name, user_type as userType FROM crg_users WHERE name = ? LIMIT 1')
    .get(cleanName) as any;

  if (existing?.id) {
    if (existing.userType !== userType) {
      db.prepare("UPDATE crg_users SET user_type = ?, updated_at = datetime('now') WHERE id = ?").run(userType, existing.id);
    }
    return { id: String(existing.id), name: String(existing.name), userType: userType };
  }

  const id = createId('usr');
  db.prepare(
    "INSERT INTO crg_users (id, name, user_type, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
  ).run(id, cleanName, userType);

  return { id, name: cleanName, userType };
}

export function createSessionForUser(userId: string): string {
  const db = getDb();
  const id = createId('ses');
  const token = createToken();
  db.prepare(
    "INSERT INTO crg_sessions (id, user_id, token, created_at, updated_at, expires_at) VALUES (?, ?, ?, datetime('now'), datetime('now'), datetime('now', '+14 days'))",
  ).run(id, userId, token);
  return token;
}

export function getUserBySessionToken(token: string): SessionUser | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT u.id as id, u.name as name, u.user_type as userType FROM crg_sessions s JOIN crg_users u ON u.id = s.user_id WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > datetime('now')) LIMIT 1",
    )
    .get(token) as any;
  if (!row?.id) return null;
  return { id: String(row.id), name: String(row.name), userType: String(row.userType) as UserType };
}

export function deleteSessionByToken(token: string) {
  const db = getDb();
  db.prepare('DELETE FROM crg_sessions WHERE token = ?').run(token);
}
