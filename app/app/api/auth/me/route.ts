import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return NextResponse.json({ user: null });

  try {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT s.user_id, u.username, u.role, u.niveau
         FROM crg_sessions s
         JOIN crg_users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > datetime('now')`,
      )
      .get(token) as { user_id: string; username: string; role: string; niveau: string | null } | undefined;

    if (!row) return NextResponse.json({ user: null });
    return NextResponse.json({
      user: { id: row.user_id, username: row.username, role: row.role, niveau: row.niveau },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
