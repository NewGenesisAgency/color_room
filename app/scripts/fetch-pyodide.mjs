// Télécharge les fichiers cœur de Pyodide dans public/pyodide/ pour un
// fonctionnement 100 % HORS-LIGNE (le Pi n'a internet qu'au build).
// Exécuté pendant le build Docker (qui a internet). Best-effort : si le
// téléchargement échoue (pas de réseau en dev local), on n'interrompt pas le
// build — l'app retombera alors sur le CDN au runtime.
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '0.27.4';
const BASE = `https://cdn.jsdelivr.net/pyodide/v${VERSION}/full/`;
// Fichiers minimaux pour exécuter du Python pur (stdlib incluse : math, random…).
const FILES = [
  'pyodide.js',
  'pyodide.mjs',
  'pyodide.asm.js',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'pyodide');

async function exists(p) { try { await stat(p); return true; } catch { return false; } }

async function main() {
  await mkdir(OUT, { recursive: true });
  let ok = 0;
  for (const f of FILES) {
    const dest = join(OUT, f);
    if (await exists(dest)) { ok++; continue; }
    try {
      const res = await fetch(BASE + f);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(dest, buf);
      console.log(`[pyodide] ✓ ${f} (${(buf.length / 1024 / 1024).toFixed(1)} Mo)`);
      ok++;
    } catch (e) {
      console.warn(`[pyodide] ⚠ ${f} non téléchargé : ${e.message} (fallback CDN au runtime)`);
    }
  }
  console.log(`[pyodide] ${ok}/${FILES.length} fichiers prêts dans public/pyodide/`);
}

main().catch((e) => { console.warn('[pyodide] échec global (non bloquant) :', e.message); });
