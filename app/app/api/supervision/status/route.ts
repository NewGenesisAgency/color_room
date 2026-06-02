import { NextResponse } from 'next/server';
import { getSupervisionBaseUrl as getBaseUrl } from '@/lib/settings';

const PING_TIMEOUT_MS = 1500;

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
