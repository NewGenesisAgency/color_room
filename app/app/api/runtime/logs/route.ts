import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import type { RuntimeLogsResponse } from '@/lib/runtime/types';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const runId = url.searchParams.get('runId');
  if (!runId) return NextResponse.json({ error: 'missing runId' }, { status: 400 });

  const db = getDb();
  const rows = db
    .prepare('SELECT id, ts, level, message, data_json FROM crg_runtime_logs WHERE run_id = ? ORDER BY id ASC;')
    .all(runId) as Array<{ id: number; ts: string; level: string; message: string; data_json: string | null }>;

  const logs = rows.map((r) => ({
    id: r.id,
    ts: r.ts,
    level: r.level,
    message: r.message,
    data: r.data_json ? (JSON.parse(r.data_json) as unknown) : undefined,
  }));

  const res: RuntimeLogsResponse = { runId, logs };
  return NextResponse.json(res);
}
