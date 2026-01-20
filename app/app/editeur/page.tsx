'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import EditorTilesViewport from '@/app/_components/EditorTilesViewport';

import { FilePlus2, Pencil, Plus, Save, Trash2 } from 'lucide-react';

type IdFactory = () => string;

type CustomGameVarValue = number | string | boolean;

type CustomWidgetBase = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z?: number;
};

type CustomWidgetSlider = CustomWidgetBase & {
  type: 'slider';
  label: string;
  min: number;
  max: number;
  step: number;
  bindVar: string;
};

type CustomWidgetShape = CustomWidgetBase & {
  type: 'shape';
  shape: 'circle' | 'square';
  colorExpr: string;
};

type CustomWidgetColorBox = CustomWidgetBase & {
  type: 'color_box';
  title: string;
  colorExpr: string;
};

type CustomWidgetButton = CustomWidgetBase & {
  type: 'button';
  label: string;
  points: number;
  message: string;
};

type CustomWidget = CustomWidgetSlider | CustomWidgetShape | CustomWidgetColorBox | CustomWidgetButton;

type CustomWidgetLink = {
  id: string;
  fromId: string;
  toId: string;
};

type CustomGameConfigV1 = {
  version: 1;
  title: string;
  vars: Record<string, CustomGameVarValue>;
  widgets: CustomWidget[];
  links: CustomWidgetLink[];
};

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

function parseCustomConfig(raw: unknown): CustomGameConfigV1 {
  const base: CustomGameConfigV1 = { version: 1, title: 'Jeu custom', vars: { r: 128, g: 64, b: 200 }, widgets: [], links: [] };
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as any;
  const title = typeof o.title === 'string' ? o.title : base.title;
  const vars = o.vars && typeof o.vars === 'object' ? (o.vars as Record<string, CustomGameVarValue>) : base.vars;
  const widgets = Array.isArray(o.widgets) ? (o.widgets as CustomWidget[]) : [];
  const links = Array.isArray(o.links) ? (o.links as CustomWidgetLink[]) : [];
  return { version: 1, title, vars: vars ?? {}, widgets: widgets ?? [], links: links ?? [] };
}

function randomId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function evalColorExpr(expr: string, vars: Record<string, CustomGameVarValue>): string {
  const s = String(expr || '').trim();
  const m = /^(rgba?)\((.*)\)$/.exec(s);
  if (!m) return 'rgb(0,0,0)';
  const fn = m[1];
  const args = m[2]
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  const read = (token: string): number => {
    const v = vars[token];
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : Number(token);
  };

  const r = clamp255(read(args[0] ?? '0'));
  const g = clamp255(read(args[1] ?? '0'));
  const b = clamp255(read(args[2] ?? '0'));

  if (fn === 'rgba') {
    const aRaw = read(args[3] ?? '1');
    const a = Math.max(0, Math.min(1, Number.isFinite(aRaw) ? aRaw : 1));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  return `rgb(${r}, ${g}, ${b})`;
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
    const idx = Math.max(0, Math.min(8, Math.round(getNum(node.params, 'tileIndex', 0))));
    const intensity = clamp01(getNum(node.params, 'intensity', 0.85));
    return `D${idx + 1} • I=${intensity.toFixed(2)}`;
  }
  return '';
}

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

    for (let i = 0; i < 9; i++) {
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

    for (let i = 0; i < 9; i++) {
      if (intensity <= tiles[i].intensity) continue;
      tiles[i] = { color, intensity };
    }
  }

  if (node.kind === 'tile') {
    const tileIndexRaw = getNum(node.params, 'tileIndex', 0);
    const tileIndex = Math.max(0, Math.min(8, Math.round(tileIndexRaw)));
    const color = getColor(node.params, 'color', '#ff2aa6');
    const intensity = clamp01(getNum(node.params, 'intensity', 0.85));
    tiles[tileIndex] = { color, intensity };
  }
}

function computeTiles(game: GameDoc, tSeconds: number): TileState[] {
  const tiles: TileState[] = Array.from({ length: 9 }, () => ({ color: '#000000', intensity: 0 }));

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
  const [dbGames, setDbGames] = useState<Array<{ id: string; name: string; kind: string; updatedAt: string; config: unknown }>>([]);
  const [dbGamesLoading, setDbGamesLoading] = useState(false);
  const [customEditor, setCustomEditor] = useState<{ open: boolean; gameId: string | null }>({ open: false, gameId: null });
  const [customDraft, setCustomDraft] = useState<CustomGameConfigV1 | null>(null);
  const [customSaving, setCustomSaving] = useState(false);
  const [customSelectedWidgetId, setCustomSelectedWidgetId] = useState<string | null>(null);
  const customDragRef = useRef<{ wid: string; dx: number; dy: number } | null>(null);
  const [customMessage, setCustomMessage] = useState<string>('');
  const [customLinkDrag, setCustomLinkDrag] = useState<{ active: boolean; fromId: string; x: number; y: number } | null>(null);
  const customCanvasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = window.localStorage.getItem('crg_user_type') ?? '';
    setIsTeacher(t === 'enseignant');
  }, []);

  useEffect(() => {
    if (isTeacher !== true) return;
    let cancelled = false;
    const load = async () => {
      setDbGamesLoading(true);
      try {
        const res = await fetch('/api/games', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json().catch(() => null)) as any;
        if (!json || json.ok !== true || !Array.isArray(json.games)) return;
        if (cancelled) return;
        setDbGames(json.games);
      } finally {
        if (!cancelled) setDbGamesLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isTeacher]);

  async function createCustomGame() {
    const name = 'Nouveau jeu custom';
    const cfg: CustomGameConfigV1 = {
      version: 1,
      title: name,
      vars: { r: 128, g: 64, b: 200 },
      widgets: [
        {
          id: randomId(),
          type: 'slider',
          x: 20,
          y: 20,
          w: 320,
          h: 64,
          label: 'Rouge',
          min: 0,
          max: 255,
          step: 1,
          bindVar: 'r',
        },
        {
          id: randomId(),
          type: 'slider',
          x: 20,
          y: 96,
          w: 320,
          h: 64,
          label: 'Vert',
          min: 0,
          max: 255,
          step: 1,
          bindVar: 'g',
        },
        {
          id: randomId(),
          type: 'slider',
          x: 20,
          y: 172,
          w: 320,
          h: 64,
          label: 'Bleu',
          min: 0,
          max: 255,
          step: 1,
          bindVar: 'b',
        },
        {
          id: randomId(),
          type: 'shape',
          x: 380,
          y: 30,
          w: 140,
          h: 140,
          shape: 'circle',
          colorExpr: 'rgb(r,g,b)',
        },
        {
          id: randomId(),
          type: 'color_box',
          x: 360,
          y: 200,
          w: 220,
          h: 90,
          title: 'Couleur',
          colorExpr: 'rgb(r,g,b)',
        },
      ],
      links: [],
    };

    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, kind: 'custom', config: cfg }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json.ok !== true) {
        setCustomMessage('Création impossible.');
        return;
      }
      setDbGames((prev) => [json.game, ...prev]);
      setCustomMessage('Jeu custom créé.');
      void openCustomEditor(String(json.game?.id ?? ''));
    } catch {
      setCustomMessage('Création impossible.');
    }
  }

  async function openCustomEditor(gameId: string) {
    setCustomEditor({ open: true, gameId });
    setCustomSelectedWidgetId(null);
    setCustomDraft(null);
    try {
      const res = await fetch(`/api/games/${encodeURIComponent(gameId)}`, { cache: 'no-store' });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json.ok !== true) {
        setCustomMessage('Impossible de charger le jeu.');
        return;
      }
      const cfg = parseCustomConfig(json.game?.config);
      setCustomDraft(cfg);
    } catch {
      setCustomMessage('Impossible de charger le jeu.');
    }
  }

  async function saveCustomEditor() {
    const gameId = customEditor.gameId;
    if (!gameId || !customDraft) return;
    setCustomSaving(true);
    try {
      const res = await fetch(`/api/games/${encodeURIComponent(gameId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config: customDraft, kind: 'custom', name: customDraft.title || 'Jeu custom' }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json.ok !== true) {
        setCustomMessage('Sauvegarde impossible.');
        return;
      }
      setDbGames((prev) => prev.map((g) => (g.id === gameId ? json.game : g)));
      setCustomMessage('Sauvegardé.');
    } catch {
      setCustomMessage('Sauvegarde impossible.');
    } finally {
      setCustomSaving(false);
    }
  }

  async function deleteDbGame(gameId: string) {
    try {
      const res = await fetch(`/api/games/${encodeURIComponent(gameId)}`, { method: 'DELETE' });
      if (!res.ok) {
        setCustomMessage('Suppression impossible.');
        return;
      }
      setDbGames((prev) => prev.filter((g) => g.id !== gameId));
      setCustomMessage('Jeu supprimé.');
    } catch {
      setCustomMessage('Suppression impossible.');
    }
  }

  function addWidget(kind: CustomWidget['type']) {
    if (!customDraft) return;
    const id = randomId();
    const base = { id, x: 40, y: 40, w: 240, h: 80 };
    const next: CustomWidget =
      kind === 'slider'
        ? {
            ...base,
            type: 'slider',
            label: 'Slider',
            min: 0,
            max: 255,
            step: 1,
            bindVar: 'x',
          }
        : kind === 'shape'
          ? { ...base, type: 'shape', shape: 'circle', w: 140, h: 140, colorExpr: 'rgb(r,g,b)' }
          : kind === 'button'
            ? { ...base, type: 'button', h: 56, label: 'Valider', points: 50, message: '+50 points.' }
            : { ...base, type: 'color_box', title: 'Couleur', colorExpr: 'rgb(r,g,b)', h: 90 };

    setCustomDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, widgets: [...prev.widgets, next] };
    });
    setCustomSelectedWidgetId(id);
  }

  function updateWidget(id: string, patch: Partial<CustomWidget>) {
    setCustomDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        widgets: prev.widgets.map((w) => (w.id === id ? ({ ...w, ...patch } as any) : w)),
      };
    });
  }

  function addWidgetLink(fromId: string, toId: string) {
    if (fromId === toId) return;
    setCustomDraft((prev) => {
      if (!prev) return prev;
      if (!prev.widgets.some((w) => w.id === fromId)) return prev;
      if (!prev.widgets.some((w) => w.id === toId)) return prev;
      if (prev.links.some((l) => l.fromId === fromId && l.toId === toId)) return prev;
      return { ...prev, links: [...prev.links, { id: randomId(), fromId, toId }] };
    });
  }

  function removeWidgetLink(linkId: string) {
    setCustomDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, links: prev.links.filter((l) => l.id !== linkId) };
    });
  }

  function updateVar(name: string, value: CustomGameVarValue) {
    setCustomDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, vars: { ...prev.vars, [name]: value } };
    });
  }

  const selectedWidget = useMemo(() => {
    if (!customDraft || !customSelectedWidgetId) return null;
    return customDraft.widgets.find((w) => w.id === customSelectedWidgetId) ?? null;
  }, [customDraft, customSelectedWidgetId]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = customDragRef.current;
      if (!drag || !customDraft) return;
      const x = Math.max(0, e.clientX - drag.dx);
      const y = Math.max(0, e.clientY - drag.dy);
      updateWidget(drag.wid, { x, y } as any);
    };
    const onUp = () => {
      customDragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [customDraft]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setCustomLinkDrag((prev) => {
        if (!prev || !prev.active) return prev;
        return { ...prev, x: e.clientX, y: e.clientY };
      });
    };
    const onUp = () => {
      setCustomLinkDrag((prev) => {
        if (!prev || !prev.active) return prev;
        return null;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
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

  const createGame = (forcedName?: string) => {
    const makeId: IdFactory = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const gameId = makeId();
    const nodeId = makeId();
    const nextIndex = (editorRef.current.games.length || 0) + 1;
    const gameName = forcedName && forcedName.trim().length > 0 ? forcedName.trim() : `Jeu${nextIndex}`;
    commit((cur) => {
      const newGame: GameDoc = {
        id: gameId,
        name: gameName,
        nodes: [
          {
            id: nodeId,
            kind: 'event_begin',
            name: gameName,
            enabled: true,
            params: {},
            pos: { x: 80, y: 80 },
          },
        ],
        edges: [],
      };

      return {
        ...cur,
        games: [...cur.games, newGame],
        activeGameId: gameId,
        selectedNodeId: nodeId,
      };
    });
    setStatus('Jeu créé');
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
    setSelectedTileIndex(tileIndex);

    if (!selectedNodeId) return;
    if (!selectedNode) return;
    if (selectedNode.kind !== 'tile') return;
    updateSelectedParams({ tileIndex });
    setStatus(`Dalle D${tileIndex + 1} assignée`);
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
      <main className="stage">
        <div className="ue">
          <aside className="ue__left glass">
            <div className="panelhead">
              <strong>Accès refusé</strong>
              <span className="panelhead__meta">Enseignant requis</span>
            </div>
            <div className="panelbody">
              <div className="muted">
                Cette page est réservée aux enseignants.
                <br />
                Connecte-toi en tant qu'enseignant depuis <a href="/jeux">/jeux</a>.
              </div>
            </div>
          </aside>
        </div>
      </main>
    );
  }

  return (
    <>
      {customEditor.open ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.42)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1200,
          }}
          onClick={() => setCustomEditor({ open: false, gameId: null })}
        >
          <div
            className="glass"
            style={{
              width: 'min(1100px, calc(100vw - 24px))',
              height: 'min(720px, calc(100vh - 24px))',
              padding: 16,
              borderRadius: 18,
              display: 'grid',
              gridTemplateRows: 'auto 1fr',
              gap: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Pencil size={18} />
                <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {customDraft?.title ?? 'Éditeur (chargement...)'}
                </strong>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="btn" onClick={() => setCustomEditor({ open: false, gameId: null })}>
                  Fermer
                </button>
                <button className="btn btn--hero" disabled={!customDraft || customSaving} onClick={() => void saveCustomEditor()}>
                  <Save size={18} /> Sauvegarder
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 280px', gap: 12, minHeight: 0 }}>
              <div className="glass" style={{ padding: 12, borderRadius: 16, minHeight: 0 }}>
                <div style={{ fontWeight: 800 }}>Palette</div>
                <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                  <button className="btn btn--hero" disabled={!customDraft} onClick={() => addWidget('slider')}>
                    <Plus size={18} /> Slider
                  </button>
                  <button className="btn btn--hero" disabled={!customDraft} onClick={() => addWidget('shape')}>
                    <Plus size={18} /> Forme
                  </button>
                  <button className="btn btn--hero" disabled={!customDraft} onClick={() => addWidget('color_box')}>
                    <Plus size={18} /> Color Box
                  </button>
                  <button className="btn btn--hero" disabled={!customDraft} onClick={() => addWidget('button')}>
                    <Plus size={18} /> Bouton points
                  </button>
                </div>
              </div>

              <div className="glass" style={{ padding: 12, borderRadius: 16, position: 'relative', overflow: 'hidden' }}>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>Zone de jeu (canvas)</div>
                <div
                  ref={customCanvasRef}
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    borderRadius: 14,
                    background: 'rgba(0,0,0,0.06)',
                    border: '1px solid rgba(0,0,0,0.10)',
                    overflow: 'hidden',
                  }}
                  onMouseDown={() => setCustomSelectedWidgetId(null)}
                >
                  <svg
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                  >
                    {customDraft?.links.map((l) => {
                      const from = customDraft.widgets.find((w) => w.id === l.fromId);
                      const to = customDraft.widgets.find((w) => w.id === l.toId);
                      if (!from || !to) return null;
                      const x1 = from.x + from.w;
                      const y1 = from.y + from.h / 2;
                      const x2 = to.x;
                      const y2 = to.y + to.h / 2;
                      const cx1 = x1 + 60;
                      const cx2 = x2 - 60;
                      const d = `M ${x1} ${y1} C ${cx1} ${y1} ${cx2} ${y2} ${x2} ${y2}`;
                      return (
                        <g key={l.id}>
                          <path
                            d={d}
                            fill="none"
                            stroke="rgba(67,97,238,0.75)"
                            strokeWidth={2}
                          />
                          <path
                            d={d}
                            fill="none"
                            stroke="rgba(0,0,0,0)"
                            strokeWidth={12}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              removeWidgetLink(l.id);
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                        </g>
                      );
                    })}

                    {customLinkDrag?.active && customDraft ? (() => {
                      const from = customDraft.widgets.find((w) => w.id === customLinkDrag.fromId);
                      const canvas = customCanvasRef.current;
                      if (!from || !canvas) return null;
                      const rect = canvas.getBoundingClientRect();
                      const x1 = from.x + from.w;
                      const y1 = from.y + from.h / 2;
                      const x2 = customLinkDrag.x - rect.left;
                      const y2 = customLinkDrag.y - rect.top;
                      const cx1 = x1 + 60;
                      const cx2 = x2 - 60;
                      const d = `M ${x1} ${y1} C ${cx1} ${y1} ${cx2} ${y2} ${x2} ${y2}`;
                      return <path d={d} fill="none" stroke="rgba(6,214,160,0.7)" strokeWidth={2} strokeDasharray="6 6" />;
                    })() : null}
                  </svg>

                  {customDraft?.widgets.map((w) => {
                    const isSel = w.id === customSelectedWidgetId;
                    const border = isSel ? '2px solid rgba(67,97,238,0.65)' : '1px solid rgba(0,0,0,0.12)';
                    const boxShadow = isSel ? '0 0 0 3px rgba(67,97,238,0.18)' : 'none';
                    const z = typeof w.z === 'number' ? w.z : 1;

                    const onDown = (e: React.MouseEvent) => {
                      const t = e.target as HTMLElement;
                      const tag = (t?.tagName || '').toLowerCase();
                      if (tag === 'input' || tag === 'select' || tag === 'button' || tag === 'textarea') return;
                      e.stopPropagation();
                      setCustomSelectedWidgetId(w.id);
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      customDragRef.current = { wid: w.id, dx: e.clientX - rect.left, dy: e.clientY - rect.top };
                    };

                    const commonStyle: React.CSSProperties = {
                      position: 'absolute',
                      left: w.x,
                      top: w.y,
                      width: w.w,
                      height: w.h,
                      zIndex: z,
                      border,
                      boxShadow,
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.75)',
                      padding: 10,
                      color: '#111',
                      cursor: 'grab',
                      overflow: 'hidden',
                    };

                    const pinCommon: React.CSSProperties = {
                      position: 'absolute',
                      top: '50%',
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      transform: 'translateY(-50%)',
                      background: 'rgba(67,97,238,0.9)',
                      border: '2px solid rgba(255,255,255,0.9)',
                      boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
                      pointerEvents: 'auto',
                    };

                    const startLink = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      setCustomLinkDrag({ active: true, fromId: w.id, x: e.clientX, y: e.clientY });
                    };

                    const finishLink = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      setCustomLinkDrag((prev) => {
                        if (!prev || !prev.active) return null;
                        addWidgetLink(prev.fromId, w.id);
                        return null;
                      });
                    };

                    if (w.type === 'slider') {
                      const v = customDraft?.vars?.[w.bindVar];
                      const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
                      return (
                        <div key={w.id} style={commonStyle} onMouseDown={onDown}>
                          <div onMouseDown={startLink} style={{ ...pinCommon, right: -6 }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.9 }}>
                            <strong>{w.label}</strong>
                            <span>{clamp255(n)}</span>
                          </div>
                          <input
                            type="range"
                            min={w.min}
                            max={w.max}
                            step={w.step}
                            value={Number(n)}
                            onChange={(e) => updateVar(w.bindVar, Number(e.target.value))}
                            style={{ width: '100%', marginTop: 10 }}
                          />
                          <div style={{ marginTop: 6, fontSize: 11, opacity: 0.75 }}>var: {w.bindVar}</div>
                        </div>
                      );
                    }

                    if (w.type === 'button') {
                      return (
                        <div key={w.id} style={commonStyle} onMouseDown={onDown}>
                          <div onMouseUp={finishLink} style={{ ...pinCommon, left: -6, background: 'rgba(6,214,160,0.9)' }} />
                          <button className="btn btn--hero" style={{ width: '100%' }}>
                            {w.label}
                          </button>
                        </div>
                      );
                    }

                    if (w.type === 'shape') {
                      const bg = evalColorExpr(w.colorExpr, customDraft?.vars ?? {});
                      return (
                        <div key={w.id} style={commonStyle} onMouseDown={onDown}>
                          <div onMouseUp={finishLink} style={{ ...pinCommon, left: -6, background: 'rgba(6,214,160,0.9)' }} />
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              borderRadius: w.shape === 'circle' ? 999 : 18,
                              background: bg,
                              boxShadow: `0 0 18px ${bg}`,
                            }}
                          />
                        </div>
                      );
                    }

                    const bg = evalColorExpr(w.colorExpr, customDraft?.vars ?? {});
                    return (
                      <div key={w.id} style={commonStyle} onMouseDown={onDown}>
                        <div onMouseUp={finishLink} style={{ ...pinCommon, left: -6, background: 'rgba(6,214,160,0.9)' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <strong style={{ fontSize: 12 }}>{w.title}</strong>
                        </div>
                        <div
                          style={{
                            marginTop: 10,
                            width: '100%',
                            height: `calc(100% - 22px)`,
                            borderRadius: 12,
                            background: bg,
                            boxShadow: `0 0 18px ${bg}`,
                            border: '1px solid rgba(0,0,0,0.10)',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="glass" style={{ padding: 12, borderRadius: 16, minHeight: 0, overflow: 'auto' }}>
                <div style={{ fontWeight: 800 }}>Propriétés</div>
                {!customDraft ? <div style={{ marginTop: 10, opacity: 0.75 }}>Chargement…</div> : null}

                {customDraft ? (
                  <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>Titre</div>
                      <input
                        className="input"
                        value={customDraft.title}
                        onChange={(e) => setCustomDraft((p) => (p ? { ...p, title: e.target.value } : p))}
                      />
                    </div>

                    <div className="glass" style={{ padding: 10, borderRadius: 14 }}>
                      <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.9 }}>Variables</div>
                      <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                        {Object.entries(customDraft.vars).map(([k, v]) => (
                          <div key={k} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8, alignItems: 'center' }}>
                            <div style={{ fontSize: 12, opacity: 0.8 }}>{k}</div>
                            <input
                              className="input"
                              value={String(v)}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const n = Number(raw);
                                updateVar(k, Number.isFinite(n) && raw.trim() !== '' ? n : raw);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedWidget ? (
                      <div className="glass" style={{ padding: 10, borderRadius: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.9 }}>Widget</div>
                          <button
                            className="btn"
                            onClick={() => {
                              const id = selectedWidget.id;
                              setCustomDraft((prev) => (prev ? { ...prev, widgets: prev.widgets.filter((w) => w.id !== id) } : prev));
                              setCustomSelectedWidgetId(null);
                            }}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>

                        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <input
                              className="input"
                              value={String(selectedWidget.x)}
                              onChange={(e) => updateWidget(selectedWidget.id, { x: Math.max(0, Number(e.target.value) || 0) } as any)}
                            />
                            <input
                              className="input"
                              value={String(selectedWidget.y)}
                              onChange={(e) => updateWidget(selectedWidget.id, { y: Math.max(0, Number(e.target.value) || 0) } as any)}
                            />
                          </div>

                          {selectedWidget.type === 'slider' ? (
                            <>
                              <input
                                className="input"
                                value={selectedWidget.label}
                                onChange={(e) => updateWidget(selectedWidget.id, { label: e.target.value } as any)}
                              />
                              <input
                                className="input"
                                value={selectedWidget.bindVar}
                                onChange={(e) => updateWidget(selectedWidget.id, { bindVar: e.target.value } as any)}
                              />
                            </>
                          ) : null}

                          {selectedWidget.type === 'shape' ? (
                            <>
                              <select
                                className="input"
                                value={selectedWidget.shape}
                                onChange={(e) => updateWidget(selectedWidget.id, { shape: e.target.value as any } as any)}
                              >
                                <option value="circle">circle</option>
                                <option value="square">square</option>
                              </select>
                              <input
                                className="input"
                                value={selectedWidget.colorExpr}
                                onChange={(e) => updateWidget(selectedWidget.id, { colorExpr: e.target.value } as any)}
                              />
                            </>
                          ) : null}

                          {selectedWidget.type === 'button' ? (
                            <>
                              <input
                                className="input"
                                value={selectedWidget.label}
                                onChange={(e) => updateWidget(selectedWidget.id, { label: e.target.value } as any)}
                              />
                              <input
                                className="input"
                                type="number"
                                value={String(selectedWidget.points)}
                                onChange={(e) => updateWidget(selectedWidget.id, { points: Number(e.target.value) } as any)}
                              />
                              <input
                                className="input"
                                value={selectedWidget.message}
                                onChange={(e) => updateWidget(selectedWidget.id, { message: e.target.value } as any)}
                              />
                            </>
                          ) : null}

                          {selectedWidget.type === 'color_box' ? (
                            <>
                              <input
                                className="input"
                                value={selectedWidget.title}
                                onChange={(e) => updateWidget(selectedWidget.id, { title: e.target.value } as any)}
                              />
                              <input
                                className="input"
                                value={selectedWidget.colorExpr}
                                onChange={(e) => updateWidget(selectedWidget.id, { colorExpr: e.target.value } as any)}
                              />
                            </>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <main className="stage">
        <div className="ue">
          <aside className="ue__left glass">
            <div className="panelhead">
              <strong>Explorateur</strong>
              <span className="panelhead__meta">Jeux</span>
            </div>

            <div className="panelbody">
              <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
                <div className="glass" style={{ padding: 10, borderRadius: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <strong>Jeux custom (DB)</strong>
                    <button className="btn btn--hero" onClick={() => void createCustomGame()}>
                      <FilePlus2 className="btn__icon" aria-hidden />
                      <span>Nouveau</span>
                    </button>
                  </div>

                  {customMessage ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>{customMessage}</div> : null}
                  {dbGamesLoading ? <div className="muted" style={{ marginTop: 8 }}>Chargement…</div> : null}

                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    {dbGames
                      .filter((g) => String(g.kind) === 'custom')
                      .map((g) => (
                        <div key={g.id} className="glass" style={{ padding: 10, borderRadius: 14, display: 'flex', gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                            <div className="muted" style={{ fontSize: 12 }}>
                              {g.updatedAt}
                            </div>
                          </div>
                          <button className="btn" onClick={() => void openCustomEditor(g.id)}>
                            <Pencil className="btn__icon" aria-hidden />
                          </button>
                          <button className="btn" onClick={() => void deleteDbGame(g.id)}>
                            <Trash2 className="btn__icon" aria-hidden />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              <div className="list">
                {games.length === 0 ? (
                  <div className="muted">Aucun jeu. Clique “Créer un jeu” pour commencer.</div>
                ) : (
                  games.map((g) => (
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
                  ))
                )}
              </div>

              {activeGame ? (
                <>
                  <div className="divider" />
                  <label className="field">
                    <span>Nom du jeu</span>
                    <input className="input" value={activeGame.name} onChange={(e) => renameActiveGame(e.target.value)} />
                  </label>
                </>
              ) : null}

              <div className="divider" />

              <div className="panelhead" style={{ padding: 0 }}>
                <strong>Noeuds</strong>
                <span className="panelhead__meta">{activeGame ? activeGame.name : '—'}</span>
              </div>
              <div className="list">
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
                <span className="panelhead__meta">Simulation 9 dalles</span>
              </div>
              <div className="viewport">
                <EditorTilesViewport tiles={tiles} selectedTileIndex={selectedTileIndex} onTileClick={assignSelectedTileToNode} />
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
                        <button className="btn btn--hero" onClick={() => createGame()}>
                          <Plus className="btn__icon" aria-hidden />
                          <span>Créer un jeu</span>
                        </button>
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
                        return <path key={e.id} d={d} className={active ? 'bp-wire bp-wire--active' : 'bp-wire'} />;
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
                        return <path key="__preview" d={d} className="bp-wire bp-wire--preview" />;
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

                      <label className="field">
                        <span>Intensité</span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={clamp01(getNum(selectedNode.params, 'intensity', 0.7))}
                          style={{
                            ['--min' as any]: 0,
                            ['--max' as any]: 1,
                            ['--value' as any]: clamp01(getNum(selectedNode.params, 'intensity', 0.7)),
                          }}
                          onChange={(e) => updateSelectedParams({ intensity: Number(e.target.value) })}
                        />
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
                        <span>Intensité départ</span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={clamp01(getNum(selectedNode.params, 'fromIntensity', clamp01(getNum(selectedNode.params, 'base', 0.1))))}
                          style={{
                            ['--min' as any]: 0,
                            ['--max' as any]: 1,
                            ['--value' as any]: clamp01(
                              getNum(selectedNode.params, 'fromIntensity', clamp01(getNum(selectedNode.params, 'base', 0.1))),
                            ),
                          }}
                          onChange={(e) => updateSelectedParams({ fromIntensity: Number(e.target.value) })}
                        />
                      </label>

                      <label className="field">
                        <span>Intensité cible</span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={clamp01(
                            getNum(
                              selectedNode.params,
                              'toIntensity',
                              clamp01(getNum(selectedNode.params, 'base', 0.1) + clamp01(getNum(selectedNode.params, 'amp', 0.7))),
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
                                  getNum(selectedNode.params, 'base', 0.1) + clamp01(getNum(selectedNode.params, 'amp', 0.7)),
                                ),
                              ),
                            ),
                          }}
                          onChange={(e) => updateSelectedParams({ toIntensity: Number(e.target.value) })}
                        />
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
                          value={String(Math.max(0, Math.min(8, Math.round(getNum(selectedNode.params, 'tileIndex', 0))))) }
                          onChange={(e) => {
                            const idx = Math.max(0, Math.min(8, Number(e.target.value)));
                            setSelectedTileIndex(idx);
                            updateSelectedParams({ tileIndex: idx });
                          }}
                        >
                          {Array.from({ length: 9 }, (_, i) => (
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

                      <label className="field">
                        <span>Intensité</span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={clamp01(getNum(selectedNode.params, 'intensity', 0.9))}
                          style={{
                            ['--min' as any]: 0,
                            ['--max' as any]: 1,
                            ['--value' as any]: clamp01(getNum(selectedNode.params, 'intensity', 0.9)),
                          }}
                          onChange={(e) => updateSelectedParams({ intensity: Number(e.target.value) })}
                        />
                      </label>

                      <div className="muted">Astuce: clique une dalle dans le viewport pour l'assigner.</div>
                    </>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
