/**
 * @file app/api/supervision/status/route.ts
 * @brief Sonde la joignabilité de l'API de supervision (healthcheck léger).
 *
 * GET : effectue un GET sur `${baseUrl}/state` avec un timeout de 1,5 s.
 *       Renvoie { ok: true, reachable: true, status, url } si l'API répond, sinon
 *       { ok: false, reachable: false, reason: 'timeout'|'network_error', url }.
 * Effets de bord : requête réseau sortante vers le service de supervision.
 */
import { NextResponse } from 'next/server';
import { getSupervisionBaseUrl as getBaseUrl } from '@/lib/settings';

const PING_TIMEOUT_MS = 1500;

/**
 * Vérifie que l'API de supervision est joignable.
 * @returns 200 { ok, reachable, status?, reason?, url } selon le résultat de la sonde.
 */
export async function GET() {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/state`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { 'Connection': 'close' },
    });
    clearTimeout(t);

    return NextResponse.json({
      ok: true,
      reachable: true,
      status: res.status,
      url: baseUrl,
    });
  } catch (err) {
    clearTimeout(t);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return NextResponse.json({
      ok: false,
      reachable: false,
      reason: isTimeout ? 'timeout' : 'network_error',
      url: baseUrl,
    });
  }
}
