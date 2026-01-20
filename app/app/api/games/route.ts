import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';

type GameRow = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  kind: string;
  config_json: string;
};

function randomId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare('SELECT id, created_at, updated_at, name, kind, config_json FROM crg_games ORDER BY updated_at DESC LIMIT 100;')
    .all() as GameRow[];

  const games = rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    name: r.name,
    kind: r.kind,
    config: r.config_json ? (JSON.parse(r.config_json) as unknown) : {},
  }));

  return NextResponse.json({ ok: true, games } as const);
}

type CreateGameRequest = { name?: string; kind?: string; config?: unknown };

type CreateGameResponse =
  | { ok: true; game: { id: string; createdAt: string; updatedAt: string; name: string; kind: string; config: unknown } }
  | { ok: false; error: string };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as CreateGameRequest;
  const name = String(body.name ?? '').trim();
  const kind = String(body.kind ?? '').trim();
  const config = body.config ?? {};

  if (!name) return NextResponse.json({ ok: false, error: 'missing name' } satisfies CreateGameResponse, { status: 400 });
  if (!kind) return NextResponse.json({ ok: false, error: 'missing kind' } satisfies CreateGameResponse, { status: 400 });

  const id = randomId();
  const configJson = JSON.stringify(config ?? {});

  const db = getDb();
  db.prepare('INSERT INTO crg_games(id, name, kind, config_json, updated_at) VALUES(?, ?, ?, ?, datetime(\'now\'));').run(
    id,
    name,
    kind,
    configJson,
  );

  const row = db
    .prepare('SELECT id, created_at, updated_at, name, kind, config_json FROM crg_games WHERE id = ?;')
    .get(id) as GameRow | undefined;

  if (!row) return NextResponse.json({ ok: false, error: 'create failed' } satisfies CreateGameResponse, { status: 500 });

  return NextResponse.json({
    ok: true,
    game: {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      name: row.name,
      kind: row.kind,
      config: row.config_json ? (JSON.parse(row.config_json) as unknown) : {},
    },
  } satisfies CreateGameResponse);
}
