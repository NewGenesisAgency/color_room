/**
 * @file app/api/multiplayer/rooms/route.ts
 * @brief Création d'un salon multijoueur avec ses réglages.
 *
 * POST : body JSON partiel { name?, gameId?, mode?, maxPlayers?, durationSec?,
 *        difficulty?, hostName? }. Les valeurs sont assainies/bornées : nom <=40
 *        car., mode dans {versus, coop, solo} (défaut versus), maxPlayers 2..8
 *        (défaut 4), durationSec 10..600 (défaut 60), difficulty 1|2|3 (défaut 2).
 *        Crée le salon et renvoie { ok, ...result } (code, token hôte, etc.).
 * Codes d'erreur : 500 (création impossible / erreur).
 * Effets de bord : création d'un salon multijoueur.
 */
import { NextResponse } from 'next/server';
import { createRoom, type MpRoomSettings } from '@/lib/multiplayer';

/**
 * Crée un nouveau salon multijoueur à partir des réglages fournis.
 * @param req Requête HTTP POST, body décrit ci-dessus.
 * @returns 200 { ok, ...result } ; 500 si la création échoue.
 */
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
