import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

type ChatRow = {
  id: string; game_id: string | null; title: string;
  messages_json: string; created_at: string; updated_at: string;
};

function rid(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// Liste des conversations (optionnellement filtrées par jeu).
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

// Upsert d'une conversation (création si pas d'id, sinon mise à jour).
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
