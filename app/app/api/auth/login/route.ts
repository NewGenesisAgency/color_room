import { NextResponse } from 'next/server';

import { createOrGetUser, createSessionForUser, setSessionCookie, type SessionUser } from '@/lib/auth';

type LoginBody = { name?: string; userType?: 'apprenant' | 'enseignant' };

type LoginResponse =
  | { ok: true; user: SessionUser }
  | { ok: false; error: string };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as LoginBody;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const userType = body.userType === 'enseignant' ? 'enseignant' : 'apprenant';

  if (!name) return NextResponse.json({ ok: false, error: 'name_required' } satisfies LoginResponse, { status: 400 });

  try {
    const user = createOrGetUser(name, userType);
    const token = createSessionForUser(user.id);
    setSessionCookie(token);
    return NextResponse.json({ ok: true, user } satisfies LoginResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'login_failed';
    return NextResponse.json({ ok: false, error: msg } satisfies LoginResponse, { status: 500 });
  }
}
