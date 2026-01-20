import type { Edge, Node } from 'reactflow';

export type RuntimeMsg = Record<string, unknown>;

export type RuntimeFlowDocument = {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  updatedAt: string;
};

export type RuntimeRunRequest = {
  flow?: RuntimeFlowDocument;
  flowName?: string;
  initialMsg?: RuntimeMsg;
};

export type RuntimeRunResponse = {
  runId: string;
  status: 'running' | 'finished' | 'error';
};

export type RuntimeLogsResponse = {
  runId: string;
  logs: Array<{
    id: number;
    ts: string;
    level: string;
    message: string;
    data?: unknown;
  }>;
};
