import { NextResponse } from 'next/server';

const DEFAULT_BASE_URL = 'http://172.17.50.136:18080';
const DEFAULT_TIMEOUT_MS = 3000;

function getBaseUrl(): string {
  const v = process.env.SUPERVISION_API_URL?.trim();
  return v && v.length > 0 ? v.replace(/\/$/, '') : DEFAULT_BASE_URL;
}

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

export async function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const params = await ctx.params;
  const path = (params.path || []).join('/');
  return forward(req, path);
}

export async function PUT(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const params = await ctx.params;
  const path = (params.path || []).join('/');
  return forward(req, path);
}

export async function POST(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const params = await ctx.params;
  const path = (params.path || []).join('/');
  return forward(req, path);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const params = await ctx.params;
  const path = (params.path || []).join('/');
  return forward(req, path);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const params = await ctx.params;
  const path = (params.path || []).join('/');
  return forward(req, path);
}
