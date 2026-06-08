import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { loadFlow } from '@/lib/flow/storage';
import { executeFlow } from '@/lib/runtime/engine';
import type { RuntimeRunRequest, RuntimeRunResponse } from '@/lib/runtime/types';

function randomId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('crg_session')?.value;
  const me = token ? getSessionUser(token) : null;
  if (!me || (me.role !== 'enseignant' && me.role !== 'admin'))
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Partial<RuntimeRunRequest>;

  const flowName = body.flowName || 'default';
  const flow = body.flow || (await loadFlow());
  const initialMsg = (body.initialMsg || {}) as Record<string, unknown>;

  const runId = randomId();
  const db = getDb();

  db.prepare('INSERT INTO crg_runtime_runs(id, flow_name, status) VALUES(?, ?, ?);').run(
    runId,
    flowName,
    'running',
  );

  try {
    await executeFlow({ runId, flow, initialMsg });
    db.prepare('UPDATE crg_runtime_runs SET status = ?, finished_at = datetime(\'now\') WHERE id = ?;').run(
      'finished',
      runId,
    );

    const res: RuntimeRunResponse = { runId, status: 'finished' };
    return NextResponse.json(res);
  } catch (e) {
    db.prepare('UPDATE crg_runtime_runs SET status = ?, finished_at = datetime(\'now\') WHERE id = ?;').run(
      'error',
      runId,
    );

    const res: RuntimeRunResponse = { runId, status: 'error' };
    return NextResponse.json(res, { status: 500 });
  }
}
