/**
 * @file app/api/games/[id]/route.ts
 * @brief Lecture, mise à jour et suppression d'un jeu ciblé par son id.
 *
 * GET    : renvoie le jeu d'id donné -> { ok, game } ; 404 s'il n'existe pas.
 * PATCH  : met à jour partiellement le jeu (name, kind, config - champs omis
 *          conservés). 400 si name/kind résultant vide ; 404 si introuvable ;
 *          500 si la relecture échoue. Renvoie { ok, game }.
 * DELETE : supprime le jeu -> { ok, game } (champs vidés) ; 404 si rien supprimé.
 * Effets de bord DB : UPDATE (PATCH) / DELETE sur crg_games.
 */
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

type PatchGameRequest = { name?: string; kind?: string; config?: unknown };

type ApiResponse =
  | { ok: true; game: { id: string; createdAt: string; updatedAt: string; name: string; kind: string; config: unknown } }
  | { ok: false; error: string };

/**
 * Récupère un jeu par son identifiant.
 * @param _req Requête HTTP GET (non utilisée).
 * @param ctx Contexte de route ; ctx.params résout { id } du jeu.
 * @returns 200 { ok, game } ; 404 si introuvable.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const row = db
    .prepare('SELECT id, created_at, updated_at, name, kind, config_json FROM crg_games WHERE id = ?;')
    .get(id) as GameRow | undefined;

  if (!row) return NextResponse.json({ ok: false, error: 'not found' } satisfies ApiResponse, { status: 404 });

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
  } satisfies ApiResponse);
}

/**
 * Met à jour partiellement un jeu (champs omis conservés).
 * @param req Requête HTTP PATCH, body { name?, kind?, config? }.
 * @param ctx Contexte de route ; ctx.params résout { id } du jeu.
 * @returns 200 { ok, game } ; 400 (champ requis vide) / 404 / 500 selon l'erreur.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as PatchGameRequest;

  const name = body.name !== undefined ? String(body.name).trim() : undefined;
  const kind = body.kind !== undefined ? String(body.kind).trim() : undefined;
  const config = body.config !== undefined ? body.config : undefined;

  const db = getDb();
  const existing = db
    .prepare('SELECT id, created_at, updated_at, name, kind, config_json FROM crg_games WHERE id = ?;')
    .get(id) as GameRow | undefined;

  if (!existing) return NextResponse.json({ ok: false, error: 'not found' } satisfies ApiResponse, { status: 404 });

  const nextName = name !== undefined ? name : existing.name;
  const nextKind = kind !== undefined ? kind : existing.kind;
  const nextConfigJson = config !== undefined ? JSON.stringify(config ?? {}) : existing.config_json;

  if (!nextName) return NextResponse.json({ ok: false, error: 'missing name' } satisfies ApiResponse, { status: 400 });
  if (!nextKind) return NextResponse.json({ ok: false, error: 'missing kind' } satisfies ApiResponse, { status: 400 });

  db.prepare('UPDATE crg_games SET name = ?, kind = ?, config_json = ?, updated_at = datetime(\'now\') WHERE id = ?;').run(
    nextName,
    nextKind,
    nextConfigJson,
    id,
  );

  const row = db
    .prepare('SELECT id, created_at, updated_at, name, kind, config_json FROM crg_games WHERE id = ?;')
    .get(id) as GameRow | undefined;

  if (!row) return NextResponse.json({ ok: false, error: 'update failed' } satisfies ApiResponse, { status: 500 });

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
  } satisfies ApiResponse);
}

/**
 * Supprime un jeu par son identifiant.
 * @param _req Requête HTTP DELETE (non utilisée).
 * @param ctx Contexte de route ; ctx.params résout { id } du jeu.
 * @returns 200 { ok, game } (champs vidés) ; 404 si aucun jeu supprimé.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();

  const info = db.prepare('DELETE FROM crg_games WHERE id = ?;').run(id);
  if (info.changes <= 0) return NextResponse.json({ ok: false, error: 'not found' } satisfies ApiResponse, { status: 404 });

  return NextResponse.json({ ok: true, game: { id, createdAt: '', updatedAt: '', name: '', kind: '', config: {} } } satisfies ApiResponse);
}
