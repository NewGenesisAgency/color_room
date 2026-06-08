import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { loadFlow, saveFlow } from '@lib/flow/storage';
import type { SaveFlowRequest } from '@lib/flow/types';

function requireAuth(req: NextRequest, minRole?: 'enseignant' | 'admin') {
  const token = req.cookies.get('crg_session')?.value;
  if (!token) return null;
  const me = getSessionUser(token);
  if (!me) return null;
  if (minRole === 'admin' && me.role !== 'admin') return null;
  if (minRole === 'enseignant' && me.role !== 'enseignant' && me.role !== 'admin') return null;
  return me;
}

export async function GET(req: NextRequest) {
  if (!requireAuth(req, 'enseignant'))
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const flow = await loadFlow();
  return NextResponse.json({ flow });
}

export async function POST(req: NextRequest) {
  if (!requireAuth(req, 'enseignant'))
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await req.json()) as SaveFlowRequest;
  await saveFlow({ ...body.flow, updatedAt: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
