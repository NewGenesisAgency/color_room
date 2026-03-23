'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  CheckCircle2,
  DoorOpen,
  Gamepad2,
  Lightbulb,
  LogIn,
  LogOut,
  Play,
  RefreshCcw,
  Settings2,
  Sparkles,
  Star,
  StopCircle,
  Thermometer,
  Timer,
  XCircle,
  Zap,
} from 'lucide-react';

import { computeTiles } from '@/lib/game/tilesRuntime';

type UserType = 'apprenant' | 'enseignant';

type Niveau = 'college' | 'lycee' | 'universite' | 'grand-public';

type GameId =
  | 'fluorescence'
  | 'beginner-control'
  | 'color-cancel'
  | 'color-match'
  | 'white-balance'
  | 'spectrum-challenge'
  | 'escape-game'
  | 'multiplayer-split'
  ;

type GameDef = {
  id: GameId;
  name: string;
  description: string;
  difficulty: number;
};

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

type CustomGameConfigV1 = {
  version: 1;
  title: string;
  vars: Record<string, CustomGameVarValue>;
  widgets: CustomWidget[];
};

type UiWidgetKind = 'card' | 'text' | 'button' | 'slider' | 'rgb' | 'progress' | 'image';

type UiWidget = {
  id: string;
  kind: UiWidgetKind;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  tint?: { r: number; g: number; b: number };
  rgb?: { r: number; g: number; b: number };
  min?: number;
  max?: number;
  value?: number;
  src?: string;
  events?: {
    clickNodeId?: string;
    hoverNodeId?: string;
    changeNodeId?: string;
  };
};

type EditorGameConfigV1 = {
  version: 1;
  tileCount?: number;
  ui?: {
    title?: string;
    accentColor?: string;
    baseColor?: string;
    targetColor?: string;
    widgets?: UiWidget[];
  };
  nodes?: unknown[];
  edges?: unknown[];
};

type LeaderboardEntry = { name: string; score: number; niveau: Niveau };

type TargetColor = { r: number; g: number; b: number };

type TargetTemp = { name: string; temp: number };

const PLATE_ID_BY_INDEX: number[] = [1, 1, 1, 1, 1, 1, 1, 1, 1];
const INSTRUMENT_PLATE_ID = 1;
const SPECTRUM_GRAPH_MAX = 100;

const games: GameDef[] = [
  {
    id: 'fluorescence',
    name: 'Découverte par Fluorescence',
    description: 'Découvrez un texte invisible en activant la fluorescence UV',
    difficulty: 1,
  },
  {
    id: 'beginner-control',
    name: 'Niveau débutant — Contrôle complet',
    description: 'Pilotez la dalle avec 3 curseurs RGB + une intensité (conversion automatique vers les 32 canaux)',
    difficulty: 1,
  },
  {
    id: 'color-cancel',
    name: 'Annulation de Couleur',
    description: 'Faites disparaître un motif en annulant la distinction entre couleurs',
    difficulty: 2,
  },
  {
    id: 'color-match',
    name: 'Reproduction de Couleur',
    description: 'Reproduisez une couleur RGB de référence avec précision',
    difficulty: 2,
  },
  {
    id: 'white-balance',
    name: 'Balance des Blancs',
    description: 'Créez différents types de blanc selon température',
    difficulty: 3,
  },
  {
    id: 'spectrum-challenge',
    name: 'Défi Spectral',
    description: 'Composez un spectre lumineux avec 32 types de LED',
    difficulty: 3,
  },
  {
    id: 'escape-game',
    name: 'Escape Game Lumineux',
    description: 'Résolvez une série d\'énigmes pour vous échapper',
    difficulty: 4,
  },
  {
    id: 'multiplayer-split',
    name: 'Multijoueur — Écran scindé',
    description: 'Deux joueurs (2 postes) doivent afficher 2 couleurs primaires aléatoires en même temps',
    difficulty: 3,
  },
];

type MpSeat = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type MpRgb = { r: number; g: number; b: number };
type MpState = {
  gameId: 'split-screen';
  createdAt: string;
  durationMs: number;
  endsAtMs: number;
  channelBySeat: Partial<Record<MpSeat, number>>;
  targetValueBySeat: Partial<Record<MpSeat, number>>;
  submittedValueBySeat: Partial<Record<MpSeat, number>>;
  score: number;
};

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function clamp100(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function lerp(a: number, b: number, t01: number): number {
  const t = Math.max(0, Math.min(1, t01));
  return a + (b - a) * t;
}

function parseCssColorToRgb255(input: string): { r: number; g: number; b: number } {
  const s = String(input || '').trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    const raw = hex[1];
    if (raw.length === 3) {
      const r = parseInt(raw[0] + raw[0], 16);
      const g = parseInt(raw[1] + raw[1], 16);
      const b = parseInt(raw[2] + raw[2], 16);
      return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
    }
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
  }

  const rgb = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (rgb) {
    const parts = rgb[1]
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const r = clamp255(Number(parts[0] ?? 0));
    const g = clamp255(Number(parts[1] ?? 0));
    const b = clamp255(Number(parts[2] ?? 0));
    return { r, g, b };
  }

  return { r: 0, g: 0, b: 0 };
}

function lerpColor(a: string, b: string, t01: number): string {
  const ca = parseCssColorToRgb255(a);
  const cb = parseCssColorToRgb255(b);
  const t = Math.max(0, Math.min(1, t01));
  const r = clamp255(lerp(ca.r, cb.r, t));
  const g = clamp255(lerp(ca.g, cb.g, t));
  const b0 = clamp255(lerp(ca.b, cb.b, t));
  return `rgb(${r}, ${g}, ${b0})`;
}

function intensityToMasterPercent(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  if (n <= 1.01) return clamp100(n * 100);
  return clamp100(n);
}

function rgbToCss(c?: Partial<TargetColor> | null): string {
  const r = clamp255(Number(c?.r ?? 0));
  const g = clamp255(Number(c?.g ?? 0));
  const b = clamp255(Number(c?.b ?? 0));
  return `rgb(${r}, ${g}, ${b})`;
}

function isUiWidgetKind(v: unknown): v is UiWidgetKind {
  return v === 'card' || v === 'text' || v === 'button' || v === 'slider' || v === 'rgb' || v === 'progress' || v === 'image';
}

function parseUiWidgets(raw: unknown): UiWidget[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((w) => {
      if (!w || typeof w !== 'object') return null;
      const o = w as any;
      const id = typeof o.id === 'string' ? o.id : null;
      const kind = isUiWidgetKind(o.kind) ? (o.kind as UiWidgetKind) : null;
      const x = typeof o.x === 'number' && Number.isFinite(o.x) ? o.x : null;
      const y = typeof o.y === 'number' && Number.isFinite(o.y) ? o.y : null;
      const w0 = typeof o.w === 'number' && Number.isFinite(o.w) ? o.w : null;
      const h0 = typeof o.h === 'number' && Number.isFinite(o.h) ? o.h : null;
      if (!id || !kind || x === null || y === null || w0 === null || h0 === null) return null;

      const text = typeof o.text === 'string' ? o.text : undefined;

      const tintRaw = o.tint;
      const tint =
        tintRaw && typeof tintRaw === 'object'
          ? {
              r: clamp255(Number((tintRaw as any).r ?? 0)),
              g: clamp255(Number((tintRaw as any).g ?? 0)),
              b: clamp255(Number((tintRaw as any).b ?? 0)),
            }
          : undefined;

      const rgbRaw = o.rgb;
      const rgb =
        rgbRaw && typeof rgbRaw === 'object'
          ? {
              r: clamp255(Number((rgbRaw as any).r ?? 0)),
              g: clamp255(Number((rgbRaw as any).g ?? 0)),
              b: clamp255(Number((rgbRaw as any).b ?? 0)),
            }
          : undefined;

      const min = Number.isFinite(Number(o.min)) ? Number(o.min) : undefined;
      const max = Number.isFinite(Number(o.max)) ? Number(o.max) : undefined;
      const value = Number.isFinite(Number(o.value)) ? Number(o.value) : undefined;

      const src = typeof o.src === 'string' ? o.src : undefined;

      const eventsRaw = o.events;
      const events =
        eventsRaw && typeof eventsRaw === 'object'
          ? {
              clickNodeId: typeof (eventsRaw as any).clickNodeId === 'string' ? String((eventsRaw as any).clickNodeId) : undefined,
              hoverNodeId: typeof (eventsRaw as any).hoverNodeId === 'string' ? String((eventsRaw as any).hoverNodeId) : undefined,
              changeNodeId: typeof (eventsRaw as any).changeNodeId === 'string' ? String((eventsRaw as any).changeNodeId) : undefined,
            }
          : undefined;

      return { id, kind, x, y, w: w0, h: h0, text, tint, rgb, min, max, value, src, events } satisfies UiWidget;
    })
    .filter(Boolean) as UiWidget[];
}

type GraphEdge = { id: string; from: string; to: string };
type EditorNode = { id: string; kind: string; enabled: boolean; name: string; params: Record<string, unknown> };

function buildGraph(cfg: EditorGameConfigV1) {
  const nodes = Array.isArray(cfg.nodes) ? (cfg.nodes as EditorNode[]) : ([] as EditorNode[]);
  const edges = Array.isArray(cfg.edges) ? (cfg.edges as GraphEdge[]) : ([] as GraphEdge[]);
  const byId = new Map(nodes.map((n) => [String(n.id), n] as const));
  const out = new Map<string, string[]>();
  for (const e of edges) {
    const from = String((e as any).from ?? '');
    const to = String((e as any).to ?? '');
    if (!from || !to) continue;
    const arr = out.get(from) ?? [];
    arr.push(to);
    out.set(from, arr);
  }
  return { nodes, edges, byId, out };
}

function parseEditorGameConfig(raw: unknown): EditorGameConfigV1 | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as any;
  if (Number(o.version) !== 1) return null;
  const uiRaw = o.ui && typeof o.ui === 'object' ? (o.ui as any) : null;
  const ui = uiRaw
    ? {
        title: typeof uiRaw.title === 'string' ? uiRaw.title : undefined,
        accentColor: typeof uiRaw.accentColor === 'string' ? uiRaw.accentColor : undefined,
        baseColor: typeof uiRaw.baseColor === 'string' ? uiRaw.baseColor : undefined,
        targetColor: typeof uiRaw.targetColor === 'string' ? uiRaw.targetColor : undefined,
        widgets: parseUiWidgets(uiRaw.widgets),
      }
    : undefined;
  const tileCount = typeof o.tileCount === 'number' && Number.isFinite(o.tileCount) ? o.tileCount : undefined;
  return { version: 1, tileCount, ui, nodes: o.nodes, edges: o.edges } satisfies EditorGameConfigV1;
}

function parseCustomConfig(raw: unknown): CustomGameConfigV1 {
  const base: CustomGameConfigV1 = { version: 1, title: 'Jeu custom', vars: { r: 128, g: 64, b: 200 }, widgets: [] };
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as any;
  if (Number(o.version) !== 1) return base;
  const title = typeof o.title === 'string' && o.title.trim() ? o.title.trim() : base.title;
  const vars = o.vars && typeof o.vars === 'object' ? (o.vars as Record<string, CustomGameVarValue>) : base.vars;
  const widgets = Array.isArray(o.widgets) ? (o.widgets as CustomWidget[]) : base.widgets;
  return { version: 1, title, vars: vars ?? {}, widgets: widgets ?? [] };
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
    .filter((x) => x.length > 0);

  const getNum = (tok: string): number => {
    const v = (vars as any)[tok];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const n = Number(tok);
    return Number.isFinite(n) ? n : 0;
  };

  const r = clamp255(getNum(args[0] ?? '0'));
  const g = clamp255(getNum(args[1] ?? '0'));
  const b = clamp255(getNum(args[2] ?? '0'));
  if (fn === 'rgba') {
    const aRaw = getNum(args[3] ?? '1');
    const a = Math.max(0, Math.min(1, aRaw));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

function rgbToChannels32FromPalette(rgb: MpRgb): number[] {
  const r = clamp255(rgb.r);
  const g = clamp255(rgb.g);
  const b = clamp255(rgb.b);

  const y = Math.min(r, g);
  const w = clamp255((r + g + b) / 3);

  const ch = Array(32).fill(0);

  // 1..5: bleus/violets
  ch[0] = clamp255(b * 1.0);
  ch[1] = clamp255(b * 0.85);
  ch[2] = clamp255(b * 0.75);
  ch[3] = clamp255(b * 0.70);
  ch[4] = clamp255(b * 0.80);

  // 6..7: verts
  ch[5] = clamp255(g * 1.0);
  ch[6] = clamp255(g * 0.75);

  // 8..10: jaunes/oranges (issus du mélange R+G)
  ch[7] = clamp255(y * 1.0);
  ch[8] = clamp255(y * 0.85);
  ch[9] = clamp255(y * 0.70);

  // 11..18: rouges (du plus visible au plus faible)
  ch[10] = clamp255(r * 0.70);
  ch[11] = clamp255(r * 1.00);
  ch[12] = clamp255(r * 0.90);
  ch[13] = clamp255(r * 0.85);
  ch[14] = clamp255(r * 0.70);
  ch[15] = clamp255(r * 0.30);
  ch[16] = clamp255(r * 0.12);
  ch[17] = clamp255(r * 0.08);

  // 19..24: jaune/orange clair (plus faible)
  ch[18] = clamp255(y * 0.90);
  ch[19] = clamp255(y * 0.75);
  ch[20] = clamp255(y * 0.45);
  ch[21] = clamp255(y * 0.30);
  ch[22] = clamp255(y * 0.22);
  ch[23] = clamp255(y * 0.16);

  // 25..28: blancs
  ch[24] = clamp255(w * 0.60);
  ch[25] = clamp255(w * 1.00);
  ch[26] = clamp255(w * 0.85);
  ch[27] = clamp255(w * 0.70);

  // 29..32: gris / blanc-gris
  ch[28] = clamp255(w * 0.35);
  ch[29] = clamp255(w * 0.28);
  ch[30] = clamp255(w * 0.30);
  ch[31] = clamp255(w * 0.80);

  return ch;
}

const MP_TINT_NAMES: string[] = [
  'Violet foncé',
  'Violet clair',
  'Bleu violet',
  'Bleu marine',
  'Bleu turquoise',
  'Vert clair',
  'Vert foncé',
  'Jaune clair',
  'Orange',
  'Rouge/orangé un peu marron',
  'Rouge un peu foncé',
  'Rouge pétant',
  'Rouge cerise',
  'Rouge un peu plus cerise',
  'Rouge foncé',
  'Rouge très très foncé',
  'Rouge invisible (faible)',
  'Rouge invisible',
  'Jaune Orange',
  'Jaune Orange clair',
  'Jaune Orange clair (faible)',
  'Jaune Orange clair (très faible)',
  'Jaune Orange clair (encore)',
  'Jaune Orange blanc très clair',
  'Blanc un peu jaunis',
  'Blanc',
  'Blanc un peu moins lumineux',
  'Blanc encore moins lumineux',
  'Gris',
  'Gris un peu plus foncé',
  'Blanc/Gris',
  'Blanc un peu moins lumineux',
];

function seatTintLabel(channel1to32?: number): string {
  const n = Number(channel1to32);
  if (!Number.isFinite(n) || n < 1 || n > 32) return '—';
  const name = MP_TINT_NAMES[n - 1] ?? '';
  return name ? `Canal ${n}: ${name}` : `Canal ${n}`;
}

function channels32ToPreviewRgb255(channels32: number[], maxValue: number): TargetColor {
  const denom = Math.max(1, maxValue);
  let rAcc = 0;
  let gAcc = 0;
  let bAcc = 0;
  let wSum = 0;

  for (let i = 0; i < 32; i++) {
    const p = CHANNEL_PROFILES[i] ?? { rgb: [1, 1, 1], strength: 0 };
    if (p.strength <= 0) continue;

    const v = Number.isFinite(channels32[i]) ? Number(channels32[i]) : 0;
    const a = Math.max(0, Math.min(1, v / denom)) * p.strength;
    rAcc += p.rgb[0] * a;
    gAcc += p.rgb[1] * a;
    bAcc += p.rgb[2] * a;
    wSum += a;
  }

  if (wSum <= 1e-6) return { r: 0, g: 0, b: 0 };

  return {
    r: clamp255((rAcc / wSum) * 255),
    g: clamp255((gAcc / wSum) * 255),
    b: clamp255((bAcc / wSum) * 255),
  };
}

type ChannelProfile = {
  rgb: [number, number, number];
  strength: number;
};

const CHANNEL_PROFILES: ChannelProfile[] = [
  { rgb: [0.30, 0.00, 0.50], strength: 1.0 },
  { rgb: [0.55, 0.10, 0.85], strength: 1.0 },
  { rgb: [0.25, 0.05, 0.95], strength: 1.0 },
  { rgb: [0.05, 0.05, 0.40], strength: 1.0 },
  { rgb: [0.00, 0.65, 1.00], strength: 1.0 },
  { rgb: [0.25, 1.00, 0.35], strength: 1.0 },
  { rgb: [0.00, 0.55, 0.12], strength: 1.0 },
  { rgb: [1.00, 1.00, 0.40], strength: 1.0 },
  { rgb: [1.00, 0.55, 0.00], strength: 1.0 },
  { rgb: [0.75, 0.25, 0.00], strength: 1.0 },
  { rgb: [0.55, 0.00, 0.00], strength: 1.0 },
  { rgb: [1.00, 0.05, 0.05], strength: 1.0 },
  { rgb: [0.95, 0.00, 0.20], strength: 1.0 },
  { rgb: [0.90, 0.00, 0.22], strength: 1.0 },
  { rgb: [0.35, 0.00, 0.00], strength: 1.0 },
  { rgb: [0.20, 0.00, 0.00], strength: 0.25 },
  { rgb: [0.10, 0.00, 0.00], strength: 0.15 },
  { rgb: [0.10, 0.00, 0.00], strength: 0.15 },
  { rgb: [1.00, 0.58, 0.00], strength: 1.0 },
  { rgb: [1.00, 0.70, 0.10], strength: 1.0 },
  { rgb: [1.00, 0.78, 0.15], strength: 0.55 },
  { rgb: [1.00, 0.80, 0.20], strength: 0.45 },
  { rgb: [1.00, 0.82, 0.22], strength: 0.35 },
  { rgb: [1.00, 0.92, 0.78], strength: 1.0 },
  { rgb: [1.00, 0.97, 0.90], strength: 1.0 },
  { rgb: [1.00, 1.00, 1.00], strength: 1.0 },
  { rgb: [0.90, 0.90, 0.90], strength: 0.75 },
  { rgb: [0.80, 0.80, 0.80], strength: 0.60 },
  { rgb: [0.55, 0.55, 0.55], strength: 0.45 },
  { rgb: [0.40, 0.40, 0.40], strength: 0.40 },
  { rgb: [0.78, 0.78, 0.78], strength: 0.55 },
  { rgb: [0.92, 0.92, 0.92], strength: 0.70 },
];

function rgbToChannels32(rgb: TargetColor, masterIntensity: number): number[] {
  const r = clamp255(rgb.r) / 255;
  const g = clamp255(rgb.g) / 255;
  const b = clamp255(rgb.b) / 255;
  const scale = clamp100(masterIntensity) / 100;

  const energy = Math.max(r, g, b);
  const channels = Array(32).fill(0);
  if (energy <= 1e-6 || scale <= 1e-6) return channels;

  // Choose ONE dominant canal matching the requested RGB.
  // This matches the requirement: ex. Rouge=255 -> Canal 12 à fond (profile rouge pétant).
  const norm = Math.max(1e-6, Math.sqrt(r * r + g * g + b * b));
  const tr = r / norm;
  const tg = g / norm;
  const tb = b / norm;

  let bestIdx = 11; // Canal 12 (index 11) as safe default
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

  channels[bestIdx] = clamp100(energy * 100 * scale);
  return channels;
}

function wavelengthToRgb01(wlNm: number): [number, number, number] {
  // Approximation visible spectrum 380..780nm
  // Based on common piecewise approximations (not physically exact).
  const wl = Math.max(380, Math.min(780, wlNm));

  let r = 0;
  let g = 0;
  let b = 0;

  if (wl < 440) {
    r = (440 - wl) / 60;
    g = 0;
    b = 1;
  } else if (wl < 490) {
    r = 0;
    g = (wl - 440) / 50;
    b = 1;
  } else if (wl < 510) {
    r = 0;
    g = 1;
    b = (510 - wl) / 20;
  } else if (wl < 580) {
    r = (wl - 510) / 70;
    g = 1;
    b = 0;
  } else if (wl < 645) {
    r = 1;
    g = (645 - wl) / 65;
    b = 0;
  } else {
    r = 1;
    g = 0;
    b = 0;
  }

  // intensity correction on the edges
  let factor = 1;
  if (wl < 420) factor = 0.3 + 0.7 * (wl - 380) / 40;
  else if (wl > 700) factor = 0.3 + 0.7 * (780 - wl) / 80;
  factor = Math.max(0, Math.min(1, factor));

  // small gamma-ish shaping
  const gamma = 0.8;
  return [Math.pow(r * factor, gamma), Math.pow(g * factor, gamma), Math.pow(b * factor, gamma)];
}

function spectrum32ToRgb255(channels32: number[]): TargetColor {
  // Convert 32 LED channel intensities (0..255) into a display RGB approximation.
  // Important: do NOT normalize by max(r,g,b) because it destroys perceived intensity.
  let rAcc = 0;
  let gAcc = 0;
  let bAcc = 0;
  let rW = 0;
  let gW = 0;
  let bW = 0;

  for (let i = 0; i < 32; i++) {
    const v255 = Number.isFinite(channels32[i]) ? Number(channels32[i]) : 0;
    const v = Math.max(0, Math.min(255, v255)) / 255;
    const wl = 380 + i * 10;
    const [wr, wg, wb] = wavelengthToRgb01(wl);

    rAcc += wr * v;
    gAcc += wg * v;
    bAcc += wb * v;

    rW += wr;
    gW += wg;
    bW += wb;
  }

  const r01 = rW > 1e-9 ? rAcc / rW : 0;
  const g01 = gW > 1e-9 ? gAcc / gW : 0;
  const b01 = bW > 1e-9 ? bAcc / bW : 0;

  return {
    r: clamp255(r01 * 255),
    g: clamp255(g01 * 255),
    b: clamp255(b01 * 255),
  };
}

export default function JeuxPage() {
  const [dbGames, setDbGames] = useState<
    Array<{ id: string; name: string; kind: string; createdAt: string; updatedAt: string; config: unknown }>
  >([]);
  const [dbGamesLoading, setDbGamesLoading] = useState(false);
  const [customRun, setCustomRun] = useState<{ gameId: string; name: string; cfg: CustomGameConfigV1 } | null>(null);
  const [hudRun, setHudRun] = useState<{ gameId: string; name: string; cfg: EditorGameConfigV1; showHud: boolean } | null>(null);
  const [view, setView] = useState<'login' | 'main'>('login');
  const [userType, setUserType] = useState<UserType>('apprenant');
  const [username, setUsername] = useState<string>('Apprenant1');
  const [niveau, setNiveau] = useState<Niveau>('lycee');

  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [score, setScore] = useState<number>(0);
  const [gamesCompleted, setGamesCompleted] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const [currentGame, setCurrentGame] = useState<GameId | null>(null);
  const [gameActive, setGameActive] = useState<boolean>(false);

  const [plateColors, setPlateColors] = useState<string[]>(Array(9).fill('#000000'));
  const [plateActive, setPlateActive] = useState<boolean[]>(Array(9).fill(false));

  const [hardwarePreviewCss, setHardwarePreviewCss] = useState<string>('rgb(0,0,0)');

  useEffect(() => {
    if (!hudRun?.cfg) return;

    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const tSeconds = (now - start) / 1000;

      const tiles = computeTiles(
        {
          tileCount: 9,
          nodes: (hudRun.cfg.nodes ?? []) as any,
          edges: (hudRun.cfg.edges ?? []) as any,
        },
        tSeconds,
      );

      setPlateColors(() => tiles.slice(0, 9).map((x) => x.color));
      setPlateActive(() => tiles.slice(0, 9).map((x) => x.intensity > 0));

      // Afficher des instructions simples pour White Master
      if (hudRun.name.toLowerCase().includes('white master') || hudRun.name.toLowerCase().includes('maître du blanc')) {
        const phase = Math.floor(tSeconds / 3); // Change toutes les 3 secondes
        if (phase === 0) {
          setMessage('Blanc FROID - Observez la teinte bleutée');
        } else if (phase === 1) {
          setMessage('Pause - Comparez mentalement');
        } else if (phase === 2) {
          setMessage('Blanc NEUTRE - Blanc pur');
        } else if (phase === 3) {
          setMessage('Pause - Comparez avec le précédent');
        } else if (phase === 4) {
          setMessage('Blanc CHAUD - Observez la teinte jaunâtre');
        } else if (phase >= 5) {
          setMessage('Fin du jeu - Avez-vous vu les différences ?');
        }
      }

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [hudRun?.gameId]);

  const [ledValues, setLedValues] = useState<Record<number, number>>({});
  const [message, setMessage] = useState<string>('Sélectionnez un jeu et cliquez sur "Démarrer le Jeu"');

  const [masterIntensity, setMasterIntensity] = useState<number>(80);
  const [beginnerRgb, setBeginnerRgb] = useState<TargetColor>({ r: 0, g: 0, b: 0 });

  const [instrument, setInstrument] = useState({
    colorTemp: '—',
    cri: '—',
    power: '—',
    apiLatency: '—',
  });

  const [secretRevealed, setSecretRevealed] = useState<boolean>(false);
  const [cancelColor, setCancelColor] = useState<{ r: number; g: number }>({ r: 0, g: 0 });

  const [targetColor, setTargetColor] = useState<TargetColor | null>(null);
  const [userColor, setUserColor] = useState<TargetColor>({ r: 0, g: 0, b: 0 });

  const [targetTemp, setTargetTemp] = useState<TargetTemp | null>(null);
  const [currentTemp, setCurrentTemp] = useState<number>(5000);

  const [escapeProgress, setEscapeProgress] = useState<number>(0);

  const [mpToken, setMpToken] = useState<string>('');
  const [mpSeat, setMpSeat] = useState<MpSeat | null>(null);
  const [mpState, setMpState] = useState<MpState | null>(null);
  const [mpSessionId, setMpSessionId] = useState<string>('');
  const [mpStatus, setMpStatus] = useState<'active' | 'finished' | ''>('');
  const [mpPlayers, setMpPlayers] = useState<Array<{ seat: MpSeat; name: string }>>([]);
  const [mpValue, setMpValue] = useState<number>(0);
  const [mpAutoFollow, setMpAutoFollow] = useState<boolean>(true);
  const [mpSnoozedSessionId, setMpSnoozedSessionId] = useState<string>('');
  const [mpJoinPrompt, setMpJoinPrompt] = useState<{ open: boolean; sessionId: string }>(
    { open: false, sessionId: '' },
  );
  const [mpEndPrompt, setMpEndPrompt] = useState<boolean>(false);
  const [mpNowMs, setMpNowMs] = useState<number>(() => Date.now());

  const mpPrevScoreRef = useRef<number>(0);
  const [mpPlusAnimKey, setMpPlusAnimKey] = useState<number>(0);
  const [mpPlusValue, setMpPlusValue] = useState<number>(0);
  const [mpWinPulse, setMpWinPulse] = useState<boolean>(false);
  const [mpCenterAnimKey, setMpCenterAnimKey] = useState<number>(0);
  const [mpThemeIndex, setMpThemeIndex] = useState<number>(0);

  const [scorePlusAnimKey, setScorePlusAnimKey] = useState<number>(0);
  const [scorePlusValue, setScorePlusValue] = useState<number>(0);

  const mpThemes = useMemo(() => {
    return [
      { a: '#06d6a0', b: '#7ef9ff' },
      { a: '#ffd166', b: '#ff6b6b' },
      { a: '#4361ee', b: '#b5179e' },
      { a: '#4cc9f0', b: '#f72585' },
      { a: '#9b5de5', b: '#00bbf9' },
      { a: '#f15bb5', b: '#fee440' },
    ];
  }, []);

  const spectrumHeights = useMemo(() => {
    const h: number[] = [];
    for (let i = 0; i < 32; i++) h.push(ledValues[i] ?? 0);
    return h;
  }, [ledValues]);

  const spectrumHeightsPercent = useMemo(() => {
    return spectrumHeights.map((v) => {
      const raw = Number.isFinite(v) ? Number(v) : 0;
      const capped = Math.max(0, Math.min(SPECTRUM_GRAPH_MAX, raw));
      return Math.round((capped / SPECTRUM_GRAPH_MAX) * 100);
    });
  }, [spectrumHeights]);

  const hwTimersRef = useRef<Record<string, number>>({});

  const [sceneApplyScope, setSceneApplyScope] = useState<'selected' | 'all'>('selected');

  function getTargetPlateIndexes(): number[] {
    const active = plateActive.map((isOn, i) => (isOn ? i : -1)).filter((i) => i >= 0);
    if (active.length > 0) return active;
    return [0];
  }

  function setSelectedPlates(indexes: number[], active = true) {
    setPlateActive((prev) => {
      const next = [...prev];
      // Reset all first
      for (let i = 0; i < 9; i++) next[i] = false;
      // Set selected
      for (const i of indexes) {
        if (i >= 0 && i < 9) next[i] = active;
      }
      return next;
    });
  }

  function setSelectedPlatesColor(color: string, active = true) {
    const targets = getTargetPlateIndexes();
    setPlateColors((prev) => {
      const next = [...prev];
      for (const i of targets) next[i] = color;
      return next;
    });
    if (active) {
      setPlateActive((prev) => {
        const next = [...prev];
        for (const i of targets) next[i] = true;
        return next;
      });
    }
  }

  function getTargetPlateIds(): number[] {
    const active = plateActive
      .map((isOn, i) => (isOn ? i : -1))
      .filter((i) => i >= 0)
      .map((i) => PLATE_ID_BY_INDEX[i] ?? 1);
    if (active.length > 0) return Array.from(new Set(active));
    return [PLATE_ID_BY_INDEX[0] ?? 1];
  }

  function scheduleSetCanal(plaqueId: number, canalIndex: number, intensity: number) {
    const key = `${plaqueId}:${canalIndex}`;
    const existing = hwTimersRef.current[key];
    if (existing) window.clearTimeout(existing);

    hwTimersRef.current[key] = window.setTimeout(async () => {
      try {
        await fetch(`/api/supervision/state/plaque/${plaqueId}/cursor/${canalIndex}/${Math.max(0, Math.min(255, Math.round(intensity)))}`,
          {
            method: 'PUT',
            cache: 'no-store',
          },
        );
      } catch {
        // ignore
      }
    }, 60);
  }

  function sendRgbToHardware(rgb: TargetColor) {
    const targets = getTargetPlateIds();
    const channels32: number[] = [];
    for (const plaqueId of targets) {
      for (let canalIndex = 0; canalIndex < 32; canalIndex++) {
        const wavelength = 380 + canalIndex * 10;
        let v = 0;
        if (wavelength < 450) v = rgb.b;
        else if (wavelength < 550) v = rgb.g;
        else v = rgb.r;
        if (!channels32[canalIndex]) channels32[canalIndex] = v;
        scheduleSetCanal(plaqueId, canalIndex, v);
      }
    }

    setLedValues(() => {
      const next: Record<number, number> = {};
      for (let i = 0; i < 32; i++) next[i] = clamp255(channels32[i] ?? 0);
      return next;
    });

    const preview = channels32ToPreviewRgb255(channels32, 255);
    const css = rgbToCss(preview);
    setHardwarePreviewCss(css);
    setSelectedPlatesColor(css, true);
  }

  function sendChannelsToHardware(channels32: number[], previewMaxValue: number) {
    const targets = getTargetPlateIds();
    for (const plaqueId of targets) {
      for (let i = 0; i < 32; i++) scheduleSetCanal(plaqueId, i, clamp255(channels32[i] ?? 0));
    }

    setLedValues(() => {
      const next: Record<number, number> = {};
      for (let i = 0; i < 32; i++) next[i] = clamp255(channels32[i] ?? 0);
      return next;
    });

    const preview = channels32ToPreviewRgb255(channels32, previewMaxValue);
    const css = rgbToCss(preview);
    setHardwarePreviewCss(css);
    setSelectedPlatesColor(css, true);
  }

  async function blackoutHardware() {
    try {
      await fetch('/api/supervision/', { method: 'PUT', cache: 'no-store' });
    } catch {
      // ignore
    }
  }

  function inferColorTempK(r: number, g: number, b: number): number {
    const denom = Math.max(1, r + g);
    const ratio = b / denom;
    return Math.round(2500 + Math.min(1.2, Math.max(0, ratio)) * 4500);
  }

  function srgbToLinear(c: number): number {
    if (c <= 0.04045) return c / 12.92;
    return Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function rgbToCctK(rgb01: number[]): number {
    const r = srgbToLinear(Math.max(0, Math.min(1, rgb01[0] ?? 0)));
    const g = srgbToLinear(Math.max(0, Math.min(1, rgb01[1] ?? 0)));
    const b = srgbToLinear(Math.max(0, Math.min(1, rgb01[2] ?? 0)));

    const X = r * 0.4124 + g * 0.3576 + b * 0.1805;
    const Y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const Z = r * 0.0193 + g * 0.1192 + b * 0.9505;

    const sum = X + Y + Z;
    if (sum <= 1e-9) return 0;

    const x = X / sum;
    const y = Y / sum;
    if (y <= 1e-9) return 0;

    // McCamy approximation
    const n = (x - 0.332) / (y - 0.1858);
    const cct = 449 * Math.pow(n, 3) + 3525 * Math.pow(n, 2) + 6823.3 * n + 5520.33;
    if (!Number.isFinite(cct)) return 0;
    return Math.round(Math.max(1000, Math.min(20000, cct)));
  }

  function inferCri(r: number, g: number, b: number): number {
    const sum = Math.max(1, r + g + b);
    const balance = 1 - (Math.max(r, g, b) - Math.min(r, g, b)) / sum;
    return Math.round(60 + balance * 30);
  }

  function inferCriFromSpectre(spectre: number[], fallbackRgb: { r: number; g: number; b: number }): number {
    if (!Array.isArray(spectre) || spectre.length < 8) return inferCri(fallbackRgb.r, fallbackRgb.g, fallbackRgb.b);
    const vals = spectre.filter((v) => Number.isFinite(v)).map((v) => Number(v));
    if (vals.length < 8) return inferCri(fallbackRgb.r, fallbackRgb.g, fallbackRgb.b);

    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (mean <= 1e-9) return inferCri(fallbackRgb.r, fallbackRgb.g, fallbackRgb.b);

    const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length;
    const stdev = Math.sqrt(variance);
    const smoothness = 1 - Math.min(1, stdev / mean);
    return Math.round(60 + smoothness * 35);
  }

  function extractChannelValues(payload: unknown): number[] {
    if (!payload || typeof payload !== 'object') return [];
    const obj = payload as Record<string, unknown>;

    const direct = obj.canaux ?? obj.channels ?? obj.state ?? obj.etat;
    if (Array.isArray(direct)) return direct.map((v) => (typeof v === 'number' ? v : Number(v) || 0));

    if (direct && typeof direct === 'object') {
      const values: number[] = [];
      for (let i = 0; i < 64; i++) {
        const raw = (direct as Record<string, unknown>)[String(i)];
        if (raw === undefined) break;
        values.push(typeof raw === 'number' ? raw : Number(raw) || 0);
      }
      if (values.length > 0) return values;
    }

    if ('0' in obj) {
      const values: number[] = [];
      for (let i = 0; i < 64; i++) {
        const raw = obj[String(i)];
        if (raw === undefined) break;
        values.push(typeof raw === 'number' ? raw : Number(raw) || 0);
      }
      if (values.length > 0) return values;
    }

    return [];
  }

  function normalizePlaquePayload(payload: unknown, plaqueId: number): unknown {
    if (!payload || typeof payload !== 'object') return payload;
    const obj = payload as Record<string, unknown>;
    if ('canaux' in obj || 'channels' in obj || 'state' in obj || 'etat' in obj) return payload;

    const key = String(plaqueId);
    if (key in obj) return obj[key];
    return payload;
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('crg_mp_token') ?? '';
    if (stored) setMpToken(stored);

    const snoozed = window.localStorage.getItem('crg_mp_snooze_session') ?? '';
    if (snoozed) setMpSnoozedSessionId(snoozed);
  }, []);

  useEffect(() => {
    if (view !== 'main') return;
    let alive = true;
    let timer = 0;

    const tick = async () => {
      if (!alive) return;
      try {
        const qs = mpToken ? `?token=${encodeURIComponent(mpToken)}` : '';
        const res = await fetch(`/api/multiplayer/state${qs}`, { cache: 'no-store' });
        if (!res.ok) {
          timer = window.setTimeout(tick, 700);
          return;
        }
        const data = (await res.json()) as any;
        if (!data?.ok) {
          timer = window.setTimeout(tick, 700);
          return;
        }

        setMpSessionId(String(data.sessionId ?? ''));
        setMpStatus(data.status === 'active' ? 'active' : data.status === 'finished' ? 'finished' : '');
        setMpState((data.state ?? null) as MpState | null);
        setMpPlayers(
          Array.isArray(data.players)
            ? data.players
                .map((p: any) => ({ seat: Number(p.seat) as MpSeat, name: String(p.name ?? '') }))
                .filter((p: any) => Number.isFinite(p.seat) && p.seat >= 1 && p.seat <= 8)
            : [],
        );
        setMpSeat(
          Number.isFinite(Number(data.you?.seat)) && Number(data.you?.seat) >= 1 && Number(data.you?.seat) <= 8
            ? (Number(data.you?.seat) as MpSeat)
            : null,
        );

        const isMp = String(data.gameId ?? '') === 'split-screen';
        const status = String(data.status ?? '');
        if (isMp && status === 'active') {
          if (mpEndPrompt) setMpEndPrompt(false);
          const sessionId = String(data.sessionId ?? '');
          const youSeat =
            Number.isFinite(Number(data.you?.seat)) && Number(data.you?.seat) >= 1 && Number(data.you?.seat) <= 8
              ? (Number(data.you?.seat) as MpSeat)
              : null;

          if (!youSeat) {
            if (currentUser && !mpJoinPrompt.open && sessionId && sessionId !== mpSnoozedSessionId) {
              setMpJoinPrompt({ open: true, sessionId });
            }
          } else {
            // Only auto-follow if user has previously joined this session
            // Don't auto-start just because a session exists
            if (mpAutoFollow && mpToken && youSeat) {
              if (currentGame !== 'multiplayer-split') setCurrentGame('multiplayer-split');
              if (!gameActive) setGameActive(true);
            }
          }
        }

        if (isMp && status === 'finished') {
          if (currentGame === 'multiplayer-split' && gameActive && !mpEndPrompt && mpSeat === 1) setMpEndPrompt(true);
        }
      } catch {
        // ignore
      } finally {
        const nextDelay = currentGame === 'multiplayer-split' || mpStatus === 'active' ? 350 : 700;
        timer = window.setTimeout(tick, nextDelay);
      }
    };

    void tick();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [view, mpToken, currentGame, gameActive, mpSnoozedSessionId]);

  useEffect(() => {
    if (view !== 'main') return;
    let alive = true;
    let timer = 0;

    const tick = async () => {
      if (!alive) return;
      try {
        const res = await fetch('/api/games', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json().catch(() => null)) as any;
        if (!json || json.ok !== true || !Array.isArray(json.games)) return;
        if (alive) setDbGames(json.games);
      } catch {
        // ignore (offline / serveur pas prêt)
      } finally {
        if (alive) {
          timer = window.setTimeout(tick, 30000);
        }
      }
    };

    void tick();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [view]);

  useEffect(() => {
    let stopped = false;
    let timer = 0;

    const poll = async () => {
      if (stopped) return;

      const t0 = performance.now();
      let json: unknown = null;

      try {
        const res = await fetch(`/api/supervision/state/plaque/${INSTRUMENT_PLATE_ID}/all`, { cache: 'no-store' });
        if (res.ok) json = (await res.json().catch(() => null)) as unknown;
      } catch {
        json = null;
      }

      if (!json) {
        try {
          const res = await fetch(`/api/supervision/state/plaque/${INSTRUMENT_PLATE_ID}`, { cache: 'no-store' });
          if (res.ok) json = (await res.json().catch(() => null)) as unknown;
        } catch {
          json = null;
        }
      }

      const t1 = performance.now();
      const apiLatency = `${Math.round(t1 - t0)}ms`;

      const plaquePayload = normalizePlaquePayload(json, INSTRUMENT_PLATE_ID);
      const channels = extractChannelValues(plaquePayload);
      const used = channels.slice(0, 32);
      const sum = used.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);

      const payloadObj = plaquePayload && typeof plaquePayload === 'object' ? (plaquePayload as Record<string, unknown>) : null;
      const rgbFromApi = payloadObj && Array.isArray(payloadObj.rgb) ? (payloadObj.rgb as number[]) : null;
      const spectreFromApi = payloadObj && Array.isArray(payloadObj.spectre) ? (payloadObj.spectre as number[]) : null;

      const bBand = used.slice(0, 7).reduce((a, b) => a + b, 0);
      const gBand = used.slice(7, 17).reduce((a, b) => a + b, 0);
      const rBand = used.slice(17).reduce((a, b) => a + b, 0);

      const tempKFromRgb = rgbFromApi ? rgbToCctK(rgbFromApi) : 0;
      const tempK = tempKFromRgb > 0 ? tempKFromRgb : inferColorTempK(rBand, gBand, bBand);
      const cri = inferCriFromSpectre(spectreFromApi || [], { r: rBand, g: gBand, b: bBand });

      setInstrument({
        colorTemp: tempK > 0 ? `${tempK}K` : '—',
        cri: `${cri}`,
        power: `${Math.floor(sum * 3)}W`,
        apiLatency,
      });

      timer = window.setTimeout(poll, 1500);
    };

    void poll();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!gameActive) return;
    if (currentGame !== 'multiplayer-split') return;
    if (!mpState) return;
    if (mpEndPrompt) return;
    if (Number(mpState.endsAtMs ?? 0) <= 0) return;
    const activeSeats = mpPlayers.map((p) => p.seat);
    const ch32 = computeTeamChannels32FromState(mpState, { activeSeats });
    applyChannels32ToSelectedPlates(ch32);
  }, [mpState, currentGame, gameActive, mpPlayers]);

  useEffect(() => {
    if (!gameActive) return;
    if (currentGame !== 'multiplayer-split') return;
    if (!mpState) return;

    let t = 0;
    const tick = () => setMpNowMs(Date.now());
    tick();
    t = window.setInterval(tick, 1000);
    return () => {
      if (t) window.clearInterval(t);
    };
  }, [gameActive, currentGame, mpState?.endsAtMs]);

  // Fetch current colors when beginner-control game starts
  useEffect(() => {
    if (!gameActive) return;
    if (currentGame !== 'beginner-control') return;

    const fetchCurrentColors = async () => {
      try {
        const targets = getTargetPlateIds();
        if (targets.length === 0) return;

        // Fetch state from first selected plate
        const plaqueId = targets[0];
        const res = await fetch(`/api/supervision/state/plaque/${plaqueId}`, { cache: 'no-store' });
        if (!res.ok) return;

        const data = (await res.json().catch(() => null)) as any;
        if (!data) return;

        // Extract channel values
        const channels = extractChannelValues(data);
        const ch32 = channels.slice(0, 32);

        // Calculate average intensity
        const avgIntensity = ch32.reduce((a, b) => a + b, 0) / 32;
        const intensityPercent = Math.round((avgIntensity / 255) * 100);

        // Convert spectrum to RGB
        const rgb = spectrum32ToRgb255(ch32);

        // Update state with fetched values
        setBeginnerRgb({ r: rgb.r, g: rgb.g, b: rgb.b });
        setMasterIntensity(intensityPercent);
        setLedValues(() => {
          const next: Record<number, number> = {};
          for (let i = 0; i < 32; i++) next[i] = ch32[i] ?? 0;
          return next;
        });

        setMessage('Couleurs actuelles chargées depuis les plaques.');
      } catch {
        // Silently fail - keep default values
      }
    };

    void fetchCurrentColors();
  }, [gameActive, currentGame]);

  async function ensureMpJoined(name?: string): Promise<{ token: string; seat: MpSeat } | null> {
    if (mpToken && mpSeat != null && mpSeat >= 1 && mpSeat <= 8) return { token: mpToken, seat: mpSeat };
    try {
      const res = await fetch('/api/multiplayer/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name && name.trim() ? name.trim() : 'Guest' }),
      });
      const data = (await res.json()) as any;
      if (!data?.ok) return null;
      const token = String(data.token ?? '');
      const seat: MpSeat = Number(data.seat) as MpSeat;
      setMpToken(token);
      window.localStorage.setItem('crg_mp_token', token);
      setMpSeat(seat);
      return { token, seat };
    } catch {
      return null;
    }
  }

  function applyChannels32ToSelectedPlates(channels32: number[]) {
    const targets = getTargetPlateIds();
    for (const plaqueId of targets) {
      for (let i = 0; i < 32; i++) scheduleSetCanal(plaqueId, i, clamp255(channels32[i] ?? 0));
    }

    const preview = channels32ToPreviewRgb255(channels32, 255);
    setSelectedPlatesColor(rgbToCss(preview), true);
  }

  function computeTeamChannels32FromState(
    state: MpState,
    opts?: { activeSeats?: MpSeat[]; overrideSeat?: MpSeat; overrideValue?: number },
  ): number[] {
    const out = Array(32).fill(0);
    const entries = Object.entries((state as any)?.channelBySeat ?? {}) as Array<[string, number]>;
    const active = opts?.activeSeats && opts.activeSeats.length ? new Set(opts.activeSeats) : null;
    for (const [seatStr, ch1to32] of entries) {
      const seat = Number(seatStr) as MpSeat;
      if (!Number.isFinite(seat) || seat < 1 || seat > 8) continue;
      if (active && !active.has(seat)) continue;
      const idx = Number(ch1to32) - 1;
      if (!Number.isFinite(idx) || idx < 0 || idx >= 32) continue;

      const base = Number((state as any)?.submittedValueBySeat?.[seat] ?? 0);
      const v = opts?.overrideSeat === seat ? Number(opts?.overrideValue ?? 0) : base;
      out[idx] = clamp255(v);
    }
    return out;
  }

  function computeTargetChannels32FromState(state: MpState, activeSeats?: MpSeat[]): number[] {
    const out = Array(32).fill(0);
    const entries = Object.entries((state as any)?.channelBySeat ?? {}) as Array<[string, number]>;
    const active = activeSeats && activeSeats.length ? new Set(activeSeats) : null;
    for (const [seatStr, ch1to32] of entries) {
      const seat = Number(seatStr) as MpSeat;
      if (!Number.isFinite(seat) || seat < 1 || seat > 8) continue;
      if (active && !active.has(seat)) continue;
      const idx = Number(ch1to32) - 1;
      if (!Number.isFinite(idx) || idx < 0 || idx >= 32) continue;
      const t = Number((state as any)?.targetValueBySeat?.[seat] ?? 0);
      out[idx] = clamp255(t);
    }
    return out;
  }

  const mpSubmitTimerRef = useRef<number>(0);
  const mpPendingValueRef = useRef<number>(0);
  async function mpSubmitValue(value: number) {
    mpPendingValueRef.current = value;
    if (mpSubmitTimerRef.current) window.clearTimeout(mpSubmitTimerRef.current);
    mpSubmitTimerRef.current = window.setTimeout(() => {
      void (async () => {
        const joined = await ensureMpJoined(currentUser ?? undefined);
        if (!joined) return;
        try {
          await fetch('/api/multiplayer/submit', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token: joined.token, value: mpPendingValueRef.current }),
          });
        } catch {
          // ignore
        }
      })();
    }, 120);
  }

  function updateLeaderboard(nextScore: number, nextNiveau: Niveau, name: string) {
    setLeaderboard((prev) => {
      const copy = [...prev];
      const idx = copy.findIndex((e) => e.name === name);
      if (idx >= 0) copy[idx] = { ...copy[idx], score: nextScore, niveau: nextNiveau };
      else copy.push({ name, score: nextScore, niveau: nextNiveau });
      copy.sort((a, b) => b.score - a.score);
      return copy.slice(0, 10);
    });
  }

  function setPlateColor(index: number, color: string, active: boolean) {
    setPlateColors((prev) => {
      const copy = [...prev];
      copy[index] = color;
      return copy;
    });
    setPlateActive((prev) => {
      const copy = [...prev];
      copy[index] = active;
      return copy;
    });
  }

  function setAllPlates(color: string, active = true) {
    setPlateColors(Array(9).fill(color));
    setPlateActive(Array(9).fill(active));
  }

  const hudGraphRunRef = useRef<{ timers: number[]; stop: boolean }>({ timers: [], stop: false });

  const stopHudGraph = () => {
    hudGraphRunRef.current.stop = true;
    for (const t of hudGraphRunRef.current.timers) window.clearTimeout(t);
    hudGraphRunRef.current.timers = [];
  };

  const runHudGraphFrom = (startNodeId: string) => {
    if (!hudRun?.cfg) return;
    stopHudGraph();
    hudGraphRunRef.current.stop = false;

    const g = buildGraph(hudRun.cfg);
    const start = g.byId.get(String(startNodeId));
    if (!start || start.enabled === false) return;

    const getNum = (o: Record<string, unknown>, key: string, fallback: number): number => {
      const v = Number((o as any)[key]);
      return Number.isFinite(v) ? v : fallback;
    };
    const getColor = (o: Record<string, unknown>, key: string, fallback: string): string => {
      const v = (o as any)[key];
      return typeof v === 'string' && v.trim() ? String(v) : fallback;
    };

    const execNode = (node: EditorNode, tSeconds: number) => {
      const params = (node.params && typeof node.params === 'object' ? node.params : {}) as Record<string, unknown>;

      if (node.kind === 'fill') {
        const color = getColor(params, 'color', '#4361ee');
        const intensity = intensityToMasterPercent(params.intensity, masterIntensity);
        setMasterIntensity(intensity);

        const mask = String(params.mask ?? 'all');
        if (mask === 'all') {
          setAllPlates(color, intensity > 0);
        } else if (mask === 'border' || mask === 'borders') {
          setPlateColors((prev) => {
            const next = [...prev];
            for (let i = 0; i < 9; i++) {
              if (i === 4) continue;
              next[i] = color;
            }
            return next;
          });
          setPlateActive((prev) => {
            const next = [...prev];
            for (let i = 0; i < 9; i++) {
              if (i === 4) continue;
              next[i] = intensity > 0;
            }
            return next;
          });
        } else {
          setSelectedPlatesColor(color, intensity > 0);
        }
      }

      if (node.kind === 'tile') {
        const tileIndex = Math.max(0, Math.min(8, Math.round(getNum(params, 'tileIndex', 0))));
        const color = getColor(params, 'color', '#4361ee');
        const intensity = intensityToMasterPercent(params.intensity, masterIntensity);
        setMasterIntensity(intensity);
        setPlateColor(tileIndex, color, intensity > 0);
      }

      if (node.kind === 'pulse') {
        const baseColor = getColor(params, 'baseColor', getColor(params, 'color', '#4361ee'));
        const targetColor = getColor(params, 'targetColor', getColor(params, 'color', '#ff2aa6'));
        const speed = Math.max(0.01, getNum(params, 'speed', 1));
        const phase = getNum(params, 'phase', 0);
        const t01 = Math.max(0, Math.min(1, 0.5 + 0.5 * Math.sin(tSeconds * speed + phase)));

        const fromIntensity = Math.max(0, Math.min(1, getNum(params, 'fromIntensity', 0.15)));
        const toIntensity = Math.max(0, Math.min(1, getNum(params, 'toIntensity', 0.8)));
        const intensity = clamp100((fromIntensity + (toIntensity - fromIntensity) * t01) * 100);
        setMasterIntensity(intensity);
        setSelectedPlatesColor(lerpColor(baseColor, targetColor, t01), intensity > 0);
      }
    };

    const walk = (nodeId: string) => {
      if (hudGraphRunRef.current.stop) return;
      const node = g.byId.get(nodeId);
      if (!node || node.enabled === false) return;

      const params = (node.params && typeof node.params === 'object' ? node.params : {}) as Record<string, unknown>;

      if (node.kind === 'ui_event_click' || node.kind === 'ui_event_change' || node.kind === 'ui_event_hover' || node.kind === 'event_begin') {
        const nextId = g.out.get(node.id)?.[0];
        if (nextId) walk(nextId);
        return;
      }

      if (node.kind === 'wait') {
        const seconds = Math.max(0, getNum(params, 'seconds', 1));
        const nextId = g.out.get(node.id)?.[0];
        const t = window.setTimeout(() => {
          if (nextId) walk(nextId);
        }, Math.round(seconds * 1000));
        hudGraphRunRef.current.timers.push(t);
        return;
      }

      const nowSec = Date.now() / 1000;
      execNode(node, nowSec);

      const secondsAfter = node.kind === 'fill' ? Math.max(0.01, getNum(params, 'seconds', 1)) : 0;
      const nextId = g.out.get(node.id)?.[0];
      if (!nextId) return;
      if (secondsAfter > 0) {
        const t = window.setTimeout(() => {
          walk(nextId);
        }, Math.round(secondsAfter * 1000));
        hudGraphRunRef.current.timers.push(t);
      } else {
        walk(nextId);
      }
    };

    walk(start.id);
  };

  function resetScene() {
    setPlateColors(Array(9).fill('#000000'));
    setPlateActive(Array(9).fill(false));
    setLedValues({});
    setMasterIntensity(80);
    setBeginnerRgb({ r: 0, g: 0, b: 0 });
    setInstrument((prev) => ({ ...prev, power: '0W' }));
    void blackoutHardware();
  }

  function login() {
    if (!username.trim()) {
      setMessage('Veuillez entrer votre nom');
      return;
    }

    setCurrentUser(username.trim());
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('crg_user_type', userType);
    }
    setView('main');
    setScore(0);
    setGamesCompleted(0);
    updateLeaderboard(0, niveau, username.trim());
  }

  function logout() {
    setCurrentUser(null);
    setView('login');
    setGameActive(false);
    setCurrentGame(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('crg_user_type');
    }
    setScore(0);
    setGamesCompleted(0);
    setMessage('Sélectionnez un jeu et cliquez sur "Démarrer le Jeu"');
    resetScene();
  }

  function startCustomFromDb(game: { id: string; name: string; config: unknown }) {
    const cfg = parseCustomConfig(game.config);
    setCustomRun({ gameId: game.id, name: game.name, cfg });
    setHudRun(null);
    setCurrentGame(null);
    setGameActive(true);
    setMessage(`Jeu custom: ${game.name}`);
    resetScene();
  }

  function startHudFromDb(game: { id: string; name: string; config: unknown }) {
    const cfg = parseEditorGameConfig(game.config);
    if (!cfg) {
      setMessage('Jeu éditeur: config invalide');
      return;
    }

    // Ajout d'une interface simple pour White Master
    const showHud = Boolean(cfg.ui && Array.isArray(cfg.ui.widgets) && cfg.ui.widgets.length > 0);
    setHudRun({ gameId: game.id, name: game.name, cfg, showHud });
    setCustomRun(null);
    setCurrentGame(null);
    setGameActive(true);
    
    // Message d'instructions pour White Master
    if (game.name.toLowerCase().includes('white master') || game.name.toLowerCase().includes('maître du blanc')) {
      setMessage(`Jeu éditeur: ${game.name} - Observez bien les différentes teintes de blanc !`);
    } else {
      setMessage(`Jeu éditeur: ${game.name}`);
    }
    resetScene();

    // V1-A: simulation via computeTiles() (moteur partagé) dans un raf loop.
  }

  function customRunUpdateVar(name: string, value: CustomGameVarValue) {
    setCustomRun((prev) => {
      if (!prev) return prev;
      return { ...prev, cfg: { ...prev.cfg, vars: { ...prev.cfg.vars, [name]: value } } };
    });
  }

  function selectGame(id: GameId) {
    setCurrentGame(id);
    const game = games.find((g) => g.id === id);
    if (game) setMessage(`Jeu sélectionné: ${game.name}. Cliquez sur "Démarrer le Jeu".`);
  }

  function stopGame() {
    if (currentGame === 'multiplayer-split' && gameActive) {
      if (mpSeat !== 1) {
        setMessage('Seul le joueur 1 peut arrêter la partie multijoueur.');
        return;
      }
      void fetch('/api/multiplayer/stop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: mpToken || undefined }),
      }).catch(() => null);
    }
    setGameActive(false);
    setCustomRun(null);
    setHudRun(null);
    setSecretRevealed(false);
    setTargetColor(null);
    setTargetTemp(null);
    setEscapeProgress(0);
    setMpEndPrompt(false);
    setMpAutoFollow(false);
    setMessage('Jeu arrêté.');
    resetScene();
    stopHudGraph();
  }

  function startGame() {
    if (!currentGame) {
      setMessage('Veuillez d\'abord sélectionner un jeu.');
      return;
    }

    const mpActiveBlocked =
      mpStatus === 'active' && !!mpSessionId && mpSeat == null && !!mpSnoozedSessionId && mpSnoozedSessionId === mpSessionId;
    if (mpActiveBlocked && currentGame !== 'multiplayer-split') {
      setMessage('Une session multijoueur est active. Sélectionne le jeu Multijoueur pour rejoindre.');
      return;
    }

    setGameActive(true);

    if (currentGame === 'fluorescence') {
      setSecretRevealed(false);
      setMessage('Activez l\'éclairage UV pour révéler le message secret.');
      resetScene();
      return;
    }

    if (currentGame === 'beginner-control') {
      setMessage('Pilotez la dalle en RGB + intensité (conversion automatique vers les 32 canaux). Cliquez sur une dalle (P1..P9) pour choisir la/les plaques à contrôler.');
      resetScene();
      setAllPlates('rgb(0,0,0)', true);
      return;
    }

    if (currentGame === 'color-cancel') {
      setMessage('Faites disparaître le motif en ajustant l\'éclairage.');
      const pattern = new Set([0, 2, 4, 6, 8]);
      for (let i = 0; i < 9; i++) {
        setPlateColor(i, pattern.has(i) ? '#ff0000' : '#00ff00', true);
      }
      setCancelColor({ r: 0, g: 0 });
      return;
    }

    if (currentGame === 'color-match') {
      const t: TargetColor = {
        r: Math.floor(Math.random() * 256),
        g: Math.floor(Math.random() * 256),
        b: Math.floor(Math.random() * 256),
      };
      setTargetColor(t);
      setUserColor({ r: 0, g: 0, b: 0 });
      setMessage('Reproduisez la couleur de référence avec les curseurs RGB.');
      resetScene();
      for (let i = 0; i < 3; i++) setPlateColor(i, rgbToCss(t), true);
      for (let i = 3; i < 6; i++) setPlateColor(i, 'rgb(0,0,0)', true);
      return;
    }

    if (currentGame === 'white-balance') {
      setMessage('Créez différents types de blanc en ajustant la température.');
      const targets: TargetTemp[] = [
        { name: 'Blanc froid (6500K)', temp: 6500 },
        { name: 'Blanc neutre (5000K)', temp: 5000 },
        { name: 'Blanc chaud (3000K)', temp: 3000 },
      ];
      const pick = targets[Math.floor(Math.random() * targets.length)];
      setTargetTemp(pick);
      setCurrentTemp(5000);
      resetScene();
      setAllPlates('rgb(255,240,220)', true);
      return;
    }

    if (currentGame === 'spectrum-challenge') {
      setMessage('Composez un spectre lumineux avec les 32 types de LED.');
      resetScene();
      return;
    }

    if (currentGame === 'multiplayer-split') {
      setMessage('Multijoueur: rejoins une partie existante ou démarre la session sur ce poste.');
      resetScene();
      setMpEndPrompt(false);
      setMpAutoFollow(true);
      setMpSnoozedSessionId('');
      window.localStorage.removeItem('crg_mp_snooze_session');
      void (async () => {
        // Host-claim: start will also create the host player (seat 1) and return token+seat.
        // This does NOT start the timer (lobby mode), it only prepares the session.
        try {
          const res = await fetch('/api/multiplayer/start', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ reset: true, name: currentUser ?? undefined }),
          });
          const data = (await res.json().catch(() => null)) as any;
          if (data?.ok && typeof data.token === 'string' && Number.isFinite(Number(data.seat))) {
            setMpToken(String(data.token));
            window.localStorage.setItem('crg_mp_token', String(data.token));
            setMpSeat(Number(data.seat) as MpSeat);
            setMpSessionId(String(data.sessionId ?? ''));
          }
        } catch {
          // ignore
        }
      })();
      return;
    }

    if (currentGame === 'escape-game') {
      setEscapeProgress(0);
      setEscapeError('');
      setMessage('Escape Game: Résolvez 3 énigmes lumineuses.');
      resetScene();
      // Only select first plate for the escape game (single plate mode)
      setSelectedPlates([0], true);
      return;
    }
  }

  function awardPoints(points: number, text: string) {
    if (!currentUser) return;
    const safePoints = Math.max(0, Math.floor(points));
    const nextScore = score + safePoints;
    setScore(nextScore);
    updateLeaderboard(nextScore, niveau, currentUser);
    setMessage(text);

    if (safePoints > 0) {
      setScorePlusValue(safePoints);
      setScorePlusAnimKey((k) => k + 1);
    }
  }

  function award(points: number, text: string) {
    awardPoints(points, text);
    setGamesCompleted((v) => v + 1);
  }

  function extractRgbFromCss(css: string): { r: number; g: number; b: number } {
    const match = css.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
    }
    return { r: 0, g: 0, b: 0 };
  }

  const [escapeError, setEscapeError] = useState<string>('');

  function checkEscapeProgress() {
    // Énigme 1: plaques impaires actives (1,3,5,7,9 -> index 0,2,4,6,8)
    if (escapeProgress === 0) {
      const oddPlatesActive = [0, 2, 4, 6, 8].every(i => plateActive[i]);
      const evenPlatesInactive = [1, 3, 5, 7].every(i => !plateActive[i]);
      if (oddPlatesActive && evenPlatesInactive) {
        setEscapeProgress(1);
        setMessage('Énigme 1 réussie! Passez à l\'énigme 2.');
        setEscapeError('');
        awardPoints(50, 'Énigme 1 résolue! +50 points.');
      } else {
        setEscapeError('Raté! Activez les plaques impaires (1,3,5,7,9) et désactivez les paires.');
        setMessage('');
      }
      return;
    }

    // Énigme 2: dégradé de bleu
    if (escapeProgress === 1) {
      const darkBlue = [0, 1, 2].every(i => plateColors[i].includes('0,0,'));
      const medBlue = [3, 4, 5].every(i => plateColors[i].includes('100,150,255'));
      const lightBlue = [6, 7, 8].every(i => plateColors[i].includes('150,200,255'));
      
      if (darkBlue && medBlue && lightBlue) {
        setEscapeProgress(2);
        setMessage('Énigme 2 réussie! Passez à l\'énigme finale.');
        setEscapeError('');
        awardPoints(100, 'Énigme 2 résolue! +100 points.');
      } else {
        setEscapeError('Raté! Créez un dégradé de bleu: plaques 1-3 bleu foncé, 4-6 bleu moyen, 7-9 bleu clair.');
        setMessage('');
      }
      return;
    }

    // Énigme 3: RGB(255,215,0) - Or
    if (escapeProgress === 2) {
      const allGold = plateColors.every(c => {
        const rgb = extractRgbFromCss(c);
        return rgb.r >= 240 && rgb.r <= 255 && rgb.g >= 200 && rgb.g <= 220 && rgb.b >= 0 && rgb.b <= 20;
      });
      
      if (allGold) {
        setEscapeProgress(3);
        setEscapeError('');
        award(150, 'Escape Game réussi! Vous vous êtes échappé! +150 points.');
      } else {
        setEscapeError('Raté! Réglez toutes les plaques sur RGB(255,215,0) - couleur or.');
        setMessage('');
      }
    }
  }

  function activateUV() {
    setAllPlates('#8b00ff', true);
    setSecretRevealed(true);

    // UV/Fluorescence: utiliser les canaux violets (1..3) directement.
    // Intensité sur 0..100 (cohérent avec l'affichage des canaux dans /state).
    const uv = Array(32).fill(0);
    uv[0] = 95; // Canal 1: violet foncé
    uv[1] = 75; // Canal 2: violet clair
    uv[2] = 30; // Canal 3: bleu violet (réduit)
    uv[12] = 40; // Canal 13: rouge cerise (plus présent)
    uv[13] = 18; // Canal 14: rouge cerise (léger)
    sendChannelsToHardware(uv, 100);

    window.setTimeout(() => {
      award(50, 'Bravo! Message révélé par fluorescence. +50 points.');
    }, 600);
  }

  function adjustCancelLight(channel: 'r' | 'g', value: number) {
    const next = { ...cancelColor, [channel]: value };
    setCancelColor(next);
    const color = `rgb(${next.r}, ${next.g}, 0)`;
    for (let i = 0; i < 9; i++) setPlateColor(i, color, true);
    sendRgbToHardware({ r: next.r, g: next.g, b: 0 });
  }

  function checkColorCancel() {
    const diff = Math.abs(cancelColor.r - cancelColor.g);
    if (diff < 30) award(100, 'Excellent! Le motif a disparu. +100 points.');
    else setMessage('Le contraste est encore visible. Égalisez rouge et vert.');
  }

  function adjustMatchColor(channel: keyof TargetColor, value: number) {
    const next = { ...userColor, [channel]: value };
    setUserColor(next);
    const css = rgbToCss(next);
    for (let i = 3; i < 6; i++) setPlateColor(i, css, true);
    sendRgbToHardware(next);
  }

  function checkColorMatch() {
    if (!targetColor) return;
    const error = Math.sqrt(
      Math.pow(targetColor.r - userColor.r, 2) +
        Math.pow(targetColor.g - userColor.g, 2) +
        Math.pow(targetColor.b - userColor.b, 2),
    );
    const maxError = Math.sqrt(3 * Math.pow(255, 2));
    const accuracy = Math.max(0, 100 - (error / maxError) * 100);
    const points = Math.floor(accuracy * 2);
    award(points, `Précision: ${accuracy.toFixed(1)}% — +${points} points.`);
  }

  function adjustWhiteBalance(temp: number) {
    setCurrentTemp(temp);
    let r: number;
    let g: number;
    let b: number;

    if (temp <= 3000) {
      r = 255;
      g = 200;
      b = 150;
    } else if (temp <= 5000) {
      r = 255;
      g = 240;
      b = 220;
    } else {
      r = 220;
      g = 240;
      b = 255;
    }

    const css = `rgb(${r}, ${g}, ${b})`;
    setAllPlates(css, true);
    sendRgbToHardware({ r, g, b });
  }

  function checkWhiteBalance() {
    if (!targetTemp) return;
    const error = Math.abs(currentTemp - targetTemp.temp);
    const accuracy = Math.max(0, 100 - error / 50);
    const points = Math.floor(accuracy * 1.5);
    award(points, `Écart: ${error}K — Précision: ${accuracy.toFixed(1)}% — +${points} points.`);
  }

  function adjustLED(index: number, value: number) {
    setLedValues((prev) => ({ ...prev, [index]: value }));

    const targets = getTargetPlateIds();
    for (const plaqueId of targets) scheduleSetCanal(plaqueId, index, value);

    const next = { ...ledValues, [index]: value };

    const channels32: number[] = [];
    for (let i = 0; i < 32; i++) channels32[i] = clamp255(next[i] || 0);
    const preview = channels32ToPreviewRgb255(channels32, 255);
    setHardwarePreviewCss(rgbToCss(preview));

    const totalPower = Object.values(next).reduce((sum, val) => sum + val, 0);
    setInstrument((prev) => ({ ...prev, power: `${Math.floor(totalPower * 3)}W` }));
  }

  function adjustBeginnerChannel(index: number, rawValue: number) {
    const raw = clamp255(rawValue);
    setLedValues((prev) => {
      const next = { ...prev, [index]: raw };

      const scale = masterIntensity / 255;
      const effective = clamp255(raw * scale);
      const targets = getTargetPlateIds();
      for (const plaqueId of targets) scheduleSetCanal(plaqueId, index, effective);

      const channels32: number[] = [];
      for (let i = 0; i < 32; i++) channels32.push(clamp255((next[i] ?? 0) * scale));
      const preview = spectrum32ToRgb255(channels32);
      setAllPlates(rgbToCss(preview), true);

      const totalPower = channels32.reduce((sum, v) => sum + v, 0);
      setInstrument((p) => ({ ...p, power: `${Math.floor(totalPower * 3)}W` }));

      return next;
    });
  }

  const rgbDebounceRef = useRef<number>(0);
  const intensityDebounceRef = useRef<number>(0);
  const pendingRgbRef = useRef<TargetColor>({ r: 0, g: 0, b: 0 });
  const pendingIntensityRef = useRef<number>(80);

  function adjustBeginnerRgb(channel: keyof TargetColor, value: number) {
    const next = { ...beginnerRgb, [channel]: clamp255(value) };
    setBeginnerRgb(next);
    pendingRgbRef.current = next;
    
    // Update plates immediately for responsive UI
    applyBeginnerRgbLocal(next, masterIntensity);
    
    // Debounce API call
    if (rgbDebounceRef.current) window.clearTimeout(rgbDebounceRef.current);
    rgbDebounceRef.current = window.setTimeout(() => {
      applyBeginnerRgb(pendingRgbRef.current, masterIntensity);
    }, 80);
  }

  function adjustBeginnerIntensity(v: number) {
    const nextIntensity = clamp100(v);
    setMasterIntensity(nextIntensity);
    pendingIntensityRef.current = nextIntensity;
    
    // Update plates immediately for responsive UI
    applyBeginnerRgbLocal(beginnerRgb, nextIntensity);
    
    // Debounce API call
    if (intensityDebounceRef.current) window.clearTimeout(intensityDebounceRef.current);
    intensityDebounceRef.current = window.setTimeout(() => {
      applyBeginnerRgb(beginnerRgb, nextIntensity);
    }, 80);
  }

  // Local version that updates UI without API calls (for during slider drag)
  function applyBeginnerRgbLocal(rgb: TargetColor, intensity: number) {
    const channels32 = rgbToChannels32(rgb, intensity);
    
    const preview = channels32ToPreviewRgb255(channels32, 100);
    const css = rgbToCss(preview);
    setHardwarePreviewCss(css);
    setSelectedPlatesColor(css, true);
    
    // Update LED values locally
    setLedValues(() => {
      const next: Record<number, number> = {};
      for (let i = 0; i < 32; i++) next[i] = channels32[i];
      return next;
    });

    const totalPower = channels32.reduce((sum, val) => sum + val, 0);
    setInstrument((p) => ({ ...p, power: `${Math.floor(totalPower * 3)}W` }));
  }

  // API version that sends to hardware (debounced)
  function applyBeginnerRgb(rgb: TargetColor, intensity: number) {
    const channels32 = rgbToChannels32(rgb, intensity);
    const targets = getTargetPlateIds();
    for (const plaqueId of targets) {
      for (let i = 0; i < 32; i++) scheduleSetCanal(plaqueId, i, channels32[i]);
    }

    setLedValues(() => {
      const next: Record<number, number> = {};
      for (let i = 0; i < 32; i++) next[i] = channels32[i];
      return next;
    });

    const preview = channels32ToPreviewRgb255(channels32, 100);
    const css = rgbToCss(preview);
    setHardwarePreviewCss(css);
    setSelectedPlatesColor(css, true);

    const totalPower = channels32.reduce((sum, val) => sum + val, 0);
    setInstrument((p) => ({ ...p, power: `${Math.floor(totalPower * 3)}W` }));
  }

  function validateSpectrum() {
    const totalLEDs = Object.keys(ledValues).length;
    const points = totalLEDs * 5;
    award(points, `Spectre validé! ${totalLEDs} LED configurées — +${points} points.`);
  }

  function loadScene(sceneName: string) {
    if (!sceneName) return;

    const scenes: Record<string, string> = {
      daylight: '#ffffff',
      warmwhite: '#ffebcd',
      coolwhite: '#e0f0ff',
      sunset: '#ff6b4a',
      fluorescent: '#8b00ff',
    };

    if (sceneName === 'special') {
      const pattern: string[] = [
        '#ffffff',
        '#d9d9d9',
        '#101214',
        '#bfbfbf',
        '#ffffff',
        '#7a7a7a',
        '#2a2d31',
        '#eaeaea',
        '#000000',
      ];

      const targetIndexes = sceneApplyScope === 'all' ? Array.from({ length: 9 }, (_, i) => i) : getTargetPlateIndexes();
      setPlateColors((prev) => {
        const next = [...prev];
        for (const i of targetIndexes) next[i] = pattern[i] ?? '#ffffff';
        return next;
      });
      setPlateActive((prev) => {
        const next = [...prev];
        for (const i of targetIndexes) next[i] = true;
        return next;
      });

      setHardwarePreviewCss('rgb(255,255,255)');
      setMessage('Scène "Spéciale" chargée.');
      return;
    }

    const color = scenes[sceneName] || '#ffffff';
    if (sceneApplyScope === 'all') setAllPlates(color, true);
    else setSelectedPlatesColor(color, true);
    setMessage(`Scène "${sceneName}" chargée.`);

    if (sceneName === 'daylight') sendRgbToHardware({ r: 255, g: 255, b: 255 });
    else if (sceneName === 'warmwhite') sendRgbToHardware({ r: 255, g: 235, b: 205 });
    else if (sceneName === 'coolwhite') sendRgbToHardware({ r: 224, g: 240, b: 255 });
    else if (sceneName === 'sunset') sendRgbToHardware({ r: 255, g: 107, b: 74 });
    else if (sceneName === 'fluorescent') sendRgbToHardware({ r: 139, g: 0, b: 255 });
    else sendRgbToHardware({ r: 255, g: 255, b: 255 });
  }

  function handlePlateClick(index: number) {
    if (!gameActive) return;

    setPlateActive((prev) => {
      const next = [...prev];
      next[index] = !prev[index];
      const isOn = next[index];

      setPlateColors((prevColors) => {
        const colors = [...prevColors];
        colors[index] = isOn ? '#ffffff' : '#000000';
        return colors;
      });

      const plaqueId = PLATE_ID_BY_INDEX[index] ?? 1;
      const value = isOn ? 255 : 0;
      const channels32: number[] = [];
      for (let canalIndex = 0; canalIndex < 32; canalIndex++) {
        channels32[canalIndex] = value;
        scheduleSetCanal(plaqueId, canalIndex, value);
      }

      setLedValues(() => {
        const next: Record<number, number> = {};
        for (let i = 0; i < 32; i++) next[i] = value;
        return next;
      });
      setHardwarePreviewCss(isOn ? 'rgb(255,255,255)' : 'rgb(0,0,0)');

      return next;
    });
  }

  const currentGameDef = useMemo(() => games.find((g) => g.id === currentGame) || null, [currentGame]);

  return (
    <>
      <div className="header" style={{ ['--tile-shadow-intensity' as any]: clamp100(masterIntensity) / 100 }}>
        <h1>ColorRoomGames</h1>
        <p>Projet BTS CIEL · ENTPE/LTDS · Lycée Édouard Branly · Session 2026</p>
      </div>

      {view === 'main' && mpJoinPrompt.open ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
          }}
          onClick={() => setMpJoinPrompt({ open: false, sessionId: '' })}
        >
          <div
            className="glass"
            style={{ width: 'min(520px, calc(100vw - 32px))', padding: 18, borderRadius: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong style={{ color: '#fff' }}>Session multijoueur détectée</strong>
              <span style={{ opacity: 0.8, fontSize: 12, color: '#fff' }}>ID: {mpJoinPrompt.sessionId || '—'}</span>
            </div>
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9, color: '#fff' }}>
              Un autre poste a lancé le jeu <strong style={{ color: '#fff' }}>Multijoueur — Teintes</strong>.
              <br />
              Voulez-vous rejoindre ? La partie démarrera automatiquement dès qu'il y aura 2 joueurs.
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="btn"
                onClick={() => {
                  const sid = mpJoinPrompt.sessionId || '';
                  setMpJoinPrompt({ open: false, sessionId: '' });
                  if (sid) {
                    setMpSnoozedSessionId(sid);
                    window.localStorage.setItem('crg_mp_snooze_session', sid);
                    setMessage('Session multijoueur active : sélectionne le jeu Multijoueur pour rejoindre.');
                  }
                }}
              >
                Plus tard
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  void (async () => {
                    const joined = await ensureMpJoined(currentUser ?? undefined);
                    if (!joined) {
                      setMessage('Impossible de rejoindre la session (déjà 2 joueurs).');
                      setMpJoinPrompt({ open: false, sessionId: '' });
                      return;
                    }
                    setMpJoinPrompt({ open: false, sessionId: '' });
                    setMpSnoozedSessionId('');
                    window.localStorage.removeItem('crg_mp_snooze_session');
                    setMpAutoFollow(true);
                    setCurrentGame('multiplayer-split');
                    setGameActive(true);
                    setMessage('Session multijoueur rejointe.');
                  })();
                }}
              >
                Rejoindre
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {view === 'main' && mpEndPrompt ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
          }}
          onClick={() => setMpEndPrompt(false)}
        >
          <div
            className="glass"
            style={{ width: 'min(520px, calc(100vw - 32px))', padding: 18, borderRadius: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong style={{ color: '#fff' }}>Partie terminée</strong>
              <span style={{ opacity: 0.8, fontSize: 12, color: '#fff' }}>Score: {mpState?.score ?? 0}</span>
            </div>
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9, color: '#fff' }}>
              Le temps est écoulé. Voulez-vous relancer une nouvelle partie ou quitter le mode multijoueur ?
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="btn"
                onClick={() => {
                  setMpEndPrompt(false);
                  stopGame();
                }}
              >
                Quitter
              </button>
              {mpSeat === 1 ? (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    void (async () => {
                      setMpEndPrompt(false);
                      await fetch('/api/multiplayer/start', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ reset: true, token: mpToken || undefined }),
                      }).catch(() => null);
                      setMpSeat(null);
                      setMpSnoozedSessionId('');
                      window.localStorage.removeItem('crg_mp_snooze_session');
                      setMpAutoFollow(true);
                      await ensureMpJoined(currentUser ?? undefined);
                      setCurrentGame('multiplayer-split');
                      setGameActive(true);
                      setMessage('Nouvelle partie multijoueur lancée.');
                    })();
                  }}
                >
                  Relancer
                </button>
              ) : (
                <div style={{ alignSelf: 'center', fontSize: 12, opacity: 0.85, color: '#fff' }}>Attends le joueur 1…</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {view === 'login' ? (
        <div className="container">
          <div className="login-box glass">
            <h2>Connexion</h2>
            <div className="form-group">
              <label>Type d'utilisateur</label>
              <select value={userType} onChange={(e) => setUserType(e.target.value as UserType)}>
                <option value="apprenant">Apprenant</option>
                <option value="enseignant">Enseignant</option>
              </select>
            </div>

            <div className="form-group">
              <label>Nom d'utilisateur</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Votre nom" />
            </div>

            {userType === 'apprenant' ? (
              <div className="form-group">
                <label>Niveau</label>
                <select value={niveau} onChange={(e) => setNiveau(e.target.value as Niveau)}>
                  <option value="college">Collège</option>
                  <option value="lycee">Lycée</option>
                  <option value="universite">Université</option>
                  <option value="grand-public">Grand Public</option>
                </select>
              </div>
            ) : null}

            <button className="btn btn-success" onClick={login}>
              <LogIn size={18} /> Se connecter
            </button>

            <div style={{ marginTop: 16, fontSize: 12, opacity: 0.75, textAlign: 'center' }}>{message}</div>
          </div>
        </div>
      ) : (
        <div className="container">
          <div className="dashboard">
            <div className="panel glass">
              <div className="section">
                <h3>
                  <Award size={18} /> Profil Utilisateur
                </h3>
                <div className="stats-box">
                  <div className="stat-row">
                    <span className="stat-label">Utilisateur</span>
                    <span className="stat-value">{currentUser || '-'}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Niveau</span>
                    <span className="stat-value">{niveau}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Score</span>
                    <span className="stat-value" style={{ position: 'relative' }}>
                      {score}
                      {scorePlusValue > 0 ? (
                        <span key={scorePlusAnimKey} className="mp-plusone">
                          +{scorePlusValue}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Jeux réussis</span>
                    <span className="stat-value">{gamesCompleted}</span>
                  </div>
                </div>
              </div>

              <div className="section">
                <h3>
                  <Gamepad2 size={18} /> Sélection du Jeu
                </h3>
                <div className="game-list">
                  {games.map((g) => (
                    <div
                      key={g.id}
                      className={`game-card ${g.id === currentGame ? 'selected' : ''}`}
                      onClick={() => selectGame(g.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <h4>{g.name}</h4>
                      <p>{g.description}</p>
                      <div className="stars" aria-label={`Difficulté ${g.difficulty}/4`}>
                        {Array.from({ length: g.difficulty }).map((_, i) => (
                          <Star key={i} size={14} fill="currentColor" />
                        ))}
                        {Array.from({ length: Math.max(0, 4 - g.difficulty) }).map((_, i) => (
                          <Star key={`e_${i}`} size={14} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="section">
                <h3>
                  <Gamepad2 size={18} /> Jeux (base de données)
                </h3>

                <div className="glass" style={{ padding: 12, borderRadius: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>Liste</div>
                    {dbGamesLoading ? <div style={{ fontSize: 12, opacity: 0.75 }}>Chargement…</div> : null}
                  </div>

                  {!dbGamesLoading && dbGames.length <= 0 ? <div style={{ marginTop: 8, opacity: 0.75 }}>Aucun jeu.</div> : null}

                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    {dbGames.map((g) => (
                      <div
                        key={g.id}
                        className="glass"
                        style={{ padding: 10, borderRadius: 14, display: 'flex', justifyContent: 'space-between', gap: 12 }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {g.name}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>
                            Type: {g.kind}
                          </div>
                          {/* Instructions pour White Master */}
                          {(g.name.toLowerCase().includes('white master') || g.name.toLowerCase().includes('maître du blanc')) ? (
                            <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>
                              💡 Observez les différentes teintes de blanc !
                            </div>
                          ) : null}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {String(g.kind) === 'custom' ? (
                            <button className="btn" onClick={() => startCustomFromDb({ id: g.id, name: g.name, config: g.config })}>
                              <Play size={18} />
                            </button>
                          ) : null}
                          {String(g.kind) === 'editor' ? (
                            <button className="btn" onClick={() => startHudFromDb({ id: g.id, name: g.name, config: g.config })}>
                              <Play size={18} />
                            </button>
                          ) : null}
                          <div style={{ fontSize: 12, opacity: 0.65, whiteSpace: 'nowrap' }}>{g.updatedAt}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="section">
                <h3>
                  <Settings2 size={18} /> Contrôles
                </h3>
                <button className="btn btn-success" onClick={startGame} disabled={gameActive}>
                  <Play size={18} /> Démarrer le Jeu
                </button>
                <button className="btn btn-danger" onClick={stopGame} disabled={!gameActive}>
                  <StopCircle size={18} /> Arrêter
                </button>
                <button className="btn btn-warning" onClick={resetScene}>
                  <RefreshCcw size={18} /> Reset Scène
                </button>
                <button className="btn btn-primary" onClick={logout}>
                  <LogOut size={18} /> Déconnexion
                </button>
              </div>
            </div>

            <div className="panel glass">
              <h3>
                <Lightbulb size={18} /> Zone de Jeu - ColorRoom
              </h3>

              <div className="message-box">{message}</div>

              <div className="light-plates-grid">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    className={`light-plate ${plateActive[i] ? 'active' : ''}`}
                    style={{
                      backgroundColor: plateActive[i] ? plateColors[i] : '#1a1a1a',
                      color: plateColors[i],
                    }}
                    onClick={() => handlePlateClick(i)}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="plate-label">P{i + 1}</span>
                  </div>
                ))}
              </div>

              <div>
                {gameActive && customRun ? (
                  <div className="glass" style={{ padding: 14, borderRadius: 18, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <strong>Jeu custom</strong>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>{customRun.name}</span>
                    </div>
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: 360,
                        marginTop: 12,
                        borderRadius: 14,
                        background: 'rgba(0,0,0,0.12)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        overflow: 'hidden',
                      }}
                    >
                      {customRun.cfg.widgets.map((w) => {
                        const commonStyle: React.CSSProperties = {
                          position: 'absolute',
                          left: w.x,
                          top: w.y,
                          width: w.w,
                          height: w.h,
                          border: '1px solid rgba(255,255,255,0.18)',
                          borderRadius: 14,
                          background: 'rgba(255,255,255,0.06)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          padding: 10,
                          color: '#fff',
                          overflow: 'hidden',
                        };

                        if (w.type === 'button') {
                          const pts = Math.max(0, Math.floor(Number((w as any).points ?? 0) || 0));
                          const label = String((w as any).label ?? 'Valider');
                          const msg = String((w as any).message ?? (pts > 0 ? `+${pts} points.` : ''));
                          return (
                            <div key={w.id} style={commonStyle}>
                              <button
                                className="btn btn-success"
                                style={{ width: '100%' }}
                                onClick={() => {
                                  awardPoints(pts, msg);
                                }}
                              >
                                {label}
                              </button>
                            </div>
                          );
                        }

                        if (w.type === 'slider') {
                          const v = customRun.cfg.vars[w.bindVar];
                          const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
                          return (
                            <div key={w.id} style={commonStyle}>
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
                                onChange={(e) => customRunUpdateVar(w.bindVar, Number(e.target.value))}
                                style={{ width: '100%', marginTop: 10 }}
                              />
                            </div>
                          );
                        }

                        if (w.type === 'shape') {
                          const bg = evalColorExpr(w.colorExpr, customRun.cfg.vars);
                          return (
                            <div key={w.id} style={commonStyle}>
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

                        const bg = evalColorExpr(w.colorExpr, customRun.cfg.vars);
                        return (
                          <div key={w.id} style={commonStyle}>
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
                                border: '1px solid rgba(255,255,255,0.18)',
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {gameActive && currentGame === 'fluorescence' ? (
                  <>
                    <div className={`fluorescence-text ${secretRevealed ? 'revealed-text' : 'hidden-text'}`}>
                      LA LUMIÈRE EST ONDE ET PARTICULE
                    </div>
                    <button className="btn btn-primary" onClick={activateUV}>
                      <Sparkles size={18} /> Activer UV (380-400nm)
                    </button>
                  </>
                ) : null}

                {gameActive && currentGame === 'multiplayer-split' ? (
                  <div
                    className="mp-area"
                    style={
                      {
                        ['--mp-slider-a' as any]: mpThemes[mpThemeIndex]?.a ?? '#06d6a0',
                        ['--mp-slider-b' as any]: mpThemes[mpThemeIndex]?.b ?? '#7ef9ff',
                      } as any
                    }
                  >
                    <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
                      Mode coop: 2 à 8 joueurs. Chaque joueur contrôle une teinte (1 canal parmi 32). Objectif: atteindre les cibles ensemble en 2 minutes.
                    </div>

                    {mpState && Number(mpState.endsAtMs ?? 0) <= 0 ? (
                      <div className="glass" style={{ padding: 14, borderRadius: 18, marginTop: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <strong>Lobby</strong>
                          <span style={{ opacity: 0.75, fontSize: 12 }}>Session: {mpSessionId || '—'}</span>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
                          Joueurs connectés: {mpPlayers.length}/8. Le chrono démarre automatiquement dès qu'il y a 2 joueurs.
                        </div>
                        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                          Astuce: ouvre /jeux sur un autre poste, connecte-toi, puis clique “Rejoindre”.
                        </div>
                      </div>
                    ) : null}

                    <div
                      className={mpWinPulse ? 'mp-win-pulse' : ''}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}
                    >
                      <div style={{ fontWeight: 800, position: 'relative' }}>
                        Score équipe: {mpState?.score ?? 0}
                        {mpPlusValue > 0 ? (
                          <span key={mpPlusAnimKey} className="mp-plusone">
                            +{mpPlusValue}
                          </span>
                        ) : null}
                      </div>
                      <div
                        className={
                          mpState && Number(mpState.endsAtMs ?? 0) > 0 && Math.max(0, Math.ceil((Number(mpState.endsAtMs) - mpNowMs) / 1000)) <= 10
                            ? 'pulsing'
                            : ''
                        }
                        style={{
                          fontSize: 12,
                          opacity: 0.85,
                          color:
                            mpState && Number(mpState.endsAtMs ?? 0) > 0 && Math.max(0, Math.ceil((Number(mpState.endsAtMs) - mpNowMs) / 1000)) <= 10
                              ? '#ff3b5c'
                              : undefined,
                        }}
                      >
                        {mpState && Number(mpState.endsAtMs ?? 0) > 0
                          ? `Temps restant: ${Math.max(0, Math.ceil((Number(mpState.endsAtMs) - mpNowMs) / 1000))}s`
                          : 'En attente de 2 joueurs…'}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '16px 0' }}>
                      {(mpPlayers.length ? mpPlayers : ([1, 2] as MpSeat[]).map((seat) => ({ seat, name: `Guest${seat}` }))).map(
                        (p) => {
                          const seat = p.seat;
                          const ch1to32 = mpState?.channelBySeat?.[seat];
                          const submitted = mpState?.submittedValueBySeat?.[seat] ?? 0;
                          const target = mpState?.targetValueBySeat?.[seat] ?? 0;
                          const isYou = mpSeat === seat;
                          return (
                            <div key={seat} className="glass" style={{ padding: 14, borderRadius: 18 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <strong>
                                  Joueur {seat} {isYou ? '(toi)' : ''}
                                </strong>
                                <span style={{ opacity: 0.75, fontSize: 12 }}>{p.name}</span>
                              </div>
                              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.78 }}>
                                {seatTintLabel(ch1to32)}
                              </div>
                              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                                Cible: {clamp255(target)} • Actuel: {clamp255(submitted)}
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>

                    <div className="glass" style={{ padding: 14, borderRadius: 18 }}>
                      <strong>Couleur cible (équipe)</strong>
                      {mpState ? (
                        (() => {
                          const ch32 = computeTargetChannels32FromState(
                            mpState,
                            mpPlayers.length ? mpPlayers.map((p) => p.seat) : undefined,
                          );
                          const preview = channels32ToPreviewRgb255(ch32, 255);
                          const css = rgbToCss(preview);
                          return (
                            <div
                              style={{
                                marginTop: 10,
                                height: 70,
                                borderRadius: 16,
                                background: css,
                                boxShadow: `0 0 14px ${css}`,
                                border: '1px solid rgba(255,255,255,0.25)',
                              }}
                            />
                          );
                        })()
                      ) : (
                        <div style={{ marginTop: 10, opacity: 0.75 }}>—</div>
                      )}
                    </div>

                    <div className="glass" style={{ padding: 14, borderRadius: 18 }}>
                      <strong>Couleur actuelle (équipe)</strong>
                      {mpState ? (
                        (() => {
                          const ch32 = computeTeamChannels32FromState(
                            mpState,
                            mpPlayers.length ? { activeSeats: mpPlayers.map((p) => p.seat) } : undefined,
                          );
                          const preview = channels32ToPreviewRgb255(ch32, 255);
                          const css = rgbToCss(preview);
                          return (
                            <div
                              style={{
                                marginTop: 10,
                                height: 90,
                                borderRadius: 16,
                                background: css,
                                boxShadow: `0 0 14px ${css}`,
                                border: '1px solid rgba(255,255,255,0.25)',
                              }}
                            />
                          );
                        })()
                      ) : (
                        <div style={{ marginTop: 10, opacity: 0.75 }}>—</div>
                      )}
                    </div>

                    <div className="led-slider led-slider--special">
                      <label>
                        <span>Ton slider ({mpState && mpSeat ? seatTintLabel(mpState.channelBySeat?.[mpSeat]) : '—'})</span>
                        <span>{clamp255(mpValue)}</span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={255}
                        value={clamp255(mpValue)}
                        disabled={!mpState || Number(mpState.endsAtMs ?? 0) <= 0}
                        onChange={(e) => {
                          const next = clamp255(Number(e.target.value));
                          setMpValue(next);
                          void mpSubmitValue(next);
                        }}
                      />
                    </div>

                    <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                      Session: {mpSessionId ? mpSessionId : '—'} • Ton siège: {mpSeat ?? '—'}
                    </div>
                  </div>
                ) : null}

                {gameActive && currentGame === 'multiplayer-split' && mpPlusValue > 0 ? (
                  <div className="mp-center-overlay" aria-hidden="true">
                    <div key={mpCenterAnimKey} className="mp-center-plusone">
                      <span className="mp-center-plusone-text">+{mpPlusValue}</span>
                    </div>
                  </div>
                ) : null}

                {gameActive && currentGame === 'beginner-control' ? (
                  <>
                    <div style={{ margin: '20px 0' }}>
                      <div className="led-slider led-slider--intensity">
                        <label>
                          <span>Intensité globale</span>
                          <span>{masterIntensity}</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={masterIntensity}
                          onChange={(e) => adjustBeginnerIntensity(Number(e.target.value))}
                        />
                      </div>

                      <div className="led-slider led-slider--red">
                        <label>
                          <span>Rouge</span>
                          <span>{beginnerRgb.r}</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={255}
                          value={beginnerRgb.r}
                          onChange={(e) => adjustBeginnerRgb('r', Number(e.target.value))}
                        />
                      </div>

                      <div className="led-slider led-slider--green">
                        <label>
                          <span>Vert</span>
                          <span>{beginnerRgb.g}</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={255}
                          value={beginnerRgb.g}
                          onChange={(e) => adjustBeginnerRgb('g', Number(e.target.value))}
                        />
                      </div>

                      <div className="led-slider led-slider--blue">
                        <label>
                          <span>Bleu</span>
                          <span>{beginnerRgb.b}</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={255}
                          value={beginnerRgb.b}
                          onChange={(e) => adjustBeginnerRgb('b', Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </>
                ) : null}

                {gameActive && currentGame === 'color-cancel' ? (
                  <>
                    <div style={{ margin: '20px 0' }}>
                      <div className="led-slider led-slider--red">
                        <label>
                          <span>Canal Rouge</span>
                          <span>{cancelColor.r}</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={255}
                          value={cancelColor.r}
                          onChange={(e) => adjustCancelLight('r', Number(e.target.value))}
                        />
                      </div>
                      <div className="led-slider led-slider--green">
                        <label>
                          <span>Canal Vert</span>
                          <span>{cancelColor.g}</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={255}
                          value={cancelColor.g}
                          onChange={(e) => adjustCancelLight('g', Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <button className="btn btn-success" onClick={checkColorCancel}>
                      <CheckCircle2 size={18} /> Vérifier
                    </button>
                  </>
                ) : null}

                {gameActive && currentGame === 'color-match' && targetColor ? (
                  <>
                    <div style={{ margin: '20px 0' }}>
                      <h4 style={{ marginBottom: 16, fontWeight: 700 }}>Couleur de référence (plaques 1-3)</h4>
                      <div className="rgb-display">
                        <div className="rgb-value rgb-value--red">
                          <div className="label">R</div>
                          <div className="value">{targetColor.r}</div>
                        </div>
                        <div className="rgb-value rgb-value--green">
                          <div className="label">G</div>
                          <div className="value">{targetColor.g}</div>
                        </div>
                        <div className="rgb-value rgb-value--blue">
                          <div className="label">B</div>
                          <div className="value">{targetColor.b}</div>
                        </div>
                      </div>

                      <h4 style={{ margin: '24px 0 16px', fontWeight: 700 }}>Votre couleur (plaques 4-6)</h4>
                      <div className="led-slider led-slider--red">
                        <label>
                          <span>Rouge</span>
                          <span>{userColor.r}</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={255}
                          value={userColor.r}
                          onChange={(e) => adjustMatchColor('r', Number(e.target.value))}
                        />
                      </div>
                      <div className="led-slider led-slider--green">
                        <label>
                          <span>Vert</span>
                          <span>{userColor.g}</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={255}
                          value={userColor.g}
                          onChange={(e) => adjustMatchColor('g', Number(e.target.value))}
                        />
                      </div>
                      <div className="led-slider led-slider--blue">
                        <label>
                          <span>Bleu</span>
                          <span>{userColor.b}</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={255}
                          value={userColor.b}
                          onChange={(e) => adjustMatchColor('b', Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <button className="btn btn-success" onClick={checkColorMatch}>
                      <CheckCircle2 size={18} /> Valider
                    </button>
                  </>
                ) : null}

                {gameActive && currentGame === 'white-balance' && targetTemp ? (
                  <>
                    <div style={{ margin: '20px 0' }}>
                      <h4 style={{ marginBottom: 16, fontWeight: 700 }}>Objectif: {targetTemp.name}</h4>
                      <div className="led-slider">
                        <label>
                          <span>Température</span>
                          <span>{currentTemp}K</span>
                        </label>
                        <input
                          type="range"
                          min={2500}
                          max={7500}
                          step={100}
                          value={currentTemp}
                          onChange={(e) => adjustWhiteBalance(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <button className="btn btn-success" onClick={checkWhiteBalance}>
                      <CheckCircle2 size={18} /> Valider
                    </button>
                  </>
                ) : null}

                {gameActive && currentGame === 'spectrum-challenge' ? (
                  <>
                    <div className="led-controls">
                      {Array.from({ length: 32 }).map((_, i) => {
                        const wavelength = 380 + i * 10;
                        const value = ledValues[i] ?? 0;
                        const isLast3 = i >= 29;
                        const max = isLast3 ? 255 : 100;
                        return (
                          <div key={i} className={isLast3 ? 'led-slider led-slider--special' : 'led-slider'}>
                            <label>
                              <span>
                                LED {i + 1} ({wavelength}nm)
                              </span>
                              <span>
                                {value}
                                {isLast3 ? '' : '%'}
                              </span>
                            </label>
                            <input
                              type="range"
                              min={0}
                              max={max}
                              step={1}
                              value={value}
                              onChange={(e) => adjustLED(i, Number(e.target.value))}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <button className="btn btn-success" onClick={validateSpectrum}>
                      <CheckCircle2 size={18} /> Valider le spectre
                    </button>
                  </>
                ) : null}

                {gameActive && currentGame === 'escape-game' ? (
                  <>
                    <div style={{ margin: '20px 0' }}>
                      <h3 style={{ fontWeight: 700, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                        <DoorOpen size={18} /> Étape {escapeProgress + 1}/3
                      </h3>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${(escapeProgress / 3) * 100}%` }}>
                          {escapeProgress}/3
                        </div>
                      </div>
                      <p style={{ margin: '20px 0', fontSize: '1.1em', fontWeight: 500 }}>
                        {[
                          'Énigme 1: Activez les plaques impaires (1,3,5,7,9) et désactivez les paires',
                          'Énigme 2: Créez un dégradé de bleu (1-3 foncé, 4-6 moyen, 7-9 clair)',
                          'Énigme 3: Réglez toutes les plaques sur RGB(255,215,0) - couleur or',
                        ][Math.min(escapeProgress, 2)]}
                      </p>

                      {/* Error message in liquid glass style */}
                      {escapeError ? (
                        <div className="glass" style={{ 
                          padding: '16px 20px', 
                          borderRadius: 16, 
                          marginBottom: 20,
                          background: 'rgba(255, 59, 92, 0.25)',
                          border: '1px solid rgba(255, 59, 92, 0.5)',
                          color: '#ff6b8a',
                          fontWeight: 600
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <XCircle size={18} />
                            {escapeError}
                          </span>
                        </div>
                      ) : null}

                      {/* RGB sliders for enigmas 2 and 3 */}
                      {escapeProgress >= 1 ? (
                        <div style={{ margin: '20px 0' }}>
                          <div className="led-slider led-slider--red">
                            <label>
                              <span>Rouge</span>
                              <span>{beginnerRgb.r}</span>
                            </label>
                            <input
                              type="range"
                              min={0}
                              max={255}
                              value={beginnerRgb.r}
                              onChange={(e) => adjustBeginnerRgb('r', Number(e.target.value))}
                            />
                          </div>
                          <div className="led-slider led-slider--green">
                            <label>
                              <span>Vert</span>
                              <span>{beginnerRgb.g}</span>
                            </label>
                            <input
                              type="range"
                              min={0}
                              max={255}
                              value={beginnerRgb.g}
                              onChange={(e) => adjustBeginnerRgb('g', Number(e.target.value))}
                            />
                          </div>
                          <div className="led-slider led-slider--blue">
                            <label>
                              <span>Bleu</span>
                              <span>{beginnerRgb.b}</span>
                            </label>
                            <input
                              type="range"
                              min={0}
                              max={255}
                              value={beginnerRgb.b}
                              onChange={(e) => adjustBeginnerRgb('b', Number(e.target.value))}
                            />
                          </div>
                        </div>
                      ) : null}

                      <button
                        className="btn btn-success"
                        onClick={checkEscapeProgress}
                      >
                        <CheckCircle2 size={18} /> Vérifier
                      </button>
                    </div>
                  </>
                ) : null}

                {!gameActive && currentGameDef ? (
                  <div style={{ marginTop: 16, fontSize: 12, opacity: 0.75 }}>
                    <AlertTriangle size={14} style={{ verticalAlign: 'text-bottom' }} />
                    <span style={{ marginLeft: 6 }}>
                      Jeu sélectionné: <strong>{currentGameDef.name}</strong>. Clique “Démarrer le Jeu”.
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="panel glass">
              <div className="section">
                <h3>
                  <Activity size={18} /> Instruments de Mesure
                </h3>
                <div className="instruments-panel">
                  <div className="instrument-reading">
                    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <Thermometer size={16} /> Temp. Couleur
                    </span>
                    <span>{instrument.colorTemp}</span>
                  </div>
                  <div className="instrument-reading">
                    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <Zap size={16} /> IRC
                    </span>
                    <span>{instrument.cri}</span>
                  </div>
                  <div className="instrument-reading">
                    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <Activity size={16} /> Puissance
                    </span>
                    <span>{instrument.power}</span>
                  </div>
                  <div className="instrument-reading">
                    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <Timer size={16} /> Latence API
                    </span>
                    <span>{instrument.apiLatency}</span>
                  </div>
                </div>
              </div>

              <div className="section">
                <h3>
                  <Sparkles size={18} /> Spectre Lumineux
                </h3>
                <div className="spectrum-display">
                  {spectrumHeightsPercent.map((h, i) => (
                    <div key={i} className="spectrum-bar" style={{ height: `${Math.max(2, h)}%` }} />
                  ))}
                </div>
              </div>

              <div className="section">
                <h3>
                  <Award size={18} /> Classement
                </h3>
                <div className="leaderboard">
                  {leaderboard.length === 0 ? (
                    <div className="leaderboard-item">
                      <span>—</span>
                      <span>—</span>
                    </div>
                  ) : (
                    leaderboard.map((e, idx) => (
                      <div
                        key={e.name}
                        className={`leaderboard-item ${e.name === currentUser ? 'current-user' : ''}`}
                      >
                        <span>
                          {idx + 1}. {e.name}
                        </span>
                        <span>{e.score} pts</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="section">
                <h3>
                  <Lightbulb size={18} /> Scènes Prédéfinies
                </h3>
                <div className="scene-scope">
                  <button
                    type="button"
                    className={sceneApplyScope === 'selected' ? 'scope-btn scope-btn--active' : 'scope-btn'}
                    onClick={() => setSceneApplyScope('selected')}
                  >
                    Plaques sélectionnées
                  </button>
                  <button
                    type="button"
                    className={sceneApplyScope === 'all' ? 'scope-btn scope-btn--active' : 'scope-btn'}
                    onClick={() => setSceneApplyScope('all')}
                  >
                    Toutes
                  </button>
                </div>
                <select className="scene-selector" defaultValue="" onChange={(e) => loadScene(e.target.value)}>
                  <option value="">Sélectionner...</option>
                  <option value="daylight">Lumière du jour</option>
                  <option value="warmwhite">Blanc chaud</option>
                  <option value="coolwhite">Blanc froid</option>
                  <option value="sunset">Coucher de soleil</option>
                  <option value="fluorescent">Fluorescence UV</option>
                  <option value="special">Spéciale (par dalle)</option>
                </select>

                <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75, display: 'flex', gap: 8, alignItems: 'center' }}>
                  {gameActive ? (
                    <>
                      <CheckCircle2 size={14} /> Jeu en cours
                    </>
                  ) : (
                    <>
                      <XCircle size={14} /> Aucun jeu actif
                    </>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75, display: 'flex', gap: 8, alignItems: 'center' }}>
                <TrophyIcon score={score} />
                <span>
                  Astuce: lance <strong>"Défi Spectral"</strong> pour alimenter le graphe de spectre.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TrophyIcon({ score }: { score: number }) {
  if (score >= 300) return <Award size={14} />;
  if (score >= 100) return <TrophyLike size={14} />;
  return <Gamepad2 size={14} />;
}

function TrophyLike({ size }: { size: number }) {
  return <Award size={size} />;
}
