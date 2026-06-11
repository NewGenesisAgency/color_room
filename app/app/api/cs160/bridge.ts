/**
 * @file app/api/cs160/bridge.ts
 * @brief Client HTTP du pont KonicaBridge pilotant le colorimètre CS-160.
 *
 * Encapsule les appels réseau vers le service KonicaBridge (URL de base fournie
 * par les réglages). Chaque méthode renvoie un { success, data?, error? } uniforme,
 * en gérant les timeouts et le parsing JSON tolérant. Exporte l'instance
 * singleton `cs160Bridge`.
 *
 * CS-160 Bridge - KonicaBridge sur http://172.17.50.39:3000
 *
 * Routes réelles (préfixe /api/) :
 *   GET  /api/health    - ping
 *   POST /api/connect   - connexion
 *   POST /api/disconnect
 *   POST /api/measure   - mesure → MesureResult
 *   GET  /api/samples   - données stockées
 */

import { getCs160BaseUrl as getBaseUrl } from '@/lib/settings';

interface BridgeResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Effectue un appel HTTP vers le pont CS-160 avec timeout et parsing tolérant.
 * @param path Chemin de la route (préfixé par l'URL de base du pont).
 * @param method Méthode HTTP ('GET' ou 'POST').
 * @param timeoutMs Délai d'expiration en millisecondes (défaut 10000).
 * @returns { success, data } si OK, sinon { success: false, error }.
 */
async function call(path: string, method: 'GET' | 'POST', timeoutMs = 10000): Promise<BridgeResponse> {
  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      method,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (res.ok) return { success: true, data };
    return { success: false, error: typeof data === 'object' && data?.error ? data.error : `HTTP ${res.status}: ${text}` };
  } catch (err: any) {
    return { success: false, error: err.name === 'TimeoutError' ? `Timeout (${timeoutMs}ms) - bridge inaccessible ?` : err.message };
  }
}

/**
 * Façade typée des opérations du pont CS-160. Chaque méthode délègue à `call`
 * avec le chemin, la méthode HTTP et le timeout adaptés.
 */
class CS160Bridge {
  health()      { return call('/api/health',     'GET',  4000); }
  connect()     { return call('/api/connect',    'POST', 10000); }
  disconnect()  { return call('/api/disconnect', 'POST', 5000); }
  measure()     { return call('/api/measure',    'POST', 20000); }
  getSamples()  { return call('/api/samples',    'GET',  8000); }
}

export const cs160Bridge = new CS160Bridge();
export default cs160Bridge;
