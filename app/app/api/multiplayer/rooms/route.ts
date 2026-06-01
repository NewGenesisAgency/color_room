import { NextResponse } from 'next/server';
import { createRoom, type MpRoomSettings } from '@/lib/multiplayer';

export async function POST(req: Request) {
  try {
    const body = await req.json() as Partial<MpRoomSettings> & { hostName?: string };
    const settings: MpRoomSettings = {
      name: String(body.name ?? 'Partie').slice(0, 40),
      gameId: String(body.gameId ?? 'split-screen'),
      mode: (['versus', 'coop', 'solo'] as const).includes(body.mode as any) ? body.mode as MpRoomSettings['mode'] : 'versus',
      maxPlayers: Math.min(8, Math.max(2, Number(body.maxPlayers) || 4)),
      durationSec: Math.min(600, Math.max(10, Number(body.durationSec) || 60)),
      difficulty: ([1, 2, 3] as const).includes(body.difficulty as any) ? body.difficulty as 1 | 2 | 3 : 2,
    };
    const result = createRoom(settings, body.hostName);
    if (!result) return NextResponse.json({ ok: false, error: 'could_not_create' }, { status: 500 });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
