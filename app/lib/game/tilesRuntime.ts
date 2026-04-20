export type TileState = {
  color: string;
  intensity: number;
};

export type RuntimeEdge = {
  id: string;
  from: string;
  to: string;
};

export type RuntimeNode = {
  id: string;
  kind: string;
  enabled: boolean;
  params: Record<string, unknown>;
};

export type RuntimeGameDoc = {
  tileCount?: number;
  nodes: RuntimeNode[];
  edges: RuntimeEdge[];
};

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function isHexColor(str: unknown): str is string {
  return typeof str === 'string' && /^#[0-9a-fA-F]{6}$/.test(str);
}

function getNum(params: Record<string, unknown>, key: string, fallback: number): number {
  const raw = params[key];
  const v = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

function getColor(params: Record<string, unknown>, key: string, fallback: string): string {
  const raw = params[key];
  return isHexColor(raw) ? raw : fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return { r: 255, g: 255, b: 255 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const rr = Math.max(0, Math.min(255, Math.round(r))).toString(16).padStart(2, '0');
  const gg = Math.max(0, Math.min(255, Math.round(g))).toString(16).padStart(2, '0');
  const bb = Math.max(0, Math.min(255, Math.round(b))).toString(16).padStart(2, '0');
  return `#${rr}${gg}${bb}`;
}

function lerpColor(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  return rgbToHex(lerp(ra.r, rb.r, t), lerp(ra.g, rb.g, t), lerp(ra.b, rb.b, t));
}

function applyRenderNode(tiles: TileState[], node: RuntimeNode, tSeconds: number) {
  const params = node.params && typeof node.params === 'object' ? node.params : {};

  if (node.kind === 'fill') {
    const color = getColor(params, 'color', '#6d28ff');
    const intensity = clamp01(getNum(params, 'intensity', 0.8));
    const mask = String((params as any).mask ?? 'all');

    for (let i = 0; i < tiles.length; i++) {
      const apply = mask === 'all' || ((mask === 'border' || mask === 'borders') && i !== 4);
      if (!apply) continue;
      tiles[i] = { color, intensity };
    }
  }

  if (node.kind === 'pulse') {
    const legacyColor = getColor(params, 'color', '#ff2aa6');
    const baseColor = getColor(params, 'baseColor', legacyColor);
    const targetColor = getColor(params, 'targetColor', legacyColor);

    const legacyBase = clamp01(getNum(params, 'base', 0.15));
    const legacyAmp = clamp01(getNum(params, 'amp', 0.75));
    const fromIntensity = clamp01(getNum(params, 'fromIntensity', legacyBase));
    const toIntensity = clamp01(getNum(params, 'toIntensity', clamp01(legacyBase + legacyAmp)));

    const speed = Math.max(0.01, getNum(params, 'speed', 0.9));
    const phase = getNum(params, 'phase', 0);
    const t01 = clamp01(0.5 + 0.5 * Math.sin(tSeconds * speed + phase));
    const intensity = clamp01(lerp(fromIntensity, toIntensity, t01));
    const color = lerpColor(baseColor, targetColor, t01);

    for (let i = 0; i < tiles.length; i++) {
      if (intensity <= tiles[i].intensity) continue;
      tiles[i] = { color, intensity };
    }
  }

  if (node.kind === 'tile') {
    const tileIndexRaw = getNum(params, 'tileIndex', 0);
    const maxIndex = Math.max(0, tiles.length - 1);
    const tileIndex = Math.max(0, Math.min(maxIndex, Math.round(tileIndexRaw)));
    const color = getColor(params, 'color', '#ff2aa6');
    const intensity = clamp01(getNum(params, 'intensity', 0.85));
    tiles[tileIndex] = { color, intensity };
  }
}

export function computeTiles(game: RuntimeGameDoc, tSeconds: number): TileState[] {
  const tileCount = Math.max(1, Math.round(Number(game.tileCount ?? 9)));
  const tiles: TileState[] = Array.from({ length: tileCount }, () => ({ color: '#000000', intensity: 0 }));

  const byId = new Map(game.nodes.map((n) => [n.id, n] as const));
  const out = new Map<string, string[]>();
  for (const e of game.edges) {
    const arr = out.get(e.from) ?? [];
    arr.push(e.to);
    out.set(e.from, arr);
  }

  const start = game.nodes.find((n) => n.kind === 'event_begin' && n.enabled);
  if (!start) {
    for (const node of game.nodes) {
      if (!node.enabled) continue;
      applyRenderNode(tiles, node, tSeconds);
    }
    return tiles;
  }

  type Segment = { nodeId: string; duration: number };
  const segments: Segment[] = [];
  const visited = new Set<string>();
  let cursor: RuntimeNode | null = start;
  let steps = 0;

  while (cursor && steps < 100) {
    steps++;
    if (visited.has(cursor.id)) break;
    visited.add(cursor.id);

    if (cursor.enabled) {
      const params = cursor.params && typeof cursor.params === 'object' ? cursor.params : {};
      if (cursor.kind === 'wait') {
        const seconds = Math.max(0, getNum(params, 'seconds', 1));
        segments.push({ nodeId: cursor.id, duration: seconds });
      } else if (cursor.kind === 'fill') {
        const seconds = Math.max(0.01, getNum(params, 'seconds', 1));
        segments.push({ nodeId: cursor.id, duration: seconds });
      } else if (cursor.kind === 'pulse' || cursor.kind === 'tile') {
        segments.push({ nodeId: cursor.id, duration: 1 });
      }
    }

    const nextId: string | null = out.get(cursor.id)?.[0] ?? null;
    cursor = nextId ? byId.get(nextId) ?? null : null;
  }

  const total = segments.reduce((acc, s) => acc + s.duration, 0);
  if (total <= 0.0001 || segments.length === 0) {
    return tiles;
  }

  let local = ((tSeconds % total) + total) % total;

  let activeIndex = -1;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (local <= seg.duration) {
      activeIndex = i;
      break;
    }
    local -= seg.duration;
  }

  if (activeIndex === -1) return tiles;

  const pickRenderableIndex = (startIndex: number): number => {
    for (let k = 0; k < segments.length; k++) {
      const idx = (startIndex - k + segments.length) % segments.length;
      const node = byId.get(segments[idx].nodeId);
      if (node && node.enabled && node.kind !== 'wait') return idx;
    }
    return -1;
  };

  const chosenIndex = pickRenderableIndex(activeIndex);
  if (chosenIndex !== -1) {
    const node = byId.get(segments[chosenIndex].nodeId);
    if (node && node.enabled && node.kind !== 'wait') {
      applyRenderNode(tiles, node, tSeconds);
    }
  }

  return tiles;
}
