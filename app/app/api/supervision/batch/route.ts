import { NextResponse } from 'next/server';

const DEFAULT_BASE_URL = 'http://172.17.50.136:18080';
const DEFAULT_TIMEOUT_MS = 3000;
const GAME_TIMEOUT_MS = 500;

// Limite globale de requêtes simultanées vers le serveur hardware embarqué.
// Le serveur est monothread (HTTP/1.1) — au-delà de ~4 connexions simultanées
// les requêtes se mettent en file et la latence explose.
// IMPORTANT : cette constante est au niveau module → partagée entre tous les POST
// simultanés (contrairement à une limite par-requête qui peut être contournée).
const HW_CONCURRENCY = 4;

// Sémaphore module-level : limite la concurrence GLOBALE vers le hardware,
// même si plusieurs requêtes POST /batch arrivent simultanément.
let globalHwInFlight = 0;
async function globalHwSlot<T>(fn: () => Promise<T>): Promise<T> {
  // Attendre qu'un slot se libère (busy-wait avec micro-pause)
  while (globalHwInFlight >= HW_CONCURRENCY) {
    await new Promise<void>((r) => setTimeout(r, 10));
  }
  globalHwInFlight++;
  try {
    return await fn();
  } finally {
    globalHwInFlight--;
  }
}

function getBaseUrl(): string {
  const v = process.env.SUPERVISION_API_URL?.trim();
  return v && v.length > 0 ? v.replace(/\/$/, '') : DEFAULT_BASE_URL;
}


export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { plateId, channels, plates, fast } = body;
    const timeoutMs = fast ? GAME_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
    const baseUrl = getBaseUrl();

    // ── Construire la liste plate de toutes les mises à jour ──────────────────
    type ChanReq = { plateId: number; index: number; value: number };
    const allRequests: ChanReq[] = [];

    if (plates && Array.isArray(plates)) {
      // Format multi-dalles : { plates: [{ plateId, channels: [...] }, ...] }
      for (const plate of plates as { plateId: number; channels: { index: number; value: number }[] }[]) {
        for (const ch of plate.channels) {
          allRequests.push({ plateId: plate.plateId, index: ch.index, value: ch.value });
        }
      }
    } else if (plateId && Array.isArray(channels)) {
      // Format mono-dalle : { plateId, channels: [...] }
      for (const ch of channels as { index: number; value: number }[]) {
        allRequests.push({ plateId, index: ch.index, value: ch.value });
      }
    } else {
      return NextResponse.json(
        { ok: false, error: 'MISSING_PARAMS', message: 'plateId+channels or plates required' },
        { status: 400 },
      );
    }

    if (allRequests.length === 0) {
      return NextResponse.json({ ok: true, updatedChannels: 0 });
    }

    // ── Envoyer avec concurrence limitée (sémaphore global partagé) ─────────────
    const sendOne = async (r: ChanReq): Promise<boolean> => {
      return globalHwSlot(async () => {
        const url = `${baseUrl}/state/plaque/${r.plateId}/cursor/${r.index}/${r.value}`;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
          const res = await fetch(url, {
            method: 'PUT',
            cache: 'no-store',
            signal: ctrl.signal,
            // Connection: close évite l'accumulation de keep-alive sur le serveur
            // hardware monothread après plusieurs sessions de jeu.
            headers: { 'Connection': 'close' },
          });
          return res.ok;
        } catch {
          return false;
        } finally {
          clearTimeout(t);
        }
      });
    };

    // Envoyer tous les canaux sans pré-filtrer la concurrence ici :
    // le sémaphore global s'en charge.
    const results = await Promise.all(allRequests.map(sendOne));
    const ok = results.filter(Boolean).length;

    return NextResponse.json({ ok: ok === results.length, updatedChannels: ok, totalChannels: results.length });
  } catch {
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
