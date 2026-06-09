import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  db.prepare('DELETE FROM crg_ai_chats WHERE id = ?;').run(id);
  return NextResponse.json({ ok: true });
}
