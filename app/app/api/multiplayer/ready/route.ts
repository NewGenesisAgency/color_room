import { NextResponse } from 'next/server';
import { setPlayerReady } from '@/lib/multiplayer';

export async function POST(req: Request) {
  try {
    const body = await req.json() as { token?: string; ready?: boolean };
    if (!body.token) return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });
    const ok = setPlayerReady(String(body.token), Boolean(body.ready !== false));
    return NextResponse.json({ ok });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
