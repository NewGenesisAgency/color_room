/**
 * @file app/api/supervision/route.ts
 * @brief Proxy transparent vers la racine de l'API de supervision.
 *
 * GET/PUT/POST/PATCH/DELETE : relaient la requête vers `${baseUrl}/` (URL de base
 *        issue des réglages), en recopiant content-type/accept et le corps pour
 *        les méthodes non GET/HEAD. Timeout 3 s. La réponse amont (corps + statut +
 *        content-type) est renvoyée telle quelle.
 * Codes d'erreur : 502 { ok:false, error:'SUPERVISION_PROXY_ERROR' } en cas de
 *        timeout ou d'erreur réseau.
 * Effets de bord : requête réseau sortante vers le service de supervision.
 */
import { NextResponse } from 'next/server';
import { getSupervisionBaseUrl as getBaseUrl } from '@/lib/settings';

const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Relaie une requête vers la racine de l'API de supervision et renvoie sa réponse.
 * @param req Requête HTTP entrante à transmettre.
 * @returns La réponse amont (statut/corps/content-type) ou 502 en cas d'échec.
 */
async function forward(req: Request) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  const headers = new Headers();
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const accept = req.headers.get('accept');
  if (accept) headers.set('accept', accept);

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
    signal: controller.signal,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) init.body = buf;
  }

  try {
    const res = await fetch(url, init);
    const resBody = await res.arrayBuffer();

    const outHeaders = new Headers();
    const resContentType = res.headers.get('content-type');
    if (resContentType) outHeaders.set('content-type', resContentType);

    return new NextResponse(resBody, { status: res.status, headers: outHeaders });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const message = isAbort ? `Timeout en appelant ${url}` : `Erreur réseau en appelant ${url}`;
    return NextResponse.json(
      {
        ok: false,
        error: 'SUPERVISION_PROXY_ERROR',
        message,
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** Relaie un GET vers la racine de l'API de supervision. @param req Requête. @returns Réponse amont. */
export async function GET(req: Request) {
  return forward(req);
}

/** Relaie un PUT vers la racine de l'API de supervision. @param req Requête. @returns Réponse amont. */
export async function PUT(req: Request) {
  return forward(req);
}

/** Relaie un POST vers la racine de l'API de supervision. @param req Requête. @returns Réponse amont. */
export async function POST(req: Request) {
  return forward(req);
}

/** Relaie un PATCH vers la racine de l'API de supervision. @param req Requête. @returns Réponse amont. */
export async function PATCH(req: Request) {
  return forward(req);
}

/** Relaie un DELETE vers la racine de l'API de supervision. @param req Requête. @returns Réponse amont. */
export async function DELETE(req: Request) {
  return forward(req);
}
