import { getDb } from '@/lib/db';

/**
 * Réglages applicatifs persistants (table crg_app_config).
 *
 * Priorité de résolution d'une URL d'API :
 *   1. valeur enregistrée en base (modifiable depuis la page Configuration)
 *   2. variable d'environnement (.env / Docker)
 *   3. valeur par défaut codée en dur
 *
 * better-sqlite3 est synchrone : ces fonctions ne sont jamais `async`.
 */

export const SETTING_KEYS = {
  SUPERVISION_API_URL: 'SUPERVISION_API_URL',
  CS160_API_URL: 'CS160_API_URL',
} as const;

export const DEFAULTS = {
  SUPERVISION_API_URL: 'http://172.17.50.136:18080',
  CS160_API_URL: 'http://172.17.50.39:3000',
} as const;

function cleanUrl(u: string): string {
  return u.trim().replace(/\/+$/, '');
}

// Cache mémoire court (les routes temps réel comme /supervision/batch lisent l'URL
// à chaque requête). Invalidé immédiatement à toute écriture.
const CACHE_TTL_MS = 3000;
const cache = new Map<string, { value: string | null; at: number }>();

export function getSetting(key: string): string | null {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.value;
  let value: string | null = null;
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM crg_app_config WHERE key = ?;').get(key) as { value: string } | undefined;
    const v = row?.value?.trim();
    value = v && v.length > 0 ? v : null;
  } catch {
    value = null;
  }
  cache.set(key, { value, at: now });
  return value;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO crg_app_config(key, value, updated_at) VALUES(?, ?, datetime('now')) " +
    "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now');",
  ).run(key, value);
  cache.delete(key);
}

/** Supprime un réglage (revient à l'env var / valeur par défaut). */
export function clearSetting(key: string): void {
  try {
    const db = getDb();
    db.prepare('DELETE FROM crg_app_config WHERE key = ?;').run(key);
  } catch { /* ignore */ }
  cache.delete(key);
}

/** Résout l'URL effective : base (DB) → env → défaut. */
function resolveUrl(key: keyof typeof DEFAULTS, envValue: string | undefined): string {
  const fromDb = getSetting(SETTING_KEYS[key]);
  if (fromDb) return cleanUrl(fromDb);
  const fromEnv = envValue?.trim();
  if (fromEnv && fromEnv.length > 0) return cleanUrl(fromEnv);
  return DEFAULTS[key];
}

export function getSupervisionBaseUrl(): string {
  return resolveUrl('SUPERVISION_API_URL', process.env.SUPERVISION_API_URL);
}

export function getCs160BaseUrl(): string {
  return resolveUrl('CS160_API_URL', process.env.CS160_API_URL);
}

/** Indique la provenance de la valeur effective (pour l'UI de configuration). */
export function getConfigSnapshot() {
  const supDb = getSetting(SETTING_KEYS.SUPERVISION_API_URL);
  const csDb = getSetting(SETTING_KEYS.CS160_API_URL);
  return {
    supervision: {
      value: getSupervisionBaseUrl(),
      source: supDb ? 'base' : (process.env.SUPERVISION_API_URL?.trim() ? 'env' : 'défaut'),
      default: DEFAULTS.SUPERVISION_API_URL,
    },
    cs160: {
      value: getCs160BaseUrl(),
      source: csDb ? 'base' : (process.env.CS160_API_URL?.trim() ? 'env' : 'défaut'),
      default: DEFAULTS.CS160_API_URL,
    },
  };
}
