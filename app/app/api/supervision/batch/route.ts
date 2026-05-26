import { NextResponse } from 'next/server';

const DEFAULT_BASE_URL = 'http://172.17.50.136:18080';

// Timeout par défaut pour les appels normaux (ex: éditeur sans fast)
const DEFAULT_TIMEOUT_MS = 1200;
// Timeout "fast" pour les jeux en temps réel
const GAME_TIMEOUT_MS = 800;

// ── Sémaphore global ─────────────────────────────────────────────────────────
// Le serveur supervision est HTTP/1.1 + accès série monothread.
// On limite à 6 requêtes simultanées pour ne pas saturer sa file d'attente.
const HW_CONCURRENCY = 6;
let globalHwInFlight = 0;

// AbortController global pour "forcer la prise de contrôle" :
// quand force=true, toutes les requêtes en cours sont annulées et les slots
// sont libérés immédiatement pour que les nouvelles passent en premier.
let forceAbortCtrl: AbortController = new AbortController();

// ── Preemption (une seule fois par batch) ────────────────────────────────────
// La préemption ne doit être déclenchée QU'UNE SEULE FOIS par batch.
// Si on l'applique à tous les channels en Promise.all, chaque appel abort
// tous les précédents → cascade d'annulations → seul le dernier survit.
//
// On N'ÉCRASE PAS globalHwInFlight : les requêtes abortées vont rapidement
// passer dans leur bloc finally et décrémenter le compteur elles-mêmes.
// Si on le réinitialisait à 0, leurs finally le passeraient en négatif.
function applyForceOnce() {
  forceAbortCtrl.abort();
  forceAbortCtrl = new AbortController();
  // globalHwInFlight se remettra à 0 naturellement via les blocs finally
  // des requêtes abortées (en quelques millisecondes max)
}

async function globalHwSlot<T>(
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  // Attendre qu'un slot se libère (busy-wait 5ms)
  while (globalHwInFlight >= HW_CONCURRENCY) {
    await new Promise<void>((r) => setTimeout(r, 5));
  }
  globalHwInFlight++;
  try {
    return await fn(forceAbortCtrl.signal);
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
    const { plateId, channels, plates, fast, force } = body;
    const timeoutMs = fast ? GAME_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
    const baseUrl = getBaseUrl();
    const isForce = Boolean(force);

    // ── Construire la liste plate de toutes les mises à jour ──────────────────
    type ChanReq = { plateId: number; index: number; value: number };
    const allRequests: ChanReq[] = [];

    if (plates && Array.isArray(plates)) {
      for (const plate of plates as { plateId: number; channels: { index: number; value: number }[] }[]) {
        for (const ch of plate.channels) {
          allRequests.push({ plateId: plate.plateId, index: ch.index, value: ch.value });
        }
      }
    } else if (plateId && Array.isArray(channels)) {
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

    // ── Force-preemption : UNE SEULE FOIS avant d'envoyer le batch ────────────
    // On abort toutes les requêtes précédentes AVANT de lancer le Promise.all.
    // Ainsi aucune des nouvelles requêtes ne s'abort mutuellement.
    if (isForce) {
      applyForceOnce();
    }

    // ── Envoyer avec sémaphore global ─────────────────────────────────────────
    const sendOne = async (r: ChanReq): Promise<boolean> => {
      return globalHwSlot(async (globalSignal) => {
        // Seul l'endpoint /canal/ est documenté dans le README officiel
        const urlCanal  = `${baseUrl}/state/plaque/${r.plateId}/canal/${r.index}/${r.value}`;
        // Fallback /cursor/ pour compat ancienne version de l'API
        const urlCursor = `${baseUrl}/state/plaque/${r.plateId}/cursor/${r.index}/${r.value}`;

        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);

        // Propager l'annulation "force" à cette requête individuelle
        const onForce = () => ctrl.abort();
        globalSignal.addEventListener('abort', onForce, { once: true });

        try {
          // Essayer d'abord /canal/ (endpoint officiel selon README)
          const res = await fetch(urlCanal, {
            method: 'PUT',
            cache: 'no-store',
            signal: ctrl.signal,
            headers: { 'Connection': 'close' },
          });
          if (res.ok) return true;

          // Fallback vers /cursor/ (ancienne API ou variante)
          if (ctrl.signal.aborted) return false;
          const res2 = await fetch(urlCursor, {
            method: 'PUT',
            cache: 'no-store',
            signal: ctrl.signal,
            headers: { 'Connection': 'close' },
          });
          return res2.ok;
        } catch {
          return false;
        } finally {
          clearTimeout(t);
          globalSignal.removeEventListener('abort', onForce);
        }
      });
    };

    const results = await Promise.all(allRequests.map((r) => sendOne(r)));
    const ok = results.filter(Boolean).length;

    return NextResponse.json({
      ok: ok > 0,
      updatedChannels: ok,
      totalChannels: results.length,
      forced: isForce,
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
