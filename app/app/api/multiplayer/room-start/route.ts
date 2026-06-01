import { NextResponse } from 'next/server';
import { startRoomGame } from '@/lib/multiplayer';

export async function POST(req: Request) {
  try {
    const body = await req.json() as { token?: string };
    if (!body.token) return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });
    const result = startRoomGame(String(body.token));
    if (!result) return NextResponse.json({ ok: false, error: 'forbidden_or_not_found' }, { status: 403 });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
