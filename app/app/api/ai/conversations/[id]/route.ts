/**
 * @file app/api/ai/conversations/[id]/route.ts
 * @brief Suppression d'une conversation IA par son identifiant.
 *
 * DELETE : supprime la conversation dont l'id est dans l'URL. Toujours { ok }.
 * Effets de bord DB : DELETE sur crg_ai_chats.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Supprime la conversation ciblée.
 * @param _req Requête HTTP DELETE (non utilisée).
 * @param ctx Contexte de route ; ctx.params résout { id } de la conversation.
 * @returns 200 { ok }.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  db.prepare('DELETE FROM crg_ai_chats WHERE id = ?;').run(id);
  return NextResponse.json({ ok: true });
}
