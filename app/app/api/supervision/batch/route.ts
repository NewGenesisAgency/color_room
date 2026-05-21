import { NextResponse } from 'next/server';

const DEFAULT_BASE_URL = 'http://172.17.50.136:18080';
const DEFAULT_TIMEOUT_MS = 3000;
const GAME_TIMEOUT_MS = 500;

// Limite globale de requêtes simultanées vers le serveur hardware embarqué.
// Le serveur est monothread (HTTP/1.1) — au-delà de ~8 connexions simultanées
// les requêtes se mettent en file et la latence explose.
const HW_CONCURRENCY = 8;

function getBaseUrl(): string {
  const v = process.env.SUPERVISION_API_URL?.trim();
  return v && v.length > 0 ? v.replace(/\/$/, '') : DEFAULT_BASE_URL;
}

// Exécute `fn` sur chaque item avec au plus `concurrency` appels simultanés.
// Contrairement à Promise.all, cette version garantit que le hardware
// ne reçoit jamais plus de `concurrency` requêtes en même temps.
async function withConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<boolean>,
): Promise<boolean[]> {
  if (items.length === 0) return [];
  const results: boolean[] = new Array(items.length).fill(false);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
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

    // ── Envoyer avec concurrence limitée (HW_CONCURRENCY globale) ─────────────
    const sendOne = async (r: ChanReq): Promise<boolean> => {
      const url = `${baseUrl}/state/plaque/${r.plateId}/cursor/${r.index}/${r.value}`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, { method: 'PUT', cache: 'no-store', signal: ctrl.signal });
        return res.ok;
      } catch {
        return false;
      } finally {
        clearTimeout(t);
      }
    };

    const results = await withConcurrency(allRequests, HW_CONCURRENCY, sendOne);
    const ok = results.filter(Boolean).length;

    return NextResponse.json({ ok: ok === results.length, updatedChannels: ok, totalChannels: results.length });
  } catch {
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
