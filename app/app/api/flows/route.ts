import { NextResponse } from 'next/server';

import { loadFlow, saveFlow } from '@lib/flow/storage';
import type { SaveFlowRequest } from '@lib/flow/types';

/**
 * @file API flows.
 * @brief Chargement/sauvegarde du flow.
 */

export async function GET() {
  const flow = await loadFlow();
  return NextResponse.json({ flow });
}

export async function POST(req: Request) {
  const body = (await req.json()) as SaveFlowRequest;
  await saveFlow({ ...body.flow, updatedAt: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
