/**
 * @file app/api/classes/route.ts
 * @brief Liste et création des classes selon le rôle de l'utilisateur.
 *
 * GET  : renvoie les classes visibles par l'appelant. Un admin voit toutes les
 *        classes (avec nom du créateur et nombre de membres) ; un enseignant ne
 *        voit que celles qu'il a créées (avec nombre de membres) ; un apprenant
 *        voit les classes auxquelles il a adhéré. Renvoie { ok, classes }.
 * POST : crée une classe (réservé enseignant/admin). Body JSON { name, niveau? }.
 *        Génère un code d'adhésion unique à 6 caractères (jusqu'à 10 essais).
 *        Renvoie { ok, id, code }.
 * Codes d'erreur : 401 (non connecté), 403 (rôle insuffisant), 400 (nom manquant).
 * Effets de bord DB : INSERT dans crg_classes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { randomBytes } from 'crypto';

/**
 * Génère un code d'adhésion aléatoire de 6 caractères (alphabet sans ambiguïté).
 * @returns Code de classe en majuscules (ex. "AB3CD7").
 */
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/**
 * Liste les classes visibles selon le rôle de l'appelant.
 * @param req Requête HTTP GET (cookie `crg_session`).
 * @returns 200 { ok, classes } ; 401 si non connecté.
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const me = getSessionUser(token);
  if (!me) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const db = getDb();

  if (me.role === 'admin') {
    const classes = db.prepare(`
      SELECT c.*, u.name as creator_name,
             (SELECT COUNT(*) FROM crg_class_members WHERE class_id = c.id) as member_count
      FROM crg_classes c JOIN crg_users u ON u.id = c.created_by
      ORDER BY c.created_at DESC
    `).all();
    return NextResponse.json({ ok: true, classes });
  }

  if (me.role === 'enseignant') {
    const classes = db.prepare(`
      SELECT c.*,
             (SELECT COUNT(*) FROM crg_class_members WHERE class_id = c.id) as member_count
      FROM crg_classes c WHERE c.created_by = ? ORDER BY c.created_at DESC
    `).all(me.id);
    return NextResponse.json({ ok: true, classes });
  }

  // Élève : classes rejointes
  const classes = db.prepare(`
    SELECT c.id, c.name, c.niveau, c.created_at, u.name as creator_name
    FROM crg_classes c
    JOIN crg_class_members cm ON cm.class_id = c.id
    JOIN crg_users u ON u.id = c.created_by
    WHERE cm.user_id = ?
    ORDER BY cm.joined_at DESC
  `).all(me.id);
  return NextResponse.json({ ok: true, classes });
}

/**
 * Crée une nouvelle classe avec un code d'adhésion unique.
 * @param req Requête HTTP POST, body { name, niveau? }.
 * @returns 200 { ok, id, code } ; 401/403/400 selon l'erreur.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const me = getSessionUser(token);
  if (!me || (me.role !== 'admin' && me.role !== 'enseignant')) {
    return NextResponse.json({ error: 'Réservé aux enseignants et admins' }, { status: 403 });
  }

  const { name, niveau } = (await req.json()) as { name?: string; niveau?: string };
  if (!name?.trim()) return NextResponse.json({ error: 'Nom de classe requis' }, { status: 400 });

  const db = getDb();
  let code = generateCode();
  // Ensure uniqueness
  let attempts = 0;
  while (db.prepare('SELECT id FROM crg_classes WHERE code = ?').get(code) && attempts < 10) {
    code = generateCode(); attempts++;
  }

  const id = randomBytes(16).toString('hex');
  db.prepare('INSERT INTO crg_classes (id, name, code, created_by, niveau) VALUES (?, ?, ?, ?, ?)').run(
    id, name.trim(), code, me.id, niveau?.trim() || null,
  );
  return NextResponse.json({ ok: true, id, code });
}
