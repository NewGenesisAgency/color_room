import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { randomBytes } from 'crypto';

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

export async function POST(req: NextRequest) {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const me = getSessionUser(token);
  if (!me) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { gameName, score } = (await req.json()) as { gameName?: string; score?: number };
  if (!gameName?.trim()) return NextResponse.json({ error: 'Nom du jeu requis' }, { status: 400 });
  if (typeof score !== 'number') return NextResponse.json({ error: 'Score invalide' }, { status: 400 });

  const db = getDb();
  db.prepare('INSERT INTO crg_scores (id, user_id, game_name, score) VALUES (?, ?, ?, ?)').run(
    randomBytes(16).toString('hex'), me.id, gameName.trim(), Math.round(score),
  );
  return NextResponse.json({ ok: true });
}
