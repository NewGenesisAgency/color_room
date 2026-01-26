import { NextResponse } from 'next/server';

import { getUserBySessionToken, readSessionToken, type SessionUser } from '@/lib/auth';

type MeResponse =
  | { ok: true; user: SessionUser }
  | { ok: true; user: null }
  | { ok: false; error: string };

export async function GET() {
  try {
    const token = readSessionToken();
    if (!token) return NextResponse.json({ ok: true, user: null } satisfies MeResponse);
    const user = getUserBySessionToken(token);
    return NextResponse.json({ ok: true, user } satisfies MeResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'me_failed';
    return NextResponse.json({ ok: false, error: msg } satisfies MeResponse, { status: 500 });
  }
}
