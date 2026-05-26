import { NextResponse } from 'next/server';

const DEFAULT_BASE_URL = 'http://172.17.50.136:18080';
const PING_TIMEOUT_MS = 1500;

function getBaseUrl(): string {
  const v = process.env.SUPERVISION_API_URL?.trim();
  return v && v.length > 0 ? v.replace(/\/$/, '') : DEFAULT_BASE_URL;
}

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
