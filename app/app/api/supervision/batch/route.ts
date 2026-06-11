/**
 * @file app/api/supervision/batch/route.ts
 * @brief Envoi groupé et préemptible de mises à jour de canaux vers la supervision.
 *
 * POST : body JSON soit { plateId, channels: [{ index, value }] }, soit
 *        { plates: [{ plateId, channels: [...] }] }, plus drapeaux { fast?, force? }.
 *        Chaque canal est poussé en PUT vers /state/plaque/{plateId}/canal/{i}/{v}
 *        (repli sur /cursor/ pour l'ancienne API). Un sémaphore à file drainable
 *        (concurrence HW_CONCURRENCY=2) sérialise les appels vers supervision.exe ;
 *        `force` purge instantanément la file et annule les requêtes en cours pour
 *        ne jamais envoyer de commandes obsolètes. La déconnexion client purge
 *        aussi la file. `fast` réduit le timeout (jeux temps réel).
 *        Renvoie { ok, updatedChannels, totalChannels, forced }.
 * Codes d'erreur : 400 (MISSING_PARAMS), 500 (INTERNAL_ERROR).
 * Effets de bord : nombreuses requêtes réseau sortantes vers la supervision ;
 *        état de file/concurrence partagé au niveau du module.
 */
import { NextResponse } from 'next/server';
import { getSupervisionBaseUrl as getBaseUrl } from '@/lib/settings';

// Timeout par défaut pour les appels normaux (ex: éditeur sans fast)
const DEFAULT_TIMEOUT_MS = 1200;
// Timeout "fast" pour les jeux en temps réel
const GAME_TIMEOUT_MS = 700;

// ── Drainable promise-queue semaphore ─────────────────────────────────────────
//
// POURQUOI PAS UN BUSY-WAIT ?
// L'ancienne implémentation utilisait :
//   while (globalHwInFlight >= N) await new Promise(r => setTimeout(r, 5));
// Problème : quand force() est appelé, les promises dormantes continuent de
// s'exécuter dès qu'un slot se libère - même si leurs données sont obsolètes.
// Résultat : accumulation indéfinie de requêtes stale dans la file de supervision.exe,
// qui sature sa connexion TCP et ralentit exponentiellement.
//
// La file drainable résout ça : quand forceReset() est appelé, TOUS les waiters
// sont résolus immédiatement avec false (ne pas procéder). Zéro accumulation.

const HW_CONCURRENCY = 2; // supervision.exe est essentiellement série

type Waiter = { resolve: (proceed: boolean) => void };
let hwInFlight = 0;
const hwWaiters: Waiter[] = [];
let forceAbortCtrl: AbortController = new AbortController();

/**
 * Réveille les waiters en attente tant qu'il reste des slots de concurrence.
 * Chaque waiter résolu avec true incrémente hwInFlight.
 */
function drainWaiters() {
  while (hwWaiters.length > 0 && hwInFlight < HW_CONCURRENCY) {
    hwInFlight++;
    hwWaiters.shift()!.resolve(true);
  }
}

/**
 * Acquiert un slot de concurrence matériel, ou s'inscrit dans la file d'attente.
 * @returns Promesse résolue à true s'il faut procéder, false si annulé/évincé.
 */
async function acquireHwSlot(): Promise<boolean> {
  if (hwInFlight < HW_CONCURRENCY) {
    hwInFlight++;
    return true;
  }
  // MAX_QUEUE : évite les accumulations infinies en cas de boucle non-force
  if (hwWaiters.length >= 256) {
    // Éjecter le plus ancien (le plus stale)
    const dropped = hwWaiters.shift()!;
    dropped.resolve(false);
  }
  return new Promise<boolean>((resolve) => {
    hwWaiters.push({ resolve });
  });
}

/**
 * Libère un slot de concurrence et tente de réveiller les waiters suivants.
 */
function releaseHwSlot() {
  hwInFlight = Math.max(0, hwInFlight - 1);
  drainWaiters();
}

/**
 * Purge instantanée de toute la file + abort des requêtes en cours.
 * Les waiters reçoivent false → ils ne lancent aucun fetch.
 * Les fetches en cours reçoivent un signal d'abort.
 */
function forceReset() {
  forceAbortCtrl.abort();
  forceAbortCtrl = new AbortController();

  // Vider la file : les waiters n'ont PAS encore incrémenté hwInFlight
  const stale = hwWaiters.splice(0);
  for (const w of stale) w.resolve(false);
  // hwInFlight reste correct : il ne compte que les fetches réellement en cours
}

/**
 * Applique un lot de mises à jour de canaux vers la supervision (préemptible).
 * @param req Requête HTTP POST, body { plateId, channels } | { plates }, + { fast?, force? }.
 * @returns 200 { ok, updatedChannels, totalChannels, forced } ; 400 (params manquants) / 500.
 */
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

    // ── Force-preemption : purge la file AVANT de lancer les nouvelles requêtes ─
    if (isForce) {
      forceReset();
    }

    // ── Snapshot du signal de force pour CE batch ─────────────────────────────
    // On capture le signal APRÈS forceReset() pour ne pas écouter le signal
    // déjà aborté - on veut le nouveau signal de la nouvelle génération.
    const batchForceSignal = forceAbortCtrl.signal;

    // ── Propager l'annulation client (disconnect) ─────────────────────────────
    // Si le client coupe la connexion (ex: timeout côté Next.js), on purge la file.
    const clientSignal = req.signal;
    if (clientSignal) {
      clientSignal.addEventListener('abort', () => {
        // Purger la file quand le client se déconnecte (évite d'envoyer des
        // commandes obsolètes à supervision.exe pour rien)
        const stale = hwWaiters.splice(0);
        for (const w of stale) w.resolve(false);
      }, { once: true });
    }

    // ── Envoyer avec la file drainable ────────────────────────────────────────
    const sendOne = async (r: ChanReq): Promise<boolean> => {
      // Vérifier si déjà annulé avant de demander un slot
      if (batchForceSignal.aborted || clientSignal?.aborted) return false;

      const proceed = await acquireHwSlot();
      if (!proceed) return false;

      // Re-vérifier après avoir obtenu le slot (peut avoir changé pendant l'attente)
      if (batchForceSignal.aborted || clientSignal?.aborted) {
        releaseHwSlot();
        return false;
      }

      const reqCtrl = new AbortController();
      const t = setTimeout(() => reqCtrl.abort(), timeoutMs);

      const onForce  = () => reqCtrl.abort();
      const onClient = () => reqCtrl.abort();
      batchForceSignal.addEventListener('abort', onForce, { once: true });
      clientSignal?.addEventListener('abort', onClient, { once: true });

      try {
        const urlCanal = `${baseUrl}/state/plaque/${r.plateId}/canal/${r.index}/${r.value}`;
        const res = await fetch(urlCanal, {
          method: 'PUT',
          cache: 'no-store',
          signal: reqCtrl.signal,
          headers: { Connection: 'close' },
        });
        if (res.ok) return true;

        // Fallback /cursor/ (ancienne version de l'API)
        if (reqCtrl.signal.aborted) return false;
        const urlCursor = `${baseUrl}/state/plaque/${r.plateId}/cursor/${r.index}/${r.value}`;
        const res2 = await fetch(urlCursor, {
          method: 'PUT',
          cache: 'no-store',
          signal: reqCtrl.signal,
          headers: { Connection: 'close' },
        });
        return res2.ok;
      } catch {
        return false;
      } finally {
        clearTimeout(t);
        batchForceSignal.removeEventListener('abort', onForce);
        clientSignal?.removeEventListener('abort', onClient);
        releaseHwSlot();
      }
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
