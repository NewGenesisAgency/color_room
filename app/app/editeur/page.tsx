'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import EditorTilesViewport from '@/app/_components/EditorTilesViewport';
import TetrisGame from '@/app/_components/TetrisGame';
import CS150Panel from '@/app/_components/CS150Panel';
import type { TetrisSnapshot } from '@/app/_components/TetrisGame';

import { Boxes, Gamepad2, Plus, Play, Pause, RotateCcw, Save, Trash2, FolderPlus, X, Lightbulb, Layers, Zap, Palette, Clock, MousePointer2, LayoutGrid, Maximize2, Minimize2, Eye, Star, Heart, Sun, Moon, Flame, Snowflake, Music, Target, Puzzle, Sparkles, Trophy, Rocket, Ghost, Dice1, Brain, Check, GitBranch, Hash, Settings2, Shuffle, type LucideIcon } from 'lucide-react';

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
  | 'tile_set'
  | 'game_tetris'
  | 'game_simon'
  | 'game_memory'
  | 'on_timer'
  | 'on_click'
  // CS150 Colorimeter nodes
  | 'cs150_connect'
  | 'cs150_measure'
  | 'cs150_read_xyz'
  | 'cs150_read_lvxy'
  | 'cs150_set_backlight'
  | 'cs150_set_calib_ch'
  | 'cs150_rgb_calib'
  | 'cs150_single_calib';

type EditorNode = {
  id: string;
  kind: EditorNodeKind;
  name: string;
  enabled: boolean;
  params: Record<string, unknown>;
  pos: { x: number; y: number };
};

type GameDifficulty = 1 | 2 | 3 | 4 | 5;

type GameIconName = 'Lightbulb' | 'Gamepad2' | 'Star' | 'Heart' | 'Sun' | 'Moon' | 'Flame' | 'Snowflake' | 'Music' | 'Target' | 'Puzzle' | 'Sparkles' | 'Trophy' | 'Rocket' | 'Ghost' | 'Palette' | 'Zap' | 'Dice1';

const GAME_ICON_MAP: Record<GameIconName, LucideIcon> = {
  Lightbulb, Gamepad2, Star, Heart, Sun, Moon, Flame, Snowflake, Music, Target, Puzzle, Sparkles, Trophy, Rocket, Ghost, Palette, Zap, Dice1,
};

const GAME_ICON_NAMES: GameIconName[] = Object.keys(GAME_ICON_MAP) as GameIconName[];

type GameDoc = {
  id: string;
  name: string;
  tileCount?: number;
  icon?: GameIconName;
  difficulty?: GameDifficulty;
  description?: string;
  bgColor?: string;
  accentColor?: string;
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
  { kind: 'game_tetris', category: 'Jeux', title: 'Tetris Lumière', defaults: { speed: 500, bgColor: '#0a0a0f', borderColor: '#222233' } },
  { kind: 'game_simon', category: 'Jeux', title: 'Simon', defaults: { speed: 800, colors: 4 } },
  { kind: 'game_memory', category: 'Jeux', title: 'Mémoire', defaults: { pairs: 8 } },
  { kind: 'on_timer', category: 'Évènements', title: 'Timer', defaults: { intervalMs: 1000 } },
  { kind: 'on_click', category: 'Évènements', title: 'On Click', defaults: { tileIndex: 0 } },
  // CS150 Colorimeter nodes
  { kind: 'cs150_connect', category: 'Colorimètre', title: 'CS150 Connect', defaults: {} },
  { kind: 'cs150_measure', category: 'Colorimètre', title: 'CS150 Mesurer', defaults: {} },
  { kind: 'cs150_read_xyz', category: 'Colorimètre', title: 'CS150 Lire XYZ', defaults: {} },
  { kind: 'cs150_read_lvxy', category: 'Colorimètre', title: 'CS150 Lire Lvxy', defaults: {} },
  { kind: 'cs150_set_backlight', category: 'Colorimètre', title: 'CS150 Rétroéclairage', defaults: { mode: 'on' } },
  { kind: 'cs150_set_calib_ch', category: 'Colorimètre', title: 'CS150 Canal Calib', defaults: { channel: 0 } },
  { kind: 'cs150_rgb_calib', category: 'Colorimètre', title: 'CS150 Calib RGB', defaults: { 
    trueRedX: 800, trueRedY: 400, trueRedZ: 300,
    trueGreenX: 600, trueGreenY: 1000, trueGreenZ: 400,
    trueBlueX: 500, trueBlueY: 600, trueBlueZ: 1000,
    calibId: 'rgb_calib_001', targetChannel: 1 
  }},
  { kind: 'cs150_single_calib', category: 'Colorimètre', title: 'CS150 Calib 1 Point', defaults: { 
    trueLv: 11.0, trueX: 0.4, trueY: 0.4,
    calibId: 'single_calib_001', targetChannel: 1 
  }},
];

function labelNodeKind(kind: EditorNodeKind): string {
  return NODE_CATALOG.find((x) => x.kind === kind)?.title ?? kind;
}

function categoryOfKind(kind: EditorNodeKind): string {
  return NODE_CATALOG.find((x) => x.kind === kind)?.category ?? '';
}

const NODE_CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Évènements': Zap,
  'Flux': GitBranch,
  'Rendu': Palette,
  'Jeux': Gamepad2,
  'Maths': Hash,
  'Logique': Brain,
  'Temps': Clock,
  'Constantes': Hash,
  'Dalles': LayoutGrid,
  'Aléatoire': Shuffle,
  'Colorimètre': Lightbulb,
};

const NODE_CATEGORY_COLORS: Record<string, string> = {
  'Évènements': '#f59e0b',
  'Flux': '#f97316',
  'Rendu': '#22d3ee',
  'Jeux': '#a855f7',
  'Maths': '#4ade80',
  'Logique': '#60a5fa',
  'Temps': '#fb7185',
  'Constantes': '#a1a1aa',
  'Dalles': '#06d6a0',
  'Aléatoire': '#34d399',
  'Colorimètre': '#fbbf24',
};

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
  activeGameId: string | null;
  selectedNodeId: string | null;
  drillDownFrom?: string;
  expandedGameNodeId?: string;
  visibleNodeIds?: string[];
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
    const t01 = clamp01(0.5 + 0.5 * Math.sin(tSeconds * speed * 2 * Math.PI + phase));
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
  const tileCount = Math.max(1, Math.round(Number(game.tileCount ?? 42)));
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
    // Fallback: apply all enabled render nodes if no valid timeline
    for (const node of game.nodes) {
      if (!node.enabled) continue;
      if (node.kind === 'fill' || node.kind === 'pulse' || node.kind === 'tile') {
        applyRenderNode(tiles, node, tSeconds);
      }
    }
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

// Hardware control constants and functions (from /jeux)
const PLATE_ID_BY_INDEX: number[] = Array.from({ length: 42 }, (_, i) => i + 1);

function hexToRgb255(hex: string): { r: number; g: number; b: number } {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Channel profiles matching COULEURS.md (32 LED channels per plaque)
const CHANNEL_PROFILES: { rgb: [number, number, number]; strength: number }[] = [
  { rgb: [0.30, 0.00, 0.50], strength: 1.0 },  // 1: violet foncé
  { rgb: [0.55, 0.10, 0.85], strength: 1.0 },  // 2: violet clair
  { rgb: [0.25, 0.05, 0.95], strength: 1.0 },  // 3: bleu violet
  { rgb: [0.05, 0.05, 0.40], strength: 1.0 },  // 4: bleu marine
  { rgb: [0.00, 0.65, 1.00], strength: 1.0 },  // 5: bleu turquoise
  { rgb: [0.25, 1.00, 0.35], strength: 1.0 },  // 6: vert clair
  { rgb: [0.00, 0.55, 0.12], strength: 1.0 },  // 7: vert foncé
  { rgb: [1.00, 1.00, 0.40], strength: 1.0 },  // 8: jaune clair
  { rgb: [1.00, 0.55, 0.00], strength: 1.0 },  // 9: orange
  { rgb: [0.75, 0.25, 0.00], strength: 1.0 },  // 10: rouge/orangé
  { rgb: [0.55, 0.00, 0.00], strength: 1.0 },  // 11: rouge foncé
  { rgb: [1.00, 0.05, 0.05], strength: 1.0 },  // 12: rouge pétant
  { rgb: [0.95, 0.00, 0.20], strength: 1.0 },  // 13: rouge cerise
  { rgb: [0.90, 0.00, 0.22], strength: 1.0 },  // 14: rouge cerise+
  { rgb: [0.35, 0.00, 0.00], strength: 1.0 },  // 15: rouge foncé
  { rgb: [0.20, 0.00, 0.00], strength: 0.25 }, // 16: rouge très foncé
  { rgb: [0.10, 0.00, 0.00], strength: 0.15 }, // 17: rouge invisible
  { rgb: [0.10, 0.00, 0.00], strength: 0.15 }, // 18: rouge invisible
  { rgb: [1.00, 0.58, 0.00], strength: 1.0 },  // 19: jaune orange
  { rgb: [1.00, 0.70, 0.10], strength: 1.0 },  // 20: jaune orange clair
  { rgb: [1.00, 0.78, 0.15], strength: 0.55 }, // 21
  { rgb: [1.00, 0.80, 0.20], strength: 0.45 }, // 22
  { rgb: [1.00, 0.82, 0.22], strength: 0.35 }, // 23
  { rgb: [1.00, 0.92, 0.78], strength: 1.0 },  // 24: jaune orange blanc
  { rgb: [1.00, 0.97, 0.90], strength: 1.0 },  // 25: blanc jaunis
  { rgb: [1.00, 1.00, 1.00], strength: 1.0 },  // 26: blanc
  { rgb: [0.90, 0.90, 0.90], strength: 0.75 }, // 27
  { rgb: [0.80, 0.80, 0.80], strength: 0.60 }, // 28
  { rgb: [0.55, 0.55, 0.55], strength: 0.45 }, // 29: gris
  { rgb: [0.40, 0.40, 0.40], strength: 0.40 }, // 30
  { rgb: [0.78, 0.78, 0.78], strength: 0.55 }, // 31
  { rgb: [0.92, 0.92, 0.92], strength: 0.70 }, // 32
];

function rgbToChannels32(rgb: { r: number; g: number; b: number }, masterIntensity100: number): number[] {
  const r = clamp255(rgb.r) / 255;
  const g = clamp255(rgb.g) / 255;
  const b = clamp255(rgb.b) / 255;
  const scale = Math.max(0, Math.min(100, masterIntensity100)) / 100;

  const energy = Math.max(r, g, b);
  const channels = Array(32).fill(0);
  if (energy <= 1e-6 || scale <= 1e-6) return channels;

  // Find the best matching channel using cosine similarity with CHANNEL_PROFILES
  const norm = Math.max(1e-6, Math.sqrt(r * r + g * g + b * b));
  const tr = r / norm;
  const tg = g / norm;
  const tb = b / norm;

  let bestIdx = 11; // Canal 12 (rouge pétant) as safe default
  let bestScore = -1;
  for (let i = 0; i < 32; i++) {
    const p = CHANNEL_PROFILES[i];
    if (!p || p.strength <= 0.05) continue;
    const pn = Math.max(1e-6, Math.sqrt(p.rgb[0] * p.rgb[0] + p.rgb[1] * p.rgb[1] + p.rgb[2] * p.rgb[2]));
    const pr = p.rgb[0] / pn;
    const pg = p.rgb[1] / pn;
    const pb = p.rgb[2] / pn;
    const score = pr * tr + pg * tg + pb * tb;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  const mainValue = Math.max(0, Math.min(100, Math.round(energy * 100 * scale)));
  channels[bestIdx] = mainValue;

  // Boost intensity with white channels (COULEURS.md canaux 25-28)
  // to increase overall luminosity — proportional to energy and scale
  const whiteBoost = Math.round(mainValue * 0.4);
  if (whiteBoost > 0) {
    channels[24] = Math.round(whiteBoost * 0.5);  // Canal 25: Blanc un peu jaunis
    channels[25] = whiteBoost;                      // Canal 26: Blanc (dominant)
    channels[26] = Math.round(whiteBoost * 0.7);   // Canal 27: Blanc un peu moins lumineux
    channels[27] = Math.round(whiteBoost * 0.4);   // Canal 28: Blanc encore moins lumineux
  }

  return channels;
}

// Hardware batch: per-plate accumulator with 20ms coalescing window
const hwLastSent: Map<string, number> = new Map();
const hwBatchPending: Map<number, Record<number, number>> = new Map();
const hwBatchTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();

function scheduleSetCanal(plaqueId: number, canalIndex: number, intensity: number) {
  const key = `${plaqueId}:${canalIndex}`;
  const clamped = Math.max(0, Math.min(255, Math.round(intensity)));
  // Skip if value unchanged
  const prev = hwLastSent.get(key);
  if (prev === clamped) return;
  hwLastSent.set(key, clamped);

  // Accumulate into per-plate pending batch
  if (!hwBatchPending.has(plaqueId)) hwBatchPending.set(plaqueId, {});
  hwBatchPending.get(plaqueId)![canalIndex] = clamped;

  // (Re-)arm a single 20ms timer per plate — all 32 channels coalesce into one batch
  const existing = hwBatchTimers.get(plaqueId);
  if (existing) clearTimeout(existing);
  hwBatchTimers.set(plaqueId, setTimeout(() => {
    hwBatchTimers.delete(plaqueId);
    const channels = hwBatchPending.get(plaqueId);
    hwBatchPending.delete(plaqueId);
    if (!channels) return;
    const channelArray = Object.entries(channels)
      .map(([i, v]) => ({ index: Number(i), value: v }))
      .filter(ch => ch.value >= 0);
    if (channelArray.length === 0) return;
    fetch('/api/supervision/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plateId: plaqueId, channels: channelArray }),
      cache: 'no-store',
    }).catch(() => {});
  }, 20));
}

function sendChannelsToHardware(channels32: number[], plateIds: number[]) {
  for (const plaqueId of plateIds) {
    for (let i = 0; i < 32; i++) {
      const v = clamp255(channels32[i] ?? 0);
      if (v > 0) scheduleSetCanal(plaqueId, i, v); // only schedule non-zero
    }
  }
}

function sendRgbToHardware(rgb: { r: number; g: number; b: number }, intensity100: number, plateIds: number[]) {
  const channels32 = rgbToChannels32(rgb, intensity100);
  sendChannelsToHardware(channels32, plateIds);
}

function getPlateIdsFromIndexes(indexes: number[]): number[] {
  return indexes.map((i) => PLATE_ID_BY_INDEX[i] ?? 1).filter(Boolean);
}

export default function EditeurPage() {
  const [isTeacher, setIsTeacher] = useState<boolean | null>(null);
  const [dbLoading, setDbLoading] = useState<boolean>(false);
  const [dirty, setDirty] = useState<boolean>(false);

  // Nouveaux états pour l'interface améliorée
  const [modal, setModal] = useState<ModalState>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [showGameOverlay, setShowGameOverlay] = useState(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [visualComponents, setVisualComponents] = useState<VisualComponent[]>([]);
  const [selectedVisualComponent, setSelectedVisualComponent] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [newProjectTemplate, setNewProjectTemplate] = useState<'blank' | 'tutorial' | 'animation' | 'interactive' | 'fluorescence' | 'color-demo' | 'pulse-advanced' | 'rainbow' | 'tetris' | 'memory'>('blank');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = window.localStorage.getItem('crg_user_type') ?? '';
    setIsTeacher(t === 'enseignant');
  }, []);

  const [status, setStatus] = useState<string>('');
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null);
  const tetrisSnapRef = useRef<TetrisSnapshot | null>(null);

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

  const [editor, setEditor] = useState<EditorSnapshot>(() => ({ games: [], activeGameId: null, selectedNodeId: null }));
  const [history, setHistory] = useState<{ past: EditorSnapshot[]; future: EditorSnapshot[] }>({ past: [], future: [] });

  const editorRef = useRef<EditorSnapshot>(editor);
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const games = editor.games;
  const activeGameId = editor.activeGameId ?? null;
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


  const activeTetrisNode = useMemo(() => {
    if (!activeGame) return null;
    return activeGame.nodes.find((n) => n.kind === 'game_tetris' && n.enabled) ?? null;
  }, [activeGame]);

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
        // Prevent deletion of event_begin nodes
        const game = editor.games.find((g) => g.id === editor.activeGameId);
        const targetNode = game?.nodes.find((n) => n.id === nodeId);
        if (targetNode?.kind === 'event_begin') {
          setStatus('⛔ Impossible de supprimer l\'évènement de départ');
          return;
        }
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

  // Send tile changes to hardware (same logic as /jeux)
  useEffect(() => {
    if (!activeGame) return;
    if (!isPlaying) return;

    // Send each tile's color/intensity to hardware
    tiles.forEach((tile, index) => {
      const plateId = PLATE_ID_BY_INDEX[index];
      if (!plateId) return;

      const rgb = hexToRgb255(tile.color);
      const intensity100 = Math.round(tile.intensity * 100);

      // Only send if intensity > 0, otherwise black out
      if (tile.intensity > 0) {
        sendRgbToHardware(rgb, intensity100, [plateId]);
      } else {
        // Send black to turn off
        sendRgbToHardware({ r: 0, g: 0, b: 0 }, 0, [plateId]);
      }
    });
  }, [tiles, activeGame, isPlaying]);

  // PREVIEW MODE: Show selected node color on ALL plates in real-time when editing
  useEffect(() => {
    if (!activeGame || isPlaying) return;
    if (!editor.selectedNodeId) return;

    const selectedNode = activeGame.nodes.find((n) => n.id === editor.selectedNodeId);
    if (!selectedNode || !selectedNode.enabled) return;

    // Extract color and intensity from render nodes
    let previewColor: string | null = null;
    let previewIntensity = 0.8;

    if (selectedNode.kind === 'fill') {
      previewColor = getColor(selectedNode.params, 'color', '#6d28ff');
      previewIntensity = clamp01(getNum(selectedNode.params, 'intensity', 0.8));
    } else if (selectedNode.kind === 'pulse') {
      // ANIMATED pulse preview using live t
      const legacyColor = getColor(selectedNode.params, 'color', '#ff2aa6');
      const baseColor = getColor(selectedNode.params, 'baseColor', legacyColor);
      const targetColor = getColor(selectedNode.params, 'targetColor', legacyColor);
      
      const legacyBase = clamp01(getNum(selectedNode.params, 'base', 0.15));
      const legacyAmp = clamp01(getNum(selectedNode.params, 'amp', 0.75));
      const fromIntensity = clamp01(getNum(selectedNode.params, 'fromIntensity', legacyBase));
      const toIntensity = clamp01(getNum(selectedNode.params, 'toIntensity', clamp01(legacyBase + legacyAmp)));
      
      const speed = Math.max(0.01, getNum(selectedNode.params, 'speed', 0.9));
      const phase = getNum(selectedNode.params, 'phase', 0);
      const t01 = clamp01(0.5 + 0.5 * Math.sin(t * speed * 2 * Math.PI + phase));
      
      previewColor = lerpColor(baseColor, targetColor, t01);
      previewIntensity = clamp01(lerp(fromIntensity, toIntensity, t01));
    } else if (selectedNode.kind === 'tile') {
      previewColor = getColor(selectedNode.params, 'color', '#ff2aa6');
      previewIntensity = clamp01(getNum(selectedNode.params, 'intensity', 0.85));
    }

    if (!previewColor) return;

    // Send to all plates
    const rgb = hexToRgb255(previewColor);
    const intensity100 = Math.round(previewIntensity * 100);
    const allPlateIds = PLATE_ID_BY_INDEX.filter(Boolean);
    sendRgbToHardware(rgb, intensity100, allPlateIds);
  }, [activeGame, editor.selectedNodeId, isPlaying, t]);

  // Map Tetris grid to hardware tiles — throttled to 500ms interval (not every frame)
  useEffect(() => {
    if (!activeTetrisNode || !isPlaying) return;

    function syncTetrisToHardware() {
      const snap = tetrisSnapRef.current;
      if (!snap) return;
      const { grid, piece } = snap;
      if (!grid || grid.length === 0) return;

      const GRID_ROWS = grid.length;
      const GRID_COLS = grid[0]?.length ?? 6;

      // Merge current piece onto grid copy
      const merged: (string | null)[][] = grid.map(row => [...row]);
      if (piece) {
        const { shape, x: px, y: py, color: pColor } = piece;
        for (let r = 0; r < shape.length; r++) {
          for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c]) {
              const gr = py + r;
              const gc = px + c;
              if (gr >= 0 && gr < GRID_ROWS && gc >= 0 && gc < GRID_COLS) {
                merged[gr][gc] = pColor;
              }
            }
          }
        }
      }

      const TOTAL_PLATES = 42;
      const HW_COLS = 6;
      const HW_ROWS = 7;

      // 1:1 mapping: show bottom 7 rows of Tetris grid on the 7 hardware rows
      const gridOffset = Math.max(0, GRID_ROWS - HW_ROWS);

      for (let hr = 0; hr < HW_ROWS; hr++) {
        const gridRow = gridOffset + hr;
        for (let hc = 0; hc < HW_COLS; hc++) {
          const tileIdx = hr * HW_COLS + hc;
          if (tileIdx >= TOTAL_PLATES) continue;
          const plateId = PLATE_ID_BY_INDEX[tileIdx];
          if (!plateId) continue;

          const cellColor = merged[gridRow]?.[hc] ?? null;

          if (cellColor) {
            const rgb = hexToRgb255(cellColor);
            sendRgbToHardware(rgb, 90, [plateId]);
          } else {
            sendRgbToHardware({ r: 0, g: 0, b: 0 }, 0, [plateId]);
          }
        }
      }
    }

    syncTetrisToHardware(); // initial sync
    const iv = setInterval(syncTetrisToHardware, 500); // poll every 500ms
    return () => clearInterval(iv);
  }, [activeTetrisNode, isPlaying]);

  const tileCount = tiles.length;

  useEffect(() => {
    if (typeof selectedTileIndex !== 'number') return;
    if (selectedTileIndex < 0 || selectedTileIndex >= tileCount) {
      setSelectedTileIndex(null);
    }
  }, [selectedTileIndex, tileCount]);

  const serializeGameConfig = (g: GameDoc): unknown => {
    return {
      version: 1,
      tileCount: g.tileCount ?? tiles.length,
      icon: g.icon,
      difficulty: g.difficulty,
      description: g.description,
      bgColor: g.bgColor,
      accentColor: g.accentColor,
      nodes: g.nodes,
      edges: g.edges,
    };
  };

  const parseGameConfig = (config: unknown): {
    tileCount?: number;
    icon?: GameIconName;
    difficulty?: GameDifficulty;
    description?: string;
    bgColor?: string;
    accentColor?: string;
    nodes: EditorNode[];
    edges: GraphEdge[];
  } | null => {
    if (!config || typeof config !== 'object') return null;
    const o = config as any;
    const tileCount = typeof o.tileCount === 'number' && Number.isFinite(o.tileCount) ? o.tileCount : undefined;
    const nodes = Array.isArray(o.nodes) ? (o.nodes as EditorNode[]) : null;
    const edges = Array.isArray(o.edges) ? (o.edges as GraphEdge[]) : null;
    if (!nodes || !edges) return null;
    const icon = typeof o.icon === 'string' ? (o.icon as GameIconName) : undefined;
    const difficulty = [1,2,3,4,5].includes(Number(o.difficulty)) ? (Number(o.difficulty) as GameDifficulty) : undefined;
    const description = typeof o.description === 'string' ? o.description : undefined;
    const bgColor = typeof o.bgColor === 'string' ? o.bgColor : undefined;
    const accentColor = typeof o.accentColor === 'string' ? o.accentColor : undefined;
    return { tileCount, icon, difficulty, description, bgColor, accentColor, nodes, edges };
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

  const createGame = async (forcedName?: string, template: 'blank' | 'tutorial' | 'animation' | 'interactive' | 'fluorescence' | 'color-demo' | 'pulse-advanced' | 'rainbow' | 'tetris' | 'memory' = 'blank') => {
    const makeId: IdFactory = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const provisionalId = makeId();
    const nextIndex = (editorRef.current.games.length || 0) + 1;
    const gameName = forcedName && forcedName.trim().length > 0 ? forcedName.trim() : `Jeu${nextIndex}`;
    
    // Créer les nœuds et connexions selon le template
    let initialNodes: EditorNode[] = [];
    let initialEdges: GraphEdge[] = [];
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
      initialEdges = [{ id: makeId(), from: eventId, to: fillId }];
    } else if (template === 'animation') {
      const pulseId = makeId();
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 80 } },
        { id: pulseId, kind: 'pulse', name: 'Pulsation', enabled: true, params: { baseColor: '#ff2aa6', targetColor: '#00d7ff', fromIntensity: 0.1, toIntensity: 0.8, speed: 1.0, phase: 0 }, pos: { x: 400, y: 80 } },
      ];
      initialEdges = [{ id: makeId(), from: eventId, to: pulseId }];
    } else if (template === 'interactive') {
      const tileId = makeId();
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 80 } },
        { id: tileId, kind: 'tile', name: 'Dalle centrale', enabled: true, params: { tileIndex: 4, color: '#ff2aa6', intensity: 0.9 }, pos: { x: 400, y: 80 } },
      ];
      initialEdges = [{ id: makeId(), from: eventId, to: tileId }];
    } else if (template === 'fluorescence') {
      const fill1 = makeId();
      const wait1 = makeId();
      const fill2 = makeId();
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 80 } },
        { id: fill1, kind: 'fill', name: 'UV Activation', enabled: true, params: { color: '#8b00ff', intensity: 0.3, mask: 'all', seconds: 1 }, pos: { x: 400, y: 80 } },
        { id: wait1, kind: 'wait', name: 'Pause', enabled: true, params: { seconds: 2 }, pos: { x: 400, y: 200 } },
        { id: fill2, kind: 'fill', name: 'Fluorescence', enabled: true, params: { color: '#00ff88', intensity: 0.8, mask: 'all', seconds: 3 }, pos: { x: 400, y: 320 } },
      ];
      initialEdges = [
        { id: makeId(), from: eventId, to: fill1 },
        { id: makeId(), from: fill1, to: wait1 },
        { id: makeId(), from: wait1, to: fill2 },
      ];
    } else if (template === 'color-demo') {
      const tile1 = makeId();
      const tile2 = makeId();
      const tile3 = makeId();
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 80 } },
        { id: tile1, kind: 'tile', name: 'Rouge', enabled: true, params: { tileIndex: 0, color: '#ff0000', intensity: 0.8 }, pos: { x: 400, y: 50 } },
        { id: tile2, kind: 'tile', name: 'Vert', enabled: true, params: { tileIndex: 1, color: '#00ff00', intensity: 0.8 }, pos: { x: 400, y: 170 } },
        { id: tile3, kind: 'tile', name: 'Bleu', enabled: true, params: { tileIndex: 2, color: '#0000ff', intensity: 0.8 }, pos: { x: 400, y: 290 } },
      ];
      initialEdges = [
        { id: makeId(), from: eventId, to: tile1 },
        { id: makeId(), from: eventId, to: tile2 },
        { id: makeId(), from: eventId, to: tile3 },
      ];
    } else if (template === 'pulse-advanced') {
      const pulse1 = makeId();
      const wait1 = makeId();
      const pulse2 = makeId();
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 80 } },
        { id: pulse1, kind: 'pulse', name: 'Pulsation chaude', enabled: true, params: { baseColor: '#ff6b00', targetColor: '#ffeb00', fromIntensity: 0.2, toIntensity: 0.9, speed: 0.8, phase: 0 }, pos: { x: 400, y: 80 } },
        { id: wait1, kind: 'wait', name: 'Transition', enabled: true, params: { seconds: 3 }, pos: { x: 400, y: 200 } },
        { id: pulse2, kind: 'pulse', name: 'Pulsation froide', enabled: true, params: { baseColor: '#00d4ff', targetColor: '#b829dd', fromIntensity: 0.2, toIntensity: 0.9, speed: 1.2, phase: 0 }, pos: { x: 400, y: 320 } },
      ];
      initialEdges = [
        { id: makeId(), from: eventId, to: pulse1 },
        { id: makeId(), from: pulse1, to: wait1 },
        { id: makeId(), from: wait1, to: pulse2 },
      ];
    } else if (template === 'rainbow') {
      const fill1 = makeId();
      const fill2 = makeId();
      const fill3 = makeId();
      const fill4 = makeId();
      const fill5 = makeId();
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 80 } },
        { id: fill1, kind: 'fill', name: 'Rouge', enabled: true, params: { color: '#ff0000', intensity: 0.7, mask: 'all', seconds: 0.8 }, pos: { x: 400, y: 40 } },
        { id: fill2, kind: 'fill', name: 'Jaune', enabled: true, params: { color: '#ffff00', intensity: 0.7, mask: 'all', seconds: 0.8 }, pos: { x: 400, y: 140 } },
        { id: fill3, kind: 'fill', name: 'Vert', enabled: true, params: { color: '#00ff00', intensity: 0.7, mask: 'all', seconds: 0.8 }, pos: { x: 400, y: 240 } },
        { id: fill4, kind: 'fill', name: 'Cyan', enabled: true, params: { color: '#00ffff', intensity: 0.7, mask: 'all', seconds: 0.8 }, pos: { x: 400, y: 340 } },
        { id: fill5, kind: 'fill', name: 'Bleu', enabled: true, params: { color: '#0000ff', intensity: 0.7, mask: 'all', seconds: 0.8 }, pos: { x: 400, y: 440 } },
      ];
      initialEdges = [
        { id: makeId(), from: eventId, to: fill1 },
        { id: makeId(), from: fill1, to: fill2 },
        { id: makeId(), from: fill2, to: fill3 },
        { id: makeId(), from: fill3, to: fill4 },
        { id: makeId(), from: fill4, to: fill5 },
      ];
    } else if (template === 'tetris') {
      // Jeu Tetris avec nœuds internes détaillés
      const tetrisMainId = makeId();
      const initGrid = makeId();
      const spawnPiece = makeId();
      const renderGrid = makeId();
      const gameLoop = makeId();
      const moveDown = makeId();
      const checkCollision = makeId();
      const mergePiece = makeId();
      const clearLines = makeId();
      const checkGameOver = makeId();
      const gameOverFill = makeId();
      const scorePulse = makeId();
      const waitTick = makeId();
      const bgFill = makeId();
      const borderTiles = makeId();
      
      // IDs pour les 4 pièces Tetris (exemples)
      const pieceI = makeId();
      const pieceL = makeId();
      const pieceT = makeId();
      const pieceSquare = makeId();
      const rotateCheck = makeId();
      const inputHandler = makeId();
      const timerEvent = makeId();
      
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 300 } },
        // Nœud principal du jeu (celui sur lequel on double-clique)
        { id: tetrisMainId, kind: 'game_tetris', name: 'Tetris Lumière', enabled: true, params: { speed: 500, bgColor: '#0a0a0f', borderColor: '#222233' }, pos: { x: 300, y: 300 } },
        
        // Nœuds internes visibles quand on double-clique
        { id: bgFill, kind: 'fill', name: 'Fond noir', enabled: true, params: { color: '#0a0a0f', intensity: 1, mask: 'all', seconds: 0 }, pos: { x: 520, y: 80 } },
        { id: borderTiles, kind: 'tile', name: 'Bordure', enabled: true, params: { tileIndex: 21, color: '#444466', intensity: 0.5 }, pos: { x: 740, y: 80 } },
        { id: initGrid, kind: 'sequence', name: 'Init Grille', enabled: true, params: {}, pos: { x: 520, y: 180 } },
        { id: gameLoop, kind: 'while', name: 'Boucle Jeu', enabled: true, params: {}, pos: { x: 520, y: 280 } },
        { id: spawnPiece, kind: 'random_01', name: 'Nouvelle Pièce', enabled: true, params: {}, pos: { x: 740, y: 180 } },
        { id: pieceI, kind: 'tile', name: 'Pièce I (cyan)', enabled: true, params: { tileIndex: 10, color: '#00ffff', intensity: 0.9 }, pos: { x: 960, y: 80 } },
        { id: pieceL, kind: 'tile', name: 'Pièce L (orange)', enabled: true, params: { tileIndex: 11, color: '#ffaa00', intensity: 0.9 }, pos: { x: 960, y: 160 } },
        { id: pieceT, kind: 'tile', name: 'Pièce T (violet)', enabled: true, params: { tileIndex: 12, color: '#aa00ff', intensity: 0.9 }, pos: { x: 960, y: 240 } },
        { id: pieceSquare, kind: 'tile', name: 'Pièce O (jaune)', enabled: true, params: { tileIndex: 13, color: '#ffff00', intensity: 0.9 }, pos: { x: 960, y: 320 } },
        { id: moveDown, kind: 'math_add', name: 'Descendre', enabled: true, params: {}, pos: { x: 740, y: 280 } },
        { id: checkCollision, kind: 'compare_eq', name: 'Collision?', enabled: true, params: {}, pos: { x: 740, y: 360 } },
        { id: mergePiece, kind: 'sequence', name: 'Fusionner', enabled: true, params: {}, pos: { x: 960, y: 400 } },
        { id: clearLines, kind: 'pulse', name: 'Ligne complète', enabled: true, params: { baseColor: '#ffffff', targetColor: '#00ff00', fromIntensity: 0.5, toIntensity: 1, speed: 3 }, pos: { x: 1180, y: 400 } },
        { id: renderGrid, kind: 'fill', name: 'Rafraîchir', enabled: true, params: { color: '#0a0a0f', intensity: 0.1, mask: 'all', seconds: 0.05 }, pos: { x: 520, y: 480 } },
        { id: waitTick, kind: 'wait', name: 'Attente tick', enabled: true, params: { seconds: 0.5 }, pos: { x: 520, y: 560 } },
        { id: checkGameOver, kind: 'compare_gt', name: 'Game Over?', enabled: true, params: {}, pos: { x: 740, y: 560 } },
        { id: gameOverFill, kind: 'fill', name: 'Game Over Rouge', enabled: true, params: { color: '#ff0000', intensity: 0.8, mask: 'all', seconds: 2 }, pos: { x: 960, y: 560 } },
        { id: scorePulse, kind: 'pulse', name: 'Pulse Score', enabled: true, params: { baseColor: '#00ff88', targetColor: '#88ffaa', fromIntensity: 0.3, toIntensity: 0.9, speed: 4 }, pos: { x: 1180, y: 280 } },
        { id: rotateCheck, kind: 'logic_and', name: 'Rotation OK?', enabled: true, params: {}, pos: { x: 1180, y: 200 } },
        { id: inputHandler, kind: 'on_click', name: 'Input Joueur', enabled: true, params: { target: 'any' }, pos: { x: 1400, y: 300 } },
        { id: timerEvent, kind: 'on_timer', name: 'Timer Jeu', enabled: true, params: { interval: 500 }, pos: { x: 1400, y: 380 } },
      ];
      initialEdges = [
        { id: makeId(), from: eventId, to: tetrisMainId },
        // Flux principal du jeu (ces nœuds sont "internes" au jeu)
        { id: makeId(), from: tetrisMainId, to: bgFill },
        { id: makeId(), from: bgFill, to: borderTiles },
        { id: makeId(), from: borderTiles, to: initGrid },
        { id: makeId(), from: initGrid, to: gameLoop },
        { id: makeId(), from: gameLoop, to: spawnPiece },
        { id: makeId(), from: spawnPiece, to: pieceI },
        { id: makeId(), from: spawnPiece, to: pieceL },
        { id: makeId(), from: spawnPiece, to: pieceT },
        { id: makeId(), from: spawnPiece, to: pieceSquare },
        { id: makeId(), from: pieceI, to: moveDown },
        { id: makeId(), from: pieceL, to: moveDown },
        { id: makeId(), from: pieceT, to: moveDown },
        { id: makeId(), from: pieceSquare, to: moveDown },
        { id: makeId(), from: moveDown, to: checkCollision },
        { id: makeId(), from: checkCollision, to: mergePiece },
        { id: makeId(), from: mergePiece, to: clearLines },
        { id: makeId(), from: clearLines, to: renderGrid },
        { id: makeId(), from: renderGrid, to: waitTick },
        { id: makeId(), from: waitTick, to: checkGameOver },
        { id: makeId(), from: checkGameOver, to: gameLoop },
        { id: makeId(), from: checkGameOver, to: gameOverFill },
        // Bonus score
        { id: makeId(), from: clearLines, to: scorePulse },
        // Input et rotation
        { id: makeId(), from: inputHandler, to: rotateCheck },
        { id: makeId(), from: timerEvent, to: moveDown },
      ];
    } else if (template === 'memory') {
      // Jeu de mémoire type Simon
      const seqStart = makeId();
      const tile1 = makeId();
      const tile2 = makeId();
      const tile3 = makeId();
      const tile4 = makeId();
      const wait1 = makeId();
      const wait2 = makeId();
      const wait3 = makeId();
      const wait4 = makeId();
      const pulse1 = makeId();
      const pulse2 = makeId();
      const pulse3 = makeId();
      const pulse4 = makeId();
      
      initialNodes = [
        { id: eventId, kind: 'event_begin', name: 'Démarrer', enabled: true, params: {}, pos: { x: 80, y: 200 } },
        // Séquence de démarrage
        { id: seqStart, kind: 'sequence', name: 'Séquence', enabled: true, params: {}, pos: { x: 300, y: 200 } },
        // Attentes entre les flashs
        { id: wait1, kind: 'wait', name: 'Pause 0.5s', enabled: true, params: { seconds: 0.5 }, pos: { x: 520, y: 50 } },
        { id: wait2, kind: 'wait', name: 'Pause 0.5s', enabled: true, params: { seconds: 0.5 }, pos: { x: 520, y: 150 } },
        { id: wait3, kind: 'wait', name: 'Pause 0.5s', enabled: true, params: { seconds: 0.5 }, pos: { x: 520, y: 250 } },
        { id: wait4, kind: 'wait', name: 'Pause 0.5s', enabled: true, params: { seconds: 0.5 }, pos: { x: 520, y: 350 } },
        // Dalles à mémoriser (coins)
        { id: tile1, kind: 'tile', name: 'Coin HG', enabled: true, params: { tileIndex: 0, color: '#ff0000', intensity: 0.9 }, pos: { x: 740, y: 50 } },
        { id: tile2, kind: 'tile', name: 'Coin HD', enabled: true, params: { tileIndex: 5, color: '#00ff00', intensity: 0.9 }, pos: { x: 740, y: 150 } },
        { id: tile3, kind: 'tile', name: 'Coin BG', enabled: true, params: { tileIndex: 36, color: '#0000ff', intensity: 0.9 }, pos: { x: 740, y: 250 } },
        { id: tile4, kind: 'tile', name: 'Coin BD', enabled: true, params: { tileIndex: 41, color: '#ffff00', intensity: 0.9 }, pos: { x: 740, y: 350 } },
        // Pulsations pour l'effet visuel
        { id: pulse1, kind: 'pulse', name: 'Pulse R', enabled: true, params: { baseColor: '#ff0000', targetColor: '#ff6666', fromIntensity: 0.3, toIntensity: 1, speed: 2, phase: 0 }, pos: { x: 960, y: 50 } },
        { id: pulse2, kind: 'pulse', name: 'Pulse V', enabled: true, params: { baseColor: '#00ff00', targetColor: '#66ff66', fromIntensity: 0.3, toIntensity: 1, speed: 2, phase: 0 }, pos: { x: 960, y: 150 } },
        { id: pulse3, kind: 'pulse', name: 'Pulse B', enabled: true, params: { baseColor: '#0000ff', targetColor: '#6666ff', fromIntensity: 0.3, toIntensity: 1, speed: 2, phase: 0 }, pos: { x: 960, y: 250 } },
        { id: pulse4, kind: 'pulse', name: 'Pulse J', enabled: true, params: { baseColor: '#ffff00', targetColor: '#ffff66', fromIntensity: 0.3, toIntensity: 1, speed: 2, phase: 0 }, pos: { x: 960, y: 350 } },
      ];
      initialEdges = [
        { id: makeId(), from: eventId, to: seqStart },
        // Séquence: R -> pause -> V -> pause -> B -> pause -> J
        { id: makeId(), from: seqStart, to: tile1 },
        { id: makeId(), from: tile1, to: wait1 },
        { id: makeId(), from: wait1, to: tile2 },
        { id: makeId(), from: tile2, to: wait2 },
        { id: makeId(), from: wait2, to: tile3 },
        { id: makeId(), from: tile3, to: wait3 },
        { id: makeId(), from: wait3, to: tile4 },
        // Pulsations liées aux dalles
        { id: makeId(), from: tile1, to: pulse1 },
        { id: makeId(), from: tile2, to: pulse2 },
        { id: makeId(), from: tile3, to: pulse3 },
        { id: makeId(), from: tile4, to: pulse4 },
      ];
    }
    
    const provisionalGame: GameDoc = {
      id: provisionalId,
      name: gameName,
      tileCount: 42,
      nodes: initialNodes,
      edges: initialEdges,
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
              icon: cfg.icon,
              difficulty: cfg.difficulty,
              description: cfg.description,
              bgColor: cfg.bgColor,
              accentColor: cfg.accentColor,
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

        // Create default games if none exist
        await createGame('Simon', 'memory');
        await createGame('Tetris', 'tetris');
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
    setStatus('Sauvegardé ✓');
  };

  // Auto-save every 3 seconds when dirty
  useEffect(() => {
    if (!dirty || !activeGame) return;
    const timer = setTimeout(() => {
      void saveDbGame(activeGame).then((ok) => {
        if (ok) {
          setDirty(false);
          setStatus('Auto-sauvegardé ✓');
        }
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, [dirty, activeGame]);

  const deleteActiveGame = async () => {
    if (!activeGame) return;
    const deletedId = activeGame.id;
    const ok = await deleteDbGame(deletedId);
    if (!ok) {
      setStatus('Suppression impossible');
      return;
    }
    // Use setEditor directly (not commit) to avoid setting dirty=true on a deleted game
    setEditor((cur) => {
      const nextGames = cur.games.filter((g) => g.id !== deletedId);
      const nextActive = nextGames[0] ?? null;
      return {
        games: nextGames,
        activeGameId: nextActive?.id ?? null,
        selectedNodeId: nextActive?.nodes[0]?.id ?? null,
        expandedGameNodeId: undefined,
        visibleNodeIds: undefined,
      };
    });
    setHistory({ past: [], future: [] });
    setDirty(false);
    setStatus('Jeu supprimé ✓');
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

  const removeNodeById = (nodeId: string) => {
    commit((cur) => {
      const nextGames = cur.games.map((g) => {
        if (g.id !== cur.activeGameId) return g;
        return {
          ...g,
          nodes: g.nodes.filter((nd) => nd.id !== nodeId),
          edges: g.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
        };
      });
      const nextSelectedId = cur.selectedNodeId === nodeId ? null : cur.selectedNodeId;
      return { ...cur, games: nextGames, selectedNodeId: nextSelectedId };
    });
    setStatus('Nœud supprimé');
  };

  const renameActiveGame = (name: string) => {
    if (!activeGameId) return;
    commit((cur) => ({
      ...cur,
      games: cur.games.map((g) => (g.id === cur.activeGameId ? { ...g, name } : g)),
    }));
  };

  const updateActiveGameMeta = (patch: Partial<Pick<GameDoc, 'icon' | 'difficulty' | 'description' | 'bgColor' | 'accentColor' | 'tileCount'>>) => {
    if (!activeGameId) return;
    commit((cur) => ({
      ...cur,
      games: cur.games.map((g) => (g.id === cur.activeGameId ? { ...g, ...patch } : g)),
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
      <main className="editeur stage">
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
      <main className="editeur stage" style={{ display: 'grid', placeItems: 'center' }}>
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
    <main className="editeur stage">
      <div className="ue">
        <aside className="ue__left" style={{ borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="panelhead" style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Gamepad2 size={16} color="#1a1a1a" />
                <strong style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.02em', color: '#1a1a1a' }}>Explorateur</strong>
              </div>
              <Lightbulb size={14} style={{ color: '#4361ee' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Jeux</span>
            </div>

            <div className="panelbody">
              <div className="panelsection">
                <div className="panelsection__head">
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button 
                      className="g-btn g-btn--sm" 
                      disabled={!activeGame || dbLoading} 
                      onClick={() => void saveActiveGame()}
                      title="Sauvegarder"
                    >
                      <Save size={14} />
                      <span>{dirty ? <X size={10} /> : <Check size={10} />}</span>
                    </button>
                    <button 
                      className="g-btn g-btn--sm g-btn--danger" 
                      disabled={!activeGame || dbLoading} 
                      onClick={() => activeGame && setModal({ type: 'confirm-delete', gameId: activeGame.id, gameName: activeGame.name })}
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button 
                      className="g-btn g-btn--sm g-btn--accent" 
                      disabled={dbLoading} 
                      onClick={() => setModal({ type: 'create-project' })}
                    >
                      <FolderPlus size={14} />
                      <span>{dbLoading ? '...' : 'Nouveau'}</span>
                    </button>
                  </div>
                </div>

                <div className="list panelsection__list">
                  {games.map((g) => {
                    const GIcon = GAME_ICON_MAP[g.icon ?? 'Lightbulb'] ?? Lightbulb;
                    return (
                      <button
                        key={g.id}
                        className={g.id === activeGameId ? 'list__item list__item--active' : 'list__item'}
                        onClick={() => {
                          commit((cur) => ({ ...cur, activeGameId: g.id, selectedNodeId: g.nodes[0]?.id ?? null }));
                          setStatus('Jeu sélectionné');
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                      >
                        <GIcon size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
                        <span className="list__title" style={{ flex: 1 }}>{g.name}</span>
                        <span className="list__meta">{g.nodes.length} noeuds · {g.tileCount ?? 42}d</span>
                      </button>
                    );
                  })}
                </div>

                {activeGame ? (
                  <div className="g-card" style={{ marginTop: 12, padding: 14, borderRadius: 14, display: 'grid', gap: 12 }}>
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span className="g-label">Nom du projet</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          className="g-input"
                          value={activeGame.name}
                          onChange={(e) => renameActiveGame(e.target.value)}
                          onBlur={() => void saveActiveGame()}
                          style={{ flex: 1, height: 36, fontSize: 13 }}
                        />
                        <button 
                          className="g-btn g-btn--sm g-btn--icon"
                          onClick={() => void saveActiveGame()}
                          title="Sauvegarder"
                          style={{ width: 36, height: 36 }}
                        >
                          <Save size={14} />
                        </button>
                      </div>
                    </label>

                    <label style={{ display: 'grid', gap: 6 }}>
                      <span className="g-label">Description</span>
                      <input
                        className="g-input"
                        value={activeGame.description ?? ''}
                        onChange={(e) => updateActiveGameMeta({ description: e.target.value })}
                        onBlur={() => void saveActiveGame()}
                        placeholder="Description courte du jeu..."
                        style={{ height: 36, fontSize: 13 }}
                      />
                    </label>

                    <div>
                      <span className="g-label" style={{ display: 'block', marginBottom: 6 }}>Icône du jeu</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {GAME_ICON_NAMES.map((iconName) => {
                          const IconComp = GAME_ICON_MAP[iconName];
                          const isActive = (activeGame.icon ?? 'Lightbulb') === iconName;
                          return (
                            <button
                              key={iconName}
                              onClick={() => { updateActiveGameMeta({ icon: iconName }); void saveActiveGame(); }}
                              title={iconName}
                              style={{
                                width: 34, height: 34, borderRadius: 8, border: isActive ? '2px solid #4361ee' : '1px solid rgba(0,0,0,0.08)',
                                background: isActive ? 'rgba(67,97,238,0.08)' : '#fff', display: 'grid', placeItems: 'center',
                                cursor: 'pointer', transition: 'all 0.15s',
                              }}
                            >
                              <IconComp size={16} color={isActive ? '#4361ee' : '#888'} />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="g-label" style={{ display: 'block', marginBottom: 6 }}>Difficulté</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {([1, 2, 3, 4, 5] as GameDifficulty[]).map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() => { updateActiveGameMeta({ difficulty: lvl }); void saveActiveGame(); }}
                            style={{
                              width: 32, height: 32, borderRadius: 8, border: 'none', background: 'none',
                              cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center',
                              transition: 'transform 0.12s',
                            }}
                            title={`Difficulté ${lvl}`}
                          >
                            <Star size={18} fill={lvl <= (activeGame.difficulty ?? 1) ? '#fbbf24' : 'none'} color={lvl <= (activeGame.difficulty ?? 1) ? '#f59e0b' : '#ddd'} />
                          </button>
                        ))}
                        <span style={{ fontSize: 12, color: '#888', marginLeft: 6, alignSelf: 'center', fontWeight: 600 }}>
                          {activeGame.difficulty ?? 1}/5
                        </span>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span className="g-label">Dalles cibles</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{activeGame.tileCount ?? 42}</span>
                      </div>
                      <input
                        type="range" className="g-slider g-slider--accent" min={1} max={42} step={1}
                        value={activeGame.tileCount ?? 42}
                        onChange={(e) => updateActiveGameMeta({ tileCount: Number(e.target.value) })}
                        onMouseUp={() => void saveActiveGame()}
                        style={{ width: '100%', ['--pct' as any]: `${((activeGame.tileCount ?? 42) / 42) * 100}%` }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa', marginTop: 2 }}>
                        <span>1</span><span>21</span><span>42</span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label" style={{ fontSize: 11 }}>Fond du jeu</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="color"
                            value={activeGame.bgColor ?? '#0a0a0f'}
                            onChange={(e) => updateActiveGameMeta({ bgColor: e.target.value })}
                            onBlur={() => void saveActiveGame()}
                            style={{ width: 32, height: 32, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, cursor: 'pointer', padding: 2 }}
                          />
                          <span style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{activeGame.bgColor ?? '#0a0a0f'}</span>
                        </div>
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label" style={{ fontSize: 11 }}>Couleur accent</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="color"
                            value={activeGame.accentColor ?? '#4361ee'}
                            onChange={(e) => updateActiveGameMeta({ accentColor: e.target.value })}
                            onBlur={() => void saveActiveGame()}
                            style={{ width: 32, height: 32, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, cursor: 'pointer', padding: 2 }}
                          />
                          <span style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{activeGame.accentColor ?? '#4361ee'}</span>
                        </div>
                      </label>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2, fontSize: 11 }}>
                      <span className="g-badge" style={{ fontSize: 10 }}>{activeGame.nodes.length} nœuds</span>
                      <span className="g-badge" style={{ fontSize: 10, background: 'rgba(6,214,160,0.1)', color: '#06d6a0', borderColor: 'rgba(6,214,160,0.15)' }}>{activeGame.edges.length} connexions</span>
                      <span className="g-badge" style={{ fontSize: 10, background: 'rgba(255,165,0,0.1)', color: '#e88a1a', borderColor: 'rgba(255,165,0,0.15)' }}>{activeGame.tileCount ?? 42} dalles</span>
                    </div>

                    <p style={{ fontSize: 10, color: '#aaa', margin: '4px 0 0', lineHeight: 1.4 }}>
                      32 canaux LED par dalle · Couleurs selon COULEURS.md
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="divider" />

              <div className="panelsection">
                <div className="panelsection__head">
                  <div className="panelsection__title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Boxes size={14} style={{ color: '#06d6a0' }} />
                    <span>Nœuds</span>
                  </div>
                  <button
                    className="g-btn g-btn--sm g-btn--success"
                    disabled={!activeGameId}
                    onClick={() => {
                      const id = addNode('fill');
                      if (id) setStatus('Noeud ajouté');
                    }}
                  >
                    <Plus size={14} />
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
            <div className="ue__viewport" style={{ borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="panelhead" style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '14px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Eye size={16} color="#1a1a1a" />
                  <strong style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.02em', color: '#1a1a1a' }}>Aperçu</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    className="g-btn g-btn--sm"
                    onClick={() => setIsPlaying((p) => !p)}
                    title={isPlaying ? 'Pause envoi hardware' : 'Play envoi hardware'}
                    style={isPlaying ? { background: '#1a1a1a', color: '#fff', borderColor: '#1a1a1a' } : {}}
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    <span>{isPlaying ? 'ON' : 'OFF'}</span>
                  </button>
                  <button
                    className="g-btn g-btn--sm"
                    onClick={() => setShowGameOverlay(true)}
                    title="Ouvrir le visuel 2D du jeu"
                  >
                    <Maximize2 size={14} />
                    <span>2D</span>
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#999' }}>{tileCount} dalles</span>
                </div>
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
                    <div className="viewport__pane viewport__pane--ui" style={activeTetrisNode ? { flex: 2, minWidth: 0, overflow: 'auto' } : undefined}>
                      {activeTetrisNode ? (
                        <TetrisGame
                          params={{
                            speed: Math.max(50, getNum(activeTetrisNode.params, 'speed', 500)),
                            bgColor: getColor(activeTetrisNode.params, 'bgColor', '#0a0a0f'),
                            borderColor: getColor(activeTetrisNode.params, 'borderColor', '#222233'),
                          }}
                          isPlaying={isPlaying}
                          onSnapshot={(snap) => { tetrisSnapRef.current = snap; }}
                        />
                      ) : (
                        <div className="viewport-ui">
                          <div className="viewport-ui__card glass">
                            <div className="viewport-ui__title">Visuel du jeu</div>
                            <div className="viewport-ui__hint">
                              Ajoutez un noeud <b>Tetris Lumière</b> (catégorie Jeux) pour lancer un jeu interactif.
                              <br />
                              Clic droit dans le graphe → Jeux → Tetris Lumière
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bp-empty" style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                    <div style={{ display: 'grid', gap: 16, textAlign: 'center', maxWidth: 320 }}>
                      <Lightbulb size={48} style={{ opacity: 0.3, color: '#4361ee', margin: '0 auto' }} />
                      <div>
                        <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>Aucun projet</h3>
                        <p style={{ margin: 0, fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>
                          Créez votre premier jeu lumineux pour commencer à explorer l'éditeur visuel.
                        </p>
                      </div>
                      <button 
                        className="g-btn g-btn--accent" 
                        onClick={() => setModal({ type: 'create-project' })}
                        style={{ marginTop: 8, height: 48, padding: '0 24px', fontSize: 14 }}
                      >
                        <FolderPlus size={18} />
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
              <div className="panelhead" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <strong>Graphe</strong>
                <span className="panelhead__meta">MVP</span>
                {activeGame && (
                  <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.8 }}>
                    {activeGame.name}
                  </span>
                )}
                {editor.expandedGameNodeId && (
                  <button
                    className="btn btn--small"
                    onClick={() => {
                      commit((cur) => ({
                        ...cur,
                        expandedGameNodeId: undefined,
                        visibleNodeIds: undefined,
                      }));
                      setStatus('Vue complète');
                    }}
                    style={{ marginLeft: 8 }}
                  >
                    Afficher tout
                  </button>
                )}
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
                          <Gamepad2 size={48} style={{ opacity: 0.3, color: '#4361ee', marginBottom: 16 }} />
                          <p style={{ margin: '0 0 20px', fontSize: 14, opacity: 0.7 }}>Commencez par créer votre premier jeu</p>
                          <button 
                            className="g-btn g-btn--accent" 
                            onClick={() => setModal({ type: 'create-project' })}
                            style={{ height: 46, padding: '0 22px', fontSize: 14 }}
                          >
                            <FolderPlus size={18} />
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
                          {(() => {
                            const q = contextMenu.q.trim().toLowerCase();
                            const filtered = NODE_CATALOG.filter((n) => {
                              if (!q) return true;
                              return `${n.category} ${n.title} ${n.kind}`.toLowerCase().includes(q);
                            });
                            const categories = [...new Set(filtered.map((n) => n.category))];
                            return categories.map((cat) => {
                              const CatIcon = NODE_CATEGORY_ICONS[cat] ?? Boxes;
                              const catColor = NODE_CATEGORY_COLORS[cat] ?? '#999';
                              return (
                                <div key={cat}>
                                  <div className="bp-menu__cathead" style={{ borderLeft: `3px solid ${catColor}` }}>
                                    <CatIcon size={11} style={{ color: catColor, flexShrink: 0 }} />
                                    <span>{cat}</span>
                                  </div>
                                  {filtered.filter((n) => n.category === cat).map((n) => (
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
                                      <span className="bp-menu__title">{n.title}</span>
                                      <span className="bp-menu__meta" style={{ color: catColor, opacity: 0.7, fontSize: 11 }}>{n.kind.startsWith('cs150') ? 'CS150' : ''}</span>
                                    </button>
                                  ))}
                                </div>
                              );
                            });
                          })()}
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

                    {(activeGame?.nodes ?? [])
                      .filter((n) => {
                        // If we have visibleNodeIds (drill-down mode), only show those nodes
                        if (editor.visibleNodeIds && editor.visibleNodeIds.length > 0) {
                          return editor.visibleNodeIds.includes(n.id);
                        }
                        return true;
                      })
                      .map((n) => {
                      const selected = n.id === selectedNodeId;
                      const hasInput = n.kind !== 'event_begin' && n.kind !== 'on_timer' && n.kind !== 'on_click';
                      const inLabel = 'Entrée';
                      const outLabel =
                        n.kind === 'event_begin' ? 'Commencer' :
                        n.kind === 'game_tetris' || n.kind === 'game_simon' || n.kind === 'game_memory' ? 'Fin du jeu' :
                        n.kind === 'on_timer' ? 'Tick' :
                        n.kind === 'on_click' ? 'Click' :
                        n.kind === 'if' ? 'Alors' :
                        n.kind === 'sequence' ? 'Exécuter' :
                        'Sortie';
                      const nodeAccent =
                        ['event_begin', 'on_timer', 'on_click'].includes(n.kind) ? '#f59e0b' :
                        ['game_tetris', 'game_simon', 'game_memory'].includes(n.kind) ? '#a855f7' :
                        ['fill', 'pulse', 'tile', 'tile_set', 'tile_get'].includes(n.kind) ? '#22d3ee' :
                        ['if', 'while', 'sequence', 'wait'].includes(n.kind) ? '#f97316' :
                        ['math_add', 'math_sub', 'math_mul', 'math_div', 'math_clamp01', 'math_lerp'].includes(n.kind) ? '#4ade80' :
                        ['compare_eq', 'compare_gt', 'compare_lt', 'logic_and', 'logic_or', 'logic_not'].includes(n.kind) ? '#60a5fa' :
                        '#4361ee';
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
                          className={[
                            'bp-node',
                            selected ? 'bp-node--active' : '',
                            !n.enabled ? 'bp-node--disabled' : '',
                          ].filter(Boolean).join(' ')}
                          style={{ left: n.pos.x, top: n.pos.y }}
                          data-nodeid={n.id}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setContextMenu((p) => ({ ...p, open: false }));
                            commit((cur) => ({ ...cur, selectedNodeId: n.id }));
                            beginDrag();
                            setGraphDrag({ nodeId: n.id, x: e.clientX, y: e.clientY });
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            // Drill-down for game nodes - show/create connected internal nodes
                            if (n.kind === 'game_tetris' || n.kind === 'game_simon' || n.kind === 'game_memory') {
                              const activeGame = editor.games.find(g => g.id === editor.activeGameId);
                              if (!activeGame) return;
                              
                              // Find all nodes connected to this game node
                              const connectedNodeIds = new Set<string>();
                              connectedNodeIds.add(n.id);
                              
                              // Find nodes connected FROM this game node (outputs)
                              activeGame.edges.forEach(edge => {
                                if (edge.from === n.id) {
                                  connectedNodeIds.add(edge.to);
                                }
                              });
                              
                              // Find nodes connected TO this game node (inputs)
                              activeGame.edges.forEach(edge => {
                                if (edge.to === n.id) {
                                  connectedNodeIds.add(edge.from);
                                }
                              });
                              
                              // If no connected nodes found, create internal nodes dynamically
                              if (connectedNodeIds.size <= 1) {
                                // Create default internal nodes for this game
                                const makeId = () => Math.random().toString(36).slice(2);
                                const gameX = n.pos.x;
                                const gameY = n.pos.y;
                                
                                const internalNodes: EditorNode[] = [];
                                const internalEdges: GraphEdge[] = [];
                                
                                if (n.kind === 'game_tetris') {
                                  // ── Tetris: 4 colonnes × 4 lignes, espacement 360 × 240 ──
                                  const ids = Array(13).fill(0).map(() => makeId());
                                  const dx = 360, dy = 240;
                                  const sx = gameX + 60, sy = gameY - 100;
                                  internalNodes.push(
                                    // Ligne 0 — initialisation
                                    { id: ids[0],  kind: 'fill',       name: 'Fond Noir',       enabled: true, params: { color: '#000000', intensity: 1, mask: 'all', seconds: 0 },                                       pos: { x: sx,          y: sy          } },
                                    { id: ids[1],  kind: 'sequence',   name: 'Init Grille',     enabled: true, params: {},                                                                                                 pos: { x: sx + dx,     y: sy          } },
                                    { id: ids[2],  kind: 'while',      name: 'Boucle Jeu',      enabled: true, params: {},                                                                                                 pos: { x: sx + dx * 2, y: sy          } },
                                    { id: ids[3],  kind: 'random_01',  name: 'Nouvelle Pièce',  enabled: true, params: {},                                                                                                 pos: { x: sx + dx * 3, y: sy          } },
                                    // Ligne 1 — rendu des pièces
                                    { id: ids[4],  kind: 'tile',       name: 'Pièce I (cyan)',  enabled: true, params: { tileIndex: 0,  color: '#00ffff', intensity: 0.9 },                                               pos: { x: sx,          y: sy + dy     } },
                                    { id: ids[5],  kind: 'tile',       name: 'Pièce L (orange)',enabled: true, params: { tileIndex: 1,  color: '#ff7f00', intensity: 0.9 },                                               pos: { x: sx + dx,     y: sy + dy     } },
                                    { id: ids[6],  kind: 'tile',       name: 'Pièce T (violet)',enabled: true, params: { tileIndex: 2,  color: '#aa00ff', intensity: 0.9 },                                               pos: { x: sx + dx * 2, y: sy + dy     } },
                                    { id: ids[7],  kind: 'math_add',   name: 'Descendre',       enabled: true, params: {},                                                                                                 pos: { x: sx + dx * 3, y: sy + dy     } },
                                    // Ligne 2 — logique de collision
                                    { id: ids[8],  kind: 'wait',       name: 'Attente tick',    enabled: true, params: { seconds: 0.5 },                                                                                  pos: { x: sx,          y: sy + dy * 2 } },
                                    { id: ids[9],  kind: 'compare_eq', name: 'Collision ?',     enabled: true, params: {},                                                                                                 pos: { x: sx + dx,     y: sy + dy * 2 } },
                                    { id: ids[10], kind: 'sequence',   name: 'Fusionner',       enabled: true, params: {},                                                                                                 pos: { x: sx + dx * 2, y: sy + dy * 2 } },
                                    { id: ids[11], kind: 'compare_eq', name: 'Ligne complète',  enabled: true, params: {},                                                                                                 pos: { x: sx + dx * 3, y: sy + dy * 2 } },
                                    // Ligne 3 — score
                                    { id: ids[12], kind: 'pulse',      name: 'Score Flash',     enabled: true, params: { baseColor: '#00ff88', targetColor: '#88ffff', fromIntensity: 0.3, toIntensity: 1.0, speed: 6 }, pos: { x: sx + dx * 3, y: sy + dy * 3 } },
                                  );
                                  internalEdges.push(
                                    { id: makeId(), from: n.id,    to: ids[0]  }, // Tetris → Fond Noir
                                    { id: makeId(), from: ids[0],  to: ids[1]  }, // Fond Noir → Init Grille
                                    { id: makeId(), from: ids[1],  to: ids[2]  }, // Init Grille → Boucle Jeu
                                    { id: makeId(), from: ids[2],  to: ids[3]  }, // Boucle Jeu → Nouvelle Pièce
                                    { id: makeId(), from: ids[3],  to: ids[4]  }, // Nouvelle Pièce → Pièce I
                                    { id: makeId(), from: ids[3],  to: ids[5]  }, // Nouvelle Pièce → Pièce L
                                    { id: makeId(), from: ids[3],  to: ids[6]  }, // Nouvelle Pièce → Pièce T
                                    { id: makeId(), from: ids[2],  to: ids[7]  }, // Boucle Jeu → Descendre
                                    { id: makeId(), from: ids[2],  to: ids[8]  }, // Boucle Jeu → Attente tick
                                    { id: makeId(), from: ids[8],  to: ids[2]  }, // Attente tick ↩ Boucle Jeu
                                    { id: makeId(), from: ids[7],  to: ids[9]  }, // Descendre → Collision ?
                                    { id: makeId(), from: ids[9],  to: ids[10] }, // Collision ? → Fusionner
                                    { id: makeId(), from: ids[10], to: ids[11] }, // Fusionner → Ligne complète
                                    { id: makeId(), from: ids[11], to: ids[12] }, // Ligne complète → Score Flash
                                  );
                                } else if (n.kind === 'game_simon') {
                                  // ── Simon: 3 colonnes × 3 lignes, espacement 360 × 240 ──
                                  const ids = Array(9).fill(0).map(() => makeId());
                                  const dx = 360, dy = 240;
                                  const sx = gameX + 60, sy = gameY - 80;
                                  internalNodes.push(
                                    // Ligne 0 — init + séquence
                                    { id: ids[0], kind: 'fill',      name: 'Fond Noir',         enabled: true, params: { color: '#000000', intensity: 1, mask: 'all', seconds: 0 },                                                pos: { x: sx,          y: sy          } },
                                    { id: ids[1], kind: 'sequence',  name: 'Séquence Simon',    enabled: true, params: {},                                                                                                          pos: { x: sx + dx,     y: sy          } },
                                    { id: ids[2], kind: 'random_01', name: 'Couleur aléatoire', enabled: true, params: {},                                                                                                          pos: { x: sx + dx * 2, y: sy          } },
                                    // Ligne 1 — dalles couleurs
                                    { id: ids[3], kind: 'tile',      name: 'Dalle Rouge',       enabled: true, params: { tileIndex: 0, color: '#ff2020', intensity: 0.95 },                                                        pos: { x: sx,          y: sy + dy     } },
                                    { id: ids[4], kind: 'tile',      name: 'Dalle Bleue',       enabled: true, params: { tileIndex: 1, color: '#2040ff', intensity: 0.95 },                                                        pos: { x: sx + dx,     y: sy + dy     } },
                                    { id: ids[5], kind: 'tile',      name: 'Dalle Verte',       enabled: true, params: { tileIndex: 2, color: '#20cc20', intensity: 0.95 },                                                        pos: { x: sx + dx * 2, y: sy + dy     } },
                                    // Ligne 2 — contrôle + score
                                    { id: ids[6], kind: 'tile',      name: 'Dalle Jaune',       enabled: true, params: { tileIndex: 3, color: '#ffcc00', intensity: 0.95 },                                                        pos: { x: sx,          y: sy + dy * 2 } },
                                    { id: ids[7], kind: 'wait',      name: 'Attente joueur',    enabled: true, params: { seconds: 0.6 },                                                                                            pos: { x: sx + dx,     y: sy + dy * 2 } },
                                    { id: ids[8], kind: 'pulse',     name: 'Score Simon',       enabled: true, params: { baseColor: '#ffffff', targetColor: '#ffcc00', fromIntensity: 0.2, toIntensity: 1.0, speed: 4 },          pos: { x: sx + dx * 2, y: sy + dy * 2 } },
                                  );
                                  internalEdges.push(
                                    { id: makeId(), from: n.id,   to: ids[0] }, // Simon → Fond Noir
                                    { id: makeId(), from: ids[0], to: ids[1] }, // Fond Noir → Séquence Simon
                                    { id: makeId(), from: ids[1], to: ids[2] }, // Séquence Simon → Couleur aléatoire
                                    { id: makeId(), from: ids[2], to: ids[3] }, // Couleur → Dalle Rouge
                                    { id: makeId(), from: ids[2], to: ids[4] }, // Couleur → Dalle Bleue
                                    { id: makeId(), from: ids[2], to: ids[5] }, // Couleur → Dalle Verte
                                    { id: makeId(), from: ids[2], to: ids[6] }, // Couleur → Dalle Jaune
                                    { id: makeId(), from: ids[1], to: ids[7] }, // Séquence → Attente joueur
                                    { id: makeId(), from: ids[7], to: ids[1] }, // Attente ↩ Séquence (boucle)
                                    { id: makeId(), from: ids[1], to: ids[8] }, // Séquence → Score Simon
                                  );
                                } else if (n.kind === 'game_memory') {
                                  // ── Memory: 3 colonnes × 3 lignes, espacement 360 × 240 ──
                                  const ids = Array(9).fill(0).map(() => makeId());
                                  const dx = 360, dy = 240;
                                  const sx = gameX + 60, sy = gameY - 80;
                                  internalNodes.push(
                                    // Ligne 0 — init
                                    { id: ids[0], kind: 'fill',      name: 'Fond Noir',       enabled: true, params: { color: '#000000', intensity: 1, mask: 'all', seconds: 0 },                                                  pos: { x: sx,          y: sy          } },
                                    { id: ids[1], kind: 'sequence',  name: 'Init Mémoire',    enabled: true, params: {},                                                                                                            pos: { x: sx + dx,     y: sy          } },
                                    { id: ids[2], kind: 'random_01', name: 'Paire aléatoire', enabled: true, params: {},                                                                                                            pos: { x: sx + dx * 2, y: sy          } },
                                    // Ligne 1 — dalles révélées
                                    { id: ids[3], kind: 'tile',      name: 'Carte A',         enabled: true, params: { tileIndex: 0, color: '#ff4488', intensity: 0.95 },                                                          pos: { x: sx,          y: sy + dy     } },
                                    { id: ids[4], kind: 'tile',      name: 'Carte B',         enabled: true, params: { tileIndex: 1, color: '#44aaff', intensity: 0.95 },                                                          pos: { x: sx + dx,     y: sy + dy     } },
                                    { id: ids[5], kind: 'compare_eq',name: 'Paire trouvée ?', enabled: true, params: {},                                                                                                            pos: { x: sx + dx * 2, y: sy + dy     } },
                                    // Ligne 2 — résultat
                                    { id: ids[6], kind: 'fill',      name: 'Dos de carte',    enabled: true, params: { color: '#222244', intensity: 0.6, mask: 'all', seconds: 0.2 },                                              pos: { x: sx,          y: sy + dy * 2 } },
                                    { id: ids[7], kind: 'wait',      name: 'Pause retour',    enabled: true, params: { seconds: 0.8 },                                                                                              pos: { x: sx + dx,     y: sy + dy * 2 } },
                                    { id: ids[8], kind: 'pulse',     name: 'Match Flash',     enabled: true, params: { baseColor: '#ffaa00', targetColor: '#ffffff', fromIntensity: 0.4, toIntensity: 1.0, speed: 5 },             pos: { x: sx + dx * 2, y: sy + dy * 2 } },
                                  );
                                  internalEdges.push(
                                    { id: makeId(), from: n.id,   to: ids[0] }, // Memory → Fond Noir
                                    { id: makeId(), from: ids[0], to: ids[1] }, // Fond Noir → Init Mémoire
                                    { id: makeId(), from: ids[1], to: ids[2] }, // Init → Paire aléatoire
                                    { id: makeId(), from: ids[2], to: ids[3] }, // Paire → Carte A
                                    { id: makeId(), from: ids[2], to: ids[4] }, // Paire → Carte B
                                    { id: makeId(), from: ids[3], to: ids[5] }, // Carte A → Paire trouvée ?
                                    { id: makeId(), from: ids[4], to: ids[5] }, // Carte B → Paire trouvée ?
                                    { id: makeId(), from: ids[5], to: ids[8] }, // Paire trouvée → Match Flash
                                    { id: makeId(), from: ids[1], to: ids[6] }, // Init → Dos de carte
                                    { id: makeId(), from: ids[6], to: ids[7] }, // Dos de carte → Pause retour
                                    { id: makeId(), from: ids[7], to: ids[1] }, // Pause ↩ Init Mémoire (boucle)
                                  );
                                }
                                
                                // Add internal nodes and edges to the game
                                commit((cur) => {
                                  const gameIndex = cur.games.findIndex(g => g.id === cur.activeGameId);
                                  if (gameIndex === -1) return cur;
                                  const game = cur.games[gameIndex];
                                  const updatedGame = {
                                    ...game,
                                    nodes: [...game.nodes, ...internalNodes],
                                    edges: [...game.edges, ...internalEdges],
                                  };
                                  const newGames = [...cur.games];
                                  newGames[gameIndex] = updatedGame;
                                  
                                  // Add all new node IDs to visible set
                                  internalNodes.forEach(node => connectedNodeIds.add(node.id));
                                  
                                  return {
                                    ...cur,
                                    games: newGames,
                                    expandedGameNodeId: n.id,
                                    visibleNodeIds: Array.from(connectedNodeIds),
                                  };
                                });
                                setStatus(`Création et affichage des nœuds internes: ${n.name} (${internalNodes.length} nœuds)`);
                              } else {
                                // Find nodes connected to those connected nodes (2 levels deep)
                                const level1Nodes = Array.from(connectedNodeIds);
                                level1Nodes.forEach(nodeId => {
                                  if (nodeId === n.id) return;
                                  activeGame.edges.forEach(edge => {
                                    if (edge.from === nodeId) {
                                      connectedNodeIds.add(edge.to);
                                    }
                                    if (edge.to === nodeId) {
                                      connectedNodeIds.add(edge.from);
                                    }
                                  });
                                });
                                
                                // Store the expanded state and filtered nodes
                                commit((cur) => ({
                                  ...cur,
                                  selectedNodeId: n.id,
                                  expandedGameNodeId: n.id,
                                  visibleNodeIds: Array.from(connectedNodeIds),
                                }));
                                setStatus(`Nœuds internes de: ${n.name} (${connectedNodeIds.size} nœuds)`);
                              }
                            }
                          }}
                        >
                          <div className="bp-node__header" style={{
                            background: `linear-gradient(135deg, ${nodeAccent}20, ${nodeAccent}0a)`,
                            borderBottom: `2px solid ${nodeAccent}35`,
                          }}>
                            <div className="bp-node__header-left">
                              {(() => { const CatIcon = NODE_CATEGORY_ICONS[categoryOfKind(n.kind)] ?? Boxes; return <CatIcon size={13} style={{ color: nodeAccent, flexShrink: 0 }} />; })()}
                              <span className="bp-node__name">{n.name}</span>
                            </div>
                            <div className="bp-node__header-right">
                              <button
                                className="bp-node__hbtn"
                                title={n.enabled ? 'Désactiver' : 'Activer'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  commit((cur) => ({
                                    ...cur,
                                    games: cur.games.map((g) => {
                                      if (g.id !== cur.activeGameId) return g;
                                      return { ...g, nodes: g.nodes.map((nd) => nd.id === n.id ? { ...nd, enabled: !nd.enabled } : nd) };
                                    }),
                                  }));
                                }}
                                style={{ color: n.enabled ? '#22d3ee' : '#ef4444' }}
                              >
                                {n.enabled ? <Check size={11} /> : <X size={11} />}
                              </button>
                              <button
                                className="bp-node__hbtn bp-node__hbtn--del"
                                title="Supprimer le nœud"
                                onClick={(e) => { e.stopPropagation(); removeNodeById(n.id); }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                          <div className="bp-node__kind-bar" style={{ color: nodeAccent }}>
                            {labelNodeKind(n.kind)}
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

                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Masque</span>
                                  <div className="bp-node__varctrl">
                                    <select className="bp-node__varselect"
                                      value={String(n.params.mask ?? 'all')}
                                      onChange={(e) => updateNodeParamsById(n.id, { mask: e.target.value })}>
                                      <option value="all">Tous</option>
                                      <option value="border">Bords</option>
                                      <option value="corners">Coins</option>
                                      <option value="center">Centre</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Boucle</span>
                                  <div className="bp-node__varctrl">
                                    <input type="checkbox" checked={Boolean(n.params.loop)}
                                      onChange={(e) => updateNodeParamsById(n.id, { loop: e.target.checked })} />
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
                          ) : n.kind === 'game_tetris' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Vitesse (ms)</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={200} max={2000} step={50}
                                      value={getNum(n.params, 'speed', 500)}
                                      onChange={(e) => updateNodeParamsById(n.id, { speed: Number(e.target.value) })} />
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Niveau départ</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={1} max={10} step={1}
                                      value={getNum(n.params, 'startLevel', 1)}
                                      onChange={(e) => updateNodeParamsById(n.id, { startLevel: Number(e.target.value) })} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'game_simon' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Vitesse (ms)</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={300} max={2000} step={50}
                                      value={getNum(n.params, 'speed', 800)}
                                      onChange={(e) => updateNodeParamsById(n.id, { speed: Number(e.target.value) })} />
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Couleurs</span>
                                  <div className="bp-node__varctrl">
                                    <select className="bp-node__varselect"
                                      value={String(getNum(n.params, 'colors', 4))}
                                      onChange={(e) => updateNodeParamsById(n.id, { colors: Number(e.target.value) })}>
                                      <option value="2">2</option>
                                      <option value="4">4</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'game_memory' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__var">
                                <span className="bp-node__varlabel">Paires</span>
                                <div className="bp-node__varctrl">
                                  <input className="bp-node__varinput" type="number" min={2} max={12} step={1}
                                    value={getNum(n.params, 'pairs', 8)}
                                    onChange={(e) => updateNodeParamsById(n.id, { pairs: Number(e.target.value) })} />
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'on_timer' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Intervalle (ms)</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={100} max={60000} step={100}
                                      value={getNum(n.params, 'intervalMs', 1000)}
                                      onChange={(e) => updateNodeParamsById(n.id, { intervalMs: Number(e.target.value) })} />
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Répétitions</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varinput" type="number" min={-1} max={9999} step={1}
                                      value={getNum(n.params, 'repeat', -1)}
                                      onChange={(e) => updateNodeParamsById(n.id, { repeat: Number(e.target.value) })} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'on_click' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__var">
                                <span className="bp-node__varlabel">Dalle</span>
                                <div className="bp-node__varctrl">
                                  <select className="bp-node__varselect"
                                    value={String(Math.max(0, Math.round(getNum(n.params, 'tileIndex', 0))))}
                                    onChange={(e) => updateNodeParamsById(n.id, { tileIndex: Number(e.target.value) })}>
                                    {Array.from({ length: 42 }, (_, i) => <option key={i} value={i}>D{i + 1}</option>)}
                                  </select>
                                </div>
                              </div>
                            </div>
                          ) : n.kind === 'tile_set' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__varrow">
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Dalle</span>
                                  <div className="bp-node__varctrl">
                                    <select className="bp-node__varselect"
                                      value={String(Math.max(0, Math.round(getNum(n.params, 'tileIndex', 0))))}
                                      onChange={(e) => updateNodeParamsById(n.id, { tileIndex: Number(e.target.value) })}>
                                      {Array.from({ length: 42 }, (_, i) => <option key={i} value={i}>D{i + 1}</option>)}
                                    </select>
                                  </div>
                                </div>
                                <div className="bp-node__var">
                                  <span className="bp-node__varlabel">Int.</span>
                                  <div className="bp-node__varctrl">
                                    <input className="bp-node__varrange" type="range" min={0} max={1} step={0.01}
                                      value={clamp01(getNum(n.params, 'intensity', 1))}
                                      style={{ ['--min' as any]: 0, ['--max' as any]: 1, ['--value' as any]: clamp01(getNum(n.params, 'intensity', 1)) }}
                                      onChange={(e) => updateNodeParamsById(n.id, { intensity: Number(e.target.value) })} />
                                  </div>
                                </div>
                              </div>
                              <div className="bp-node__color">
                                <div className="bp-node__colorpreview" style={{ background: getColor(n.params, 'color', '#ffffff') }} />
                                <input className="bp-node__colorinput" type="color"
                                  value={getColor(n.params, 'color', '#ffffff')}
                                  onChange={(e) => updateNodeParamsById(n.id, { color: e.target.value })} />
                              </div>
                            </div>
                          ) : n.kind === 'if' ? (
                            <div className="bp-node__vars" onPointerDown={(e) => e.stopPropagation()}>
                              <div className="bp-node__var">
                                <span className="bp-node__varlabel">Condition</span>
                                <div className="bp-node__varctrl">
                                  <input type="checkbox" checked={Boolean(n.params.condition)}
                                    onChange={(e) => updateNodeParamsById(n.id, { condition: e.target.checked })} />
                                </div>
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

          <aside className="ue__right" style={{ borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="panelhead" style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Settings2 size={16} color="#1a1a1a" />
                <strong style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.02em', color: '#1a1a1a' }}>Paramètres</strong>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>{selectedNode ? labelNodeKind(selectedNode.kind) : '—'}</span>
            </div>

            <div className="panelbody" style={{ padding: 20 }}>
              {!selectedNode ? (
                <div className="muted" style={{ padding: 24, textAlign: 'center', color: '#999' }}>Sélectionne un noeud dans le graphe.</div>
              ) : (
                <div className="form">
                  <label className="field">
                    <span className="g-label">Nom</span>
                    <input
                      value={selectedNode.name}
                      onChange={(e) => updateSelectedNode({ name: e.target.value })}
                      className="g-input"
                      style={{ height: 38, fontSize: 13 }}
                    />
                  </label>

                  <label className="field field--row">
                    <span className="g-label">Actif</span>
                    <input
                      type="checkbox"
                      className="g-check"
                      checked={selectedNode.enabled}
                      onChange={(e) => updateSelectedNode({ enabled: e.target.checked })}
                    />
                  </label>

                  <div className="divider" />

                  {selectedNode.kind === 'fill' ? (
                    <>
                      {(() => {
                        const color = getColor(selectedNode.params, 'color', '#6d28ff');
                        const rgb = hexToRgb(color);
                        const intensity = clamp01(getNum(selectedNode.params, 'intensity', 0.8));
                        const updateColor = (r: number, g: number, b: number) => {
                          updateSelectedParams({ color: rgbToHex(r, g, b) });
                        };

                        const SliderRow = ({ label, value, max, color: c, onChange }: { label: string; value: number; max: number; color: string; onChange: (v: number) => void }) => {
                          const pct = `${(value / max) * 100}%`;
                          const variant = c === '#e53e3e' || c === '#ef4444' ? 'g-slider--red' : c === '#38a169' || c === '#22c55e' ? 'g-slider--green' : c === '#3182ce' || c === '#3b82f6' ? 'g-slider--blue' : '';
                          return (
                            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 36px', gap: 12, alignItems: 'center' }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.02em' }}>{label}</span>
                              <input
                                type="range"
                                className={`g-slider ${variant}`}
                                min={0}
                                max={max}
                                step={1}
                                value={value}
                                onChange={(e) => onChange(Number(e.target.value))}
                                style={{ ['--pct' as any]: pct }}
                              />
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                            </div>
                          );
                        };

                        return (
                          <>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                              <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: color,
                                border: '1px solid rgba(0,0,0,0.1)',
                                flexShrink: 0,
                              }} />
                              <input
                                type="color"
                                value={color}
                                onChange={(e) => updateSelectedParams({ color: e.target.value })}
                                style={{
                                  width: '100%', height: 32, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)',
                                  cursor: 'pointer', padding: 0, background: '#fff',
                                }}
                              />
                            </div>

                            <div style={{
                              padding: 16, borderRadius: 12,
                              background: '#fff',
                              border: '1px solid rgba(0,0,0,0.06)',
                              display: 'grid', gap: 12,
                            }}>
                              <SliderRow label="R" value={rgb.r} max={255} color="#ef4444" onChange={(v) => updateColor(v, rgb.g, rgb.b)} />
                              <SliderRow label="G" value={rgb.g} max={255} color="#22c55e" onChange={(v) => updateColor(rgb.r, v, rgb.b)} />
                              <SliderRow label="B" value={rgb.b} max={255} color="#3b82f6" onChange={(v) => updateColor(rgb.r, rgb.g, v)} />
                            </div>

                            <div style={{
                              padding: 16, borderRadius: 12, marginTop: 4,
                              background: '#fff',
                              border: '1px solid rgba(0,0,0,0.06)',
                            }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 42px', gap: 12, alignItems: 'center' }}>
                                <div>
                                  <span className="g-label" style={{ marginBottom: 8, display: 'block' }}>Intensité</span>
                                  <input
                                    type="range" className="g-slider g-slider--accent" min={0} max={1} step={0.01} value={intensity}
                                    onChange={(e) => updateSelectedParams({ intensity: Number(e.target.value) })}
                                    style={{ ['--pct' as any]: `${intensity * 100}%` }}
                                  />
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', textAlign: 'right' }}>{Math.round(intensity * 100)}%</span>
                              </div>
                            </div>
                          </>
                        );
                      })()}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Durée (s)</span>
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={Math.max(0, getNum(selectedNode.params, 'seconds', 1))}
                            onChange={(e) => updateSelectedParams({ seconds: Number(e.target.value) })}
                            className="g-input"
                            style={{ height: 36, fontSize: 13 }}
                          />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="g-label">Masque</span>
                          <select
                            className="g-select"
                            style={{ height: 36, fontSize: 13 }}
                            value={String(selectedNode.params.mask ?? 'all')}
                            onChange={(e) => updateSelectedParams({ mask: e.target.value })}
                          >
                            <option value="all">Tout</option>
                            <option value="border">Bord</option>
                            <option value="corners">Coins</option>
                            <option value="center">Centre</option>
                          </select>
                        </label>
                      </div>

                      <p style={{ fontSize: 11, opacity: 0.5, marginTop: 4, lineHeight: 1.4 }}>Clique une dalle dans le viewport pour l'assigner.</p>
                    </>
                  ) : selectedNode.kind === 'pulse' ? (
                    <>
                      {(() => {
                        const baseColor = getColor(selectedNode.params, 'baseColor', getColor(selectedNode.params, 'color', '#ff2aa6'));
                        const targetColor = getColor(selectedNode.params, 'targetColor', getColor(selectedNode.params, 'color', '#ff2aa6'));
                        const fromI = clamp01(getNum(selectedNode.params, 'fromIntensity', clamp01(getNum(selectedNode.params, 'base', 0))));
                        const toI = clamp01(getNum(selectedNode.params, 'toIntensity', clamp01(getNum(selectedNode.params, 'base', 0) + clamp01(getNum(selectedNode.params, 'amp', 0.8)))));
                        const speed = Math.max(0.01, getNum(selectedNode.params, 'speed', 1));

                        const MiniSlider = ({ label, value, max, unit, color: c, onChange }: { label: string; value: number; max: number; unit: string; color: string; onChange: (v: number) => void }) => {
                          const pct = `${(value / max) * 100}%`;
                          const variant = c === '#4361ee' ? 'g-slider--accent' : c === '#b829dd' || c === '#805ad5' ? 'g-slider--purple' : c === '#06d6a0' || c === '#319795' ? 'g-slider--teal' : 'g-slider--accent';
                          return (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 48px', gap: 10, alignItems: 'center' }}>
                              <div>
                                <span className="g-label" style={{ marginBottom: 6, display: 'block' }}>{label}</span>
                                <input
                                  type="range" className={`g-slider ${variant}`} min={0} max={max} step={max > 2 ? 0.05 : 0.01} value={value}
                                  onChange={(e) => onChange(Number(e.target.value))}
                                  style={{ ['--pct' as any]: pct }}
                                />
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', textAlign: 'right' }}>{max <= 2 ? `${Math.round(value * 100)}%` : value.toFixed(1)}{unit}</span>
                            </div>
                          );
                        };

                        return (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                              <label style={{ display: 'grid', gap: 6 }}>
                                <span className="g-label">Base</span>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <div style={{ width: 28, height: 28, borderRadius: 8, background: baseColor, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                                  <input type="color" value={baseColor} onChange={(e) => updateSelectedParams({ baseColor: e.target.value })} style={{ flex: 1, height: 28, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', padding: 0, background: '#fff' }} />
                                </div>
                              </label>
                              <label style={{ display: 'grid', gap: 6 }}>
                                <span className="g-label">Cible</span>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <div style={{ width: 28, height: 28, borderRadius: 8, background: targetColor, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                                  <input type="color" value={targetColor} onChange={(e) => updateSelectedParams({ targetColor: e.target.value })} style={{ flex: 1, height: 28, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', padding: 0, background: '#fff' }} />
                                </div>
                              </label>
                            </div>

                            <div style={{ padding: 16, borderRadius: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', display: 'grid', gap: 14 }}>
                              <MiniSlider label="Int. départ" value={fromI} max={1} unit="" color="#4361ee" onChange={(v) => updateSelectedParams({ fromIntensity: v })} />
                              <MiniSlider label="Int. cible" value={toI} max={1} unit="" color="#b829dd" onChange={(v) => updateSelectedParams({ toIntensity: v })} />
                              <MiniSlider label="Vitesse" value={speed} max={10} unit="" color="#06d6a0" onChange={(v) => updateSelectedParams({ speed: v })} />
                            </div>
                          </>
                        );
                      })()}
                    </>
                  ) : selectedNode.kind === 'wait' ? (
                    <>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Durée (secondes)</span>
                        <input
                          className="g-input"
                          type="number"
                          step={0.1}
                          style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'seconds', 1)}
                          onChange={(e) => updateSelectedParams({ seconds: Number(e.target.value) })}
                        />
                      </label>
                      <p style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>Retarde l'exécution de la prochaine action dans la séquence.</p>
                    </>
                  ) : selectedNode.kind === 'game_tetris' ? (
                    <>
                      <div style={{ padding: 16, borderRadius: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', display: 'grid', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 10, alignItems: 'center' }}>
                          <div>
                            <span className="g-label" style={{ marginBottom: 6, display: 'block' }}>Vitesse (ms)</span>
                            <input
                              type="range" className="g-slider g-slider--accent" min={80} max={1200} step={10}
                              value={getNum(selectedNode.params, 'speed', 500)}
                              onChange={(e) => updateSelectedParams({ speed: Number(e.target.value) })}
                              style={{ ['--pct' as any]: `${((getNum(selectedNode.params, 'speed', 500) - 80) / 1120) * 100}%` }}
                            />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', textAlign: 'right' }}>{Math.round(getNum(selectedNode.params, 'speed', 500))}ms</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 10, alignItems: 'center' }}>
                          <div>
                            <span className="g-label" style={{ marginBottom: 6, display: 'block' }}>Niveau de départ</span>
                            <input
                              type="range" className="g-slider g-slider--accent" min={1} max={10} step={1}
                              value={getNum(selectedNode.params, 'startLevel', 1)}
                              onChange={(e) => updateSelectedParams({ startLevel: Number(e.target.value) })}
                              style={{ ['--pct' as any]: `${((getNum(selectedNode.params, 'startLevel', 1) - 1) / 9) * 100}%` }}
                            />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', textAlign: 'right' }}>Niv.{Math.round(getNum(selectedNode.params, 'startLevel', 1))}</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span className="g-label">Fond</span>
                            <input type="color" value={getColor(selectedNode.params, 'bgColor', '#0a0a0f')}
                              onChange={(e) => updateSelectedParams({ bgColor: e.target.value })}
                              style={{ width: '100%', height: 28, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', padding: 0 }}
                            />
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span className="g-label">Bordure</span>
                            <input type="color" value={getColor(selectedNode.params, 'borderColor', '#222233')}
                              onChange={(e) => updateSelectedParams({ borderColor: e.target.value })}
                              style={{ width: '100%', height: 28, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', padding: 0 }}
                            />
                          </label>
                        </div>
                      </div>
                      <p style={{ fontSize: 11, opacity: 0.5, marginTop: 4, lineHeight: 1.4 }}>
                        Tetris interactif dans le viewport. Contrôles: ← → ↑ ↓ Espace.
                        <br />Les couleurs sont envoyées sur les dalles physiques en temps réel.
                      </p>
                    </>
                  ) : selectedNode.kind === 'on_timer' ? (
                    <>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Intervalle (ms)</span>
                        <input className="g-input" type="number" step={100} min={50}
                          style={{ height: 36, fontSize: 13 }}
                          value={getNum(selectedNode.params, 'intervalMs', 1000)}
                          onChange={(e) => updateSelectedParams({ intervalMs: Number(e.target.value) })}
                        />
                      </label>
                    </>
                  ) : selectedNode.kind === 'on_click' ? (
                    <>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Dalle cible</span>
                        <select className="g-select" style={{ height: 36, fontSize: 13 }}
                          value={String(Math.round(getNum(selectedNode.params, 'tileIndex', 0)))}
                          onChange={(e) => updateSelectedParams({ tileIndex: Number(e.target.value) })}
                        >
                          {Array.from({ length: tileCount }, (_, i) => (
                            <option key={i} value={i}>D{i + 1}</option>
                          ))}
                        </select>
                      </label>
                      <p style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>Se déclenche quand la dalle est cliquée/touchée.</p>
                    </>
                  ) : selectedNode.kind.startsWith('cs150_') ? (
                    <>
                      <div style={{ padding: 16, borderRadius: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', display: 'grid', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', display: 'grid', placeItems: 'center' }}>
                            <Target size={18} color="#fff" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>Colorimètre CS150</div>
                            <div style={{ fontSize: 12, opacity: 0.6 }}>Konica Minolta</div>
                          </div>
                        </div>
                        
                        {selectedNode.kind === 'cs150_connect' && (
                          <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
                            Connecte le colorimètre CS150 via USB/RS232.
                          </p>
                        )}
                        
                        {selectedNode.kind === 'cs150_measure' && (
                          <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
                            Lance une mesure one-shot (mesure + polling + lecture).
                          </p>
                        )}
                        
                        {selectedNode.kind === 'cs150_read_xyz' && (
                          <>
                            <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5, marginBottom: 8 }}>
                              Lit les valeurs XYZ de la dernière mesure.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: 10, background: '#f8fafc', borderRadius: 8 }}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: '#94a3b8' }}>X</div>
                                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>--</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: '#94a3b8' }}>Y</div>
                                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>--</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: '#94a3b8' }}>Z</div>
                                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>--</div>
                              </div>
                            </div>
                          </>
                        )}
                        
                        {selectedNode.kind === 'cs150_read_lvxy' && (
                          <>
                            <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5, marginBottom: 8 }}>
                              Lit les valeurs Lv, x, y de la dernière mesure.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: 10, background: '#f8fafc', borderRadius: 8 }}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: '#94a3b8' }}>Lv</div>
                                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>--</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: '#94a3b8' }}>x</div>
                                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>--</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: '#94a3b8' }}>y</div>
                                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>--</div>
                              </div>
                            </div>
                          </>
                        )}
                        
                        {selectedNode.kind === 'cs150_set_backlight' && (
                          <label style={{ display: 'grid', gap: 6 }}>
                            <span className="g-label">Mode rétroéclairage</span>
                            <select 
                              className="g-select" 
                              style={{ height: 36, fontSize: 13 }}
                              value={String(selectedNode.params.mode ?? 'on')}
                              onChange={(e) => updateSelectedParams({ mode: e.target.value })}
                            >
                              <option value="on">ON</option>
                              <option value="off">OFF</option>
                            </select>
                          </label>
                        )}
                        
                        {selectedNode.kind === 'cs150_set_calib_ch' && (
                          <label style={{ display: 'grid', gap: 6 }}>
                            <span className="g-label">Canal de calibration</span>
                            <select 
                              className="g-select" 
                              style={{ height: 36, fontSize: 13 }}
                              value={Number(selectedNode.params.channel ?? 0)}
                              onChange={(e) => updateSelectedParams({ channel: Number(e.target.value) })}
                            >
                              {Array.from({ length: 11 }, (_, i) => (
                                <option key={i} value={i}>Canal {i}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        
                        {selectedNode.kind === 'cs150_rgb_calib' && (
                          <>
                            <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5, marginBottom: 12 }}>
                              Calibration RGB: mesure Rouge, Vert, Bleu puis calcule la matrice.
                            </p>
                            <div style={{ display: 'grid', gap: 10 }}>
                              <label style={{ display: 'grid', gap: 4 }}>
                                <span className="g-label" style={{ fontSize: 11 }}>ID Calibration</span>
                                <input 
                                  type="text" 
                                  className="g-input"
                                  style={{ height: 32, fontSize: 12 }}
                                  value={String(selectedNode.params.calibId ?? 'rgb_calib_001')}
                                  onChange={(e) => updateSelectedParams({ calibId: e.target.value })}
                                />
                              </label>
                              <label style={{ display: 'grid', gap: 4 }}>
                                <span className="g-label" style={{ fontSize: 11 }}>Canal cible</span>
                                <select 
                                  className="g-select" 
                                  style={{ height: 32, fontSize: 12 }}
                                  value={Number(selectedNode.params.targetChannel ?? 1)}
                                  onChange={(e) => updateSelectedParams({ targetChannel: Number(e.target.value) })}
                                >
                                  {Array.from({ length: 10 }, (_, i) => (
                                    <option key={i + 1} value={i + 1}>Canal {i + 1}</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          </>
                        )}
                        
                        {selectedNode.kind === 'cs150_single_calib' && (
                          <>
                            <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5, marginBottom: 12 }}>
                              Calibration 1 point: mesure une source blanche de référence.
                            </p>
                            <div style={{ display: 'grid', gap: 10 }}>
                              <label style={{ display: 'grid', gap: 4 }}>
                                <span className="g-label" style={{ fontSize: 11 }}>Valeur blanc Lv (cd/m²)</span>
                                <input 
                                  type="number" 
                                  step="0.1"
                                  className="g-input"
                                  style={{ height: 32, fontSize: 12 }}
                                  value={Number(selectedNode.params.trueLv ?? 11.0)}
                                  onChange={(e) => updateSelectedParams({ trueLv: Number(e.target.value) })}
                                />
                              </label>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <label style={{ display: 'grid', gap: 4 }}>
                                  <span className="g-label" style={{ fontSize: 11 }}>x</span>
                                  <input 
                                    type="number" 
                                    step="0.001"
                                    className="g-input"
                                    style={{ height: 32, fontSize: 12 }}
                                    value={Number(selectedNode.params.trueX ?? 0.4)}
                                    onChange={(e) => updateSelectedParams({ trueX: Number(e.target.value) })}
                                  />
                                </label>
                                <label style={{ display: 'grid', gap: 4 }}>
                                  <span className="g-label" style={{ fontSize: 11 }}>y</span>
                                  <input 
                                    type="number" 
                                    step="0.001"
                                    className="g-input"
                                    style={{ height: 32, fontSize: 12 }}
                                    value={Number(selectedNode.params.trueY ?? 0.4)}
                                    onChange={(e) => updateSelectedParams({ trueY: Number(e.target.value) })}
                                  />
                                </label>
                              </div>
                              <label style={{ display: 'grid', gap: 4 }}>
                                <span className="g-label" style={{ fontSize: 11 }}>Canal cible</span>
                                <select 
                                  className="g-select" 
                                  style={{ height: 32, fontSize: 12 }}
                                  value={Number(selectedNode.params.targetChannel ?? 1)}
                                  onChange={(e) => updateSelectedParams({ targetChannel: Number(e.target.value) })}
                                >
                                  {Array.from({ length: 10 }, (_, i) => (
                                    <option key={i + 1} value={i + 1}>Canal {i + 1}</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          </>
                        )}
                      </div>
                      <p style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>
                        Utilisez le panneau CS150 dans la barre latérale pour le contrôle direct.
                      </p>
                    </>
                  ) : (
                    <>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="g-label">Dalle</span>
                        <select
                          className="g-select"
                          style={{ height: 36, fontSize: 13 }}
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

                      {(() => {
                        const color = getColor(selectedNode.params, 'color', '#ff2aa6');
                        const rgb = hexToRgb(color);
                        const intensity = clamp01(getNum(selectedNode.params, 'intensity', 0.85));
                        const updateColor = (r: number, g: number, b: number) => {
                          updateSelectedParams({ color: rgbToHex(r, g, b) });
                        };

                        const SliderRow = ({ label, value, max, color: c, onChange }: { label: string; value: number; max: number; color: string; onChange: (v: number) => void }) => {
                          const pct = `${(value / max) * 100}%`;
                          const variant = c === '#e53e3e' || c === '#ef4444' ? 'g-slider--red' : c === '#38a169' || c === '#22c55e' ? 'g-slider--green' : c === '#3182ce' || c === '#3b82f6' ? 'g-slider--blue' : '';
                          return (
                            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 36px', gap: 12, alignItems: 'center' }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.02em' }}>{label}</span>
                              <input
                                type="range"
                                className={`g-slider ${variant}`}
                                min={0}
                                max={max}
                                step={1}
                                value={value}
                                onChange={(e) => onChange(Number(e.target.value))}
                                style={{ ['--pct' as any]: pct }}
                              />
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                            </div>
                          );
                        };

                        return (
                          <>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                              <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: color,
                                border: '1px solid rgba(0,0,0,0.1)',
                                flexShrink: 0,
                              }} />
                              <input
                                type="color"
                                value={color}
                                onChange={(e) => updateSelectedParams({ color: e.target.value })}
                                style={{
                                  width: '100%', height: 32, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)',
                                  cursor: 'pointer', padding: 0, background: '#fff',
                                }}
                              />
                            </div>

                            <div style={{
                              padding: 16, borderRadius: 12,
                              background: '#fff',
                              border: '1px solid rgba(0,0,0,0.06)',
                              display: 'grid', gap: 12,
                            }}>
                              <SliderRow label="R" value={rgb.r} max={255} color="#ef4444" onChange={(v) => updateColor(v, rgb.g, rgb.b)} />
                              <SliderRow label="G" value={rgb.g} max={255} color="#22c55e" onChange={(v) => updateColor(rgb.r, v, rgb.b)} />
                              <SliderRow label="B" value={rgb.b} max={255} color="#3b82f6" onChange={(v) => updateColor(rgb.r, rgb.g, v)} />
                            </div>

                            <div style={{
                              padding: 16, borderRadius: 12, marginTop: 4,
                              background: '#fff',
                              border: '1px solid rgba(0,0,0,0.06)',
                            }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 42px', gap: 12, alignItems: 'center' }}>
                                <div>
                                  <span className="g-label" style={{ marginBottom: 8, display: 'block' }}>Intensité</span>
                                  <input
                                    type="range" className="g-slider g-slider--accent" min={0} max={1} step={0.01} value={intensity}
                                    onChange={(e) => updateSelectedParams({ intensity: Number(e.target.value) })}
                                    style={{ ['--pct' as any]: `${intensity * 100}%` }}
                                  />
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', textAlign: 'right' }}>{Math.round(intensity * 100)}%</span>
                              </div>
                            </div>
                          </>
                        );
                      })()}

                      <p style={{ fontSize: 11, opacity: 0.5, marginTop: 4, lineHeight: 1.4 }}>Clique une dalle dans le viewport pour l'assigner.</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* CS150 Colorimeter Panel */}
            <div style={{ marginTop: 16, padding: '0 20px 20px' }}>
              <CS150Panel />
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
            className="g-glass"
            style={{
              width: 'min(520px, calc(100vw - 40px))',
              padding: 28,
              borderRadius: 24,
              boxShadow: '0 24px 60px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.9) inset',
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
                    background: 'linear-gradient(135deg, #4361ee, #3a56d4)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <FolderPlus size={22} color="#fff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>Nouveau projet</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.6 }}>Créez un jeu lumineux interactif</p>
                </div>
              </div>
              <button
                className="g-btn g-btn--icon"
                onClick={() => setModal(null)}
                style={{ width: 38, height: 38 }}
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
                  className="g-input"
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
                  {[
                    { id: 'blank', icon: Layers, label: 'Vide', desc: 'Projet vide avec événement initial' },
                    { id: 'tutorial', icon: Zap, label: 'Tutoriel', desc: 'Remplissage simple démonstratif' },
                    { id: 'animation', icon: Play, label: 'Animation', desc: 'Pulsation automatique' },
                    { id: 'interactive', icon: MousePointer2, label: 'Interactif', desc: 'Contrôle d\'une dalle' },
                    { id: 'fluorescence', icon: Palette, label: 'Fluorescence UV', desc: 'Activation UV → Fluorescence verte' },
                    { id: 'color-demo', icon: Palette, label: 'Démo RGB', desc: '3 dalles RGB primaires' },
                    { id: 'pulse-advanced', icon: Clock, label: 'Pulsations', desc: 'Alternance chaud/froid' },
                    { id: 'rainbow', icon: Palette, label: 'Arc-en-ciel', desc: 'Séquence colorée complète' },
                    { id: 'tetris', icon: Gamepad2, label: 'Tetris Lumière', desc: 'Jeu Tetris interactif sur les dalles' },
                    { id: 'memory', icon: Brain, label: 'Jeu de Mémoire', desc: 'Mémorisation de séquences lumineuses type Simon' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setNewProjectTemplate(t.id as typeof newProjectTemplate)}
                      className="g-card"
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        border: newProjectTemplate === t.id ? '2px solid #4361ee' : '1px solid rgba(255,255,255,0.6)',
                        background: newProjectTemplate === t.id ? 'rgba(67, 97, 238, 0.06)' : 'linear-gradient(135deg, rgba(255,255,255,0.78), rgba(255,255,255,0.55))',
                        cursor: 'pointer',
                        textAlign: 'left',
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

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button
                className="g-btn"
                onClick={() => setModal(null)}
                style={{ height: 42, padding: '0 20px' }}
              >
                Annuler
              </button>
              <button
                className="g-btn g-btn--accent"
                onClick={() => void createGame(newProjectName, newProjectTemplate)}
                disabled={dbLoading}
                style={{ height: 42, padding: '0 24px' }}
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
            background: 'linear-gradient(180deg, rgba(255,255,255,0.26), rgba(245,247,255,0.42))',
            backdropFilter: 'blur(18px) saturate(140%)',
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
              background: 'linear-gradient(135deg, rgba(255,255,255,0.88), rgba(245,247,255,0.82))',
              border: '1px solid rgba(255,255,255,0.7)',
              boxShadow: '0 20px 60px rgba(140, 160, 200, 0.14), 0 2px 0 rgba(255,255,255,0.8) inset',
              backdropFilter: 'blur(28px) saturate(160%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(239,71,111,0.12), rgba(239,71,111,0.06))',
                border: '1px solid rgba(0,0,0,0.08)',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.6)',
              }}
            >
              <Trash2 size={26} color="#1a1a1a" />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#1a1a1a' }}>Supprimer le projet ?</h3>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: '#444', lineHeight: 1.5 }}>
              "{modal.gameName}" sera définitivement supprimé.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                className="btn"
                onClick={() => setModal(null)}
                style={{
                  height: 44,
                  padding: '0 24px',
                  background: 'rgba(255,255,255,0.7)',
                  color: '#1a1a1a',
                  border: '1px solid rgba(0,0,0,0.1)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
                  fontWeight: 600,
                  borderRadius: 12,
                  cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                className="btn"
                onClick={() => {
                  void deleteActiveGame();
                  setModal(null);
                }}
                style={{
                  height: 44,
                  padding: '0 24px',
                  background: 'linear-gradient(135deg, #ef476f, #c9184a)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 8px 24px rgba(239, 71, 111, 0.25)',
                  fontWeight: 600,
                  borderRadius: 12,
                  cursor: 'pointer',
                }}
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
            gap: 6,
            padding: '8px 14px',
            borderRadius: 12,
            background: '#fff',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            zIndex: 100,
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <button
            className="btn btn--mini"
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause' : 'Lecture'}
            style={{ width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <div style={{ width: 1, background: 'rgba(0, 0, 0, 0.1)', margin: '4px 4px' }} />
          <button
            className="btn btn--mini"
            onClick={() => setViewMode(viewMode === 'split' ? 'tiles-only' : viewMode === 'tiles-only' ? 'ui-only' : 'split')}
            title="Changer vue"
            style={{ width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {viewMode === 'split' ? <LayoutGrid size={16} /> : viewMode === 'tiles-only' ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button
            className="btn btn--mini"
            onClick={() => setShowGrid(!showGrid)}
            title="Grille"
            style={{ width: 36, height: 36, padding: 0, opacity: showGrid ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ width: 14, height: 14, border: '2px solid currentColor', borderRadius: 3 }} />
          </button>
          <div style={{ width: 1, background: 'rgba(0, 0, 0, 0.1)', margin: '4px 4px' }} />
          <button
            className="btn btn--mini"
            onClick={() => {
              setGraphZoom(1);
              setGraphPan({ x: 0, y: 0 });
            }}
            title="Réinitialiser vue"
            style={{ width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <RotateCcw size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{Math.round(graphZoom * 100)}%</span>
          </div>
        </div>
      )}

      {/* Overlay 2D du jeu - Visuel en plein écran */}
      {showGameOverlay && activeGame && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 10001,
            padding: 20,
          }}
          onClick={() => setShowGameOverlay(false)}
        >
          <div
            style={{
              width: 'min(1100px, calc(100vw - 40px))',
              height: 'min(750px, calc(100vh - 40px))',
              padding: 0,
              borderRadius: 16,
              display: 'grid',
              gridTemplateColumns: '1fr 320px',
              overflow: 'hidden',
              background: '#fff',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Zone principale - Aperçu du jeu */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Header */}
              <div
                style={{
                  padding: '18px 24px',
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#fff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Eye size={20} color="#1a1a1a" />
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>Visuel 2D du Jeu</h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#666' }}>{activeGame.name}</p>
                  </div>
                </div>
                <button
                  className="g-btn g-btn--icon"
                  onClick={() => setShowGameOverlay(false)}
                  style={{ width: 36, height: 36 }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Game Viewport */}
              <div
                style={{
                  flex: 1,
                  display: 'grid',
                  placeItems: 'center',
                  padding: 32,
                  background: '#fafafa',
                }}
              >
                <div style={{ display: 'grid', gap: 20, width: '100%', maxWidth: 550 }}>
                  {/* Grille de dalles 3x3 */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 12,
                      padding: 20,
                      background: '#fff',
                      borderRadius: 16,
                      border: '1px solid rgba(0,0,0,0.06)',
                    }}
                  >
                    {tiles.map((tile, i) => (
                      <div
                        key={i}
                        style={{
                          aspectRatio: '1',
                          borderRadius: 12,
                          background: `linear-gradient(135deg, ${tile.color}${Math.round(tile.intensity * 255).toString(16).padStart(2, '0')}, ${tile.color}${Math.round(tile.intensity * 200).toString(16).padStart(2, '0')})`,
                          boxShadow: `0 0 ${tile.intensity * 20}px ${tile.color}${Math.round(tile.intensity * 100).toString(16).padStart(2, '0')}`,
                          border: '1px solid rgba(0,0,0,0.08)',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#fff',
                          fontSize: 13,
                          fontWeight: 700,
                          textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }}
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>

                  {/* Info du jeu */}
                  <div
                    style={{
                      padding: 16,
                      background: '#fff',
                      borderRadius: 12,
                      border: '1px solid rgba(0,0,0,0.06)',
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, textAlign: 'center' }}>
                      <div>
                        <div style={{ fontSize: 11, marginBottom: 4, color: '#999', fontWeight: 600 }}>Nœuds</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a' }}>{activeGame.nodes.length}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, marginBottom: 4, color: '#999', fontWeight: 600 }}>Connexions</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a' }}>{activeGame.edges.length}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, marginBottom: 4, color: '#999', fontWeight: 600 }}>Dalles</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a' }}>{tileCount}</div>
                      </div>
                    </div>
                  </div>

                  {/* Footer avec contrôles */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                    <button
                      className="g-btn"
                      onClick={() => setIsPlaying(!isPlaying)}
                      style={{ height: 40, padding: '0 20px', background: isPlaying ? '#1a1a1a' : undefined, color: isPlaying ? '#fff' : undefined, borderColor: isPlaying ? '#1a1a1a' : undefined }}
                    >
                      {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                      <span>{isPlaying ? 'Pause' : 'Lecture'}</span>
                    </button>
                    <button
                      className="g-btn"
                      onClick={() => setShowGameOverlay(false)}
                      style={{ height: 40, padding: '0 20px' }}
                    >
                      <X size={16} />
                      <span>Fermer</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Panneau latéral - Configuration UI */}
            <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(0,0,0,0.06)', background: '#fafafa' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Layers size={16} color="#1a1a1a" />
                  <strong style={{ fontSize: 14, fontWeight: 800, color: '#1a1a1a' }}>Configuration UI</strong>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                <div style={{ display: 'grid', gap: 16 }}>
                  {/* Visibilité des dalles */}
                  <div>
                    <label className="g-label" style={{ marginBottom: 8, display: 'block' }}>Affichage des dalles</label>
                    <select className="g-select" style={{ height: 36, fontSize: 13 }}>
                      <option value="all">Toutes les dalles (9)</option>
                      <option value="3x3">Grille 3×3</option>
                      <option value="2x2">Grille 2×2</option>
                      <option value="1x3">Ligne 1×3</option>
                      <option value="custom">Personnalisé</option>
                    </select>
                  </div>

                  {/* Nombre de dalles */}
                  <div>
                    <label className="g-label" style={{ marginBottom: 8, display: 'block' }}>Nombre de dalles visibles</label>
                    <input
                      type="number"
                      className="g-input"
                      min={1}
                      max={9}
                      defaultValue={9}
                      style={{ height: 36, fontSize: 13 }}
                    />
                  </div>

                  <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '8px 0' }} />

                  {/* Composants UI */}
                  <div>
                    <label className="g-label" style={{ marginBottom: 8, display: 'block' }}>Composants UI du jeu</label>
                    <p style={{ fontSize: 11, color: '#999', marginBottom: 12, lineHeight: 1.4 }}>Ajoutez des boutons et sliders pour contrôler le jeu depuis /jeux</p>
                    
                    <div style={{ display: 'grid', gap: 8 }}>
                      <button className="g-btn g-btn--sm" style={{ justifyContent: 'flex-start' }}>
                        <Plus size={14} />
                        <span>Ajouter un bouton</span>
                      </button>
                      <button className="g-btn g-btn--sm" style={{ justifyContent: 'flex-start' }}>
                        <Plus size={14} />
                        <span>Ajouter un slider</span>
                      </button>
                      <button className="g-btn g-btn--sm" style={{ justifyContent: 'flex-start' }}>
                        <Plus size={14} />
                        <span>Ajouter un texte</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '8px 0' }} />

                  {/* Liste des composants ajoutés */}
                  <div>
                    <label className="g-label" style={{ marginBottom: 8, display: 'block' }}>Composants ajoutés (0)</label>
                    <div style={{ padding: 20, textAlign: 'center', color: '#999', fontSize: 12, background: '#fff', borderRadius: 12, border: '1px dashed rgba(0,0,0,0.1)' }}>
                      Aucun composant UI pour le moment
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
