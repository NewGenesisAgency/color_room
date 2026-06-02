import { NextResponse } from 'next/server';
import { getSupervisionBaseUrl, getCs160BaseUrl } from '@/lib/settings';

/**
 * @file Route santé.
 * @brief
 *  - `GET /api/health`         → { status: 'ok' }  (healthcheck Docker, ne dépend d'aucune API externe)
 *  - `GET /api/health?full=1`  → teste en plus la joignabilité des APIs Supervision et CS-160.
 */

async function ping(url: string, timeoutMs: number): Promise<{ ok: boolean; status?: number; ms: number; error?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store', signal: ctrl.signal });
    return { ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch (e: any) {
    return { ok: false, ms: Date.now() - started, error: e?.name === 'AbortError' ? 'timeout' : 'network_error' };
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: Request) {
  const full = new URL(req.url).searchParams.get('full');
  if (!full) {
    return NextResponse.json({ status: 'ok' });
  }

  const supBase = getSupervisionBaseUrl();
  const csBase = getCs160BaseUrl();

  const [supervision, cs160] = await Promise.all([
    ping(`${supBase}/state`, 2000),
    ping(`${csBase}/api/health`, 4000),
  ]);

  const allOk = supervision.ok && cs160.ok;
  return NextResponse.json({
    status: 'ok', // le serveur Next répond toujours
    apis: {
      supervision: { url: supBase, reachable: supervision.ok, httpStatus: supervision.status, ms: supervision.ms, error: supervision.error },
      cs160: { url: csBase, reachable: cs160.ok, httpStatus: cs160.status, ms: cs160.ms, error: cs160.error },
    },
    allReachable: allOk,
  });
}
