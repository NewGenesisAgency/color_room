/**
 * @file lib/pyodide.ts
 * @brief Chargeur Pyodide partagé (éditeur + /jeux), avec cache et mode hors-ligne.
 *
 * Pyodide (Python compilé en WebAssembly) permet d'exécuter du code Python dans
 * le navigateur. Stratégie de chargement :
 *   1. HORS-LIGNE d'abord : les fichiers cœur sont embarqués dans /pyodide/
 *      (téléchargés au build Docker, cf. scripts/fetch-pyodide.mjs) → le Pi
 *      n'a pas besoin d'internet au runtime.
 *   2. Repli CDN (jsdelivr) en développement local si la copie locale est absente.
 *
 * L'instance est chargée UNE seule fois puis mise en cache (getPyodide est
 * idempotent et peut être appelé en concurrence).
 */

const VERSION = '0.27.4';
const LOCAL = '/pyodide/';
const CDN = `https://cdn.jsdelivr.net/pyodide/v${VERSION}/full/`;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { loadPyodide?: (opts: { indexURL: string }) => Promise<any>; }
}

let pyPromise: Promise<unknown> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => res();
    s.onerror = () => rej(new Error('script KO: ' + src));
    document.head.appendChild(s);
  });
}

async function hasLocal(): Promise<boolean> {
  try { const r = await fetch(LOCAL + 'pyodide.js', { method: 'HEAD' }); return r.ok; } catch { return false; }
}

/** Charge Pyodide (idempotent). Retourne l'instance prête. */
export function getPyodide(): Promise<unknown> {
  if (pyPromise) return pyPromise;
  pyPromise = (async () => {
    const base = (await hasLocal()) ? LOCAL : CDN;
    if (!window.loadPyodide) {
      try { await loadScript(base + 'pyodide.js'); }
      catch { if (base !== CDN) await loadScript(CDN + 'pyodide.js'); else throw new Error('Pyodide inaccessible'); }
    }
    const indexURL = base === LOCAL ? window.location.origin + LOCAL : CDN;
    try { return await window.loadPyodide!({ indexURL }); }
    catch { return await window.loadPyodide!({ indexURL: CDN }); }
  })();
  return pyPromise;
}
