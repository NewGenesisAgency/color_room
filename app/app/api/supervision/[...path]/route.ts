/**
 * @file app/api/supervision/[...path]/route.ts
 * @brief Proxy générique (catch-all) vers un chemin arbitraire de l'API supervision.
 *
 * GET/PUT/POST/PATCH/DELETE : reconstruisent le sous-chemin depuis le segment
 *        catch-all `path` et relaient la requête vers `${baseUrl}/${path}`, en
 *        recopiant content-type/accept et le corps pour les méthodes non GET/HEAD.
 *        Timeout 3 s. La réponse amont est renvoyée telle quelle.
 * Codes d'erreur : 502 { ok:false, error:'SUPERVISION_PROXY_ERROR' } en cas de
 *        timeout ou d'erreur réseau.
 * Effets de bord : requête réseau sortante vers le service de supervision.
 */
import { NextResponse } from 'next/server';
import { getSupervisionBaseUrl as getBaseUrl } from '@/lib/settings';

const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Relaie une requête vers le sous-chemin donné de l'API de supervision.
 * @param req Requête HTTP entrante à transmettre.
 * @param path Sous-chemin (segments catch-all joints par '/').
 * @returns La réponse amont (statut/corps/content-type) ou 502 en cas d'échec.
 */
async function forward(req: Request, path: string) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/${path}`;

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

/** Relaie un GET vers `${baseUrl}/${path}`. @param req Requête. @param ctx Contexte (params.path). @returns Réponse amont. */
export async function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const params = await ctx.params;
  const path = (params.path || []).join('/');
  return forward(req, path);
}

/** Relaie un PUT vers `${baseUrl}/${path}`. @param req Requête. @param ctx Contexte (params.path). @returns Réponse amont. */
export async function PUT(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const params = await ctx.params;
  const path = (params.path || []).join('/');
  return forward(req, path);
}

/** Relaie un POST vers `${baseUrl}/${path}`. @param req Requête. @param ctx Contexte (params.path). @returns Réponse amont. */
export async function POST(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const params = await ctx.params;
  const path = (params.path || []).join('/');
  return forward(req, path);
}

/** Relaie un PATCH vers `${baseUrl}/${path}`. @param req Requête. @param ctx Contexte (params.path). @returns Réponse amont. */
export async function PATCH(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const params = await ctx.params;
  const path = (params.path || []).join('/');
  return forward(req, path);
}

/** Relaie un DELETE vers `${baseUrl}/${path}`. @param req Requête. @param ctx Contexte (params.path). @returns Réponse amont. */
export async function DELETE(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const params = await ctx.params;
  const path = (params.path || []).join('/');
  return forward(req, path);
}
