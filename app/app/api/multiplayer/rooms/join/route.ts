import { NextResponse } from 'next/server';
import { joinByCode } from '@/lib/multiplayer';

export async function POST(req: Request) {
  try {
    const body = await req.json() as { code?: string; name?: string };
    const code = String(body.code ?? '').trim().toUpperCase();
    if (code.length !== 6) return NextResponse.json({ ok: false, error: 'invalid_code' }, { status: 400 });
    const result = joinByCode(code, body.name);
    if (!result) return NextResponse.json({ ok: false, error: 'room_not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
