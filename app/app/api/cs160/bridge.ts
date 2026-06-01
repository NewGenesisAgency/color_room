/**
 * CS-160 Bridge — KonicaBridge sur http://172.17.50.39:3000
 *
 * Routes réelles (préfixe /api/) :
 *   GET  /api/health    — ping
 *   POST /api/connect   — connexion
 *   POST /api/disconnect
 *   POST /api/measure   — mesure → MesureResult
 *   GET  /api/samples   — données stockées
 */

function getBaseUrl(): string {
  const v = process.env.CS160_API_URL?.trim();
  return v && v.length > 0 ? v.replace(/\/$/, '') : 'http://172.17.50.39:3000';
}

interface BridgeResponse {
  success: boolean;
  data?: any;
  error?: string;
}

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
    return { success: false, error: err.name === 'TimeoutError' ? `Timeout (${timeoutMs}ms) — bridge inaccessible ?` : err.message };
  }
}

class CS160Bridge {
  health()      { return call('/api/health',     'GET',  4000); }
  connect()     { return call('/api/connect',    'POST', 10000); }
  disconnect()  { return call('/api/disconnect', 'POST', 5000); }
  measure()     { return call('/api/measure',    'POST', 20000); }
  getSamples()  { return call('/api/samples',    'GET',  8000); }
}

export const cs160Bridge = new CS160Bridge();
export default cs160Bridge;
