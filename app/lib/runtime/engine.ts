import vm from 'node:vm';

import type { Edge, Node } from 'reactflow';

import { getDb } from '@/lib/db';
import type { RuntimeFlowDocument, RuntimeMsg } from './types';

type Logger = {
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
};

function safeJson(data: unknown): string | null {
  try {
    return JSON.stringify(data);
  } catch {
    return null;
  }
}

function buildAdjacency(edges: Edge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const e of edges) {
    if (!map.has(e.source)) map.set(e.source, []);
    map.get(e.source)!.push(e.target);
  }
  return map;
}

function nodesById(nodes: Node[]): Map<string, Node> {
  const map = new Map<string, Node>();
  for (const n of nodes) map.set(n.id, n);
  return map;
}

function incomingCount(nodes: Node[], edges: Edge[]): Map<string, number> {
  const cnt = new Map<string, number>();
  for (const n of nodes) cnt.set(n.id, 0);
  for (const e of edges) cnt.set(e.target, (cnt.get(e.target) || 0) + 1);
  return cnt;
}

function kind(node: Node): string {
  const d = node.data as any;
  return (d?.kind as string) || (node.type as string) || 'default';
}

async function runNode(node: Node, msg: RuntimeMsg, logger: Logger): Promise<RuntimeMsg | null> {
  const d = node.data as any;
  const k = kind(node);

  if (k === 'inject') {
    const payload = d?.payload;
    if (payload !== undefined) return { ...msg, payload };
    return msg;
  }

  if (k === 'delay') {
    const ms = typeof d?.ms === 'number' ? d.ms : 100;
    await new Promise((r) => setTimeout(r, ms));
    return msg;
  }

  if (k === 'debug') {
    logger.info('debug', { msg });
    return msg;
  }

  if (k === 'http-request') {
    const url = String(d?.url || msg.url || '');
    const method = String(d?.method || 'GET');
    if (!url) {
      logger.warn('http-request: missing url');
      return msg;
    }

    const res = await fetch(url, { method });
    const contentType = res.headers.get('content-type') || '';
    let payload: unknown;
    if (contentType.includes('application/json')) payload = await res.json();
    else payload = await res.text();

    return { ...msg, payload, statusCode: res.status };
  }

  if (k === 'sqlite') {
    const db = getDb();
    const sql = String(d?.sql || msg.sql || '');
    const params = (d?.params || msg.params) as unknown;

    if (!sql) {
      logger.warn('sqlite: missing sql');
      return msg;
    }

    const stmt = db.prepare(sql);
    let result: unknown;

    if (stmt.reader) {
      if (Array.isArray(params)) result = stmt.all(...params);
      else if (params && typeof params === 'object') result = stmt.all(params as any);
      else result = stmt.all();
    } else {
      if (Array.isArray(params)) result = stmt.run(...params);
      else if (params && typeof params === 'object') result = stmt.run(params as any);
      else result = stmt.run();
    }

    return { ...msg, payload: result };
  }

  if (k === 'function-js') {
    const code = String(d?.code || 'return msg;');
    const context = vm.createContext({ msg: { ...msg } });
    const wrapped = `(function(){\n${code}\n})()`;
    try {
      const result = vm.runInContext(wrapped, context, { timeout: 5000 });
      return { ...msg, payload: result };
    } catch (e) {
      logger.error('function-js error', { error: String(e) });
      return msg;
    }
  }

  // Game nodes
  if (k === 'game_tetris') {
    logger.info('game_tetris: starting Tetris game', { msg });
    // Trigger Tetris game via API call to the game runtime
    try {
      const res = await fetch('/api/game/tetris/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config: d?.config || {} }),
      });
      const payload = await res.json();
      return { ...msg, payload, statusCode: res.status };
    } catch {
      logger.warn('game_tetris: failed to start');
      return msg;
    }
  }

  // Event nodes
  if (k === 'on_timer') {
    const interval = Number(d?.interval || 1000);
    logger.info('on_timer: scheduling timer', { interval });
    // Timer events are handled by the runtime scheduler
    return { ...msg, _timerInterval: interval };
  }

  if (k === 'on_click') {
    const target = String(d?.target || 'any');
    logger.info('on_click: registering click handler', { target });
    // Click events are handled by the UI runtime
    return { ...msg, _clickTarget: target };
  }

  // CS150 Colorimeter nodes
  if (k === 'cs150_connect') {
    try {
      const res = await fetch('/api/cs150', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'connect' }),
      });
      const payload = await res.json();
      logger.info('cs150_connect', { payload });
      return { ...msg, payload };
    } catch {
      logger.warn('cs150_connect: failed');
      return msg;
    }
  }

  if (k === 'cs150_disconnect') {
    try {
      const res = await fetch('/api/cs150', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      const payload = await res.json();
      logger.info('cs150_disconnect', { payload });
      return { ...msg, payload };
    } catch {
      logger.warn('cs150_disconnect: failed');
      return msg;
    }
  }

  if (k === 'cs150_measure') {
    try {
      const res = await fetch('/api/cs150', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'measure' }),
      });
      const payload = await res.json();
      logger.info('cs150_measure', { payload });
      return { ...msg, payload };
    } catch {
      logger.warn('cs150_measure: failed');
      return msg;
    }
  }

  if (k === 'cs150_samples') {
    try {
      const res = await fetch('/api/cs150', {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = await res.json();
      logger.info('cs150_samples', { payload });
      return { ...msg, payload };
    } catch {
      logger.warn('cs150_samples: failed');
      return msg;
    }
  }

  if (k === 'cs150_status') {
    try {
      const res = await fetch('/api/cs150', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      });
      const payload = await res.json();
      logger.info('cs150_status', { payload });
      return { ...msg, payload };
    } catch {
      logger.warn('cs150_status: failed');
      return msg;
    }
  }

  // Render nodes (fill, pulse, tile) - handled by editeur page preview
  if (k === 'fill' || k === 'pulse' || k === 'tile') {
    logger.info(`render node: ${k}`, { params: d?.params });
    return { ...msg, _renderNode: k, _renderParams: d?.params };
  }

  logger.warn(`unknown node kind: ${k}`, { nodeId: node.id });
  return msg;
}

export async function executeFlow(opts: {
  runId: string;
  flow: RuntimeFlowDocument;
  initialMsg: RuntimeMsg;
}): Promise<void> {
  const { runId, flow, initialMsg } = opts;

  const db = getDb();

  const insertLog = db.prepare(
    'INSERT INTO crg_runtime_logs(run_id, level, message, data_json) VALUES(?, ?, ?, ?);',
  );

  const logger: Logger = {
    info: (message, data) => {
      insertLog.run(runId, 'info', message, safeJson(data));
    },
    warn: (message, data) => {
      insertLog.run(runId, 'warn', message, safeJson(data));
    },
    error: (message, data) => {
      insertLog.run(runId, 'error', message, safeJson(data));
    },
  };

  const byId = nodesById(flow.nodes);
  const adj = buildAdjacency(flow.edges);
  const incoming = incomingCount(flow.nodes, flow.edges);

  const startNodes = flow.nodes
    .filter((n) => kind(n) === 'inject' || (incoming.get(n.id) || 0) === 0)
    .map((n) => n.id);

  logger.info('run:start', { flowId: flow.id, flowName: flow.name, startNodes });

  type QItem = { nodeId: string; msg: RuntimeMsg };
  const q: QItem[] = startNodes.map((nodeId) => ({ nodeId, msg: { ...initialMsg } }));

  while (q.length) {
    const item = q.shift()!;
    const node = byId.get(item.nodeId);
    if (!node) {
      logger.warn('missing node', { nodeId: item.nodeId });
      continue;
    }

    logger.info('node:enter', { nodeId: node.id, kind: kind(node) });

    let out: RuntimeMsg | null;
    try {
      out = await runNode(node, item.msg, logger);
    } catch (e) {
      logger.error('node:error', { nodeId: node.id, error: String(e) });
      throw e;
    }

    if (!out) {
      logger.info('node:stop', { nodeId: node.id });
      continue;
    }

    const next = adj.get(node.id) || [];
    for (const targetId of next) {
      q.push({ nodeId: targetId, msg: out });
    }
  }

  logger.info('run:finished');
}
