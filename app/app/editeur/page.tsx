'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import EditorTilesViewport from '@/app/_components/EditorTilesViewport';

import { Boxes, Gamepad2, Plus, Play, Pause, RotateCcw, Save, Trash2, FolderPlus, X, ChevronRight, Layers, Zap, Palette, Clock, MousePointer2, LayoutGrid, Maximize2, Minimize2 } from 'lucide-react';

type IdFactory = () => string;

type TileState = {
  color: string;
  intensity: number;
};

type EditorNodeKind =
  | 'fill'
  | 'pulse'
  | 'tile'
  | 'event_begin'
  | 'wait'
  | 'sequence'
  | 'while'
  | 'if'
  | 'const_number'
  | 'const_bool'
  | 'const_color'
  | 'math_add'
  | 'math_sub'
  | 'math_mul'
  | 'math_div'
  | 'math_clamp01'
  | 'math_lerp'
  | 'compare_eq'
  | 'compare_gt'
  | 'compare_lt'
  | 'logic_and'
  | 'logic_or'
  | 'logic_not'
  | 'time_seconds'
  | 'random_01'
  | 'tile_get'
  | 'tile_set';

type EditorNode = {
  id: string;
  kind: EditorNodeKind;
  name: string;
  enabled: boolean;
  params: Record<string, unknown>;
  pos: { x: number; y: number };
};

type GameDoc = {
  id: string;
  name: string;
  tileCount?: number;
  nodes: EditorNode[];
  edges: GraphEdge[];
};

type GraphEdge = {
  id: string;
  from: string;
  to: string;
};

type NodeCatalogItem = {
  kind: EditorNodeKind;
  category: string;
  title: string;
  defaults: Record<string, unknown>;
};

const NODE_CATALOG: NodeCatalogItem[] = [
  { kind: 'event_begin', category: 'Évènements', title: 'Évènement', defaults: {} },
  { kind: 'wait', category: 'Flux', title: 'Attendre', defaults: { seconds: 1 } },
  { kind: 'sequence', category: 'Flux', title: 'Séquence', defaults: {} },
  { kind: 'while', category: 'Flux', title: 'Tant que', defaults: {} },
  { kind: 'if', category: 'Flux', title: 'Si', defaults: {} },
  { kind: 'fill', category: 'Rendu', title: 'Remplissage', defaults: { color: '#00d7ff', intensity: 0.6, mask: 'all', seconds: 1 } },
  {
    kind: 'pulse',
    category: 'Rendu',
    title: 'Pulsation',
    defaults: { baseColor: '#ff2aa6', targetColor: '#00d7ff', fromIntensity: 0.1, toIntensity: 0.8, speed: 1.0, phase: 0 },
  },
  { kind: 'tile', category: 'Rendu', title: 'Surcharge tuile', defaults: { tileIndex: 0, color: '#ff2aa6', intensity: 0.9 } },
  { kind: 'tile_get', category: 'Dalles', title: 'Lire une dalle', defaults: { tileIndex: 0 } },
  { kind: 'tile_set', category: 'Dalles', title: 'Écrire une dalle', defaults: { tileIndex: 0, color: '#ffffff', intensity: 1 } },
  { kind: 'const_number', category: 'Constantes', title: 'Nombre', defaults: { value: 0 } },
  { kind: 'const_bool', category: 'Constantes', title: 'Booléen', defaults: { value: false } },
  { kind: 'const_color', category: 'Constantes', title: 'Couleur', defaults: { value: '#ffffff' } },
  { kind: 'math_add', category: 'Maths', title: 'Addition', defaults: {} },
  { kind: 'math_sub', category: 'Maths', title: 'Soustraction', defaults: {} },
  { kind: 'math_mul', category: 'Maths', title: 'Multiplication', defaults: {} },
  { kind: 'math_div', category: 'Maths', title: 'Division', defaults: {} },
  { kind: 'math_clamp01', category: 'Maths', title: 'Bornage 0..1', defaults: {} },
  { kind: 'math_lerp', category: 'Maths', title: 'Interpolation', defaults: { t: 0.5 } },
  { kind: 'compare_eq', category: 'Logique', title: 'Égal', defaults: {} },
  { kind: 'compare_gt', category: 'Logique', title: 'Supérieur à', defaults: {} },
  { kind: 'compare_lt', category: 'Logique', title: 'Inférieur à', defaults: {} },
  { kind: 'logic_and', category: 'Logique', title: 'ET', defaults: {} },
  { kind: 'logic_or', category: 'Logique', title: 'OU', defaults: {} },
  { kind: 'logic_not', category: 'Logique', title: 'NON', defaults: {} },
  { kind: 'time_seconds', category: 'Temps', title: 'Secondes', defaults: {} },
  { kind: 'random_01', category: 'Aléatoire', title: 'Aléatoire 0..1', defaults: {} },
];

function labelNodeKind(kind: EditorNodeKind): string {
  return NODE_CATALOG.find((x) => x.kind === kind)?.title ?? kind;
}

function clamp255(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(255, Math.round(v)));
}

function randomId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isEditorNodeKind(v: string): v is EditorNodeKind {
  return (NODE_CATALOG as { kind: string }[]).some((x) => x.kind === v);
}

function formatNodeParamsInline(node: EditorNode): string {
  if (node.kind === 'wait') {
    const s = Math.max(0, getNum(node.params, 'seconds', 1));
    return `${s}s`;
  }
  if (node.kind === 'fill') {
    const s = Math.max(0, getNum(node.params, 'seconds', 1));
    const intensity = clamp01(getNum(node.params, 'intensity', 0.8));
    const mask = String(node.params.mask ?? 'all');
    return `${s}s • I=${intensity.toFixed(2)} • ${mask}`;
  }
  if (node.kind === 'pulse') {
    const speed = Math.max(0.01, getNum(node.params, 'speed', 1));
    return `spd=${speed.toFixed(2)}`;
  }
  if (node.kind === 'tile') {
    const idx = Math.max(0, Math.round(getNum(node.params, 'tileIndex', 0)));
    const intensity = clamp01(getNum(node.params, 'intensity', 0.85));
    return `D${idx + 1} • I=${intensity.toFixed(2)}`;
  }
  return '';
}

type ModalState =
  | { type: 'create-project' }
  | { type: 'confirm-delete'; gameId: string; gameName: string }
  | { type: 'node-help'; kind: EditorNodeKind }
  | null;

type ViewMode = 'split' | 'tiles-only' | 'ui-only' | 'fullscreen-graph';

type VisualComponent =
  | { id: string; type: 'button'; label: string; x: number; y: number; w: number; h: number; color: string }
  | { id: string; type: 'slider'; label: string; x: number; y: number; w: number; h: number; min: number; max: number; value: number }
  | { id: string; type: 'color-picker'; label: string; x: number; y: number; w: number; h: number; color: string }
  | { id: string; type: 'label'; text: string; x: number; y: number; w: number; h: number; fontSize: number };

type LegacyJsonlNodeSpec = {
  kind: string;
  gameId?: string;
  name?: string;
  params?: Record<string, unknown>;
  pos?: { x: number; y: number };
};

type EditorSnapshot = {
  games: GameDoc[];
  activeGameId: string;
  selectedNodeId: string | null;
};

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest('input, textarea, select, [contenteditable="true"]'));
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  return rgbToHex(lerp(ra.r, rb.r, t), lerp(ra.g, rb.g, t), lerp(ra.b, rb.b, t));
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

function applyRenderNode(tiles: TileState[], node: EditorNode, tSeconds: number) {
  if (node.kind === 'fill') {
    const color = getColor(node.params, 'color', '#6d28ff');
    const intensity = clamp01(getNum(node.params, 'intensity', 0.8));
    const mask = String(node.params.mask ?? 'all');

    for (let i = 0; i < tiles.length; i++) {
      const apply = mask === 'all' || ((mask === 'border' || mask === 'borders') && i !== 4);
      if (!apply) continue;
      tiles[i] = { color, intensity };
    }
  }

  if (node.kind === 'pulse') {
    const legacyColor = getColor(node.params, 'color', '#ff2aa6');
    const baseColor = getColor(node.params, 'baseColor', legacyColor);
    const targetColor = getColor(node.params, 'targetColor', legacyColor);

    const legacyBase = clamp01(getNum(node.params, 'base', 0.15));
    const legacyAmp = clamp01(getNum(node.params, 'amp', 0.75));
    const fromIntensity = clamp01(getNum(node.params, 'fromIntensity', legacyBase));
    const toIntensity = clamp01(getNum(node.params, 'toIntensity', clamp01(legacyBase + legacyAmp)));

    const speed = Math.max(0.01, getNum(node.params, 'speed', 0.9));
    const phase = getNum(node.params, 'phase', 0);
    const t01 = clamp01(0.5 + 0.5 * Math.sin(tSeconds * speed + phase));
    const intensity = clamp01(lerp(fromIntensity, toIntensity, t01));
    const color = lerpColor(baseColor, targetColor, t01);

    for (let i = 0; i < tiles.length; i++) {
      if (intensity <= tiles[i].intensity) continue;
      tiles[i] = { color, intensity };
    }
  }

  if (node.kind === 'tile') {
    const tileIndexRaw = getNum(node.params, 'tileIndex', 0);
    const maxIndex = Math.max(0, tiles.length - 1);
    const tileIndex = Math.max(0, Math.min(maxIndex, Math.round(tileIndexRaw)));
    const color = getColor(node.params, 'color', '#ff2aa6');
    const intensity = clamp01(getNum(node.params, 'intensity', 0.85));
    tiles[tileIndex] = { color, intensity };
  }
}

function computeTiles(game: GameDoc, tSeconds: number): TileState[] {
  const tileCount = Math.max(1, Math.round(Number(game.tileCount ?? 9)));
  const tiles: TileState[] = Array.from({ length: tileCount }, () => ({ color: '#000000', intensity: 0 }));

  // Runtime MVP: exécute une seule chaîne depuis event_begin en suivant les edges.
  // wait(seconds) retarde l'action suivante, fill(seconds) définit la durée d'affichage, puis boucle.
  const byId = new Map(game.nodes.map((n) => [n.id, n] as const));
  const out = new Map<string, string[]>();
  for (const e of game.edges) {
    const arr = out.get(e.from) ?? [];
    arr.push(e.to);
    out.set(e.from, arr);
  }

  const start = game.nodes.find((n) => n.kind === 'event_begin' && n.enabled);
  if (!start) {
    // fallback: comportement historique (appliquer tous les noeuds activés)
    for (const node of game.nodes) {
      if (!node.enabled) continue;
      applyRenderNode(tiles, node, tSeconds);
    }
    return tiles;
  }

  type Segment = { nodeId: string; duration: number };
  const segments: Segment[] = [];
  const visited = new Set<string>();
  let cursor: EditorNode | null = start;
  let steps = 0;

  while (cursor && steps < 100) {
    steps++;
    if (visited.has(cursor.id)) break;
    visited.add(cursor.id);

    if (cursor.enabled) {
      if (cursor.kind === 'wait') {
        const seconds = Math.max(0, getNum(cursor.params, 'seconds', 1));
        segments.push({ nodeId: cursor.id, duration: seconds });
      } else if (cursor.kind === 'fill') {
        const seconds = Math.max(0.01, getNum(cursor.params, 'seconds', 1));
        segments.push({ nodeId: cursor.id, duration: seconds });
      } else if (cursor.kind === 'pulse' || cursor.kind === 'tile') {
        // Durée par défaut courte si dans une séquence.
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

export default function EditeurPage() {
  const [isTeacher, setIsTeacher] = useState<boolean | null>(null);
  const [dbLoading, setDbLoading] = useState<boolean>(false);
  const [dirty, setDirty] = useState<boolean>(false);

  // Nouveaux états pour l'interface améliorée
  const [modal, setModal] = useState<ModalState>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [visualComponents, setVisualComponents] = useState<VisualComponent[]>([]);
  const [selectedVisualComponent, setSelectedVisualComponent] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [newProjectTemplate, setNewProjectTemplate] = useState<'blank' | 'tutorial' | 'animation' | 'interactive'>('blank');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = window.localStorage.getItem('crg_user_type') ?? '';
    setIsTeacher(t === 'enseignant');
  }, []);

  const [status, setStatus] = useState<string>('');
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null);

  const [viewportHeight, setViewportHeight] = useState<number>(300);
  const [resizing, setResizing] = useState<{ active: boolean; y: number; start: number }>(
    { active: false, y: 0, start: 300 },
  );

  const [linkDrag, setLinkDrag] = useState<{ active: boolean; x: number; y: number; gx: number; gy: number } | null>(null);
  const [pendingAutoConnect, setPendingAutoConnect] = useState<{ fromNodeId: string } | null>(null);

  const [graphPan, setGraphPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [graphZoom, setGraphZoom] = useState<number>(1);
  const bpContentRef = useRef<HTMLDivElement | null>(null);
  const [pinPositions, setPinPositions] = useState<
    Record<string, { in?: { x: number; y: number }; out?: { x: number; y: number } }>
  >({});
  const measurePinsRef = useRef<(() => void) | null>(null);

  const [graphPanning, setGraphPanning] = useState<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 0,
    y: 0,
  });
  const [graphDrag, setGraphDrag] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [pendingLink, setPendingLink] = useState<{ fromNodeId: string } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    gx: number;
    gy: number;
    q: string;
  }>({ open: false, x: 0, y: 0, gx: 0, gy: 0, q: '' });

  const [editor, setEditor] = useState<EditorSnapshot>(() => ({ games: [], activeGameId: '', selectedNodeId: null }));
  const [history, setHistory] = useState<{ past: EditorSnapshot[]; future: EditorSnapshot[] }>({ past: [], future: [] });

  const editorRef = useRef<EditorSnapshot>(editor);
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const games = editor.games;
  const activeGameId = editor.activeGameId;
  const selectedNodeId = editor.selectedNodeId;

  const commit = (recipe: (cur: EditorSnapshot) => EditorSnapshot) => {
    setEditor((cur) => {
      const next = recipe(cur);
      setHistory((h) => ({ past: [...h.past, cur], future: [] }));
      setDirty(true);
      return next;
    });
  };

  const updateNodeParamsById = (nodeId: string, patch: Record<string, unknown>) => {
    if (!activeGameId) return;
    commit((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== cur.activeGameId) return g;
        return {
          ...g,
          nodes: g.nodes.map((n) => (n.id === nodeId ? { ...n, params: { ...n.params, ...patch } } : n)),
        };
      });
      return { ...cur, games: nextGames };
    });
  };

  const undo = () => {
    setHistory((h) => {
      const prev = h.past[h.past.length - 1];
      if (!prev) return h;
      const cur = editorRef.current;
      setEditor(prev);
      return { past: h.past.slice(0, -1), future: [cur, ...h.future] };
    });
  };

  const redo = () => {
    setHistory((h) => {
      const next = h.future[0];
      if (!next) return h;
      const cur = editorRef.current;
      setEditor(next);
      return { past: [...h.past, cur], future: h.future.slice(1) };
    });
  };

  const activeGame = useMemo(() => games.find((g) => g.id === activeGameId) || null, [activeGameId, games]);

  const measurePins = () => {
    const root = bpContentRef.current;
    if (!root) return;
    const contentRect = root.getBoundingClientRect();
    const next: Record<string, { in?: { x: number; y: number }; out?: { x: number; y: number } }> = {};

    const nodes = Array.from(root.querySelectorAll('.bp-node[data-nodeid]')) as HTMLElement[];
    for (const nodeEl of nodes) {
      const nodeId = nodeEl.dataset.nodeid;
      if (!nodeId) continue;

      const inEl = nodeEl.querySelector('.bp-pin--in') as HTMLElement | null;
      const outEl = nodeEl.querySelector('.bp-pin--out') as HTMLElement | null;

      const entry: { in?: { x: number; y: number }; out?: { x: number; y: number } } = {};

      if (inEl) {
        const r = inEl.getBoundingClientRect();
        const cx = r.left + 6;
        const cy = r.top + r.height / 2;
        entry.in = {
          x: (cx - contentRect.left) / Math.max(0.0001, graphZoom),
          y: (cy - contentRect.top) / Math.max(0.0001, graphZoom),
        };
      }
      if (outEl) {
        const r = outEl.getBoundingClientRect();
        const cx = r.right - 6;
        const cy = r.top + r.height / 2;
        entry.out = {
          x: (cx - contentRect.left) / Math.max(0.0001, graphZoom),
          y: (cy - contentRect.top) / Math.max(0.0001, graphZoom),
        };
      }

      next[nodeId] = entry;
    }

    setPinPositions(next);
  };

  measurePinsRef.current = measurePins;

  const nodesLayoutKey = useMemo(() => {
    const g = activeGame;
    if (!g) return '';
    return g.nodes.map((n) => `${n.id}:${Math.round(n.pos.x)}:${Math.round(n.pos.y)}`).join('|');
  }, [activeGame]);

  useLayoutEffect(() => {
    let raf = 0;

    raf = requestAnimationFrame(() => measurePinsRef.current?.());
    window.addEventListener('resize', measurePins);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measurePins);
    };
  }, [graphZoom, graphPan.x, graphPan.y, activeGameId, games.length, nodesLayoutKey, activeGame?.edges.length]);

  const selectedNode = useMemo(() => {
    if (!activeGame) return null;
    return activeGame.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [activeGame, selectedNodeId]);


  const addEdge = (from: string, to: string) => {
    if (!activeGameId) return;
    commit((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== cur.activeGameId) return g;
        if (g.edges.some((e) => e.from === from && e.to === to)) return g;
        const id = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
        return { ...g, edges: [...g.edges, { id, from, to }] };
      });
      return { ...cur, games: nextGames };
    });
  };

  const beginDrag = () => {
    if (dragBaseSnapshot) return;
    setDragBaseSnapshot(editorRef.current);
    setDragDidMove(false);
  };

  const endDrag = () => {
    if (!dragBaseSnapshot) return;
    if (dragDidMove) {
      setHistory((h) => ({ past: [...h.past, dragBaseSnapshot], future: [] }));
    }
    setDragBaseSnapshot(null);
    setDragDidMove(false);
  };

  const [t, setT] = useState<number>(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const now = performance.now();
      setT((now - start) / 1000);
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
        setStatus('Redo');
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        setStatus('Undo');
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        setStatus('Redo');
        return;
      }

      if (e.key === 'Escape') {
        setContextMenu((p) => ({ ...p, open: false }));
        setPendingLink(null);
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && editor.selectedNodeId) {
        e.preventDefault();
        const nodeId = editor.selectedNodeId;
        commit((cur) => {
          const nextGames = cur.games.map((g) => {
            if (g.id !== cur.activeGameId) return g;
            return {
              ...g,
              nodes: g.nodes.filter((n) => n.id !== nodeId),
              edges: g.edges.filter((ed) => ed.from !== nodeId && ed.to !== nodeId),
            };
          });
          return { ...cur, games: nextGames, selectedNodeId: null };
        });
        setStatus('Noeud supprimé');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setContextMenu, setPendingLink, commit, editor.selectedNodeId]);

  const editorTiles = useMemo(() => {
    if (!activeGame) return Array.from({ length: 9 }, () => ({ color: '#000000', intensity: 0 }));
    return computeTiles(activeGame, t);
  }, [activeGame, t]);

  const tiles = editorTiles;

  const tileCount = tiles.length;

  useEffect(() => {
    if (typeof selectedTileIndex !== 'number') return;
    if (selectedTileIndex < 0 || selectedTileIndex >= tileCount) {
      setSelectedTileIndex(null);
    }
  }, [selectedTileIndex, tileCount]);

  const serializeGameConfig = (g: GameDoc): unknown => {
    return { version: 1, tileCount: g.tileCount ?? tiles.length, nodes: g.nodes, edges: g.edges };
  };

  const parseGameConfig = (config: unknown): { tileCount?: number; nodes: EditorNode[]; edges: GraphEdge[] } | null => {
    if (!config || typeof config !== 'object') return null;
    const o = config as any;
    const tileCount = typeof o.tileCount === 'number' && Number.isFinite(o.tileCount) ? o.tileCount : undefined;
    const nodes = Array.isArray(o.nodes) ? (o.nodes as EditorNode[]) : null;
    const edges = Array.isArray(o.edges) ? (o.edges as GraphEdge[]) : null;
    if (!nodes || !edges) return null;
    return { tileCount, nodes, edges };
  };

  const createDbGame = async (name: string, initialGame: GameDoc): Promise<string | null> => {
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, kind: 'editor', config: serializeGameConfig(initialGame) }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json.ok !== true) return null;
      return String(json.game?.id ?? '');
    } catch {
      return null;
    }
  };

  const saveDbGame = async (g: GameDoc): Promise<boolean> => {
    try {
      const res = await fetch(`/api/games/${encodeURIComponent(g.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: g.name, kind: 'editor', config: serializeGameConfig(g) }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json.ok !== true) return false;
      return true;
    } catch {
      return false;
    }
  };

  const deleteDbGame = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/games/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json.ok !== true) return false;
      return true;
    } catch {
      return false;
    }
  };

  const createGame = async (forcedName?: string, template: 'blank' | 'tutorial' | 'animation' | 'interactive' = 'blank') => {
    const makeId: IdFactory = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const provisionalId = makeId();
    const nextIndex = (editorRef.current.games.length || 0) + 1;
    const gameName = forcedName && forcedName.trim().length > 0 ? forcedName.trim() : `Jeu${nextIndex}`;
    
    // Créer les nœuds de base selon le template
    let initialNodes: EditorNode[] = [];
    const eventId = makeId();
    
    if (template === 'blank') {
      initialNodes = [
        {
          id: eventId,
          kind: 'event_begin',
          name: 'Démarrer',
          enabled: true,
          params: {},
          pos: { x: 80, y: 80 },
        },
      ];
    } else if (template === 'tutorial') {
      const fillId = makeId();
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 80 } },
        { id: fillId, kind: 'fill', name: 'Remplissage bleu', enabled: true, params: { color: '#00d7ff', intensity: 0.6, mask: 'all', seconds: 2 }, pos: { x: 400, y: 80 } },
      ];
    } else if (template === 'animation') {
      const pulseId = makeId();
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 80 } },
        { id: pulseId, kind: 'pulse', name: 'Pulsation', enabled: true, params: { baseColor: '#ff2aa6', targetColor: '#00d7ff', fromIntensity: 0.1, toIntensity: 0.8, speed: 1.0, phase: 0 }, pos: { x: 400, y: 80 } },
      ];
    } else if (template === 'interactive') {
      const tileId = makeId();
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 80 } },
        { id: tileId, kind: 'tile', name: 'Dalle centrale', enabled: true, params: { tileIndex: 4, color: '#ff2aa6', intensity: 0.9 }, pos: { x: 400, y: 80 } },
      ];
    }
    
    const provisionalGame: GameDoc = {
      id: provisionalId,
      name: gameName,
      tileCount: Math.max(1, tiles.length || 1),
      nodes: initialNodes,
      edges: [],
    };

    const dbId = await createDbGame(gameName, provisionalGame);
    if (!dbId) {
      setStatus('Création DB impossible');
      return;
    }

    const newGame: GameDoc = { ...provisionalGame, id: dbId };
    commit((cur) => ({
      ...cur,
      games: [...cur.games, newGame],
      activeGameId: dbId,
      selectedNodeId: initialNodes[0]?.id ?? null,
    }));
    setDirty(false);
    setStatus(`Jeu créé: ${gameName}`);
    setModal(null);
    setNewProjectName('');
  };

  useEffect(() => {
    if (isTeacher !== true) return;
    let cancelled = false;
    const load = async () => {
      setDbLoading(true);
      try {
        const res = await fetch('/api/games', { cache: 'no-store' });
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok || !json || json.ok !== true || !Array.isArray(json.games)) {
          return;
        }

        const rows = json.games as Array<{ id: string; name: string; kind: string; config: unknown }>;
        const editorRows = rows.filter((r) => String(r.kind) === 'editor');

        const loaded: GameDoc[] = editorRows
          .map((r) => {
            const cfg = parseGameConfig(r.config);
            if (!cfg) return null;
            return {
              id: String(r.id),
              name: String(r.name),
              tileCount: cfg.tileCount,
              nodes: cfg.nodes,
              edges: cfg.edges,
            } satisfies GameDoc;
          })
          .filter(Boolean) as GameDoc[];

        if (cancelled) return;

        if (loaded.length > 0) {
          setEditor({
            games: loaded,
            activeGameId: loaded[0].id,
            selectedNodeId: loaded[0].nodes[0]?.id ?? null,
          });
          editorRef.current = {
            games: loaded,
            activeGameId: loaded[0].id,
            selectedNodeId: loaded[0].nodes[0]?.id ?? null,
          };
          setHistory({ past: [], future: [] });
          setDirty(false);
          setStatus('Jeux chargés');
          return;
        }

        await createGame('Jeu1');
      } finally {
        if (!cancelled) setDbLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isTeacher]);

  const saveActiveGame = async () => {
    if (!activeGame) return;
    const ok = await saveDbGame(activeGame);
    if (!ok) {
      setStatus('Sauvegarde impossible');
      return;
    }
    setDirty(false);
    setStatus('Sauvegardé');
  };

  const deleteActiveGame = async () => {
    if (!activeGame) return;
    const ok = await deleteDbGame(activeGame.id);
    if (!ok) {
      setStatus('Suppression impossible');
      return;
    }

    commit((cur) => {
      const nextGames = cur.games.filter((g) => g.id !== activeGame.id);
      const nextActive = nextGames[0];
      return {
        ...cur,
        games: nextGames,
        activeGameId: nextActive?.id ?? null,
        selectedNodeId: nextActive?.nodes[0]?.id ?? null,
      };
    });
    setDirty(false);
    setStatus('Jeu supprimé');
  };

  const addNode = (kind: EditorNodeKind, pos?: { x: number; y: number }): string | null => {
    if (!activeGameId) {
      setStatus("Crée un jeu avant d'ajouter des noeuds");
      return null;
    }
    const nextId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    commit((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== cur.activeGameId) return g;
        const basePos = pos ?? { x: 80 + g.nodes.length * 28, y: 80 + g.nodes.length * 22 };
        const spec = NODE_CATALOG.find((x) => x.kind === kind);
        const title = spec?.title ?? kind;
        const params = spec?.defaults ?? {};
        const base: Omit<EditorNode, 'pos'> = { id: nextId, kind, name: `${title} ${g.nodes.length + 1}`, enabled: true, params };
        const nodeWithPos: EditorNode = { ...base, pos: basePos };
        return { ...g, nodes: [...g.nodes, nodeWithPos] };
      });
      return { ...cur, games: nextGames, selectedNodeId: nextId };
    });
    setStatus('Noeud ajouté');
    return nextId;
  };

  const addNodeForGame = (
    gameId: string,
    kind: EditorNodeKind,
    pos?: { x: number; y: number },
    overrides?: { name?: string; params?: Record<string, unknown> },
  ): string => {
    const nextId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    commit((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== gameId) return g;
        const basePos = pos ?? { x: 80 + g.nodes.length * 28, y: 80 + g.nodes.length * 22 };
        const spec = NODE_CATALOG.find((x) => x.kind === kind);
        const title = spec?.title ?? kind;
        const params = { ...(spec?.defaults ?? {}), ...(overrides?.params ?? {}) };
        const name = overrides?.name && overrides.name.trim().length > 0 ? overrides.name.trim() : `${title} ${g.nodes.length + 1}`;
        const base: Omit<EditorNode, 'pos'> = { id: nextId, kind, name, enabled: true, params };
        const nodeWithPos: EditorNode = { ...base, pos: basePos };
        return { ...g, nodes: [...g.nodes, nodeWithPos] };
      });
      return { ...cur, games: nextGames, activeGameId: gameId, selectedNodeId: nextId };
    });
    return nextId;
  };

  const renameActiveGame = (name: string) => {
    if (!activeGameId) return;
    commit((cur) => ({
      ...cur,
      games: cur.games.map((g) => (g.id === cur.activeGameId ? { ...g, name } : g)),
    }));
  };

  const [dragBaseSnapshot, setDragBaseSnapshot] = useState<EditorSnapshot | null>(null);
  const [dragDidMove, setDragDidMove] = useState<boolean>(false);

  const moveNode = (nodeId: string, dx: number, dy: number) => {
    setEditor((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== cur.activeGameId) return g;
        return {
          ...g,
          nodes: g.nodes.map((n) => (n.id === nodeId ? { ...n, pos: { x: n.pos.x + dx, y: n.pos.y + dy } } : n)),
        };
      });
      return { ...cur, games: nextGames };
    });
  };

  const assignSelectedTileToNode = (tileIndex: number) => {
    const safe = Math.max(0, Math.min(tileCount - 1, Math.round(tileIndex)));
    setSelectedTileIndex(safe);

    if (!selectedNodeId) return;
    if (!selectedNode) return;
    if (selectedNode.kind !== 'tile') return;
    updateSelectedParams({ tileIndex: safe });
    setStatus(`Dalle D${safe + 1} assignée`);
  };

  const updateSelectedNode = (patch: Partial<EditorNode>) => {
    if (!selectedNodeId) return;
    commit((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== cur.activeGameId) return g;
        return {
          ...g,
          nodes: g.nodes.map((n) => (n.id === cur.selectedNodeId ? { ...n, ...patch } : n)),
        };
      });
      return { ...cur, games: nextGames };
    });
  };

  const updateSelectedParams = (patch: Record<string, unknown>) => {
    if (!selectedNodeId) return;
    commit((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== cur.activeGameId) return g;
        return {
          ...g,
          nodes: g.nodes.map((n) => (n.id === cur.selectedNodeId ? { ...n, params: { ...n.params, ...patch } } : n)),
        };
      });
      return { ...cur, games: nextGames };
    });
  };

  if (isTeacher === null) {
    return (
      <main className="stage">
        <div className="ue">
          <aside className="ue__left glass">
            <div className="panelhead">
              <strong>Chargement</strong>
              <span className="panelhead__meta">Vérification…</span>
            </div>
          </aside>
        </div>
      </main>
    );
  }

  if (isTeacher === false) {
    return (
      <main className="stage" style={{ display: 'grid', placeItems: 'center' }}>
        <div
          className="glass"
          style={{
            width: 'min(720px, calc(100vw - 28px))',
            padding: 22,
            borderRadius: 22,
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 14, opacity: 0.8 }}>Enseignant requis</div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}>Accès refusé</div>
            <div style={{ fontSize: 13, opacity: 0.82, lineHeight: 1.6, marginTop: 4 }}>
              Cette page est réservée aux enseignants.
              <br />
              Connecte-toi en tant qu'enseignant depuis <a href="/jeux">/jeux</a>.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
            <a className="btn btn--hero" href="/jeux" style={{ textDecoration: 'none' }}>
              Aller à /jeux
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="stage">
      <div className="ue">
        <aside className="ue__left glass">
            <div className="panelhead">
              <strong>Explorateur</strong>
              <span className="panelhead__meta">Jeux</span>
            </div>

            <div className="panelbody">
              <div className="panelsection">
                <div className="panelsection__head">
                  <div className="panelsection__title" title="Jeux" aria-label="Jeux">
                    <Gamepad2 size={16} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button 
                      className="btn btn--mini" 
                      disabled={!activeGame || dbLoading} 
                      onClick={() => void saveActiveGame()}
                      title="Sauvegarder"
                    >
                      <Save size={16} />
                      <span>{dirty ? 'Sauvegarder' : 'Sauvegardé'}</span>
                    </button>
                    <button 
                      className="btn btn--mini" 
                      disabled={!activeGame || dbLoading} 
                      onClick={() => activeGame && setModal({ type: 'confirm-delete', gameId: activeGame.id, gameName: activeGame.name })}
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button 
                      className="btn btn--mini btn--primary" 
                      disabled={dbLoading} 
                      onClick={() => setModal({ type: 'create-project' })}
                    >
                      <FolderPlus className="btn__icon" aria-hidden size={16} />
                      <span>{dbLoading ? '...' : 'Nouveau'}</span>
                    </button>
                  </div>
                </div>

                <div className="list panelsection__list">
                  {games.map((g) => (
                    <button
                      key={g.id}
                      className={g.id === activeGameId ? 'list__item list__item--active' : 'list__item'}
                      onClick={() => {
                        commit((cur) => ({ ...cur, activeGameId: g.id, selectedNodeId: g.nodes[0]?.id ?? null }));
                        setStatus('Jeu sélectionné');
                      }}
                    >
                      <span className="list__title">{g.name}</span>
                      <span className="list__meta">{g.nodes.length} noeuds</span>
                    </button>
                  ))}
                </div>

                {activeGame ? (
                  <div className="game-info-card" style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(67, 97, 238, 0.06)', border: '1px solid rgba(67, 97, 238, 0.15)' }}>
                    <label className="field" style={{ margin: 0 }}>
                      <span style={{ fontSize: 12, opacity: 0.8, marginBottom: 6, display: 'block' }}>Nom du projet</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          className="input"
                          value={activeGame.name}
                          onChange={(e) => renameActiveGame(e.target.value)}
                          onBlur={() => void saveActiveGame()}
                          style={{ flex: 1 }}
                        />
                        <button 
                          className="btn btn--mini"
                          onClick={() => void saveActiveGame()}
                          title="Sauvegarder"
                        >
                          <Save size={16} />
                        </button>
                      </div>
                    </label>
                    <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                      <span>{activeGame.nodes.length} nœuds</span>
                      <span>{activeGame.edges.length} connexions</span>
                      <span>{tileCount} dalles</span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="divider" />

              <div className="panelsection">
                <div className="panelsection__head">
                  <div className="panelsection__title" title="Noeuds" aria-label="Noeuds">
                    <Boxes size={16} />
                  </div>
                  <button
                    className="btn btn--mini"
                    disabled={!activeGameId}
                    onClick={() => {
                      const id = addNode('fill');
                      if (id) setStatus('Noeud ajouté');
                    }}
                  >
                    <Plus className="btn__icon" aria-hidden />
                    <span>Ajouter</span>
                  </button>
                </div>

                <div className="list panelsection__list">
                  {!activeGame ? (
                    <div className="muted">Crée un jeu pour commencer.</div>
                  ) : activeGame.nodes.length === 0 ? (
                    <div className="muted">Aucun noeud. Ajoute un bloc (clic droit) ou double clic pour "Remplissage".</div>
                  ) : (
                    activeGame.nodes.map((n) => (
                      <button
                        key={n.id}
                        className={n.id === selectedNodeId ? 'list__item list__item--active' : 'list__item'}
                        onClick={() => commit((cur) => ({ ...cur, selectedNodeId: n.id }))}
                      >
                        <span className="list__title">{n.name}</span>
                        <span className="list__meta">{labelNodeKind(n.kind)}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="divider" />
          </aside>

          <section
            className="ue__center"
            style={{ gridTemplateRows: `${viewportHeight}px 10px 1fr` }}
            onPointerMove={(e) => {
              if (!resizing.active) return;
              const dy = e.clientY - resizing.y;
              const next = Math.max(260, Math.min(760, resizing.start + dy));
              setViewportHeight(next);
            }}
            onPointerUp={() => {
              setResizing({ active: false, y: 0, start: viewportHeight });
            }}
          >
            <div className="ue__viewport glass">
              <div className="panelhead">
                <strong>Aperçu</strong>
                <span className="panelhead__meta">Simulation {tileCount} dalles</span>
              </div>
              <div className="viewport">
                {activeGame ? (
                  <div className="viewport__split">
                    <div className="viewport__pane viewport__pane--tiles">
                      <EditorTilesViewport
                        tiles={tiles}
                        selectedTileIndex={selectedTileIndex}
                        onTileClick={assignSelectedTileToNode}
                      />
                    </div>
                    <div className="viewport__pane viewport__pane--ui">
                      <div className="viewport-ui">
                        <div className="viewport-ui__card glass">
                          <div className="viewport-ui__title">Visuel du jeu</div>
                          <div className="viewport-ui__hint">
                            Prévisualisation de l’interface 2D et des éléments interactifs.
                            <br />
                            (Le rendu complet arrive juste après la refonte du runtime.)
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bp-empty" style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                    <div style={{ display: 'grid', gap: 16, textAlign: 'center', maxWidth: 320 }}>
                      <div style={{ fontSize: 48, opacity: 0.3 }}>💡</div>
                      <div>
                        <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>Aucun projet</h3>
                        <p style={{ margin: 0, fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>
                          Créez votre premier jeu lumineux pour commencer à explorer l'éditeur visuel.
                        </p>
                      </div>
                      <button 
                        className="btn btn--hero" 
                        onClick={() => setModal({ type: 'create-project' })}
                        style={{ marginTop: 8 }}
                      >
                        <FolderPlus className="btn__icon" aria-hidden size={20} />
                        <span>Créer un projet</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div
              className="ue__splitter"
              onPointerDown={(e) => {
                e.preventDefault();
                setResizing({ active: true, y: e.clientY, start: viewportHeight });
                (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              }}
            />

            <div className="ue__graph glass">
              <div className="panelhead">
                <strong>Graphe</strong>
                <span className="panelhead__meta">MVP</span>
              </div>
              <div className="panelbody">
                <div
                  className="bp"
                  onDoubleClick={(e) => {
                    if ((e.target as HTMLElement).closest('.bp-node')) return;
                    if ((e.target as HTMLElement).closest('.bp-menu')) return;
                    if (!activeGameId) return;
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const gx = (x - graphPan.x) / Math.max(0.0001, graphZoom);
                    const gy = (y - graphPan.y) / Math.max(0.0001, graphZoom);
                    addNode('fill', { x: gx, y: gy });
                    setStatus('Noeud couleur ajouté');
                  }}
                  onContextMenu={(e) => {
                    if (!activeGameId) return;
                    e.preventDefault();
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const gx = (x - graphPan.x) / Math.max(0.0001, graphZoom);
                    const gy = (y - graphPan.y) / Math.max(0.0001, graphZoom);
                    setContextMenu({ open: true, x, y, gx, gy, q: '' });
                    setPendingLink(null);
                    setStatus('Ajouter un noeud');
                  }}
                  onPointerDown={(e) => {
                    if ((e.target as HTMLElement).closest('.bp-node')) return;
                    if ((e.target as HTMLElement).closest('.bp-menu')) return;
                    setPendingLink(null);
                    setContextMenu((p) => ({ ...p, open: false }));
                    setGraphPanning({ active: true, x: e.clientX, y: e.clientY });
                  }}
                  onPointerMove={(e) => {
                    if (linkDrag?.active) {
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const y = e.clientY - rect.top;

                      const contentRect = bpContentRef.current?.getBoundingClientRect();
                      const gx = contentRect
                        ? (e.clientX - contentRect.left) / Math.max(0.0001, graphZoom)
                        : (x - graphPan.x) / Math.max(0.0001, graphZoom);
                      const gy = contentRect
                        ? (e.clientY - contentRect.top) / Math.max(0.0001, graphZoom)
                        : (y - graphPan.y) / Math.max(0.0001, graphZoom);
                      setLinkDrag({ active: true, x, y, gx, gy });
                    }
                    if (graphDrag) {
                      setDragDidMove(true);
                      const dx = (e.clientX - graphDrag.x) / graphZoom;
                      const dy = (e.clientY - graphDrag.y) / graphZoom;
                      setGraphDrag({ nodeId: graphDrag.nodeId, x: e.clientX, y: e.clientY });
                      moveNode(graphDrag.nodeId, dx, dy);
                      requestAnimationFrame(() => requestAnimationFrame(() => measurePinsRef.current?.()));
                      return;
                    }
                    if (!graphPanning.active) return;
                    const dx = e.clientX - graphPanning.x;
                    const dy = e.clientY - graphPanning.y;
                    setGraphPanning({ active: true, x: e.clientX, y: e.clientY });
                    setGraphPan((p) => ({ x: p.x + dx, y: p.y + dy }));
                  }}
                  onPointerUp={(e) => {
                    setGraphPanning({ active: false, x: 0, y: 0 });
                    setGraphDrag(null);
                    endDrag();

                    if (linkDrag?.active && pendingLink?.fromNodeId) {
                      if (!activeGameId) {
                        setLinkDrag(null);
                        return;
                      }

                      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
                      if (el?.closest('.bp-pin--in')) {
                        setLinkDrag(null);
                        return;
                      }

                      const x = linkDrag.x;
                      const y = linkDrag.y;
                      const gx = linkDrag.gx;
                      const gy = linkDrag.gy;
                      setPendingAutoConnect({ fromNodeId: pendingLink.fromNodeId });
                      setContextMenu({ open: true, x, y, gx, gy, q: '' });
                      setStatus('Ajouter un noeud');
                    }

                    setLinkDrag(null);
                  }}
                  onWheel={(e) => {
                    if ((e.target as HTMLElement).closest('.bp-menu')) return;
                    const next = Math.max(0.6, Math.min(1.6, graphZoom + (e.deltaY > 0 ? -0.06 : 0.06)));
                    setGraphZoom(next);
                  }}
                >
                  <div
                    className="bp__content"
                    style={{ transform: `translate(${graphPan.x}px, ${graphPan.y}px) scale(${graphZoom})` }}
                    ref={bpContentRef}
                  >
                    {games.length === 0 ? (
                      <div className="bp-empty">
                        <div style={{ textAlign: 'center', padding: 40 }}>
                          <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 16 }}>🎮</div>
                          <p style={{ margin: '0 0 20px', fontSize: 14, opacity: 0.7 }}>Commencez par créer votre premier jeu</p>
                          <button 
                            className="btn btn--hero" 
                            onClick={() => setModal({ type: 'create-project' })}
                          >
                            <FolderPlus className="btn__icon" aria-hidden size={18} />
                            <span>Créer un projet</span>
                          </button>
                        </div>
                        <div className="bp-empty__hint">Clic droit pour ajouter des noeuds • Double clic = Remplissage</div>
                      </div>
                    ) : null}

                    {contextMenu.open ? (
                      <div className="bp-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
                        <div className="bp-menu__search">
                          <input
                            className="bp-menu__input"
                            placeholder="Rechercher un noeud…"
                            value={contextMenu.q}
                            autoFocus
                            onChange={(e) => setContextMenu((p) => ({ ...p, q: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setContextMenu((p) => ({ ...p, open: false }));
                            }}
                          />
                        </div>

                        <div className="bp-menu__list">
                          {NODE_CATALOG.filter((n) => {
                            const q = contextMenu.q.trim().toLowerCase();
                            if (!q) return true;
                            return `${n.category} ${n.title} ${n.kind} ${labelNodeKind(n.kind)}`.toLowerCase().includes(q);
                          }).map((n) => (
                            <button
                              key={n.kind}
                              className="bp-menu__item"
                              onClick={() => {
                                const createdId = addNode(n.kind, { x: contextMenu.gx, y: contextMenu.gy });
                                if (createdId && pendingAutoConnect?.fromNodeId) {
                                  addEdge(pendingAutoConnect.fromNodeId, createdId);
                                  setPendingLink(null);
                                  setPendingAutoConnect(null);
                                }
                                setContextMenu((p) => ({ ...p, open: false }));
                                setStatus('Noeud ajouté');
                              }}
                            >
                              <span className="bp-menu__cat">{n.category}</span>
                              <span className="bp-menu__title">{n.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <svg className="bp__wires" width="2000" height="2000" viewBox="0 0 2000 2000" preserveAspectRatio="none">
                      <defs>
                        <marker
                          id="bp-arrow"
                          viewBox="0 0 6 6"
                          refX="5.2"
                          refY="3"
                          markerWidth="6"
                          markerHeight="6"
                          orient="auto"
                          markerUnits="strokeWidth"
                        >
                          <path d="M 0 0 L 6 3 L 0 6 z" fill="var(--c-action)" opacity="0.78" />
                        </marker>
                      </defs>
                      {(activeGame?.edges ?? []).map((e) => {
                        const from = (activeGame?.nodes ?? []).find((n) => n.id === e.from);
                        const to = (activeGame?.nodes ?? []).find((n) => n.id === e.to);
                        if (!from || !to) return null;

                        const p1 = pinPositions[e.from]?.out;
                        const p2 = pinPositions[e.to]?.in;
                        const NODE_W = 280;
                        const PIN_Y = 104;
                        const x1 = p1 ? p1.x : from.pos.x + NODE_W;
                        const y1 = p1 ? p1.y : from.pos.y + PIN_Y;
                        const x2 = p2 ? p2.x : to.pos.x;
                        const y2 = p2 ? p2.y : to.pos.y + PIN_Y;
                        const dx = Math.max(60, Math.min(220, (x2 - x1) * 0.5));
                        const c1x = x1 + dx;
                        const c1y = y1;
                        const c2x = x2 - dx;
                        const c2y = y2;
                        const d = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;

                        const active = pendingLink?.fromNodeId && (pendingLink.fromNodeId === e.from || pendingLink.fromNodeId === e.to);
                        return (
                          <path
                            key={e.id}
                            d={d}
                            markerEnd="url(#bp-arrow)"
                            className={active ? 'bp-wire bp-wire--active' : 'bp-wire'}
                          />
                        );
                      })}

                      {pendingLink?.fromNodeId && linkDrag?.active && activeGame ? (() => {
                        const from = activeGame.nodes.find((n) => n.id === pendingLink.fromNodeId);
                        if (!from) return null;

                        const p1 = pinPositions[pendingLink.fromNodeId]?.out;
                        const NODE_W = 280;
                        const PIN_Y = 104;
                        const x1 = p1 ? p1.x : from.pos.x + NODE_W;
                        const y1 = p1 ? p1.y : from.pos.y + PIN_Y;
                        const x2 = linkDrag.gx;
                        const y2 = linkDrag.gy;
                        const dx = Math.max(60, Math.min(220, (x2 - x1) * 0.5));
                        const c1x = x1 + dx;
                        const c1y = y1;
                        const c2x = x2 - dx;
                        const c2y = y2;
                        const d = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
                        return <path key="__preview" d={d} markerEnd="url(#bp-arrow)" className="bp-wire bp-wire--preview" />;
                      })() : null}
                    </svg>

                    {(activeGame?.nodes ?? []).map((n) => {
                      const selected = n.id === selectedNodeId;
                      const hasInput = n.kind !== 'event_begin';
                      const inLabel = n.kind === 'fill' ? 'Entrée' : n.kind === 'pulse' ? 'Temps' : 'Entrée';
                      const outLabel = n.kind === 'event_begin' ? 'Commencer' : 'Sortie';
                      const linkingFromThis = pendingLink?.fromNodeId === n.id;
                      const seconds = Math.max(0, getNum(n.params, 'seconds', 1));
                      const fillIntensity = clamp01(getNum(n.params, 'intensity', 0.8));
                      const fillMaskRaw = String(n.params.mask ?? 'all');
                      const fillMask = fillMaskRaw === 'border' ? 'borders' : fillMaskRaw;
                      const fillColor = getColor(n.params, 'color', '#6d28ff');
                      const pulseSpeed = Math.max(0.01, getNum(n.params, 'speed', 1));
                      const tileIndex = Math.max(0, Math.min(8, Math.round(getNum(n.params, 'tileIndex', 0))));
                      const tileColor = getColor(n.params, 'color', '#ff2aa6');
                      const tileIntensity = clamp01(getNum(n.params, 'intensity', 0.85));
                      const pulseLegacyColor = getColor(n.params, 'color', '#ff2aa6');
                      const pulseBaseColor = getColor(n.params, 'baseColor', pulseLegacyColor);
                      const pulseTargetColor = getColor(n.params, 'targetColor', pulseLegacyColor);
                      const pulseLegacyBase = clamp01(getNum(n.params, 'base', 0.1));
                      const pulseLegacyAmp = clamp01(getNum(n.params, 'amp', 0.7));
                      const pulseFrom = clamp01(getNum(n.params, 'fromIntensity', pulseLegacyBase));
                      const pulseTo = clamp01(getNum(n.params, 'toIntensity', clamp01(pulseLegacyBase + pulseLegacyAmp)));
                      return (
                        <div
                          key={n.id}
                          className={selected ? 'bp-node bp-node--active' : 'bp-node'}
                          style={{ left: n.pos.x, top: n.pos.y }}
                          data-nodeid={n.id}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setContextMenu((p) => ({ ...p, open: false }));
                            commit((cur) => ({ ...cur, selectedNodeId: n.id }));
                            beginDrag();
                            setGraphDrag({ nodeId: n.id, x: e.clientX, y: e.clientY });
                          }}
                        >
                          <div className="bp-node__title">
                            <span className="bp-node__name">{n.name}</span>
                            <span className="bp-node__kind">{labelNodeKind(n.kind)}</span>
                          </div>

                          {n.kind === 'wait' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__var">
                                <span className="bp-node__varlabel">Durée</span>
                                <div className="bp-node__varctrl">
                                  <input
                                    className="bp-node__varinput"
                                    type="number"
                                    step={0.1}
                                    value={seconds}
                                    onChange={(e) => updateNodeParamsById(n.id, { seconds: Number(e.target.value) })}
                                  />
                                  <span className="bp-node__varunit">s</span>
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'fill' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Durée</span>
                                  <div className="bp-node__varctrl">
                                    <input
                                      className="bp-node__varinput"
                                      type="number"
                                      step={0.1}
                                      value={seconds}
                                      onChange={(e) => updateNodeParamsById(n.id, { seconds: Number(e.target.value) })}
                                    />
                                    <span className="bp-node__varunit">s</span>
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Int.</span>
                                  <div className="bp-node__varctrl">
                                    <input
                                      className="bp-node__varrange"
                                      type="range"
                                      min={0}
                                      max={1}
                                      step={0.01}
                                      value={fillIntensity}
                                      style={{
                                        ['--min' as any]: 0,
                                        ['--max' as any]: 1,
                                        ['--value' as any]: fillIntensity,
                                      }}
                                      onChange={(e) => updateNodeParamsById(n.id, { intensity: Number(e.target.value) })}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="bp-node__color">
                                <div className="bp-node__colorpreview" style={{ background: fillColor }} />
                                <input
                                  className="bp-node__colorinput"
                                  type="color"
                                  value={fillColor}
                                  onChange={(e) => updateNodeParamsById(n.id, { color: e.target.value })}
                                />
                              </div>

                              <div className="bp-node__var">
                                <span className="bp-node__varlabel">Masque</span>
                                <div className="bp-node__varctrl">
                                  <div className="bp-node__seg" role="group" aria-label="Masque">
                                    <button
                                      type="button"
                                      className={fillMask === 'all' ? 'bp-node__segbtn bp-node__segbtn--active' : 'bp-node__segbtn'}
                                      onClick={() => updateNodeParamsById(n.id, { mask: 'all' })}
                                    >
                                      Tous
                                    </button>
                                    <button
                                      type="button"
                                      className={fillMask === 'borders' ? 'bp-node__segbtn bp-node__segbtn--active' : 'bp-node__segbtn'}
                                      onClick={() => updateNodeParamsById(n.id, { mask: 'borders' })}
                                    >
                                      Bordures
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'pulse' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Base</span>
                                  <div className="bp-node__varctrl">
                                    <input
                                      className="bp-node__colorinput"
                                      type="color"
                                      value={pulseBaseColor}
                                      onChange={(e) => updateNodeParamsById(n.id, { baseColor: e.target.value })}
                                    />
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Cible</span>
                                  <div className="bp-node__varctrl">
                                    <input
                                      className="bp-node__colorinput"
                                      type="color"
                                      value={pulseTargetColor}
                                      onChange={(e) => updateNodeParamsById(n.id, { targetColor: e.target.value })}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">I0</span>
                                  <div className="bp-node__varctrl">
                                    <input
                                      className="bp-node__varrange"
                                      type="range"
                                      min={0}
                                      max={1}
                                      step={0.01}
                                      value={pulseFrom}
                                      style={{
                                        ['--min' as any]: 0,
                                        ['--max' as any]: 1,
                                        ['--value' as any]: pulseFrom,
                                      }}
                                      onChange={(e) => updateNodeParamsById(n.id, { fromIntensity: Number(e.target.value) })}
                                    />
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">I1</span>
                                  <div className="bp-node__varctrl">
                                    <input
                                      className="bp-node__varrange"
                                      type="range"
                                      min={0}
                                      max={1}
                                      step={0.01}
                                      value={pulseTo}
                                      style={{
                                        ['--min' as any]: 0,
                                        ['--max' as any]: 1,
                                        ['--value' as any]: pulseTo,
                                      }}
                                      onChange={(e) => updateNodeParamsById(n.id, { toIntensity: Number(e.target.value) })}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="bp-node__var">
                                <span className="bp-node__varlabel">Vitesse</span>
                                <div className="bp-node__varctrl">
                                  <input
                                    className="bp-node__varrange"
                                    type="range"
                                    min={0.05}
                                    max={4}
                                    step={0.05}
                                    value={pulseSpeed}
                                    style={{
                                      ['--min' as any]: 0.05,
                                      ['--max' as any]: 4,
                                      ['--value' as any]: pulseSpeed,
                                    }}
                                    onChange={(e) => updateNodeParamsById(n.id, { speed: Number(e.target.value) })}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'tile' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Dalle</span>
                                  <div className="bp-node__varctrl">
                                    <select
                                      className="bp-node__varselect"
                                      value={String(tileIndex)}
                                      onChange={(e) => updateNodeParamsById(n.id, { tileIndex: Number(e.target.value) })}
                                    >
                                      {Array.from({ length: 9 }, (_, i) => (
                                        <option key={i} value={i}>
                                          D{i + 1}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Int.</span>
                                  <div className="bp-node__varctrl">
                                    <input
                                      className="bp-node__varrange"
                                      type="range"
                                      min={0}
                                      max={1}
                                      step={0.01}
                                      value={tileIntensity}
                                      style={{
                                        ['--min' as any]: 0,
                                        ['--max' as any]: 1,
                                        ['--value' as any]: tileIntensity,
                                      }}
                                      onChange={(e) => updateNodeParamsById(n.id, { intensity: Number(e.target.value) })}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="bp-node__color">
                                <div className="bp-node__colorpreview" style={{ background: tileColor }} />
                                <input
                                  className="bp-node__colorinput"
                                  type="color"
                                  value={tileColor}
                                  onChange={(e) => updateNodeParamsById(n.id, { color: e.target.value })}
                                />
                              </div>
                            </div>
                          ) : null}

                          <div className="bp-node__io">
                            {hasInput ? (
                              <div
                                className="bp-pin bp-pin--in"
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                }}
                                onPointerUp={(e) => {
                                  e.stopPropagation();
                                  if (!pendingLink?.fromNodeId) return;
                                  if (pendingLink.fromNodeId === n.id) {
                                    setPendingLink(null);
                                    setPendingAutoConnect(null);
                                    setLinkDrag(null);
                                    return;
                                  }
                                  addEdge(pendingLink.fromNodeId, n.id);
                                  setPendingLink(null);
                                  setPendingAutoConnect(null);
                                  setLinkDrag(null);
                                  setStatus('Connexion créée');
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!pendingLink) return;
                                  if (pendingLink.fromNodeId === n.id) {
                                    setPendingLink(null);
                                    return;
                                  }
                                  addEdge(pendingLink.fromNodeId, n.id);
                                  setPendingLink(null);
                                  setPendingAutoConnect(null);
                                  setStatus('Connexion créée');
                                }}
                              >
                                <span className={pendingLink ? 'bp-dot bp-dot--hot' : 'bp-dot'} />
                                <span className="bp-pin__label">{inLabel}</span>
                              </div>
                            ) : (
                              <div className="bp-pin bp-pin--in" style={{ opacity: 0.35 }}>
                                <span className="bp-dot" />
                                <span className="bp-pin__label">—</span>
                              </div>
                            )}
                            <div
                              className="bp-pin bp-pin--out"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                setPendingLink({ fromNodeId: n.id });
                                setPendingAutoConnect(null);
                                setStatus('Choisis une entrée');
                                const rect = (e.currentTarget as HTMLDivElement).closest('.bp')?.getBoundingClientRect();
                                const x = rect ? e.clientX - rect.left : 0;
                                const y = rect ? e.clientY - rect.top : 0;
                                const contentRect = bpContentRef.current?.getBoundingClientRect();
                                const gx = contentRect
                                  ? (e.clientX - contentRect.left) / Math.max(0.0001, graphZoom)
                                  : (x - graphPan.x) / Math.max(0.0001, graphZoom);
                                const gy = contentRect
                                  ? (e.clientY - contentRect.top) / Math.max(0.0001, graphZoom)
                                  : (y - graphPan.y) / Math.max(0.0001, graphZoom);
                                setLinkDrag({ active: true, x, y, gx, gy });
                                (e.currentTarget as HTMLDivElement).closest('.bp')?.setPointerCapture(e.pointerId);
                              }}
                              onPointerMove={(e) => {
                                e.stopPropagation();
                                if (!linkDrag?.active) return;
                                const rect = (e.currentTarget as HTMLDivElement).closest('.bp')?.getBoundingClientRect();
                                const x = rect ? e.clientX - rect.left : 0;
                                const y = rect ? e.clientY - rect.top : 0;
                                const contentRect = bpContentRef.current?.getBoundingClientRect();
                                const gx = contentRect
                                  ? (e.clientX - contentRect.left) / Math.max(0.0001, graphZoom)
                                  : (x - graphPan.x) / Math.max(0.0001, graphZoom);
                                const gy = contentRect
                                  ? (e.clientY - contentRect.top) / Math.max(0.0001, graphZoom)
                                  : (y - graphPan.y) / Math.max(0.0001, graphZoom);
                                setLinkDrag({ active: true, x, y, gx, gy });
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (linkingFromThis) {
                                  setPendingLink(null);
                                  setPendingAutoConnect(null);
                                  setStatus('Liaison annulée');
                                  return;
                                }
                                setPendingLink({ fromNodeId: n.id });
                                setPendingAutoConnect(null);
                                setStatus('Choisis une entrée');
                              }}
                            >
                              <span className="bp-pin__label">{outLabel}</span>
                              <span className={linkingFromThis ? 'bp-dot bp-dot--active' : 'bp-dot'} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="ue__right glass">
            <div className="panelhead">
              <strong>Détails</strong>
              <span className="panelhead__meta">{selectedNode ? selectedNode.id : '—'}</span>
            </div>

            <div className="panelbody">
              {!selectedNode ? (
                <div className="muted">Sélectionne un noeud.</div>
              ) : (
                <div className="form">
                  <label className="field">
                    <span>Nom</span>
                    <input
                      value={selectedNode.name}
                      onChange={(e) => updateSelectedNode({ name: e.target.value })}
                      className="input"
                    />
                  </label>

                  <label className="field field--row">
                    <span>Actif</span>
                    <input
                      type="checkbox"
                      checked={selectedNode.enabled}
                      onChange={(e) => updateSelectedNode({ enabled: e.target.checked })}
                    />
                  </label>

                  <div className="divider" />

                  {selectedNode.kind === 'fill' ? (
                    <>
                      <label className="field">
                        <span>Couleur</span>
                        <input
                          type="color"
                          value={getColor(selectedNode.params, 'color', '#6d28ff')}
                          onChange={(e) => updateSelectedParams({ color: e.target.value })}
                          className="input"
                        />
                      </label>

                      {/* RGB Sliders */}
                      <div className="rgb-sliders">
                        {(() => {
                          const color = getColor(selectedNode.params, 'color', '#6d28ff');
                          const rgb = hexToRgb(color);
                          const updateColor = (r: number, g: number, b: number) => {
                            updateSelectedParams({ color: rgbToHex(r, g, b) });
                          };
                          return (
                            <>
                              <div className="slider-row">
                                <span className="slider-label slider-label--red">Rouge</span>
                                <input
                                  type="range"
                                  className="slider-red"
                                  min={0}
                                  max={255}
                                  step={1}
                                  value={rgb.r}
                                  style={{
                                    ['--min' as any]: 0,
                                    ['--max' as any]: 255,
                                    ['--value' as any]: rgb.r,
                                  }}
                                  onChange={(e) => updateColor(Number(e.target.value), rgb.g, rgb.b)}
                                />
                                <span className="slider-value slider-value--red">{rgb.r}</span>
                              </div>
                              <div className="slider-row">
                                <span className="slider-label slider-label--green">Vert</span>
                                <input
                                  type="range"
                                  className="slider-green"
                                  min={0}
                                  max={255}
                                  step={1}
                                  value={rgb.g}
                                  style={{
                                    ['--min' as any]: 0,
                                    ['--max' as any]: 255,
                                    ['--value' as any]: rgb.g,
                                  }}
                                  onChange={(e) => updateColor(rgb.r, Number(e.target.value), rgb.b)}
                                />
                                <span className="slider-value slider-value--green">{rgb.g}</span>
                              </div>
                              <div className="slider-row">
                                <span className="slider-label slider-label--blue">Bleu</span>
                                <input
                                  type="range"
                                  className="slider-blue"
                                  min={0}
                                  max={255}
                                  step={1}
                                  value={rgb.b}
                                  style={{
                                    ['--min' as any]: 0,
                                    ['--max' as any]: 255,
                                    ['--value' as any]: rgb.b,
                                  }}
                                  onChange={(e) => updateColor(rgb.r, rgb.g, Number(e.target.value))}
                                />
                                <span className="slider-value slider-value--blue">{rgb.b}</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      <label className="field">
                        <span className="slider-label slider-label--intensity">Intensité globale</span>
                        <div className="slider-row">
                          <input
                            type="range"
                            className="slider-intensity"
                            min={0}
                            max={1}
                            step={0.01}
                            value={clamp01(getNum(selectedNode.params, 'intensity', 0.8))}
                            style={{
                              ['--min' as any]: 0,
                              ['--max' as any]: 1,
                              ['--value' as any]: clamp01(getNum(selectedNode.params, 'intensity', 0.8)),
                            }}
                            onChange={(e) => updateSelectedParams({ intensity: Number(e.target.value) })}
                          />
                          <span className="slider-value slider-value--intensity">{Math.round(clamp01(getNum(selectedNode.params, 'intensity', 0.8)) * 100)}</span>
                        </div>
                      </label>

                      <label className="field">
                        <span>Durée (s)</span>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={Math.max(0, getNum(selectedNode.params, 'seconds', 1))}
                          onChange={(e) => updateSelectedParams({ seconds: Number(e.target.value) })}
                          className="input"
                        />
                      </label>

                      <label className="field">
                        <span>Masque</span>
                        <select
                          className="input"
                          value={String(selectedNode.params.mask ?? 'all')}
                          onChange={(e) => updateSelectedParams({ mask: e.target.value })}
                        >
                          <option value="all">Tout</option>
                          <option value="border">Bord</option>
                          <option value="corners">Coins</option>
                          <option value="center">Centre</option>
                        </select>
                      </label>
                    </>
                  ) : selectedNode.kind === 'pulse' ? (
                    <>
                      <label className="field">
                        <span>Couleur de base</span>
                        <input
                          type="color"
                          value={getColor(selectedNode.params, 'baseColor', getColor(selectedNode.params, 'color', '#ff2aa6'))}
                          onChange={(e) => updateSelectedParams({ baseColor: e.target.value })}
                          className="input"
                        />
                      </label>

                      <label className="field">
                        <span>Couleur cible</span>
                        <input
                          type="color"
                          value={getColor(selectedNode.params, 'targetColor', getColor(selectedNode.params, 'color', '#ff2aa6'))}
                          onChange={(e) => updateSelectedParams({ targetColor: e.target.value })}
                          className="input"
                        />
                      </label>

                      <label className="field">
                        <span className="slider-label slider-label--intensity">Intensité départ</span>
                        <div className="slider-row">
                          <input
                            type="range"
                            className="slider-intensity"
                            min={0}
                            max={1}
                            step={0.01}
                            value={clamp01(getNum(selectedNode.params, 'fromIntensity', clamp01(getNum(selectedNode.params, 'base', 0))))}
                            style={{
                              ['--min' as any]: 0,
                              ['--max' as any]: 1,
                              ['--value' as any]: clamp01(
                                getNum(selectedNode.params, 'fromIntensity', clamp01(getNum(selectedNode.params, 'base', 0))),
                              ),
                            }}
                            onChange={(e) => updateSelectedParams({ fromIntensity: Number(e.target.value) })}
                          />
                          <span className="slider-value slider-value--intensity">{Math.round(clamp01(getNum(selectedNode.params, 'fromIntensity', clamp01(getNum(selectedNode.params, 'base', 0)))) * 100)}</span>
                        </div>
                      </label>

                      <label className="field">
                        <span className="slider-label slider-label--intensity">Intensité cible</span>
                        <div className="slider-row">
                          <input
                            type="range"
                            className="slider-intensity"
                            min={0}
                            max={1}
                            step={0.01}
                            value={clamp01(
                              getNum(
                                selectedNode.params,
                                'toIntensity',
                                clamp01(getNum(selectedNode.params, 'base', 0) + clamp01(getNum(selectedNode.params, 'amp', 0.8))),
                              ),
                            )}
                            style={{
                              ['--min' as any]: 0,
                              ['--max' as any]: 1,
                              ['--value' as any]: clamp01(
                                getNum(
                                  selectedNode.params,
                                  'toIntensity',
                                  clamp01(
                                    getNum(selectedNode.params, 'base', 0) + clamp01(getNum(selectedNode.params, 'amp', 0.8)),
                                  ),
                                ),
                              ),
                            }}
                            onChange={(e) => updateSelectedParams({ toIntensity: Number(e.target.value) })}
                          />
                          <span className="slider-value slider-value--intensity">{Math.round(clamp01(getNum(selectedNode.params, 'toIntensity', clamp01(getNum(selectedNode.params, 'base', 0) + clamp01(getNum(selectedNode.params, 'amp', 0.8))))) * 100)}</span>
                        </div>
                      </label>

                      <label className="field">
                        <span>Vitesse</span>
                        <input
                          type="range"
                          min={0.05}
                          max={4}
                          step={0.05}
                          value={Math.max(0.01, getNum(selectedNode.params, 'speed', 1))}
                          style={{
                            ['--min' as any]: 0.05,
                            ['--max' as any]: 4,
                            ['--value' as any]: Math.max(0.01, getNum(selectedNode.params, 'speed', 1)),
                          }}
                          onChange={(e) => updateSelectedParams({ speed: Number(e.target.value) })}
                        />
                      </label>
                    </>
                  ) : selectedNode.kind === 'wait' ? (
                    <>
                      <label className="field">
                        <span>Durée (secondes)</span>
                        <input
                          className="input"
                          type="number"
                          step={0.1}
                          value={getNum(selectedNode.params, 'seconds', 1)}
                          onChange={(e) => updateSelectedParams({ seconds: Number(e.target.value) })}
                        />
                      </label>
                      <div className="muted">Retarde l'exécution de la prochaine action dans la séquence.</div>
                    </>
                  ) : (
                    <>
                      <label className="field">
                        <span>Dalle</span>
                        <select
                          className="input"
                          value={String(Math.max(0, Math.min(tileCount - 1, Math.round(getNum(selectedNode.params, 'tileIndex', 0))))) }
                          onChange={(e) => {
                            const idx = Math.max(0, Math.min(tileCount - 1, Number(e.target.value)));
                            setSelectedTileIndex(idx);
                            updateSelectedParams({ tileIndex: idx });
                          }}
                        >
                          {Array.from({ length: tileCount }, (_, i) => (
                            <option key={i} value={i}>
                              D{i + 1}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Couleur</span>
                        <input
                          type="color"
                          value={getColor(selectedNode.params, 'color', '#ff2aa6')}
                          onChange={(e) => updateSelectedParams({ color: e.target.value })}
                          className="input"
                        />
                      </label>

                      {/* RGB Sliders */}
                      <div className="rgb-sliders">
                        {(() => {
                          const color = getColor(selectedNode.params, 'color', '#ff2aa6');
                          const rgb = hexToRgb(color);
                          const updateColor = (r: number, g: number, b: number) => {
                            updateSelectedParams({ color: rgbToHex(r, g, b) });
                          };
                          return (
                            <>
                              <div className="slider-row">
                                <span className="slider-label slider-label--red">Rouge</span>
                                <input
                                  type="range"
                                  className="slider-red"
                                  min={0}
                                  max={255}
                                  step={1}
                                  value={rgb.r}
                                  style={{
                                    ['--min' as any]: 0,
                                    ['--max' as any]: 255,
                                    ['--value' as any]: rgb.r,
                                  }}
                                  onChange={(e) => updateColor(Number(e.target.value), rgb.g, rgb.b)}
                                />
                                <span className="slider-value slider-value--red">{rgb.r}</span>
                              </div>
                              <div className="slider-row">
                                <span className="slider-label slider-label--green">Vert</span>
                                <input
                                  type="range"
                                  className="slider-green"
                                  min={0}
                                  max={255}
                                  step={1}
                                  value={rgb.g}
                                  style={{
                                    ['--min' as any]: 0,
                                    ['--max' as any]: 255,
                                    ['--value' as any]: rgb.g,
                                  }}
                                  onChange={(e) => updateColor(rgb.r, Number(e.target.value), rgb.b)}
                                />
                                <span className="slider-value slider-value--green">{rgb.g}</span>
                              </div>
                              <div className="slider-row">
                                <span className="slider-label slider-label--blue">Bleu</span>
                                <input
                                  type="range"
                                  className="slider-blue"
                                  min={0}
                                  max={255}
                                  step={1}
                                  value={rgb.b}
                                  style={{
                                    ['--min' as any]: 0,
                                    ['--max' as any]: 255,
                                    ['--value' as any]: rgb.b,
                                  }}
                                  onChange={(e) => updateColor(rgb.r, rgb.g, Number(e.target.value))}
                                />
                                <span className="slider-value slider-value--blue">{rgb.b}</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      <label className="field">
                        <span className="slider-label slider-label--intensity">Intensité globale</span>
                        <div className="slider-row">
                          <input
                            type="range"
                            className="slider-intensity"
                            min={0}
                            max={1}
                            step={0.01}
                            value={clamp01(getNum(selectedNode.params, 'intensity', 0.8))}
                            style={{
                              ['--min' as any]: 0,
                              ['--max' as any]: 1,
                              ['--value' as any]: clamp01(getNum(selectedNode.params, 'intensity', 0.8)),
                            }}
                            onChange={(e) => updateSelectedParams({ intensity: Number(e.target.value) })}
                          />
                          <span className="slider-value slider-value--intensity">{Math.round(clamp01(getNum(selectedNode.params, 'intensity', 0.8)) * 100)}</span>
                        </div>
                      </label>

                      <div className="muted">Astuce: clique une dalle dans le viewport pour l'assigner.</div>
                    </>
                  )}
                </div>
              )}
            </div>
        </aside>
      </div>

      {/* Modal de création de projet amélioré */}
      {modal?.type === 'create-project' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 10000,
          }}
          onClick={() => setModal(null)}
        >
          <div
            className="glass"
            style={{
              width: 'min(520px, calc(100vw - 40px))',
              padding: 28,
              borderRadius: 24,
              boxShadow: '0 24px 60px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #4361ee, #3a0ca3)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <FolderPlus size={22} color="#fff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Nouveau projet</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.7 }}>Créez un jeu lumineux interactif</p>
                </div>
              </div>
              <button
                className="btn btn--mini"
                onClick={() => setModal(null)}
                style={{ borderRadius: 10, width: 36, height: 36, padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, opacity: 0.9 }}>
                  Nom du projet
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Mon super jeu..."
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  style={{ width: '100%', height: 44, fontSize: 15 }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void createGame(newProjectName, newProjectTemplate);
                    }
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 12, opacity: 0.9 }}>
                  Template de départ
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {[
                    { id: 'blank', icon: Layers, label: 'Vide', desc: 'Projet vide avec événement initial' },
                    { id: 'tutorial', icon: Zap, label: 'Tutoriel', desc: 'Remplissage simple démonstratif' },
                    { id: 'animation', icon: Play, label: 'Animation', desc: 'Pulsation automatique' },
                    { id: 'interactive', icon: MousePointer2, label: 'Interactif', desc: 'Contrôle d\'une dalle' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setNewProjectTemplate(t.id as typeof newProjectTemplate)}
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        border: `2px solid ${newProjectTemplate === t.id ? '#4361ee' : 'rgba(0,0,0,0.08)'}`,
                        background: newProjectTemplate === t.id ? 'rgba(67, 97, 238, 0.08)' : 'rgba(255,255,255,0.5)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <t.icon size={18} color={newProjectTemplate === t.id ? '#4361ee' : '#666'} />
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{t.label}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, opacity: 0.7, lineHeight: 1.4 }}>{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
              <button
                className="btn"
                onClick={() => setModal(null)}
                style={{ height: 44, padding: '0 20px' }}
              >
                Annuler
              </button>
              <button
                className="btn btn--cta"
                onClick={() => void createGame(newProjectName, newProjectTemplate)}
                disabled={dbLoading}
                style={{ height: 44, padding: '0 24px' }}
              >
                {dbLoading ? 'Création...' : 'Créer le projet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation de suppression */}
      {modal?.type === 'confirm-delete' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 10000,
          }}
          onClick={() => setModal(null)}
        >
          <div
            className="glass"
            style={{
              width: 'min(400px, calc(100vw - 40px))',
              padding: 28,
              borderRadius: 24,
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: 'linear-gradient(135deg, #ef476f, #c9184a)',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Trash2 size={26} color="#fff" />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>Supprimer le projet ?</h3>
            <p style={{ margin: '0 0 24px', fontSize: 14, opacity: 0.8 }}>
              "{modal.gameName}" sera définitivement supprimé.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                className="btn"
                onClick={() => setModal(null)}
                style={{ height: 44, padding: '0 24px' }}
              >
                Annuler
              </button>
              <button
                className="btn"
                onClick={() => {
                  void deleteActiveGame();
                  setModal(null);
                }}
                style={{ height: 44, padding: '0 24px', background: 'linear-gradient(135deg, #ef476f, #c9184a)', color: '#fff', border: 'none' }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barre d'outils flottante pour le viewport */}
      {activeGame && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 16,
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.5)',
            zIndex: 100,
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <button
            className="btn btn--mini"
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause' : 'Lecture'}
            style={{ width: 36, height: 36, padding: 0 }}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <div style={{ width: 1, background: 'rgba(0,0,0,0.1)', margin: '4px 4px' }} />
          <button
            className="btn btn--mini"
            onClick={() => setViewMode(viewMode === 'split' ? 'tiles-only' : viewMode === 'tiles-only' ? 'ui-only' : 'split')}
            title="Changer vue"
            style={{ width: 36, height: 36, padding: 0 }}
          >
            {viewMode === 'split' ? <LayoutGrid size={16} /> : viewMode === 'tiles-only' ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button
            className="btn btn--mini"
            onClick={() => setShowGrid(!showGrid)}
            title="Grille"
            style={{ width: 36, height: 36, padding: 0, opacity: showGrid ? 1 : 0.5 }}
          >
            <div style={{ width: 14, height: 14, border: '2px solid currentColor', borderRadius: 3 }} />
          </button>
          <div style={{ width: 1, background: 'rgba(0,0,0,0.1)', margin: '4px 4px' }} />
          <button
            className="btn btn--mini"
            onClick={() => {
              setGraphZoom(1);
              setGraphPan({ x: 0, y: 0 });
            }}
            title="Réinitialiser vue"
            style={{ width: 36, height: 36, padding: 0 }}
          >
            <RotateCcw size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{Math.round(graphZoom * 100)}%</span>
          </div>
        </div>
      )}
    </main>
  );
}
