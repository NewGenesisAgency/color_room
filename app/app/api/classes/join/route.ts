/**
 * @file app/api/classes/join/route.ts
 * @brief Adhésion de l'utilisateur courant à une classe via son code.
 *
 * POST : body JSON { code }. Résout le code (insensible à la casse) en classe,
 *        puis inscrit l'utilisateur connecté. S'il est déjà membre, renvoie
 *        { ok, className, alreadyMember: true } sans réinsérer. Sinon crée
 *        l'adhésion et renvoie { ok, className }.
 * Codes d'erreur : 401 (non connecté), 400 (code manquant), 404 (code invalide).
 * Effets de bord DB : INSERT dans crg_class_members.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { randomBytes } from 'crypto';

/**
 * Inscrit l'utilisateur courant à une classe à partir de son code.
 * @param req Requête HTTP POST, body { code } (cookie `crg_session`).
 * @returns 200 { ok, className, alreadyMember? } ; 401/400/404 selon l'erreur.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const me = getSessionUser(token);
  if (!me) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { code } = (await req.json()) as { code?: string };
  if (!code?.trim()) return NextResponse.json({ error: 'Code requis' }, { status: 400 });

  const db = getDb();
  const cls = db.prepare('SELECT id, name FROM crg_classes WHERE code = ?').get(code.trim().toUpperCase()) as { id: string; name: string } | undefined;
  if (!cls) return NextResponse.json({ error: 'Code de classe invalide' }, { status: 404 });

  const already = db.prepare('SELECT id FROM crg_class_members WHERE class_id = ? AND user_id = ?').get(cls.id, me.id);
  if (already) return NextResponse.json({ ok: true, className: cls.name, alreadyMember: true });

  db.prepare('INSERT INTO crg_class_members (id, class_id, user_id) VALUES (?, ?, ?)').run(randomBytes(16).toString('hex'), cls.id, me.id);
  return NextResponse.json({ ok: true, className: cls.name });
}
