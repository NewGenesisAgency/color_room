/**
 * @file app/api/ai/conversations/route.ts
 * @brief Persistance des conversations de l'assistant IA (liste et upsert).
 *
 * GET  : liste jusqu'à 100 conversations triées par date de mise à jour
 *        décroissante. Query optionnelle `gameId` pour ne garder que les
 *        conversations liées à un jeu. Renvoie { ok, conversations } où chaque
 *        conversation contient { id, gameId, title, messages, createdAt, updatedAt }.
 * POST : crée ou met à jour une conversation. Body JSON
 *        { id?, gameId?, title?, messages? }. Sans id, un identifiant est généré.
 *        Le titre est tronqué à 120 caractères et messages_json à 2 Mo.
 *        Renvoie { ok, id } ; 400 { ok:false, error:'BAD_JSON' } si JSON invalide.
 * Effets de bord DB : INSERT/UPDATE sur crg_ai_chats.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

type ChatRow = {
  id: string; game_id: string | null; title: string;
  messages_json: string; created_at: string; updated_at: string;
};

/**
 * Génère un identifiant de conversation aléatoire (base36 + suffixe aléatoire).
 * @returns Une chaîne d'identifiant unique.
 */
function rid(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Liste des conversations (optionnellement filtrées par jeu).
 * @param req Requête HTTP GET, query optionnelle `gameId`.
 * @returns 200 { ok, conversations }.
 */
export async function GET(req: Request) {
  const db = getDb();
  const gameId = new URL(req.url).searchParams.get('gameId');
  const rows = (gameId
    ? db.prepare('SELECT * FROM crg_ai_chats WHERE game_id = ? ORDER BY updated_at DESC LIMIT 100;').all(gameId)
    : db.prepare('SELECT * FROM crg_ai_chats ORDER BY updated_at DESC LIMIT 100;').all()) as ChatRow[];
  const conversations = rows.map((r) => ({
    id: r.id, gameId: r.game_id, title: r.title,
    messages: r.messages_json ? JSON.parse(r.messages_json) : [],
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));
  return NextResponse.json({ ok: true, conversations });
}

/**
 * Upsert d'une conversation (création si pas d'id, sinon mise à jour).
 * @param req Requête HTTP POST, body { id?, gameId?, title?, messages? }.
 * @returns 200 { ok, id } ; 400 si le corps JSON est invalide.
 */
export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'BAD_JSON' }, { status: 400 }); }

  const db = getDb();
  const id = typeof body?.id === 'string' && body.id ? body.id : rid();
  const gameId = typeof body?.gameId === 'string' ? body.gameId : null;
  const title = String(body?.title ?? '').slice(0, 120);
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const messagesJson = JSON.stringify(messages).slice(0, 2_000_000);

  const exists = db.prepare('SELECT id FROM crg_ai_chats WHERE id = ?;').get(id);
  if (exists) {
    db.prepare("UPDATE crg_ai_chats SET game_id = ?, title = ?, messages_json = ?, updated_at = datetime('now') WHERE id = ?;")
      .run(gameId, title, messagesJson, id);
  } else {
    db.prepare("INSERT INTO crg_ai_chats(id, game_id, title, messages_json) VALUES(?, ?, ?, ?);")
      .run(id, gameId, title, messagesJson);
  }
  return NextResponse.json({ ok: true, id });
}
