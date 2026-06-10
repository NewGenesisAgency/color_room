/**
 * @file app/api/scores/route.ts
 * @brief Consultation et enregistrement des scores de jeu des utilisateurs.
 *
 * GET  : renvoie des scores selon le rôle et la query. `all=1` + admin -> tous les
 *        scores ; `all=1` + enseignant -> scores des élèves de ses classes ; sinon
 *        scores de `userId` (défaut: soi-même). Un apprenant ne peut consulter que
 *        les siens (403 sinon). `limit` borné à 500 (défaut 200). Renvoie { ok, scores }.
 * POST : enregistre un score. Body JSON { gameName, score }. Validation :
 *        nom requis et <=100 car., score fini dans [0, 100000]. Anti-spam : un seul
 *        score par jeu toutes les 5 s (429). Renvoie { ok }.
 * Codes d'erreur : 401 (non connecté), 403 (consultation interdite),
 *        400 (validation), 429 (trop de soumissions).
 * Effets de bord DB : INSERT dans crg_scores (POST).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { randomBytes } from 'crypto';

/**
 * Liste les scores visibles par l'appelant selon son rôle et la query.
 * @param req Requête HTTP GET, query `all`, `userId`, `limit` (cookie `crg_session`).
 * @returns 200 { ok, scores } ; 401 (non connecté) / 403 (interdit).
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const me = getSessionUser(token);
  if (!me) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const all = searchParams.get('all') === '1';
  const userId = searchParams.get('userId') ?? me.id;
  const limit = Math.min(Number(searchParams.get('limit') ?? 200), 500);

  if (all && me.role === 'admin') {
    // Admin : tous les scores de l'établissement
    const scores = db.prepare(`
      SELECT s.id, u.name as username, s.game_name, s.score, s.played_at
      FROM crg_scores s JOIN crg_users u ON u.id = s.user_id
      ORDER BY s.played_at DESC LIMIT ?
    `).all(limit);
    return NextResponse.json({ ok: true, scores });
  }

  if (all && me.role === 'enseignant') {
    // Enseignant : uniquement les scores des élèves de SES classes
    const scores = db.prepare(`
      SELECT DISTINCT s.id, u.name as username, s.game_name, s.score, s.played_at
      FROM crg_scores s
      JOIN crg_users u ON u.id = s.user_id
      JOIN crg_class_members cm ON cm.user_id = s.user_id
      JOIN crg_classes c ON c.id = cm.class_id
      WHERE c.created_by = ?
      ORDER BY s.played_at DESC LIMIT ?
    `).all(me.id, limit);
    return NextResponse.json({ ok: true, scores });
  }

  if (userId !== me.id && me.role !== 'admin' && me.role !== 'enseignant') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  const scores = db.prepare(`
    SELECT s.id, u.name as username, s.game_name, s.score, s.played_at
    FROM crg_scores s JOIN crg_users u ON u.id = s.user_id
    WHERE s.user_id = ? ORDER BY s.played_at DESC LIMIT ?
  `).all(userId, limit);
  return NextResponse.json({ ok: true, scores });
}

/**
 * Enregistre un score pour l'utilisateur courant (avec anti-spam 5 s).
 * @param req Requête HTTP POST, body { gameName, score } (cookie `crg_session`).
 * @returns 200 { ok } ; 401/400/429 selon l'erreur.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const me = getSessionUser(token);
  if (!me) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { gameName, score } = (await req.json()) as { gameName?: string; score?: number };
  if (!gameName?.trim()) return NextResponse.json({ error: 'Nom du jeu requis' }, { status: 400 });
  if (gameName.trim().length > 100) return NextResponse.json({ error: 'Nom du jeu trop long' }, { status: 400 });
  if (typeof score !== 'number' || !Number.isFinite(score)) return NextResponse.json({ error: 'Score invalide' }, { status: 400 });
  if (score < 0 || score > 100_000) return NextResponse.json({ error: 'Score hors limites (0–100 000)' }, { status: 400 });

  const db = getDb();
  // Anti-spam : un seul score par jeu toutes les 5 secondes par utilisateur
  const recent = db.prepare(
    "SELECT id FROM crg_scores WHERE user_id = ? AND game_name = ? AND played_at > datetime('now', '-5 seconds')"
  ).get(me.id, gameName.trim());
  if (recent) return NextResponse.json({ error: 'Trop de soumissions' }, { status: 429 });

  db.prepare('INSERT INTO crg_scores (id, user_id, game_name, score) VALUES (?, ?, ?, ?)').run(
    randomBytes(16).toString('hex'), me.id, gameName.trim(), Math.round(score),
  );
  return NextResponse.json({ ok: true });
}
