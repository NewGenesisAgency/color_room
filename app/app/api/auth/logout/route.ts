import { NextResponse } from 'next/server';

import { clearSessionCookie, deleteSessionByToken, readSessionToken } from '@/lib/auth';

type LogoutResponse =
  | { ok: true }
  | { ok: false; error: string };

export async function POST() {
  try {
    const token = readSessionToken();
    if (token) deleteSessionByToken(token);
    clearSessionCookie();
    return NextResponse.json({ ok: true } satisfies LogoutResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'logout_failed';
    return NextResponse.json({ ok: false, error: msg } satisfies LogoutResponse, { status: 500 });
  }
}
