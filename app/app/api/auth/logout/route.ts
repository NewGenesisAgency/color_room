import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('crg_session')?.value;
  if (token) {
    try {
      getDb().prepare('DELETE FROM crg_sessions WHERE token = ?').run(token);
    } catch { /* ignore */ }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set('crg_session', '', { maxAge: 0, path: '/' });
  return res;
}
