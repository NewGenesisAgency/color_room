'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { TetrisSnapshot } from '@/app/_components/TetrisGame';
import type { UILayoutComponent, UIDpadPreset } from '@/app/editeur/UIDesigner';
import { SPRITE_ICONS } from '@/app/editeur/UIDesigner';
import type { TouchKey } from '@/app/_components/TouchControls';
import NavigationMenu from '@/app/_components/NavigationMenu';
import LoginScreen from '@/app/_components/LoginScreen';
import { PLATE_TYPE, CHANNELS_ROUGE, CHANNELS_BLEU } from '@/lib/tileChannels';

// Modules lourds (3D Three.js, jeux, pages spectre/chromaticité) chargés à la
// demande : ils n'alourdissent plus le bundle initial de /jeux, ce qui accélère
// nettement la navigation vers/depuis cette page.
const TetrisGame = dynamic(() => import('@/app/_components/TetrisGame'), { ssr: false });
const GameColorSpeed = dynamic(() => import('@/app/_components/GameColorSpeed'), { ssr: false });
const GameMaitreDuBlanc = dynamic(() => import('@/app/_components/GameMaitreDuBlanc'), { ssr: false });
const GamePuissance4 = dynamic(() => import('@/app/_components/GamePuissance4'), { ssr: false });
const GameMetamerisme = dynamic(() => import('@/app/_components/GameMetamerisme'), { ssr: false });
const GameChromaticite = dynamic(() => import('@/app/_games/chromaticity-diagram/ChromaticityDiagram'), { ssr: false });
const GameCanalMix = dynamic(() => import('@/app/_components/GameCanalMix'), { ssr: false });
const Room3D = dynamic(() => import('@/app/_components/Room3D'), { ssr: false, loading: () => <div style={{ height: 420 }} /> });
const CieMeasureWidget = dynamic(() => import('@/app/_components/CieMeasureWidget'), { ssr: false });
const TouchControls = dynamic(() => import('@/app/_components/TouchControls'), { ssr: false });
const SnakeGame = dynamic(() => import('@/app/_components/SnakeGame'), { ssr: false });
const GameIntrus = dynamic(() => import('@/app/_components/GameIntrus'), { ssr: false });
const SpectrePage = dynamic(() => import('@/app/spectre/page').then((m) => m.SpectreGame), { ssr: false });
const ChromaticitePage = dynamic(() => import('@/app/chromaticite/page'), { ssr: false });
import {
  Activity,
  AlertTriangle,
  Award,
  Brain,
  CheckCircle2,
  DoorOpen,
  Flame,
  Gamepad2,
  Ghost,
  Heart,
  Lightbulb,
  LogIn,
  LogOut,
  Moon,
  Music,
  Palette,
  Play,
  Puzzle,
  RefreshCcw,
  Rocket,
  Settings2,
  Snowflake,
  Sparkles,
  Star,
  StopCircle,
  Sun,
  Target,
  Thermometer,
  Timer,
  Trophy,
  XCircle,
  Zap,
  Grid,
  Crosshair,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsDown,
  Users,
} from 'lucide-react';

type UserType = 'apprenant' | 'enseignant';

type Niveau = 'college' | 'lycee' | 'universite' | 'grand-public';

// Types supprimés : les jeux sont maintenant gérés par la base de données

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
  bgColor?: string;
  accentColor?: string;
  ui?: {
    title?: string;
    accentColor?: string;
    baseColor?: string;
    targetColor?: string;
    widgets?: UiWidget[];
  };
  uiLayout?: UILayoutComponent[];
  nodes?: unknown[];
  edges?: unknown[];
};

type LeaderboardEntry = { name: string; score: number; niveau: Niveau };

type TargetColor = { r: number; g: number; b: number };

type TargetTemp = { name: string; temp: number };

// Mapping index visuel (grille 6 colonnes, row-major — identique à Room3D/buildMeta)
//   → numéro de plaque PHYSIQUE envoyé à la supervision.
//
// Numérotation physique réelle relevée sur site (par salle), du BAS vers le HAUT :
//   • Mur du fond (3×3), gauche→droite :   1- 2- 3 (bas) / 4- 5- 6 (milieu) / 7- 8- 9 (haut)
//   • Plafond (3×4), du fond (près du mur) vers l'avant (côté entrée), gauche→droite :
//       10-11-12 (près du mur) / 13-14-15 / 16-17-18 / 19-20-21 (côté entrée)
//   • Salle de droite (colonnes 3-5) : même schéma décalé de +21 → plaques 22-42.
//
// Rappel Room3D.buildMeta : row = floor(i/6), col = i%6.
//   rangées 0-3 = plafond (row 0 = côté entrée, row 3 = près du mur),
//   rangées 4-6 = mur     (row 4 = haut, row 6 = bas),
//   colonnes 0-2 = salle gauche, 3-5 = salle droite.
function plateIdForIndex(i: number): number {
  const row  = Math.floor(i / 6);
  const col  = i % 6;
  const room = col < 3 ? 0 : 1;   // 0 = salle gauche, 1 = salle droite
  const lc   = col % 3;           // colonne dans la salle (0 = gauche)
  let base: number;
  if (row >= 4) {
    // Mur : row 6 = bas → 1-3, row 5 = milieu → 4-6, row 4 = haut → 7-9
    const rowFromBottom = 6 - row;
    base = 1 + rowFromBottom * 3 + lc;
  } else {
    // Plafond : row 3 (près du mur) → 10-12 … row 0 (entrée) → 19-21
    const rowFromWall = 3 - row;
    base = 10 + rowFromWall * 3 + lc;
  }
  return base + room * 21;
}
const PLATE_ID_BY_INDEX: number[] = Array.from({ length: 42 }, (_, i) => plateIdForIndex(i));
const INSTRUMENT_PLATE_ID = 1;
const SPECTRUM_GRAPH_MAX = 100;

// Les jeux sont maintenant créés dans l'éditeur et chargés depuis la base de données

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
  const uiLayout = Array.isArray(o.uiLayout) ? (o.uiLayout as UILayoutComponent[]) : undefined;
  const bgColor = typeof o.bgColor === 'string' ? o.bgColor : undefined;
  const accentColor = typeof o.accentColor === 'string' ? o.accentColor : undefined;
  return { version: 1, tileCount, bgColor, accentColor, ui, uiLayout, nodes: o.nodes, edges: o.edges } satisfies EditorGameConfigV1;
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
  if (!Number.isFinite(n) || n < 1 || n > 32) return '-';
  const name = MP_TINT_NAMES[n - 1] ?? '';
  return name ? `Canal ${n}: ${name}` : `Canal ${n}`;
}

function channels32ToPreviewRgb255(channels32: number[], maxValue: number, plateId = 1): TargetColor {
  const CHANNEL_PROFILES = getChannelProfiles(plateId);
  const denom = Math.max(1, maxValue);
  let rAcc = 0;
  let gAcc = 0;
  let bAcc = 0;
  let wSum = 0;

  for (let i = 0; i < 32; i++) {
    const p = CHANNEL_PROFILES[i] ?? { rgb: [1, 1, 1] as [number,number,number], strength: 0 };
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

function getChannelProfiles(plateId: number): ChannelProfile[] {
  const src = (PLATE_TYPE[plateId] ?? 'rouge') === 'bleu' ? CHANNELS_BLEU : CHANNELS_ROUGE;
  return src.map(ch => ({ rgb: ch.rgb, strength: 1.0 }));
}

/**
 * Convertit une couleur RGB (0-255) en tableau de 32 valeurs de canaux LED (0-100).
 *
 * Algorithme : décomposition achromatic + chromatique
 *   W  = min(R,G,B)          → composante blanche pure (plancher gris)
 *   Rc = R - W               → rouge chromatique
 *   Gc = G - W               → vert chromatique
 *   Bc = B - W               → bleu chromatique
 *   Y  = min(Rc, Gc)         → jaune (overlap rouge+vert)
 *   Ro = Rc - Y              → rouge résiduel
 *   Go = Gc - Y              → vert résiduel
 *
 * Chaque composante est envoyée vers les groupes de canaux physiques correspondants.
 * Aucun boost blanc automatique : le blanc n'apparaît que si la couleur source en contient.
 */
function rgbToChannels32(rgb: TargetColor, masterIntensity: number, plateId = 1): number[] {
  const CHANNEL_PROFILES = getChannelProfiles(plateId);
  const R = Math.max(0, Math.min(255, Math.round(rgb.r)));
  const G = Math.max(0, Math.min(255, Math.round(rgb.g)));
  const B = Math.max(0, Math.min(255, Math.round(rgb.b)));
  const scale = clamp100(masterIntensity) / 100;

  const channels = Array(32).fill(0);
  if (scale <= 1e-6 || Math.max(R, G, B) === 0) return channels;

  // Décomposition
  const W  = Math.min(R, G, B);           // blanc (achromatic)
  const Rc = R - W;                         // rouge chromatique
  const Gc = G - W;                         // vert chromatique
  const Bc = B - W;                         // bleu chromatique
  const Y  = Math.min(Rc, Gc);             // jaune (overlap R+G)
  const Ro = Rc - Y;                        // rouge pur résiduel
  const Go = Gc - Y;                        // vert pur résiduel

  // Facteur : valeur 0-255 → canal 0-100 avec masterIntensity
  const K = scale / 255;
  const v = (x: number) => Math.min(100, Math.round(x * K * 100));

  // ── Canaux blancs / gris (24-31) ──────────────────────────────────────────
  if (W > 0) {
    const wv = v(W);
    channels[25] = wv;                          // blanc pur dominant
    channels[24] = Math.round(wv * 0.70);       // blanc jaunâtre
    channels[26] = Math.round(wv * 0.55);       // blanc neutre
    channels[27] = Math.round(wv * 0.35);       // blanc froid
    channels[31] = Math.round(wv * 0.45);       // gris clair
  }

  // ── Canaux rouges (10-14) ─────────────────────────────────────────────────
  if (Ro > 0) {
    const rv = v(Ro);
    channels[11] = Math.max(channels[11], rv);
    channels[12] = Math.max(channels[12], Math.round(rv * 0.90));
    channels[13] = Math.max(channels[13], Math.round(rv * 0.85));
    channels[10] = Math.max(channels[10], Math.round(rv * 0.70));
    channels[14] = Math.max(channels[14], Math.round(rv * 0.55));
  }

  // ── Canaux verts (5-6) ────────────────────────────────────────────────────
  if (Go > 0) {
    const gv = v(Go);
    channels[5]  = Math.max(channels[5], gv);
    channels[6]  = Math.max(channels[6], Math.round(gv * 0.75));
  }

  // ── Canaux bleus / violets (0-4) ──────────────────────────────────────────
  if (Bc > 0) {
    const bv = v(Bc);
    channels[4]  = Math.max(channels[4], bv);
    channels[2]  = Math.max(channels[2], Math.round(bv * 0.80));
    channels[3]  = Math.max(channels[3], Math.round(bv * 0.65));
    channels[1]  = Math.max(channels[1], Math.round(bv * 0.60));
    channels[0]  = Math.max(channels[0], Math.round(bv * 0.40));
  }

  // ── Canaux jaune / orange (7-9, 18-19) ───────────────────────────────────
  if (Y > 0) {
    const yv = v(Y);
    channels[7]  = Math.max(channels[7],  yv);
    channels[8]  = Math.max(channels[8],  Math.round(yv * 0.85));
    channels[18] = Math.max(channels[18], Math.round(yv * 0.90));
    channels[19] = Math.max(channels[19], Math.round(yv * 0.75));
    channels[9]  = Math.max(channels[9],  Math.round(yv * 0.70));
  }

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

// ── Sons de jeu (Web Audio, aucun fichier requis) ────────────────────────────
let _gameAudioCtx: AudioContext | null = null;
function playGameSound(type: 'click' | 'score' | 'win' | 'lose' | 'tick' | 'error') {
  try {
    if (!_gameAudioCtx) _gameAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = _gameAudioCtx;
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    const blip = (f: number, t0: number, dur: number, wave: OscillatorType, vol = 0.16) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = wave; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.start(t0); o.stop(t0 + dur + 0.02);
    };
    if (type === 'click') blip(520, now, 0.06, 'square', 0.12);
    else if (type === 'tick') blip(380, now, 0.04, 'square', 0.08);
    else if (type === 'score') { blip(660, now, 0.09, 'sine'); blip(990, now + 0.06, 0.1, 'sine'); }
    else if (type === 'error' || type === 'lose') { blip(200, now, 0.18, 'sawtooth'); blip(150, now + 0.12, 0.22, 'sawtooth'); }
    else if (type === 'win') [660, 880, 1100, 1320].forEach((f, i) => blip(f, now + i * 0.09, 0.2, 'triangle', 0.15));
  } catch { /* audio indisponible */ }
}

// ── Overlay UI des jeux éditeur (uiLayout dessiné dans /editeur) ───────────────
const HUD_CANVAS_W = 860;
const HUD_CANVAS_H = 500;

// D-pad configurable : selon le préréglage choisi dans l'éditeur, on émet
// l'ensemble de touches clavier adapté (flèches complètes, gauche/droite, + Espace).
const HUD_DPAD_UP: TouchKey    = { key: 'ArrowUp',    slot: 'up',    label: <ChevronUp size={20} /> };
const HUD_DPAD_DOWN: TouchKey  = { key: 'ArrowDown',  slot: 'down',  label: <ChevronDown size={20} />,  repeat: true };
const HUD_DPAD_LEFT: TouchKey  = { key: 'ArrowLeft',  slot: 'left',  label: <ChevronLeft size={20} />,  repeat: true };
const HUD_DPAD_RIGHT: TouchKey = { key: 'ArrowRight', slot: 'right', label: <ChevronRight size={20} />, repeat: true };
const HUD_DPAD_SPACE: TouchKey = { key: ' ',          slot: 'a',     label: <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><ChevronsDown size={16} /> Action</span>, accent: '#4361ee' };

function hudDpadKeys(preset: UIDpadPreset | undefined): TouchKey[] {
  switch (preset) {
    case 'arrows':   return [HUD_DPAD_UP, HUD_DPAD_LEFT, HUD_DPAD_RIGHT, HUD_DPAD_DOWN];
    case 'lr':       return [HUD_DPAD_LEFT, HUD_DPAD_RIGHT];
    case 'lr_space': return [HUD_DPAD_LEFT, HUD_DPAD_RIGHT, HUD_DPAD_SPACE];
    case 'arrows_space':
    default:         return [HUD_DPAD_UP, HUD_DPAD_LEFT, HUD_DPAD_RIGHT, HUD_DPAD_DOWN, HUD_DPAD_SPACE];
  }
}

type HudPlateActions = {
  onSendColor: (idx: number, r: number, g: number, b: number, intensity?: number) => void;
  onTurnOff: (idx: number) => void;
  onTurnOffAll: () => void;
  onComplete?: (points: number) => void;
  plateColors?: string[];   // couleurs live des 42 dalles (visualisation)
  onEvent?: (eventId: string) => void;  // clic d'un composant -> lance le graphe depuis le noeud event
};

function renderHudComp(c: UILayoutComponent, plate: HudPlateActions, vars: Record<string, number | string>): React.ReactNode {
  const onSendColor = plate.onSendColor;
  // Valeur live d'une variable liée (varBind) -> permet aux composants d'afficher l'état du jeu
  const boundNum = (fallback: number): number => {
    if (!c.varBind) return fallback;
    const v = Number(vars[c.varBind]);
    return Number.isFinite(v) ? v : fallback;
  };
  const boundStr = (fallback: string): string => {
    if (!c.varBind) return fallback;
    const v = vars[c.varBind];
    return v === undefined ? fallback : String(v);
  };
  const base: React.CSSProperties = {
    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxSizing: 'border-box', overflow: 'hidden', fontSize: c.fontSize ?? 14, color: c.textColor ?? '#1a1d2e',
  };
  switch (c.kind) {
    case 'cie_diagram':
      return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.08)', padding: 10, boxSizing: 'border-box' }}>
          <CieMeasureWidget
            targetX={c.cieTargetX} targetY={c.cieTargetY} tolerance={c.cieTolerance}
            randomTarget={c.cieRandom} points={c.points}
            width={Math.max(120, c.width - 20)}
            height={Math.max(100, c.height - 20)}
            onSendColor={onSendColor}
            onTurnOffAll={plate.onTurnOff ? () => { for (let i = 0; i < 42; i++) plate.onTurnOff!(i); } : undefined}
          />
        </div>
      );
    case 'button':        return <button onClick={() => c.eventId && plate.onEvent?.(c.eventId)} style={{ ...base, background: c.bgColor ?? '#4361ee', color: c.textColor ?? '#fff', borderRadius: 12, fontWeight: 700, border: 'none', cursor: c.eventId ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: c.fontSize ?? 14 }}>{c.text || 'Bouton'}</button>;
    case 'label':         return <div style={{ ...base, justifyContent: 'flex-start', paddingLeft: 4, fontWeight: 600 }}>{c.varBind ? boundStr(c.text || '') : (c.text || 'Texte')}</div>;
    case 'slider':        return <div style={{ ...base, flexDirection: 'column', gap: 4, padding: '0 10px' }}><span style={{ fontSize: 11, fontWeight: 700, alignSelf: 'flex-start' }}>{c.text || 'Slider'}</span><input type="range" style={{ width: '100%' }} readOnly /></div>;
    case 'score_display': return <div style={{ ...base, flexDirection: 'column', background: 'rgba(255,255,255,0.9)', borderRadius: 14, border: '1px solid rgba(67,97,238,0.2)' }}><span style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.text || 'Score'}</span><span style={{ fontSize: 26, fontWeight: 900, color: '#4361ee', lineHeight: 1 }}>{boundNum(0)}</span></div>;
    case 'timer_display': return <div style={{ ...base, flexDirection: 'column', background: 'rgba(255,255,255,0.9)', borderRadius: 14, border: '1px solid rgba(239,68,68,0.2)' }}><span style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Temps</span><span style={{ fontSize: 26, fontWeight: 900, color: '#ef4444', lineHeight: 1 }}>30s</span></div>;
    case 'round_badge':   return <div style={{ ...base, background: 'rgba(67,97,238,0.09)', borderRadius: 12, fontWeight: 800, color: '#4361ee' }}>Manche 1/5</div>;
    case 'color_swatch':  return <div style={{ ...base, borderRadius: 12, background: c.bgColor ?? '#ff2aa6', boxShadow: '0 0 20px ' + (c.bgColor ?? '#ff2aa6') }} />;
    case 'progress_bar':  return <div style={{ ...base, background: 'rgba(0,0,0,0.07)', borderRadius: 999, overflow: 'hidden', padding: 0 }}><div style={{ width: `${Math.max(0, Math.min(100, boundNum(55)))}%`, height: '100%', background: 'linear-gradient(90deg,#059669,#06d6a0)', borderRadius: 999, transition: 'width 0.2s' }} /></div>;
    case 'dpad':          return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TouchControls forceShow compact keys={hudDpadKeys(c.dpadPreset)} /></div>;
    case 'shape_rect':    return <div style={{ width: '100%', height: '100%', background: c.bgColor ?? '#334155', borderRadius: 12 }} />;
    case 'shape_circle':  return <div style={{ width: '100%', height: '100%', background: c.bgColor ?? '#334155', borderRadius: '50%' }} />;
    case 'divider':       return <div style={{ ...base, padding: 0 }}><div style={{ width: '100%', height: 2, borderRadius: 2, background: c.bgColor ?? 'rgba(255,255,255,0.4)' }} /></div>;
    case 'image':         return c.src ? <img src={c.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} /> : <div style={{ ...base, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Image</div>;
    case 'heart_life':    { const lives = c.varBind ? boundNum(3) : 3; const total = Math.max(lives, 3); return <div style={{ ...base, gap: 4, color: '#ef4444' }}>{Array.from({ length: total }, (_, i) => <svg key={i} width={Math.min(24, c.height - 10)} height={Math.min(24, c.height - 10)} viewBox="0 0 24 24" fill={i < lives ? '#ef4444' : 'none'} stroke="#ef4444" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" /></svg>)}</div>; }
    case 'plate_grid':    return <div style={{ width: '100%', height: '100%', padding: 6, background: '#0d1119', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', boxSizing: 'border-box' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gridTemplateRows: 'repeat(7,1fr)', gap: 3, width: '100%', height: '100%' }}>
        {Array.from({ length: 42 }, (_, i) => <span key={i} style={{ borderRadius: 3, background: plate.plateColors?.[i] ?? '#1a1f2e', transition: 'background 0.1s' }} />)}
      </div>
    </div>;
    case 'gauge_ring': { const v = Math.max(0, Math.min(100, c.varBind ? boundNum(c.value ?? 70) : (c.value ?? 70))); const acc = c.bgColor ?? '#22d3ee'; const d = Math.max(28, Math.min(c.width, c.height) - 6); return <div style={{ ...base }}><div style={{ width: d, height: d, borderRadius: '50%', background: `conic-gradient(${acc} ${v * 3.6}deg, rgba(255,255,255,0.08) 0)`, display: 'grid', placeItems: 'center' }}><div style={{ width: '66%', height: '66%', borderRadius: '50%', background: '#0d1119', display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 800, color: acc }}>{v}%</div></div></div>; }
    case 'turn_indicator': return <div style={{ ...base, justifyContent: 'flex-start', gap: 8, padding: '0 12px', background: '#141a26', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', color: '#e8eaf0' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: c.bgColor ?? '#06d6a0', boxShadow: `0 0 8px ${c.bgColor ?? '#06d6a0'}` }} /><span style={{ fontSize: 13, fontWeight: 700 }}>{c.text || 'À ton tour'}</span></div>;
    case 'players_list': return <div style={{ ...base, flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: 6, padding: 9, background: '#141a26', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', overflowY: 'auto' }}>{['Joueur 1', 'Joueur 2', 'Joueur 3'].map((p, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#cdd3e0' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: `hsl(${i * 100} 70% 55%)` }} />{p}</div>)}</div>;
    case 'leaderboard': return <div style={{ ...base, flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: 5, padding: 9, background: '#141a26', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', overflowY: 'auto' }}>{[['1', 'Lea', '120'], ['2', 'Tom', '95'], ['3', 'Sam', '80']].map((r, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: i === 0 ? '#f59e0b' : '#cdd3e0', fontWeight: i === 0 ? 800 : 600 }}><span>{r[0]}. {r[1]}</span><span>{r[2]}</span></div>)}</div>;
    case 'button_grid': { const n = Math.max(2, Math.min(6, c.gridCols ?? 4)); const cols = ['#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#06d6a0']; return <div style={{ width: '100%', height: '100%', padding: 6, background: '#0d1119', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', boxSizing: 'border-box' }}><div style={{ display: 'grid', gridTemplateColumns: `repeat(${n},1fr)`, gridTemplateRows: `repeat(${n},1fr)`, gap: 5, width: '100%', height: '100%' }}>{Array.from({ length: n * n }, (_, i) => <button key={i} onClick={() => c.eventId && plate.onEvent?.(`${c.eventId}:${i}`)} style={{ borderRadius: 8, border: 'none', cursor: 'pointer', background: cols[i % cols.length], opacity: 0.9 }} />)}</div></div>; }
    case 'rgb_sliders': return <div style={{ ...base, flexDirection: 'column', justifyContent: 'center', gap: 9, padding: '8px 12px', background: '#141a26', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>{(['#ef4444', '#22c55e', '#3b82f6'] as const).map((col, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 14, height: 14, borderRadius: 4, background: col, flexShrink: 0 }} /><input type="range" min={0} max={255} defaultValue={128} style={{ flex: 1, accentColor: col }} /></div>)}</div>;
    case 'sprite': { const Ico = SPRITE_ICONS[c.icon ?? 'Smile'] ?? SPRITE_ICONS.Smile; const el = <Ico size={Math.max(16, Math.min(c.width, c.height) - 12)} color={c.bgColor ?? '#f97316'} />; return c.eventId ? <button onClick={() => plate.onEvent?.(c.eventId!)} style={{ ...base, border: 'none', background: 'transparent', cursor: 'pointer' }}>{el}</button> : <div style={{ ...base }}>{el}</div>; }
    case 'message_box': return <div style={{ ...base, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 4, padding: '10px 13px', background: '#141a26', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', color: '#cdd3e0' }}><span style={{ fontSize: 11, fontWeight: 800, color: c.bgColor ?? '#38bdf8' }}>Message</span><span style={{ fontSize: 12.5, lineHeight: 1.4 }}>{c.varBind ? boundStr(c.text || 'Bravo !') : (c.text || 'Bravo !')}</span></div>;
    case 'title_banner': return <div style={{ ...base, background: 'linear-gradient(135deg,#1a2030,#0d1119)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontWeight: 900, fontSize: Math.min(22, c.height / 2.6), letterSpacing: '-0.02em' }}>{c.text || 'TITRE'}</div>;
    default:              return null;
  }
}

function HudUiOverlay({
  components, plate, vars = {},
}: {
  components: UILayoutComponent[];
  plate: HudPlateActions;
  vars?: Record<string, number | string>;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / HUD_CANVAS_W));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Hauteur réelle utilisée = bas du composant le plus bas (évite un grand vide).
  const usedH = components.reduce((m, c) => Math.max(m, c.y + c.height), 0) || HUD_CANVAS_H;
  return (
    <div ref={wrapRef} style={{ width: '100%', height: usedH * scale, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: HUD_CANVAS_W, height: usedH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {components.map((c) => (
          <div key={c.id} style={{ position: 'absolute', left: c.x, top: c.y, width: c.width, height: c.height }}>
            {renderHudComp(c, plate, vars)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function JeuxPage() {
  const [dbGames, setDbGames] = useState<
    Array<{ id: string; name: string; kind: string; createdAt: string; updatedAt: string; config: unknown }>
  >([]);
  const [dbGamesLoading, setDbGamesLoading] = useState(false);
  const [customRun, setCustomRun] = useState<{ gameId: string; name: string; cfg: CustomGameConfigV1 } | null>(null);
  const [hudRun, setHudRun] = useState<{ gameId: string; name: string; cfg: EditorGameConfigV1; showHud: boolean } | null>(null);
  const hudRunRef = useRef<{ gameId: string; name: string; cfg: EditorGameConfigV1; showHud: boolean } | null>(null);
  const [view, setView] = useState<'login' | 'main'>('login');
  const [userType, setUserType] = useState<UserType>('apprenant');
  const [username, setUsername] = useState<string>('');
  const [niveau, setNiveau] = useState<Niveau>('lycee');
  const [password, setPassword] = useState<string>('');
  const [loginStep, setLoginStep] = useState<'role' | 'form' | 'setup'>('role');
  const [loginLoading, setLoginLoading] = useState(false);
  const [hasTeacher, setHasTeacher] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  const [currentUser, setCurrentUser] = useState<string | null>(null);
  // Code de classe issu d'un QR code / deep-link (/jeux?classe=CODE) à rejoindre
  const [pendingClassCode, setPendingClassCode] = useState('');
  const [userAvatarColor, setUserAvatarColor] = useState('#4361ee');
  const [userAvatarIcon, setUserAvatarIcon] = useState('U');
  const [userClasses, setUserClasses] = useState<string[]>([]);
  const [gameSearch, setGameSearch] = useState('');
  const [gameVisibleCount, setGameVisibleCount] = useState(4);
  // Pop-up "Commencer le jeu" : description + explication avant de lancer
  const [pendingGame, setPendingGame] = useState<
    { title: string; desc: string; accent: string; iconBg: string; iconColor: string; Icon: React.ComponentType<{ size?: number; color?: string }>; launch: () => void; howTo?: string } | null
  >(null);
  const [hudVarsTick, setHudVarsTick] = useState(0); // re-render de l'overlay quand une variable change
  const [score, setScore] = useState<number>(0);
  const [gamesCompleted, setGamesCompleted] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const [currentGame, setCurrentGame] = useState<string | null>(null);
  const [gameActive, setGameActive] = useState<boolean>(false);
  const [tetrisStandalone, setTetrisStandalone] = useState(false);

  const [plateColors, setPlateColors] = useState<string[]>(Array(42).fill('#000000'));
  const [plateActive, setPlateActive] = useState<boolean[]>(Array(42).fill(false));

  const [hardwarePreviewCss, setHardwarePreviewCss] = useState<string>('rgb(0,0,0)');

  const [ledValues, setLedValues] = useState<Record<number, number>>({});
  const [message, setMessage] = useState<string>('');

  const [masterIntensity, setMasterIntensity] = useState<number>(80);
  const [beginnerRgb, setBeginnerRgb] = useState<TargetColor>({ r: 0, g: 0, b: 0 });

  const [instrument, setInstrument] = useState({
    colorTemp: '-',
    cri: '-',
    power: '-',
    apiLatency: '-',
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

  // Tetrix Light game states
  const [tetrixGrid, setTetrixGrid] = useState<(string | null)[]>(Array(42).fill(null));
  const [tetrixScore, setTetrixScore] = useState<number>(0);
  const [tetrixGameOver, setTetrixGameOver] = useState<boolean>(false);
  const [tetrixCurrentPiece, setTetrixCurrentPiece] = useState<{ color: string; positions: number[] } | null>(null);
  const [tetrixNextPiece, setTetrixNextPiece] = useState<{ color: string; shape: 'I' | 'L' | 'T' | 'O' } | null>(null);
  const [tetrixLevel, setTetrixLevel] = useState<number>(1);
  const [tetrixLines, setTetrixLines] = useState<number>(0);
  const tetrixTimerRef = useRef<number>(0);
  const tetrixColors = ['#00d4ff', '#ff3d71', '#ffc700', '#00ff88', '#b829dd', '#ff5e3a', '#4facfe'];

  const [scorePlusAnimKey, setScorePlusAnimKey] = useState<number>(0);
  const [scorePlusValue, setScorePlusValue] = useState<number>(0);

  // Simon game states
  const [simonActive, setSimonActive] = useState<boolean>(false);

  // Nouveaux jeux natifs
  const [activeBuiltinGame, setActiveBuiltinGame] = useState<'color-speed' | 'maitre-blanc' | 'puissance4' | 'metamere' | 'chromaticite-jeu' | 'canal-mix' | 'intrus' | 'snake' | null>(null);
  const [activeView, setActiveView] = useState<null | 'spectre' | 'chromaticite'>(null);
  // Spectre Chromatique : jeu multijoueur rendu inline (sous les dalles), comme les autres jeux
  const [spectreActive, setSpectreActive] = useState<boolean>(false);
  const [spectreJoinCode, setSpectreJoinCode] = useState<string>('');
  const [simonSequence, setSimonSequence] = useState<number[]>([]);
  const [simonPlayerInput, setSimonPlayerInput] = useState<number[]>([]);
  const [simonLevel, setSimonLevel] = useState<number>(1);
  const simonLevelRef = useRef<number>(1); // Track current level for timing calculations
  const [simonPhase, setSimonPhase] = useState<'showing' | 'input' | 'gameover'>('showing');
  const [simonLitPlate, setSimonLitPlate] = useState<number | null>(null);
  const simonTimerRef = useRef<number>(0);
  const isShowingSequenceRef = useRef<boolean>(false); // Prevent overlapping sequences

  // Other game active states (for game over popup restart)
  const [spectralActive, setSpectralActive] = useState<boolean>(false);
  const [chaseActive, setChaseActive] = useState<boolean>(false);
  const [mpActive, setMpActive] = useState<boolean>(false);
  const [snakeActive, setSnakeActive] = useState<boolean>(false);
  const [tetrixActive, setTetrixActive] = useState<boolean>(false);

  const SIMON_PLATES = [0, 5, 36, 41]; // 4 coins: HG, HD, BG, BD
  const SIMON_COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00']; // R, V, B, J

  // Game Over popup state
  const [gameOverPopup, setGameOverPopup] = useState<{
    open: boolean;
    game: string;
    score: number;
    message: string;
  }>({ open: false, game: '', score: 0, message: '' });

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

  const hwLastSentRef = useRef<Record<string, number>>({});
  const hwBatchPendingRef = useRef<Map<number, Record<number, number>>>(new Map());
  // ── Moteur hardware : state machine 1-in-flight + 1-pending ──────────────
  // Garantit qu'il n'y a JAMAIS plus d'une requête en vol simultanément.
  // 30 clics en spam = au plus 2 requêtes envoyées (première + dernière état).
  type HwPlateUpdate = { plateId: number; channels: { index: number; value: number }[] };
  const hwFlushScheduledRef = useRef(false);   // microtask flush déjà planifié ?
  const hwInFlightRef      = useRef(false);    // un POST est-il en cours ?
  const hwPendingPlatesRef = useRef<HwPlateUpdate[] | null>(null); // état en attente (remplacé à chaque flush)
  const hwCurrentCtrlRef   = useRef<AbortController | null>(null); // pour annuler le POST en cours
  const hwFetchGenRef      = useRef(0);        // génération : invalide les callbacks orphelins
  const tetrisSnapRef = useRef<TetrisSnapshot | null>(null);
  const tetrisAwardedRef = useRef(false); // évite de créditer plusieurs fois la même partie
  // State canonique des dalles pendant les jeux - équivalent tetrisSnapRef
  const gameColorStateRef = useRef<Array<{r:number;g:number;b:number;intensity:number}|null>>(new Array(42).fill(null));
  // Batch visuel (rAF) pour mettre à jour la 3D sans bloquer le fil principal
  const visualBatchRef = useRef<Map<number,{r:number;g:number;b:number;intensity:number}>>(new Map());
  const rafRef = useRef<number>(0);
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
      for (let i = 0; i < 42; i++) next[i] = false;
      // Set selected
      for (const i of indexes) {
        if (i >= 0 && i < 42) next[i] = active;
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

  /** Construit la liste de mises à jour depuis hwBatchPendingRef */
  function buildHwPlates(pending: Map<number, Record<number, number>>): HwPlateUpdate[] {
    return Array.from(pending.entries())
      .map(([plateId, channels]) => ({
        plateId,
        channels: Object.entries(channels)
          .map(([i, v]) => ({ index: Number(i), value: v }))
          .filter(ch => ch.value >= 0),
      }))
      .filter(p => p.channels.length > 0);
  }

  /** Lance réellement le POST et gère la transition d'état */
  function doSendBatch(plates: HwPlateUpdate[]) {
    const gen = ++hwFetchGenRef.current;
    const ctrl = new AbortController();
    hwCurrentCtrlRef.current = ctrl;
    hwInFlightRef.current = true;

    // Timeout auto-cancel : 1500ms max.
    // force:true est envoyé SYSTÉMATIQUEMENT - le serveur purge immédiatement
    // sa file interne (waiters stale) avant de traiter ce batch.
    // Sans ça, les anciennes requêtes s'accumulent dans la file du serveur et
    // saturent la connexion TCP de supervision.exe → ralentissement exponentiel.
    const autoAbortTimer = window.setTimeout(() => ctrl.abort(), 1500);

    fetch('/api/supervision/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plates, fast: true, force: true }),
      cache: 'no-store',
      signal: ctrl.signal,
    })
      .catch(() => {/* AbortError ou réseau - ignoré */})
      .finally(() => {
        window.clearTimeout(autoAbortTimer);
        if (hwFetchGenRef.current !== gen) return; // callback orphelin - ignorer
        const next = hwPendingPlatesRef.current;
        hwPendingPlatesRef.current = null;
        if (next && next.length > 0) {
          doSendBatch(next); // envoyer l'état en attente
        } else {
          hwInFlightRef.current = false;
        }
      });
  }

  /** Vide hwBatchPendingRef et planifie un envoi (state machine) */
  function flushHardwareBatch() {
    const pending = hwBatchPendingRef.current;
    if (pending.size === 0) return;
    hwBatchPendingRef.current = new Map(); // nouveau map atomiquement
    const plates = buildHwPlates(pending);
    if (plates.length === 0) return;

    if (!hwInFlightRef.current) {
      doSendBatch(plates);          // idle → envoyer immédiatement
    } else {
      hwPendingPlatesRef.current = plates; // sending → remplacer le pending
    }
  }

  function scheduleSetCanal(plaqueId: number, canalIndex: number, intensity: number) {
    const key = `${plaqueId}:${canalIndex}`;
    const clamped = Math.max(0, Math.min(255, Math.round(intensity)));
    if (hwLastSentRef.current[key] === clamped) return;
    hwLastSentRef.current[key] = clamped;

    const pending = hwBatchPendingRef.current;
    if (!pending.has(plaqueId)) pending.set(plaqueId, {});
    pending.get(plaqueId)![canalIndex] = clamped;

    // queueMicrotask : flush immédiatement après le code synchrone courant
    // (0 ms de délai artificiel). Le flag évite les doublons dans la même tick.
    if (!hwFlushScheduledRef.current) {
      hwFlushScheduledRef.current = true;
      queueMicrotask(() => {
        hwFlushScheduledRef.current = false;
        flushHardwareBatch();
      });
    }
  }

  function sendRgbToPlate(rgb: TargetColor, intensity100: number, plateId: number) {
    const channels32 = rgbToChannels32(rgb, intensity100, plateId);
    for (let i = 0; i < 32; i++) {
      scheduleSetCanal(plateId, i, clamp255(channels32[i] ?? 0));
    }
  }

  function sendRgbToHardware(rgb: TargetColor) {
    const targets = getTargetPlateIds();
    const channels32 = rgbToChannels32(rgb, masterIntensity);

    for (const plaqueId of targets) {
      for (let i = 0; i < 32; i++) scheduleSetCanal(plaqueId, i, clamp255(channels32[i] ?? 0));
    }

    setLedValues(() => {
      const next: Record<number, number> = {};
      for (let i = 0; i < 32; i++) next[i] = clamp255(channels32[i] ?? 0);
      return next;
    });

    const preview = channels32ToPreviewRgb255(channels32, 100);
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

  // Send Kelvin color temperature using specific LED channels from COULEURS.md
  function sendKelvinToHardware(kelvin: number) {
    const targets = getTargetPlateIds();
    const channels32 = Array(32).fill(0);

    switch (kelvin) {
      case 1900: // Lumière de bougie - Orange clair/chaud (Canaux 19-24: Jaune Orange clair)
        channels32[18] = 180; // Canal 19: Jaune Orange
        channels32[19] = 200; // Canal 20: Jaune Orange clair
        channels32[20] = 220; // Canal 21: Jaune Orange clair
        channels32[21] = 200; // Canal 22: Jaune Orange clair
        channels32[22] = 150; // Canal 23: Jaune Orange clair
        channels32[23] = 100; // Canal 24: Jaune Orange blanc très clair
        break;
      case 2700: // Blanc chaud - Jaune Orange doux (Canaux 20-25)
        channels32[19] = 150; // Canal 20: Jaune Orange clair
        channels32[20] = 200; // Canal 21: Jaune Orange clair
        channels32[21] = 220; // Canal 22: Jaune Orange clair
        channels32[22] = 200; // Canal 23: Jaune Orange clair
        channels32[23] = 180; // Canal 24: Jaune Orange blanc très clair
        channels32[24] = 120; // Canal 25: Blanc un peu jaunis
        break;
      case 3000: // Blanc doux - Jaune très clair vers blanc (Canaux 23-27)
        channels32[22] = 120; // Canal 23: Jaune Orange clair
        channels32[23] = 180; // Canal 24: Jaune Orange blanc très clair
        channels32[24] = 200; // Canal 25: Blanc un peu jaunis
        channels32[25] = 220; // Canal 26: Blanc
        channels32[26] = 180; // Canal 27: Blanc un peu moins lumineux
        break;
      case 5000: // Blanc froid - Blanc légèrement bleuté (Canaux 25-28 + touche bleu)
        channels32[24] = 200; // Canal 25: Blanc
        channels32[25] = 255; // Canal 26: Blanc pur
        channels32[26] = 220; // Canal 27: Blanc
        channels32[27] = 180; // Canal 28: Blanc
        channels32[4] = 40;   // Canal 5: Bleu turquoise (touche froide)
        break;
      case 6500: // Lumière du jour - Blanc pur neutre (Canaux 25-28)
        channels32[24] = 220; // Canal 25: Blanc
        channels32[25] = 255; // Canal 26: Blanc pur
        channels32[26] = 240; // Canal 27: Blanc
        channels32[27] = 200; // Canal 28: Blanc
        break;
      case 10000: // Ciel bleu - Blanc bleu nuancé #ccdcff
        channels32[3] = 80;   // Canal 4: Bleu marine (très réduit)
        channels32[4] = 140;  // Canal 5: Bleu turquoise (modéré)
        channels32[5] = 60;   // Canal 6: Vert clair (adoucir)
        channels32[25] = 255; // Canal 26: Blanc pur (dominant)
        channels32[26] = 240; // Canal 27: Blanc
        channels32[24] = 220; // Canal 25: Blanc
        channels32[27] = 200; // Canal 28: Blanc
        break;
      default:
        // Default to daylight
        channels32[25] = 255;
    }

    // Send to hardware
    for (const plaqueId of targets) {
      for (let i = 0; i < 32; i++) {
        scheduleSetCanal(plaqueId, i, channels32[i]);
      }
    }

    setLedValues(() => {
      const next: Record<number, number> = {};
      for (let i = 0; i < 32; i++) next[i] = channels32[i];
      return next;
    });

    // For Kelvin scenes, use a fixed CSS color that matches the expected output
    // rather than converting from channels which doesn't reflect the real LED appearance
    let css: string;
    switch (kelvin) {
      case 1900:
        css = '#ffaa5c';
        break;
      case 2700:
        css = '#ffc88a';
        break;
      case 3000:
        css = '#ffe4c4';
        break;
      case 5000:
        css = '#fff8f0';
        break;
      case 6500:
        css = '#ffffff';
        break;
      case 10000:
        css = '#ccdcff'; // Blanc bleu nuancé
        break;
      default:
        css = '#ffffff';
    }
    setHardwarePreviewCss(css);
    setSelectedPlatesColor(css, true);
  }

  // Cancel all pending scheduleSetCanal debounce timers so they can't re-light
  // plates after a blackout/stop.
  function cancelPendingHardware() {
    // 1. Empêcher tout flush microtask en attente
    hwFlushScheduledRef.current = false;
    // 2. Vider les accumulateurs
    hwBatchPendingRef.current.clear();
    hwPendingPlatesRef.current = null;
    // 3. Invalider le callback du POST en cours (génération) et l'annuler
    hwFetchGenRef.current++;
    hwCurrentCtrlRef.current?.abort();
    hwCurrentCtrlRef.current = null;
    hwInFlightRef.current = false;
    // 4. Reset du cache dedup (commandes futures repartent depuis un état connu)
    hwLastSentRef.current = {};
  }

  async function blackoutHardware() {
    cancelPendingHardware();
    // PUT global = 1 seule requête rapide vers le hardware (reset total)
    await fetch('/api/supervision/', { method: 'PUT', cache: 'no-store' }).catch(() => {});
    // Pré-remplir le cache dedup avec 0 pour que les prochains onSendColor
    // n'envoient que les canaux qui changent depuis 0 (pas de burst de 1344 canaux)
    for (let pid = 1; pid <= 42; pid++) {
      for (let ch = 0; ch < 32; ch++) {
        hwLastSentRef.current[`${pid}:${ch}`] = 0;
      }
    }
  }

  function hexToRgb255(hex: string): TargetColor {
    const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
    if (!m) return { r: 0, g: 0, b: 0 };
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  // Sync Tetris grid → 42 physical LED plates via API (32 canaux/dalle, COULEURS.md)
  const hasEditorTetris = useMemo(() => {
    if (!hudRun) return false;
    const nodes = Array.isArray(hudRun.cfg.nodes) ? hudRun.cfg.nodes : [];
    return nodes.some((n: any) => n.kind === 'game_tetris' && n.enabled !== false);
  }, [hudRun]);

  useEffect(() => {
    if (!gameActive) return;
    if (!tetrisStandalone && !hasEditorTetris) return;

    function syncTetrisToHardware() {
      const snap = tetrisSnapRef.current;
      if (!snap) return;
      const { grid, piece } = snap;
      if (!grid || grid.length === 0) return;

      // Merge current piece onto a copy of the grid for display
      const GRID_ROWS = grid.length;     // 12
      const GRID_COLS = grid[0]?.length ?? 6;
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
      const gridOffset = Math.max(0, GRID_ROWS - HW_ROWS);

      const nextColors: string[] = Array(TOTAL_PLATES).fill('#000000');
      const nextActive: boolean[] = Array(TOTAL_PLATES).fill(false);

      for (let hr = 0; hr < HW_ROWS; hr++) {
        const gridRow = gridOffset + hr;
        for (let hc = 0; hc < HW_COLS; hc++) {
          const tileIdx = hr * HW_COLS + hc;
          if (tileIdx >= TOTAL_PLATES) continue;
          const plateId = PLATE_ID_BY_INDEX[tileIdx];
          if (!plateId) continue;

          const cellColor = merged[gridRow]?.[hc] ?? null;
          if (cellColor) {
            sendRgbToPlate(hexToRgb255(cellColor), 90, plateId);
            nextColors[tileIdx] = cellColor;
            nextActive[tileIdx] = true;
          } else {
            sendRgbToPlate({ r: 0, g: 0, b: 0 }, 0, plateId);
          }
        }
      }

      setPlateColors(nextColors);
      setPlateActive(nextActive);
    }

    syncTetrisToHardware(); // sync initial
    const iv = setInterval(syncTetrisToHardware, 80); // poll toutes les 80ms pour fluidité
    return () => {
      clearInterval(iv);
      // Blackout quand on quitte le Tetris
      void blackoutHardware();
    };
  }, [gameActive, tetrisStandalone, hasEditorTetris]);

  // Nettoyage de l'état jeu quand on quitte le mode jeu
  useEffect(() => {
    if (!gameActive) {
      cancelAnimationFrame(rafRef.current);
      visualBatchRef.current.clear();
      gameColorStateRef.current = new Array(42).fill(null);
    }
  }, [gameActive]);

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

    // Restore session from server cookie
    void fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user.username);
          setUserType(data.user.role as UserType);
          if (data.user.niveau) setNiveau(data.user.niveau as Niveau);
          if (data.user.avatarColor) setUserAvatarColor(data.user.avatarColor);
          if (data.user.avatarIcon) setUserAvatarIcon((data.user.avatarIcon as string).slice(0, 1).toUpperCase() || 'U');
          // Fetch classes membership
          void fetch('/api/auth/me/classes', { cache: 'no-store' })
            .then(r => r.json()).then(d => { if (d.classes) setUserClasses(d.classes.map((c: {name:string}) => c.name)); })
            .catch(() => {});
          setView('main');
        }
        setSessionChecked(true);
      })
      .catch(() => setSessionChecked(true));

    // Check if teacher account exists (for setup)
    void fetch('/api/auth/setup', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setHasTeacher(data.hasTeacher ?? true))
      .catch(() => {});

    // Deep-links via QR code : ?classe=CODE (rejoindre une classe), ?spectre=CODE (rejoindre une partie)
    try {
      const params = new URLSearchParams(window.location.search);
      const classe = params.get('classe');
      if (classe && classe.trim()) setPendingClassCode(classe.trim().toUpperCase());
      const sp = params.get('spectre');
      if (sp && sp.trim()) {
        setSpectreJoinCode(sp.trim());
        setSpectreActive(true);
        setGameActive(true);
      }
    } catch { /* ignore */ }
  }, []);

  // Auto-jointure d'une classe dès que l'utilisateur est connecté (deep-link QR code)
  useEffect(() => {
    if (!currentUser || !pendingClassCode) return;
    void (async () => {
      try {
        const res = await fetch('/api/classes/join', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: pendingClassCode }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          setMessage(data.alreadyMember
            ? `Vous êtes déjà inscrit dans la classe « ${data.className} ».`
            : `Classe « ${data.className} » rejointe !`);
          void fetch('/api/auth/me/classes', { cache: 'no-store' })
            .then(r => r.json()).then(d => { if (d.classes) setUserClasses(d.classes.map((c: { name: string }) => c.name)); })
            .catch(() => {});
        } else {
          setMessage(data.error ?? 'Code de classe invalide');
        }
      } catch { setMessage('Erreur réseau lors de la jointure de la classe'); }
      setPendingClassCode('');
      try { window.history.replaceState(null, '', '/jeux'); } catch { /* ignore */ }
    })();
  }, [currentUser, pendingClassCode]);

  useEffect(() => {
    if (view !== 'main') return;

    // Ne poll que si un token MP existe OU si le status est actif OU si une session existe
    const shouldPoll = mpToken || mpStatus === 'active' || mpSessionId;
    if (!shouldPoll) return;

    let alive = true;
    let timer = 0;

    const tick = async () => {
      if (!alive) return;
      // Flag pour contrôler si finally doit reprogrammer (évite le double-schedule)
      let nextDelay = mpStatus === 'active' ? 800 : 5000;
      let doReschedule = true;

      try {
        const qs = mpToken ? `?token=${encodeURIComponent(mpToken)}` : '';
        const res = await fetch(`/api/multiplayer/state${qs}`, { cache: 'no-store' });

        if (!res.ok) {
          if (res.status === 404) {
            // Session introuvable → nettoyer le token et stopper le polling
            // (le useEffect se réexécutera avec shouldPoll=false et sortira)
            setMpToken('');
            setMpSessionId('');
            setMpStatus('');
            if (typeof window !== 'undefined') window.localStorage.removeItem('crg_mp_token');
            doReschedule = false;
          } else {
            // Autre erreur HTTP → retry espacé
            nextDelay = 5000;
          }
          return;
        }

        const data = (await res.json()) as any;
        if (!data?.ok) {
          nextDelay = 5000;
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
            if (mpAutoFollow && mpToken && youSeat) {
              if (!gameActive) setGameActive(true);
            }
          }
        }

        if (isMp && status === 'finished') {
          if (mpStatus === 'active' && gameActive && !mpEndPrompt && mpSeat === 1) setMpEndPrompt(true);
        }
      } catch {
        // Erreur réseau → retry espacé
        nextDelay = 5000;
      } finally {
        // Ne reprogrammer que si on n'a pas arrêté et que le composant est toujours monté
        if (doReschedule && alive) {
          timer = window.setTimeout(tick, nextDelay);
        }
      }
    };

    void tick();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [view, mpToken, mpStatus, mpSessionId, currentGame, gameActive, mpSnoozedSessionId]);

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
        // ignore - réseau indisponible ou API pas encore prête
      } finally {
        if (alive) {
          // Polling DB réduit : 60s au lieu de 30s
          timer = window.setTimeout(tick, 60000);
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
    // Ne pas poller pendant le jeu actif : le hardware doit être 100% disponible
    // pour les commandes couleur. Sinon les GET télémétrie (jusqu'à 3s) bloquent
    // les PUT de jeu sur le serveur monothread et créent un délai de 10s.
    if (gameActive) return;

    let stopped = false;
    let timer = 0;

    const poll = async () => {
      if (stopped) return;

      const t0 = performance.now();
      let json: unknown = null;

      // Timeout court côté client (2s) pour éviter de bloquer le hardware
      // si la route proxy met du temps à répondre.
      const ctrl1 = new AbortController();
      const t1Abort = window.setTimeout(() => ctrl1.abort(), 2000);
      try {
        const res = await fetch(`/api/supervision/state/plaque/${INSTRUMENT_PLATE_ID}/all`, {
          cache: 'no-store',
          signal: ctrl1.signal,
        });
        if (res.ok) json = (await res.json().catch(() => null)) as unknown;
      } catch {
        json = null;
      } finally {
        window.clearTimeout(t1Abort);
      }

      if (!json) {
        const ctrl2 = new AbortController();
        const t2Abort = window.setTimeout(() => ctrl2.abort(), 2000);
        try {
          const res = await fetch(`/api/supervision/state/plaque/${INSTRUMENT_PLATE_ID}`, {
            cache: 'no-store',
            signal: ctrl2.signal,
          });
          if (res.ok) json = (await res.json().catch(() => null)) as unknown;
        } catch {
          json = null;
        } finally {
          window.clearTimeout(t2Abort);
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
        colorTemp: tempK > 0 ? `${tempK}K` : '-',
        cri: `${cri}`,
        power: `${Math.floor(sum * 3)}W`,
        apiLatency,
      });

      if (!stopped) timer = window.setTimeout(poll, 3000);
    };

    void poll();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [gameActive]); // Pause le poll quand un jeu est actif

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

  // Auto-stop multiplayer game if no players for 15 seconds
  useEffect(() => {
    if (!gameActive) return;
    if (currentGame !== 'multiplayer-split') return;
    if (mpPlayers.length > 0) return;
    const t = window.setTimeout(() => {
      setGameActive(false);
      setCurrentGame(null);
      setMpEndPrompt(false);
      setMessage('Partie multijoueur arrêtée : aucun joueur connecté.');
    }, 15_000);
    return () => window.clearTimeout(t);
  }, [gameActive, currentGame, mpPlayers.length]);

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

  // Tetrix keyboard controls
  useEffect(() => {
    if (!gameActive || currentGame !== 'tetrix-light') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (tetrixGameOver) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          moveTetrixPiece('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveTetrixPiece('right');
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveTetrixPiece('down');
          break;
        case 'ArrowUp':
        case ' ':
          e.preventDefault();
          rotateTetrixPiece();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameActive, currentGame, tetrixGameOver, tetrixCurrentPiece, tetrixGrid]);

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
    setPlateColors(Array(42).fill(color));
    setPlateActive(Array(42).fill(active));
  }

  const hudGraphRunRef = useRef<{ timers: number[]; stop: boolean }>({ timers: [], stop: false });
  const hudGraphContinuationRef = useRef<(() => void) | null>(null);
  const hudGraphClickHandlersRef = useRef<Map<number, () => void>>(new Map());
  const gameClickHandlerRef = useRef<((idx: number) => void) | null>(null);
  // Moteur de variables des jeux éditeur : les nœuds écrivent ici, les composants UI lisent.
  const hudVarsRef = useRef<Record<string, number | string>>({});
  const bumpHudVars = () => setHudVarsTick((t) => (t + 1) % 1_000_000);
  // Walker du graphe en cours : permet de déclencher un sous-graphe (événement UI)
  // SANS arrêter la boucle principale (on_timer), contrairement à runHudGraphFrom.
  const hudWalkRef = useRef<((nodeId: string) => void) | null>(null);
  const fireHudEvent = (nodeId: string) => { hudWalkRef.current?.(nodeId); };
  // Grilles 2D des jeux éditeur (grid_create / grid_set / grid_sync_tiles)
  const hudGridsRef = useRef<Record<string, (string | null)[][]>>({});

  // Clavier -> nœuds on_key : déclenche le sous-graphe correspondant (input de jeu)
  useEffect(() => {
    if (!gameActive || !hudRun) return;
    const onKey = (e: KeyboardEvent) => {
      const nodes = Array.isArray(hudRunRef.current?.cfg.nodes) ? (hudRunRef.current!.cfg.nodes as EditorNode[]) : [];
      let matched = false;
      nodes.forEach((n) => {
        if (n.kind !== 'on_key' || n.enabled === false) return;
        const key = String(n.params?.key ?? '');
        if (!key || key === e.key || key.toLowerCase() === e.key.toLowerCase()) { matched = true; fireHudEvent(String(n.id)); }
      });
      if (matched) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameActive, hudRun]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopHudGraph = () => {
    hudGraphRunRef.current.stop = true;
    for (const t of hudGraphRunRef.current.timers) window.clearTimeout(t);
    hudGraphRunRef.current.timers = [];
    hudGraphContinuationRef.current = null;
    hudGraphClickHandlersRef.current.clear();
  };

  // Keep ref in sync so runHudGraphFrom can access the latest cfg without stale closure
  hudRunRef.current = hudRun;

  const runHudGraphFrom = (startNodeId: string) => {
    const run = hudRunRef.current;
    if (!run?.cfg) return;
    stopHudGraph();
    hudGraphRunRef.current.stop = false;

    const g = buildGraph(run.cfg);
    const start = g.byId.get(String(startNodeId));
    // Pas de retour anticipé : on construit toujours le walker (pour les événements UI),
    // même si le jeu n'a pas de nœud "Démarrer" connecté.

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
          // Border = first/last row or first/last column in 6x7 grid
          const isBorder = (idx: number) => {
            const row = Math.floor(idx / 6);
            const col = idx % 6;
            return row === 0 || row === 6 || col === 0 || col === 5;
          };
          setPlateColors((prev) => {
            const next = [...prev];
            for (let i = 0; i < 42; i++) {
              if (!isBorder(i)) continue;
              next[i] = color;
            }
            return next;
          });
          setPlateActive((prev) => {
            const next = [...prev];
            for (let i = 0; i < 42; i++) {
              if (!isBorder(i)) continue;
              next[i] = intensity > 0;
            }
            return next;
          });
        } else {
          setSelectedPlatesColor(color, intensity > 0);
        }
      }

      if (node.kind === 'tile') {
        const tileIndex = Math.max(0, Math.min(41, Math.round(getNum(params, 'tileIndex', 0))));
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
        const t01 = Math.max(0, Math.min(1, 0.5 + 0.5 * Math.sin(tSeconds * speed * 2 * Math.PI + phase)));

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

      // ── Pass-through nodes (événements + lectures) ──
      if (node.kind === 'ui_event_click' || node.kind === 'ui_event_change' || node.kind === 'ui_event_hover' || node.kind === 'event_begin'
        || node.kind === 'on_ui_click' || node.kind === 'on_score_reached' || node.kind === 'on_plate_click' || node.kind === 'on_key'
        || node.kind === 'variable_get' || node.kind === 'get_score' || node.kind === 'score_get') {
        const nextId = g.out.get(node.id)?.[0];
        if (nextId) walk(nextId);
        return;
      }

      // ── Boucle for_range : exécute le corps N fois ──
      if (node.kind === 'for_range') {
        const varName = String(params.varName ?? 'i');
        const start = Math.round(getNum(params, 'start', 0));
        const end = Math.round(getNum(params, 'end', 0));
        const step = Math.max(1, Math.round(getNum(params, 'step', 1)));
        const bodyId = String(params.bodyNodeId ?? '');
        if (bodyId) {
          if (start <= end) for (let i = start; i <= end; i += step) { hudVarsRef.current[varName] = i; walk(bodyId); }
          else for (let i = start; i >= end; i -= step) { hudVarsRef.current[varName] = i; walk(bodyId); }
        }
        const nextId = g.out.get(node.id)?.[0]; if (nextId) walk(nextId); return;
      }

      // ── Grilles 2D ──
      if (node.kind === 'grid_create') {
        const name = String(params.name ?? 'grid');
        const cols = Math.max(1, Math.round(getNum(params, 'cols', 6)));
        const rows = Math.max(1, Math.round(getNum(params, 'rows', 7)));
        hudGridsRef.current[name] = Array.from({ length: rows }, () => Array(cols).fill(null) as (string | null)[]);
        const nextId = g.out.get(node.id)?.[0]; if (nextId) walk(nextId); return;
      }
      if (node.kind === 'grid_set') {
        const name = String(params.name ?? 'grid');
        const col = Math.round(Number(hudVarsRef.current[String(params.colVar ?? 'col')] ?? 0));
        const row = Math.round(Number(hudVarsRef.current[String(params.rowVar ?? 'row')] ?? 0));
        const val = hudVarsRef.current[String(params.valueVar ?? 'val')];
        const grid = hudGridsRef.current[name];
        if (grid && grid[row] && col >= 0 && col < grid[row].length) grid[row][col] = (val === undefined || val === '' ? null : String(val));
        const nextId = g.out.get(node.id)?.[0]; if (nextId) walk(nextId); return;
      }
      if (node.kind === 'grid_get') {
        const name = String(params.name ?? 'grid');
        const col = Math.round(Number(hudVarsRef.current[String(params.colVar ?? 'col')] ?? 0));
        const row = Math.round(Number(hudVarsRef.current[String(params.rowVar ?? 'row')] ?? 0));
        const cell = hudGridsRef.current[name]?.[row]?.[col] ?? null;
        hudVarsRef.current[String(params.outVar ?? 'cell')] = cell == null ? '' : cell;
        const nextId = g.out.get(node.id)?.[0]; if (nextId) walk(nextId); return;
      }
      if (node.kind === 'grid_clear') {
        const grid = hudGridsRef.current[String(params.name ?? 'grid')];
        if (grid) for (const r of grid) r.fill(null);
        const nextId = g.out.get(node.id)?.[0]; if (nextId) walk(nextId); return;
      }
      if (node.kind === 'grid_sync_tiles') {
        const grid = hudGridsRef.current[String(params.name ?? 'grid')];
        const bg = getColor(params, 'bgColor', '#000000');
        if (grid) {
          for (let r = 0; r < 7; r++) for (let c = 0; c < 6; c++) {
            const idx = r * 6 + c; const plateId = PLATE_ID_BY_INDEX[idx]; if (!plateId) continue;
            const cell = grid[r]?.[c] ?? null;
            const lit = typeof cell === 'string' && cell.length > 0;
            const col = lit ? (cell as string) : bg;
            const rgb = parseCssColorToRgb255(col);
            sendRgbToPlate(rgb, lit ? 85 : 0, plateId);
            setPlateColor(idx, lit ? col : '#000000', lit);
          }
        }
        const nextId = g.out.get(node.id)?.[0]; if (nextId) walk(nextId); return;
      }

      // ── Variables : écriture dans le store, lu en live par les composants UI ──
      if (node.kind === 'variable_set' || node.kind === 'var_set' || node.kind === 'set_variable') {
        const name = String(params.name ?? params.varName ?? 'x');
        const op = String(params.op ?? 'set');
        const raw = (params.value as unknown);
        const num = Number(raw);
        const cur = Number(hudVarsRef.current[name] ?? 0);
        if (op === 'add') hudVarsRef.current[name] = cur + (Number.isFinite(num) ? num : 0);
        else if (op === 'sub') hudVarsRef.current[name] = cur - (Number.isFinite(num) ? num : 0);
        else if (op === 'mul') hudVarsRef.current[name] = cur * (Number.isFinite(num) ? num : 1);
        else hudVarsRef.current[name] = Number.isFinite(num) && typeof raw !== 'string' ? num : (raw as any);
        bumpHudVars();
        const nextId = g.out.get(node.id)?.[0]; if (nextId) walk(nextId); return;
      }
      if (node.kind === 'add_score' || node.kind === 'score_set') {
        const amount = getNum(params, 'amount', getNum(params, 'value', 1));
        hudVarsRef.current.score = node.kind === 'score_set' ? amount : Number(hudVarsRef.current.score ?? 0) + amount;
        bumpHudVars();
        if (amount > 0) playGameSound('score');
        // Déclenche les nœuds "Score atteint" (une seule fois par seuil)
        const sc = Number(hudVarsRef.current.score ?? 0);
        g.nodes.forEach((n2) => {
          if (n2.kind !== 'on_score_reached' || n2.enabled === false) return;
          const target = getNum((n2.params ?? {}) as Record<string, unknown>, 'target', 100);
          const firedKey = `__sr_${n2.id}`;
          if (sc >= target && !hudVarsRef.current[firedKey]) { hudVarsRef.current[firedKey] = 1; walk(String(n2.id)); }
        });
        const nextId = g.out.get(node.id)?.[0]; if (nextId) walk(nextId); return;
      }
      if (node.kind === 'play_sound') {
        const s = String(params.sound ?? 'click');
        playGameSound((['click', 'score', 'win', 'lose', 'tick', 'error'].includes(s) ? s : 'click') as any);
        const nextId = g.out.get(node.id)?.[0]; if (nextId) walk(nextId); return;
      }
      if (node.kind === 'score_reset') {
        hudVarsRef.current.score = 0; bumpHudVars();
        const nextId = g.out.get(node.id)?.[0]; if (nextId) walk(nextId); return;
      }
      if (node.kind === 'random_int') {
        const min = Math.round(getNum(params, 'min', 0));
        const max = Math.round(getNum(params, 'max', 41));
        const name = String(params.varName ?? 'rand');
        hudVarsRef.current[name] = Math.floor(Math.random() * (Math.max(min, max) - Math.min(min, max) + 1)) + Math.min(min, max);
        bumpHudVars();
        const nextId = g.out.get(node.id)?.[0]; if (nextId) walk(nextId); return;
      }

      // ── Wait ──
      if (node.kind === 'wait') {
        const seconds = Math.max(0, getNum(params, 'seconds', 1));
        const nextId = g.out.get(node.id)?.[0];
        const t = window.setTimeout(() => {
          if (nextId) walk(nextId);
        }, Math.round(seconds * 1000));
        hudGraphRunRef.current.timers.push(t);
        return;
      }

      // ── Sequence: walk all outputs in declaration order ──
      if (node.kind === 'sequence') {
        const outputs = g.out.get(node.id) ?? [];
        outputs.forEach((nextId) => walk(nextId));
        return;
      }

      // ── If: branch on boolean param ──
      if (node.kind === 'if') {
        const condition = Boolean(params.condition);
        const outputs = g.out.get(node.id) ?? [];
        const nextId = condition ? outputs[0] : outputs[1];
        if (nextId) walk(nextId);
        return;
      }

      // ── on_timer: fire connected subgraph on interval ──
      if (node.kind === 'on_timer') {
        const ms = Math.max(100, getNum(params, 'intervalMs', 1000));
        const nextId = g.out.get(node.id)?.[0];
        if (nextId) {
          const iv = window.setInterval(() => {
            if (hudGraphRunRef.current.stop) { window.clearInterval(iv); return; }
            walk(nextId);
          }, ms);
          hudGraphRunRef.current.timers.push(iv);
        }
        return;
      }

      // ── on_click: register plate click handler ──
      if (node.kind === 'on_click') {
        const tileIndex = Math.max(0, Math.min(41, Math.round(getNum(params, 'tileIndex', 0))));
        const nextId = g.out.get(node.id)?.[0];
        if (nextId) hudGraphClickHandlersRef.current.set(tileIndex, () => { if (!hudGraphRunRef.current.stop) walk(nextId); });
        return;
      }

      // ── tile_set: set individual tile color ──
      if (node.kind === 'tile_set') {
        const tileIndex = Math.max(0, Math.min(41, Math.round(getNum(params, 'tileIndex', 0))));
        const color = getColor(params, 'color', '#ffffff');
        const rawInt = typeof params.intensity === 'number' ? params.intensity : 1;
        const intensity = intensityToMasterPercent(rawInt, masterIntensity);
        setPlateColor(tileIndex, color, intensity > 0);
        const nextId = g.out.get(node.id)?.[0];
        if (nextId) walk(nextId);
        return;
      }

      // ── game_tetris: launch Tetrix as black-box node ──
      if (node.kind === 'game_tetris') {
        setTetrisStandalone(false);
        setTetrixActive(true);
        startTetrixGame();
        const onEndId = g.out.get(node.id)?.[0];
        if (onEndId) hudGraphContinuationRef.current = () => { if (!hudGraphRunRef.current.stop) walk(onEndId); };
        return;
      }

      // ── game_simon: launch Simon as black-box node ──
      if (node.kind === 'game_simon') {
        void startSimonGame();
        const onEndId = g.out.get(node.id)?.[0];
        if (onEndId) hudGraphContinuationRef.current = () => { if (!hudGraphRunRef.current.stop) walk(onEndId); };
        return;
      }

      // ── game_memory: launch Match-Pair as black-box node ──
      if (node.kind === 'game_memory') {
        startMatchPairGame();
        const onEndId = g.out.get(node.id)?.[0];
        if (onEndId) hudGraphContinuationRef.current = () => { if (!hudGraphRunRef.current.stop) walk(onEndId); };
        return;
      }

      // ── Mesure colorimétrique CS-160 ──────────────────────────────────────
      // measure_start : lance une mesure via le CS-160 et stocke x, y, Lv dans
      // les variables définies dans les paramètres, puis continue l'exécution.
      if (node.kind === 'measure_start' || node.kind === 'cs160_measure') {
        const varX  = String(params.varX  ?? 'meas_x');
        const varY  = String(params.varY  ?? 'meas_y');
        const varLv = String(params.varLv ?? 'meas_lv');
        const timeoutSec = Math.max(1, Math.min(30, Number(params.timeoutSec ?? params.timeout ?? 10)));
        (async () => {
          try {
            const res = await fetch('/api/cs160', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ action: 'measure' }),
              signal: AbortSignal.timeout(timeoutSec * 1000),
              cache: 'no-store',
            });
            const data = await res.json();
            if (data.success && data.data) {
              const d = data.data.data ?? data.data;
              const lvxy = d.lvxy ?? d;
              hudVarsRef.current[varX]  = Number(lvxy.x  ?? 0);
              hudVarsRef.current[varY]  = Number(lvxy.y  ?? 0);
              hudVarsRef.current[varLv] = Number(lvxy.Lv ?? lvxy.lv ?? 0);
              hudVarsRef.current.meas_ok = 1;
            } else {
              hudVarsRef.current.meas_ok = 0;
            }
          } catch { hudVarsRef.current.meas_ok = 0; }
          bumpHudVars();
          const nextId = g.out.get(node.id)?.[0];
          if (nextId && !hudGraphRunRef.current.stop) walk(nextId);
        })();
        return;
      }

      // measure_on_result : alias de measure_start (lit le résultat) ou nœud
      // de « branchement après mesure » — continue immédiatement (le résultat
      // a déjà été stocké par measure_start dans hudVarsRef).
      if (node.kind === 'measure_on_result') {
        const varX  = String(params.varX  ?? 'meas_x');
        const varY  = String(params.varY  ?? 'meas_y');
        const varLv = String(params.varLv ?? 'meas_lv');
        // Remappe si des noms différents sont demandés
        if (hudVarsRef.current.meas_x  !== undefined) hudVarsRef.current[varX]  = hudVarsRef.current.meas_x;
        if (hudVarsRef.current.meas_y  !== undefined) hudVarsRef.current[varY]  = hudVarsRef.current.meas_y;
        if (hudVarsRef.current.meas_lv !== undefined) hudVarsRef.current[varLv] = hudVarsRef.current.meas_lv;
        bumpHudVars();
        const nextId = g.out.get(node.id)?.[0];
        if (nextId) walk(nextId);
        return;
      }

      // measure_compare : calcule ΔE (distance CIE xy) entre la mesure et la
      // cible et ajoute un score proportionnel à la précision.
      if (node.kind === 'measure_compare') {
        const tx = Number(params.targetX ?? 0.3127);
        const ty = Number(params.targetY ?? 0.3290);
        const tol = Math.max(0.001, Number(params.toleranceDeltaE ?? 5));
        const mx = Number(hudVarsRef.current.meas_x ?? 0);
        const my = Number(hudVarsRef.current.meas_y ?? 0);
        const dxy = Math.sqrt((mx - tx) ** 2 + (my - ty) ** 2);
        const accuracy = Math.max(0, 1 - dxy / (tol * 0.01)); // 0..1
        hudVarsRef.current.meas_accuracy = Math.round(accuracy * 100);
        hudVarsRef.current.meas_delta    = Math.round(dxy * 1000) / 1000;
        const pts = Math.round(accuracy * Number(params.maxPoints ?? 100));
        if (pts > 0) {
          hudVarsRef.current.score = Number(hudVarsRef.current.score ?? 0) + pts;
          if (pts > 0) { setScorePlusValue(pts); setScorePlusAnimKey((k) => k + 1); }
        }
        bumpHudVars();
        const nextId = g.out.get(node.id)?.[0];
        if (nextId) walk(nextId);
        return;
      }

      // ── game_spectrum: ouvre Spectre Chromatique dans un nouvel onglet ──
      if (node.kind === 'game_spectrum') {
        window.open('/spectre', '_blank');
        const onEndId = g.out.get(node.id)?.[0];
        if (onEndId) setTimeout(() => { if (!hudGraphRunRef.current.stop) walk(onEndId); }, 500);
        return;
      }

      // ── Render nodes (fill, tile, pulse) ──
      const nowSec = Date.now() / 1000;
      execNode(node, nowSec);

      const secondsAfter = node.kind === 'fill' ? Math.max(0.01, getNum(params, 'seconds', 1)) : 0;
      const nextId = g.out.get(node.id)?.[0];
      if (!nextId) return;
      if (secondsAfter > 0) {
        const t = window.setTimeout(() => { walk(nextId); }, Math.round(secondsAfter * 1000));
        hudGraphRunRef.current.timers.push(t);
      } else {
        walk(nextId);
      }
    };

    hudWalkRef.current = walk; // expose le walker pour les événements UI (sans stop)
    if (start && start.enabled !== false) walk(start.id);
  };

  function resetScene() {
    cancelPendingHardware(); // annule les debounce en vol avant le blackout
    setPlateColors(Array(42).fill('#000000'));
    setPlateActive(Array(42).fill(false));
    setLedValues({});
    setMasterIntensity(80);
    setBeginnerRgb({ r: 0, g: 0, b: 0 });
    setInstrument((prev) => ({ ...prev, power: '0W' }));
    void blackoutHardware();
  }

  async function login() {
    if (!username.trim()) {
      setMessage('Veuillez entrer votre nom');
      return;
    }
    setLoginLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password, niveau, role: userType }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const detail = data.detail ? ` (${data.detail})` : '';
        setMessage((data.error ?? 'Erreur de connexion') + detail);
        return;
      }
      setCurrentUser(data.user.username);
      setUserType(data.user.role as UserType);
      if (data.user.niveau) setNiveau(data.user.niveau as Niveau);
      setView('main');
      setScore(0);
      setGamesCompleted(0);
      updateLeaderboard(0, niveau, data.user.username);
    } catch {
      setMessage('Erreur réseau');
    } finally {
      setLoginLoading(false);
    }
  }

  async function setupTeacher(setupUsername: string, setupPassword: string) {
    setLoginLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: setupUsername, password: setupPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMessage(data.error ?? 'Erreur création compte');
        return;
      }
      setHasTeacher(true);
      setLoginStep('form');
      setMessage('Compte créé ! Vous pouvez vous connecter.');
    } catch {
      setMessage('Erreur réseau');
    } finally {
      setLoginLoading(false);
    }
  }

  function logout() {
    void fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setCurrentUser(null);
    setView('login');
    setLoginStep('role');
    setUsername('');
    setPassword('');
    setGameActive(false);
    setCurrentGame(null);
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

    const showHud = Boolean(cfg.ui && Array.isArray(cfg.ui.widgets) && cfg.ui.widgets.length > 0);
    const newRun = { gameId: game.id, name: game.name, cfg, showHud };
    hudRunRef.current = newRun;
    hudVarsRef.current = { score: 0 }; // réinitialise le store de variables du jeu
    hudGridsRef.current = {};           // réinitialise les grilles 2D
    setHudVarsTick((t) => t + 1);
    setHudRun(newRun);
    setCustomRun(null);
    setCurrentGame(null);
    setGameActive(true);
    setMessage(`Jeu éditeur: ${game.name}`);
    resetScene();

    try {
      const g = buildGraph(cfg);
      const begin = g.nodes.find((n) => n.kind === 'event_begin' && n.enabled !== false);
      // Toujours appeler runHudGraphFrom : si event_begin existe il démarre la logique,
      // sinon le walker est quand même construit pour que les événements UI fonctionnent.
      runHudGraphFrom(begin?.id ? String(begin.id) : '__no_start__');
    } catch {
      // ignore
    }
  }

  function customRunUpdateVar(name: string, value: CustomGameVarValue) {
    setCustomRun((prev) => {
      if (!prev) return prev;
      return { ...prev, cfg: { ...prev.cfg, vars: { ...prev.cfg.vars, [name]: value } } };
    });
  }

  // Fonction selectGame supprimée : les jeux sont lancés directement depuis la DB

  function startSpectralChallenge() { setSpectralActive(true); }
  function startChaseGame() { setChaseActive(true); }
  function startMatchPairGame() { setMpActive(true); }
  function startSnakeGame() { setSnakeActive(true); }

  function stopGame() {
    // Arrêter le jeu multijoueur si actif
    if (mpStatus === 'active') {
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

    // Annuler tous les timers hardware en attente AVANT de changer les états React
    // (évite que les debounce 20ms rallument des dalles après le blackout)
    cancelPendingHardware();

    // Éteindre immédiatement toutes les dalles des jeux natifs
    PLATE_ID_BY_INDEX.forEach(id => turnOffPlateImmediate(id));

    setGameActive(false);
    setCustomRun(null);
    setHudRun(null);
    setTetrisStandalone(false);
    setSimonActive(false);
    setActiveBuiltinGame(null);
    setSecretRevealed(false);
    setTargetColor(null);
    setTargetTemp(null);
    setEscapeProgress(0);
    setMpEndPrompt(false);
    setMpAutoFollow(false);
    setMessage('Jeu arrêté.');
    resetScene();
    stopHudGraph();
    stopTetrixGame();
    stopSimonGame();
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
    setMessage('Jeu démarré !');
    resetScene();

    // Les jeux sont maintenant gérés par la DB (custom ou editor)
    if (customRun || hudRun) {
      return;
    }

    // Tous les jeux sont désormais créés dans l'éditeur

    // Logique multijoueur reste disponible via API
    if (mpStatus === 'active') {
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

    // Escape game sera recréé dans l'éditeur

    // Tetrix sera recréé dans l'éditeur
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

  // Show game over popup with 2 second minimum display time
  function showGameOverPopup(gameName: string, score: number, message: string) {
    setGameOverPopup({ open: true, game: gameName, score, message });
    // Fire graph continuation if a game_* node was waiting for this
    const cont = hudGraphContinuationRef.current;
    if (cont) {
      hudGraphContinuationRef.current = null;
      window.setTimeout(cont, 2200);
    }
  }

  // Tetrix Light game functions
  function stopTetrixGame() {
    if (tetrixTimerRef.current) {
      window.clearInterval(tetrixTimerRef.current);
      tetrixTimerRef.current = 0;
    }
    setTetrixGrid(Array(42).fill(null));
    setTetrixScore(0);
    setTetrixGameOver(false);
    setTetrixCurrentPiece(null);
    setTetrixNextPiece(null);
    setTetrixLevel(1);
    setTetrixLines(0);
  }

  function startTetrixGame() {
    stopTetrixGame();
    setMessage('Tetrix Light: Alignez 3 dalles de même couleur pour les faire disparaître!');
    resetScene();
    setAllPlates('#000000', true);

    // Initialize game
    setTetrixGrid(Array(42).fill(null));
    setTetrixScore(0);
    setTetrixLevel(1);
    setTetrixLines(0);
    setTetrixGameOver(false);

    // Spawn first piece
    spawnTetrixPiece();

    // Start game loop
    const speed = Math.max(800, 2000 - (tetrixLevel * 200));
    tetrixTimerRef.current = window.setInterval(() => {
      gameLoop();
    }, speed);
  }

  const TETRIX_COLS = 6;
  const TETRIX_ROWS = 7;

  function spawnTetrixPiece() {
    const shapes: ('I' | 'L' | 'T' | 'O')[] = ['I', 'L', 'T', 'O'];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const color = tetrixColors[Math.floor(Math.random() * tetrixColors.length)];

    // Generate initial positions based on shape (6-wide grid)
    let positions: number[] = [];
    switch (shape) {
      case 'I': // Horizontal 4-wide at top, centered
        positions = [1, 2, 3, 4];
        break;
      case 'L': // L shape: vertical 3 + 1 right
        positions = [1, 7, 13, 14]; // col1 rows 0-2, then col2 row2
        break;
      case 'T': // T shape: 3 wide + 1 below center
        positions = [1, 2, 3, 8]; // row0 cols 1-3, row1 col2
        break;
      case 'O': // 2x2 square
        positions = [2, 3, 8, 9]; // row0 cols 2-3, row1 cols 2-3
        break;
    }

    const piece = { color, positions };
    setTetrixCurrentPiece(piece);
    setTetrixNextPiece({ color: tetrixColors[Math.floor(Math.random() * tetrixColors.length)], shape });
    updateTetrixDisplay(piece, tetrixGrid);
  }

  function updateTetrixDisplay(piece: { color: string; positions: number[] } | null, grid: (string | null)[]) {
    const displayColors: string[] = Array(42).fill('#000000');

    // Draw locked pieces from grid
    for (let i = 0; i < 42; i++) {
      const gridValue = grid[i];
      if (gridValue !== null && gridValue !== undefined) {
        displayColors[i] = gridValue;
      }
    }

    // Draw current piece
    if (piece) {
      for (const pos of piece.positions) {
        if (pos >= 0 && pos < 42) {
          displayColors[pos] = piece.color;
        }
      }
    }

    // Update visual plates + send to hardware API
    const nextColors: string[] = [];
    const nextActive: boolean[] = [];
    for (let i = 0; i < 42; i++) {
      const color = displayColors[i];
      const isOn = color !== '#000000';
      nextColors.push(color);
      nextActive.push(isOn);

      const plateId = PLATE_ID_BY_INDEX[i];
      if (!plateId) continue;
      if (isOn) {
        const rgb = hexToRgb255(color);
        sendRgbToPlate(rgb, 80, plateId);
      } else {
        for (let ch = 0; ch < 32; ch++) scheduleSetCanal(plateId, ch, 0);
      }
    }
    setPlateColors(nextColors);
    setPlateActive(nextActive);
  }

  function moveTetrixPiece(direction: 'left' | 'right' | 'down') {
    if (!tetrixCurrentPiece || tetrixGameOver) return;

    const newPositions = tetrixCurrentPiece.positions.map((pos) => {
      switch (direction) {
        case 'left':
          return pos % TETRIX_COLS === 0 ? pos : pos - 1;
        case 'right':
          return pos % TETRIX_COLS === (TETRIX_COLS - 1) ? pos : pos + 1;
        case 'down':
          return pos + TETRIX_COLS;
        default:
          return pos;
      }
    });

    // Check collision
    if (isValidMove(newPositions, tetrixGrid)) {
      const newPiece = { ...tetrixCurrentPiece, positions: newPositions };
      setTetrixCurrentPiece(newPiece);
      updateTetrixDisplay(newPiece, tetrixGrid);
    } else if (direction === 'down') {
      lockTetrixPiece();
    }
  }

  function rotateTetrixPiece() {
    if (!tetrixCurrentPiece || tetrixGameOver) return;

    const pivot = tetrixCurrentPiece.positions[0];
    const pivotRow = Math.floor(pivot / TETRIX_COLS);
    const pivotCol = pivot % TETRIX_COLS;

    const newPositions = tetrixCurrentPiece.positions.map((pos) => {
      const row = Math.floor(pos / TETRIX_COLS);
      const col = pos % TETRIX_COLS;
      // Rotate 90° clockwise around pivot
      const newRow = pivotRow + (col - pivotCol);
      const newCol = pivotCol - (row - pivotRow);
      return newRow * TETRIX_COLS + newCol;
    });

    if (isValidMove(newPositions, tetrixGrid)) {
      const newPiece = { ...tetrixCurrentPiece, positions: newPositions };
      setTetrixCurrentPiece(newPiece);
      updateTetrixDisplay(newPiece, tetrixGrid);
    }
  }

  function isValidMove(positions: number[], grid: (string | null)[]): boolean {
    for (const pos of positions) {
      if (pos < 0 || pos >= TETRIX_COLS * TETRIX_ROWS) return false;
      if (grid[pos]) return false;
    }
    return true;
  }

  function lockTetrixPiece() {
    if (!tetrixCurrentPiece) return;

    const newGrid = [...tetrixGrid];
    for (const pos of tetrixCurrentPiece.positions) {
      newGrid[pos] = tetrixCurrentPiece.color;
    }

    // Check for completed rows (bottom-up so gravity works)
    let linesCleared = 0;
    for (let row = TETRIX_ROWS - 1; row >= 0; row--) {
      const rowStart = row * TETRIX_COLS;
      let isComplete = true;
      for (let col = 0; col < TETRIX_COLS; col++) {
        if (!newGrid[rowStart + col]) { isComplete = false; break; }
      }

      if (isComplete) {
        // Shift everything above down by one row
        for (let r = row; r > 0; r--) {
          for (let c = 0; c < TETRIX_COLS; c++) {
            newGrid[r * TETRIX_COLS + c] = newGrid[(r - 1) * TETRIX_COLS + c];
          }
        }
        // Clear top row
        for (let c = 0; c < TETRIX_COLS; c++) newGrid[c] = null;
        linesCleared++;
        row++; // re-check this row since rows shifted down
      }
    }

    // Update score
    if (linesCleared > 0) {
      const points = linesCleared * 100 * tetrixLevel;
      setTetrixScore((s) => s + points);
      setTetrixLines((l) => {
        const newLines = l + linesCleared;
        if (newLines >= tetrixLevel * 5) {
          setTetrixLevel((lvl) => lvl + 1);
        }
        return newLines;
      });
    }

    setTetrixGrid(newGrid);

    // Check game over (top row has locked pieces)
    const topRowHasPieces = newGrid.slice(0, TETRIX_COLS).some(c => c !== null);
    if (topRowHasPieces) {
      setTetrixGameOver(true);
      if (tetrixTimerRef.current) {
        window.clearInterval(tetrixTimerRef.current);
        tetrixTimerRef.current = 0;
      }
      const finalScore = tetrixScore + (linesCleared * 100 * tetrixLevel);
      setMessage(`Game Over! Score: ${finalScore}`);
      award(finalScore, `Tetrix terminé! Score: ${finalScore}`);
      showGameOverPopup('Tetrix Light', finalScore, `Niveau ${tetrixLevel} atteint`);
      return;
    }

    // Spawn new piece
    spawnTetrixPiece();
  }

  function gameLoop() {
    moveTetrixPiece('down');
  }

  // Simon game functions - ENHANCED VERSION
  const [simonScore, setSimonScore] = useState<number>(0);
  const [simonHighScore, setSimonHighScore] = useState<number>(0);
  const [simonStrictMode, setSimonStrictMode] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Sound frequencies for each color (red, green, blue, yellow)
  const SIMON_FREQUENCIES = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5

  function initAudio() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  function playTone(frequency: number, duration: number) {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.value = frequency;
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  function playErrorSound() {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3);
    osc.type = 'sawtooth';
    
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  }

  function playWinSound() {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((f, i) => {
      setTimeout(() => playTone(f, 0.15), i * 100);
    });
  }

  function stopSimonGame() {
    if (simonTimerRef.current) {
      window.clearTimeout(simonTimerRef.current);
      simonTimerRef.current = 0;
    }
    setSimonActive(false);
    setSimonSequence([]);
    setSimonPlayerInput([]);
    setSimonLevel(1);
    setSimonPhase('showing');
    setSimonLitPlate(null);
    setSimonScore(0);
  }

  async function animateAllPlates(color: string, duration: number, times: number) {
    for (let t = 0; t < times; t++) {
      // Light up
      setPlateColors(Array(42).fill(color));
      setPlateActive(Array(42).fill(true));
      
      // Light up hardware - batch all 42 plates in one request
      const rgb = hexToRgb255(color);
      const platesData = PLATE_ID_BY_INDEX.map((plateId) => ({
        plateId,
        rgb,
        intensity: 80,
      }));
      sendColorsToPlates(platesData);
      
      await new Promise(r => setTimeout(r, duration));
      
      // Turn off
      setPlateColors(Array(42).fill('#000000'));
      setPlateActive(Array(42).fill(true));
      
      // Turn off hardware - batch all 42 plates in one request
      const offPlatesData = PLATE_ID_BY_INDEX.map((plateId) => ({
        plateId,
        rgb: { r: 0, g: 0, b: 0 },
        intensity: 0,
      }));
      sendColorsToPlates(offPlatesData);
      
      await new Promise(r => setTimeout(r, duration / 2));
    }
  }

  async function startSimonGame() {
    // Clear any existing timers
    if (simonTimerRef.current) {
      window.clearTimeout(simonTimerRef.current);
      simonTimerRef.current = 0;
    }
    isShowingSequenceRef.current = false;
    
    stopSimonGame();
    setSimonActive(true);
    setSimonSequence([]);
    setSimonPlayerInput([]);
    setSimonLevel(1);
    simonLevelRef.current = 1; // Reset level ref
    setSimonScore(0);
    setSimonPhase('showing');
    setMessage('Simon: Préparez-vous!');
    resetScene();
    
    // Countdown animation with all plates
    await animateAllPlates('#ffffff', 200, 3);
    
    // Colorful startup sequence
    for (let i = 0; i < 4; i++) {
      const plateIdx = SIMON_PLATES[i];
      const color = SIMON_COLORS[i];
      const plateId = PLATE_ID_BY_INDEX[plateIdx] ?? 1;
      
      setPlateColor(plateIdx, color, true);
      void sendColorToPlateImmediate(hexToRgb255(color), 90, plateId);
      playTone(SIMON_FREQUENCIES[i], 200);
      
      await new Promise(r => setTimeout(r, 200));
      
      setPlateColor(plateIdx, '#000000', true);
      void turnOffPlateImmediate(plateId);
      await new Promise(r => setTimeout(r, 100));
    }
    
    setMessage('Simon: Mémorisez la séquence!');
    
    // Start first level after delay
    window.setTimeout(() => {
      simonNextLevel();
    }, 800);
  }

  function simonNextLevel() {
    // Clear any pending timers first
    if (simonTimerRef.current) {
      window.clearTimeout(simonTimerRef.current);
      simonTimerRef.current = 0;
    }
    
    setSimonSequence(prev => {
      const nextPlate = Math.floor(Math.random() * 4);
      const newSequence = [...prev, nextPlate];
      
      // Small delay before showing sequence
      window.setTimeout(() => {
        setSimonPlayerInput([]);
        setSimonPhase('showing');
        setMessage(`Niveau ${simonLevelRef.current + 1} - Observez ${newSequence.length} coups...`);
        
        // Show sequence after brief pause
        window.setTimeout(() => {
          showSimonSequence(newSequence, 0);
        }, 400);
      }, 300);
      
      return newSequence;
    });
    
    // Update level ref immediately for timing calculations
    setSimonLevel(prev => {
      const newLevel = prev + 1;
      simonLevelRef.current = newLevel;
      return newLevel;
    });
  }

  // Send color to a specific plate with batch API - OPTIMIZED: only non-zero channels
  function sendColorToPlateImmediate(rgb: TargetColor, intensity100: number, plateId: number) {
    const channels32 = rgbToChannels32(rgb, intensity100);
    const channels = channels32.map((v, i) => ({ index: i, value: clamp255(v ?? 0) }));
    fetch('/api/supervision/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plateId, channels, fast: true }),
      cache: 'no-store',
    }).catch(() => {});
  }

  // Turn off a specific plate completely using batch API
  function turnOffPlateImmediate(plateId: number) {
    const channels = Array.from({ length: 32 }, (_, i) => ({
      index: i,
      value: 0,
    }));

    // Fire-and-forget
    fetch('/api/supervision/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plateId, channels }),
      cache: 'no-store',
    }).catch(() => {});
  }

  // Send colors to multiple plates - one request per plate to avoid overloading the server
  function sendColorsToPlates(platesData: { plateId: number; rgb: TargetColor; intensity: number }[]) {
    for (const { plateId, rgb, intensity } of platesData) {
      const channels32 = rgbToChannels32(rgb, intensity);
      const channels = channels32.map((v, i) => ({ index: i, value: clamp255(v ?? 0) }));
      fetch('/api/supervision/batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plateId, channels, fast: true }),
        cache: 'no-store',
      }).catch(() => {});
    }
  }

  // Exponential difficulty: base * (rate ^ level)
  // Level 1: 600ms, Level 5: ~350ms, Level 10: ~200ms, Level 15: ~100ms
  function getSimonFlashDuration(level: number): number {
    const base = 600;
    const rate = 0.88; // 12% reduction per level
    return Math.max(150, Math.round(base * Math.pow(rate, level - 1)));
  }

  function getSimonPauseDuration(level: number): number {
    const base = 350;
    const rate = 0.85; // 15% reduction per level
    return Math.max(100, Math.round(base * Math.pow(rate, level - 1)));
  }

  function showSimonSequence(sequence: number[], index: number) {
    // Prevent multiple overlapping sequences
    if (isShowingSequenceRef.current && index === 0) {
      console.log('[Simon] Sequence already playing, ignoring duplicate call');
      return;
    }
    
    if (index === 0) {
      isShowingSequenceRef.current = true;
    }
    
    if (index >= sequence.length) {
      isShowingSequenceRef.current = false;
      setSimonPhase('input');
      setMessage(`Niveau ${simonLevelRef.current} - À vous! (${sequence.length} coups)`);
      return;
    }

    const plateIdx = SIMON_PLATES[sequence[index]];
    const color = SIMON_COLORS[sequence[index]];
    const plateId = PLATE_ID_BY_INDEX[plateIdx] ?? 1;
    const rgb = hexToRgb255(color);
    
    // Use ref to get current level (avoids stale closure)
    const currentLevel = simonLevelRef.current;

    // Light up plate with animation
    setSimonLitPlate(plateIdx);
    setPlateColor(plateIdx, color, true);
    
    // Play sound
    playTone(SIMON_FREQUENCIES[sequence[index]], getSimonFlashDuration(currentLevel));
    
    // Send to hardware immediately
    void sendColorToPlateImmediate(rgb, 100, plateId);

    // Turn off after delay - exponential difficulty
    const flashDuration = getSimonFlashDuration(currentLevel);
    
    simonTimerRef.current = window.setTimeout(() => {
      setSimonLitPlate(null);
      setPlateColor(plateIdx, '#000000', true);
      void turnOffPlateImmediate(plateId);

      // Pause before next flash - exponential difficulty
      const pauseDuration = getSimonPauseDuration(currentLevel);
      
      simonTimerRef.current = window.setTimeout(() => {
        showSimonSequence(sequence, index + 1);
      }, pauseDuration);
    }, flashDuration);
  }

  async function handleSimonPlateClick(plateIndex: number) {
    if (!simonActive || simonPhase !== 'input') return;

    const simonPlateIndex = SIMON_PLATES.indexOf(plateIndex);
    if (simonPlateIndex === -1) return;

    const color = SIMON_COLORS[simonPlateIndex];
    const plateId = PLATE_ID_BY_INDEX[plateIndex] ?? 1;
    const rgb = hexToRgb255(color);

    // Visual feedback - brighter and longer
    setPlateColor(plateIndex, color, true);
    void sendColorToPlateImmediate(rgb, 100, plateId);
    playTone(SIMON_FREQUENCIES[simonPlateIndex], 300);

    // Keep lit for feedback
    await new Promise(r => setTimeout(r, 250));
    
    setPlateColor(plateIndex, '#000000', true);
    void turnOffPlateImmediate(plateId);

    // Check input
    const newInput = [...simonPlayerInput, simonPlateIndex];
    setSimonPlayerInput(newInput);

    // Validate against sequence
    const expected = simonSequence[newInput.length - 1];
    if (simonPlateIndex !== expected) {
      // Wrong! Play error sound
      playErrorSound();
      
      // Flash red on wrong plate
      setPlateColor(plateIndex, '#ff0000', true);
      void sendColorToPlateImmediate({ r: 255, g: 0, b: 0 }, 100, plateId);
      
      await new Promise(r => setTimeout(r, 300));
      void turnOffPlateImmediate(plateId);
      
      // Show game over animation
      await animateAllPlates('#ff0000', 200, 2);
      
      setSimonPhase('gameover');
      const finalScore = simonScore + (simonLevel * 10);
      setMessage(`Game Over! Score: ${finalScore}`);
      award(finalScore, `Simon terminé! Niveau ${simonLevel} - +${finalScore} points.`);
      
      // Update high score
      if (finalScore > simonHighScore) {
        setSimonHighScore(finalScore);
      }
      
      // Show game over popup
      showGameOverPopup('Simon Memory', finalScore, `Niveau ${simonLevel} atteint`);
      return;
    }

    // Correct input - add points
    setSimonScore(prev => prev + 5);

    // Check if sequence complete
    if (newInput.length === simonSequence.length) {
      // Level complete! Play win sound
      playWinSound();
      
      // Success animation
      await animateAllPlates('#00ff00', 150, 2);
      
      const bonus = simonLevel * 15;
      const newScore = simonScore + bonus + (simonLevel * 10);
      setSimonScore(newScore);
      awardPoints(bonus, `Niveau ${simonLevel} réussi! +${bonus} points.`);
      
      setSimonLevel(simonLevel + 1);
      setMessage(`Niveau ${simonLevel + 1}...`);

      // Next level after delay
      window.setTimeout(() => {
        simonNextLevel();
      }, 1200);
    }
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
    for (let i = 0; i < 42; i++) setPlateColor(i, color, true);
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
    award(points, `Précision: ${accuracy.toFixed(1)}% - +${points} points.`);
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
    award(points, `Écart: ${error}K - Précision: ${accuracy.toFixed(1)}% - +${points} points.`);
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
    award(points, `Spectre validé! ${totalLEDs} LED configurées - +${points} points.`);
  }

  function loadScene(sceneName: string) {
    if (!sceneName) return;

    const scenes: Record<string, string> = {
      candlelight: '#ff8c00',
      warmwhite: '#ffaa6b',
      softwhite: '#ffc58f',
      coolwhite: '#ffffff',
      daylight: '#f0f8ff',
      bluesky: '#cce0ff',
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

      const targetIndexes = sceneApplyScope === 'all' ? Array.from({ length: 42 }, (_, i) => i) : getTargetPlateIndexes();
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

    if (sceneName === 'candlelight') sendKelvinToHardware(1900);
    else if (sceneName === 'warmwhite') sendKelvinToHardware(2700);
    else if (sceneName === 'softwhite') sendKelvinToHardware(3000);
    else if (sceneName === 'coolwhite') sendKelvinToHardware(5000);
    else if (sceneName === 'daylight') sendKelvinToHardware(6500);
    else if (sceneName === 'bluesky') sendKelvinToHardware(10000);
    else sendRgbToHardware({ r: 255, g: 255, b: 255 });
  }

  function handlePlateClick(index: number) {
    // Fire on_click graph handlers if registered
    const clickHandler = hudGraphClickHandlersRef.current.get(index);
    if (clickHandler) clickHandler();
    // Handle Simon game clicks first
    if (simonActive) {
      handleSimonPlateClick(index);
      return;
    }
    // When a builtin game handler is active (Color Speed, Maître du Blanc, etc.)
    // skip the free-play toggle - the game manages its own plate state
    if (gameClickHandlerRef.current) {
      gameClickHandlerRef.current(index);
      return;
    }

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
      if (isOn) {
        // Utilise le profil blanc (canal 26) via rgbToChannels32 - valeurs 0-100
        const channels32 = rgbToChannels32({ r: 255, g: 255, b: 255 }, masterIntensity);
        for (let canalIndex = 0; canalIndex < 32; canalIndex++) {
          scheduleSetCanal(plaqueId, canalIndex, channels32[canalIndex] ?? 0);
        }
      } else {
        for (let canalIndex = 0; canalIndex < 32; canalIndex++) {
          scheduleSetCanal(plaqueId, canalIndex, 0);
        }
      }

      setLedValues(() => {
        const next: Record<number, number> = {};
        if (isOn) {
          const ch = rgbToChannels32({ r: 255, g: 255, b: 255 }, masterIntensity);
          for (let i = 0; i < 32; i++) next[i] = ch[i] ?? 0;
        } else {
          for (let i = 0; i < 32; i++) next[i] = 0;
        }
        return next;
      });
      setHardwarePreviewCss(isOn ? 'rgb(255,255,255)' : 'rgb(0,0,0)');

      return next;
    });
    // gameClickHandlerRef already handled above (early return) when active
  }

  // currentGameDef supprimé : les jeux viennent de la DB

  if (activeView !== null) {
    return (
      <div className="jeux" style={{ ['--tile-shadow-intensity' as any]: clamp100(masterIntensity) / 100 }}>
        <NavigationMenu />
        <div style={{ paddingTop: 72 }}>
          <div style={{ padding: '12px 20px' }}>
            <button
              onClick={() => setActiveView(null)}
              style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#e8eaf0', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
            >
              ← Retour aux jeux
            </button>
          </div>
          {activeView === 'spectre' ? <SpectrePage /> : <ChromaticitePage />}
        </div>
      </div>
    );
  }

  return (
    <div className="jeux" style={{ ['--tile-shadow-intensity' as any]: clamp100(masterIntensity) / 100 }}>
      {/* Navigation Menu */}
      <NavigationMenu />
      {/* Header */}
      <div className="jeux-header">
        <div className="jeux-header-brand">
          <div className="jeux-header-dot">
            <Lightbulb size={18} color="#fff" />
          </div>
          <div>
            <h1>ColorRoomGames</h1>
            <p>Projet BTS CIEL · ENTPE/LTDS · Session 2026</p>
          </div>
        </div>
      </div>

      {view === 'main' && mpJoinPrompt.open ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
          }}
          onClick={() => setMpJoinPrompt({ open: false, sessionId: '' })}
        >
          <div
            style={{
              width: 'min(480px, calc(100vw - 32px))',
              background: 'rgba(255,255,255,0.97)',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 20,
              padding: 28,
              boxShadow: '0 24px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
              fontFamily: 'system-ui, sans-serif',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px rgba(74,222,128,0.6)', flexShrink: 0 }} />
              <span style={{ color: '#1a1d2e', fontWeight: 800, fontSize: 16 }}>Session multijoueur détectée</span>
            </div>
            {/* Session ID */}
            <code style={{ display: 'block', color: 'rgba(26,29,46,0.4)', fontSize: 11, fontFamily: 'monospace', marginBottom: 16 }}>
              ID : {mpJoinPrompt.sessionId || '-'}
            </code>
            {/* Body */}
            <div style={{ fontSize: 14, color: 'rgba(26,29,46,0.75)', lineHeight: 1.6 }}>
              Un autre poste a lancé le jeu <strong style={{ color: '#1a1d2e' }}>Multijoueur - Teintes</strong>.
              <br />
              Voulez-vous rejoindre ? La partie démarrera automatiquement dès qu'il y aura 2 joueurs.
            </div>
            {/* Buttons */}
            <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
              <button
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid rgba(0,0,0,0.12)', background: '#f5f6fa', color: 'rgba(26,29,46,0.7)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
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
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#4361ee,#7c3aed)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 18px rgba(67,97,238,0.4)' }}
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
              {(mpState as any)?.endsAtMs === 0
                ? 'Aucun joueur n\'a rejoint dans les 5 minutes. La session a été supprimée.'
                : 'Le temps est écoulé.'}
              {' '}Voulez-vous relancer une nouvelle partie ou quitter le mode multijoueur ?
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
        <LoginScreen
          sessionChecked={sessionChecked}
          initialClassCode={pendingClassCode || undefined}
          onSuccess={(user) => {
            setCurrentUser(user.username);
            setUserType((user.role === 'enseignant' || user.role === 'formateur') ? 'enseignant' : 'apprenant');
            if (user.niveau) setNiveau(user.niveau as Niveau);
            if (user.avatarColor) setUserAvatarColor(user.avatarColor);
            if (user.avatarIcon) setUserAvatarIcon(user.avatarIcon.slice(0, 1).toUpperCase() || 'U');
            void fetch('/api/auth/me/classes', { cache: 'no-store' })
              .then(r => r.json()).then(d => { if (d.classes) setUserClasses(d.classes.map((c: {name:string}) => c.name)); })
              .catch(() => {});
            setView('main');
          }}
        />
      ) : (
        <div className="container">
          <div className="dashboard" style={{ paddingTop: 4 }}>
            <div className="panel glass">
              {/* ── Profil utilisateur redesign ────────────────────────── */}
              <div className="section">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 18, background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 3px 12px rgba(0,0,0,0.06)', marginBottom: 12 }}>
                  {/* Avatar */}
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: `linear-gradient(135deg, ${userAvatarColor}, ${userAvatarColor}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#fff', flexShrink: 0, boxShadow: `0 0 0 3px rgba(255,255,255,0.8), 0 4px 14px ${userAvatarColor}55` }}>
                    {userAvatarIcon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {currentUser || '-'}
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(67,97,238,0.10)', color: 'var(--accent)', border: '1px solid rgba(67,97,238,0.2)' }}>
                        <span style={{ display:'flex', alignItems:'center', gap:4 }}>{userType === 'enseignant' ? <><Award size={11} /> Enseignant</> : <><Star size={11} /> Eleve</>}</span>
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.05)', color: 'var(--text-2)', border: '1px solid rgba(0,0,0,0.07)' }}>
                        {niveau}
                      </span>
                      {userClasses.length > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(5,150,105,0.10)', color: '#059669', border: '1px solid rgba(5,150,105,0.2)' }}>
                          <span style={{ display:'flex', alignItems:'center', gap:4 }}><Users size={11} /> {userClasses[0]}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', boxShadow: 'inset 0 1px 0 #fff' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-3)', marginBottom: 5 }}>Score</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent)', letterSpacing: '-0.02em', position: 'relative' }}>
                      {score}
                      {scorePlusValue > 0 ? <span key={scorePlusAnimKey} className="mp-plusone">+{scorePlusValue}</span> : null}
                    </div>
                  </div>
                  <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', boxShadow: 'inset 0 1px 0 #fff' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-3)', marginBottom: 5 }}>Réussis</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#059669', letterSpacing: '-0.02em' }}>{gamesCompleted}</div>
                  </div>
                </div>
              </div>

              <div className="section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ margin: 0 }}><Gamepad2 size={18} /> Sélection du Jeu</h3>
                </div>

                {/* Barre de recherche */}
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    placeholder="Rechercher un jeu…"
                    value={gameSearch}
                    onChange={e => setGameSearch(e.target.value)}
                    style={{ width: '100%', paddingLeft: 34, paddingRight: 12, paddingTop: 9, paddingBottom: 9, borderRadius: 12, border: '1px solid rgba(0,0,0,0.09)', background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(12px)', fontSize: 13, fontFamily: 'inherit', fontWeight: 500, outline: 'none', color: 'var(--text)', boxSizing: 'border-box', transition: 'all 160ms', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
                  />
                  {gameSearch && (
                    <button onClick={() => setGameSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center', padding: 2 }}>
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Liste unifiée de tous les jeux - recherche + chargement progressif (4 par 4) */}
                {(() => {
                  const ICONS_MAP: Record<string, any> = { Lightbulb, Gamepad2, Star, Heart, Sun, Moon, Flame, Snowflake, Music, Target, Puzzle, Sparkles, Trophy, Rocket, Ghost, Palette, Zap };
                  const BATCH = 4;

                  type GameCard = {
                    key: string;
                    title: string;
                    desc: string;
                    Icon: any;
                    iconBg: string;
                    iconColor: string;
                    badgeLabel: string;
                    accent: string;
                    selected: boolean;
                    launch: () => void;
                    howTo?: string;   // explication détaillée "comment jouer"
                  };

                  const nativeCards: GameCard[] = [
                    {
                      key: 'tetris',
                      title: 'Tetris Lumière',
                      desc: 'Tetris interactif sur les dalles lumineuses',
                      Icon: Gamepad2,
                      iconBg: 'linear-gradient(135deg, #4361ee, #6366f1)',
                      iconColor: '#fff',
                      badgeLabel: 'natif',
                      accent: '#4361ee',
                      selected: tetrisStandalone,
                      launch: () => {
                        setTetrisStandalone(true);
                        setCustomRun(null);
                        setHudRun(null);
                        setCurrentGame(null);
                        setSimonActive(false);
                        setActiveBuiltinGame(null);
                        setGameActive(true);
                        setMessage('Tetris Lumière: flèches déplacer, haut tourner, Espace drop');
                      },
                    },
                    {
                      key: 'simon',
                      title: 'Simon Lumière',
                      desc: 'Mémorisez et reproduisez les séquences lumineuses',
                      Icon: Brain,
                      iconBg: 'linear-gradient(135deg, #ef476f, #f72585)',
                      iconColor: '#fff',
                      badgeLabel: 'natif',
                      accent: '#ef476f',
                      selected: simonActive,
                      launch: () => {
                        setTetrisStandalone(false);
                        setCustomRun(null);
                        setHudRun(null);
                        setCurrentGame(null);
                        setActiveBuiltinGame(null);
                        setGameActive(true);
                        startSimonGame();
                      },
                    },
                  ];

                  const BUILTIN_META: Record<string, { title: string; desc: string; Icon: any; grad: string; accent: string; howTo: string }> = {
                    'color-speed':      { title: 'Color Speed',        desc: "Cliquez la dalle qui s'allume - réflexes !",            Icon: Zap,       grad: 'linear-gradient(135deg,#4361ee,#7c3aed)', accent: '#7c3aed', howTo: "Une dalle s'allume au hasard : cliquez-la le plus vite possible. Le rythme accélère, les bonnes touches enchaînent un combo. 60 s pour le meilleur score." },
                    'maitre-blanc':     { title: 'Le Maître du Blanc', desc: 'Recréez la teinte cible en dosant R, G, B',              Icon: Sun,       grad: 'linear-gradient(135deg,#f59e0b,#ef4444)', accent: '#f59e0b', howTo: "Une couleur cible est affichée. Ajustez les sliders Rouge / Vert / Bleu pour la reproduire sur les dalles. Plus vous êtes précis, plus vous marquez. 10 manches." },
                    'puissance4':       { title: 'Puissance 4',        desc: 'Alignez 4 couleurs sur la matrice 6×7',                  Icon: Grid,      grad: 'linear-gradient(135deg,#ff2828,#2850ff)', accent: '#ff2828', howTo: "Choisissez 2 joueurs ou contre l'IA (5 niveaux). À tour de rôle, posez un jeton dans une colonne (clic ou flèches + Espace). Alignez-en 4 pour gagner." },
                    'metamere':         { title: 'Métamérie',          desc: "Trouvez l'éclairage qui cache ou révèle le texte",       Icon: Sparkles,  grad: 'linear-gradient(135deg,#7c3aed,#06d6a0)', accent: '#06d6a0', howTo: "Un texte/motif n'est visible que sous certains éclairages (métamérie). Changez l'illuminant pour le révéler ou le cacher, selon la consigne de la manche." },
                    'chromaticite-jeu': { title: 'Chromaticité CIE',   desc: 'Mémorisez la couleur 5s puis retrouvez x, y, z sur le diagramme', Icon: Crosshair, grad: 'linear-gradient(135deg,#81e6d9,#4361ee)', accent: '#81e6d9', howTo: "Une couleur s'affiche 5 s : mémorisez-la. Puis placez son point sur le diagramme CIE 1931 (clic ou sliders x/y). Plus vous êtes proche, plus vous marquez. 5 manches." },
                    'canal-mix':        { title: 'Mix de Canaux',      desc: '3 canaux LED aléatoires - retrouvez la couleur sur le diagramme CIE', Icon: Palette,  grad: 'linear-gradient(135deg,#f97316,#7c3aed)', accent: '#f97316', howTo: "3 canaux LED forment un triangle sur le diagramme CIE. Dosez chaque canal avec les 3 sliders : votre point (le mélange) doit rejoindre la couleur cible dans le triangle." },
                    'intrus':           { title: "L'Intrus (Sniper)",  desc: 'Une dalle a une teinte presque invisible - trouvez-la au CS-160', Icon: Crosshair, grad: 'linear-gradient(135deg,#06d6a0,#ef4444)', accent: '#06d6a0', howTo: "Toutes les dalles ont la même couleur sauf une (écart minime, invisible à l'écran). Sélectionnez une dalle, mesurez-la au CS-160, comparez les écarts, puis désignez l'intrus. Course contre la montre, écart de plus en plus subtil." },
                    'snake':            { title: 'Snake Lumière',       desc: 'Le serpent sur les 42 dalles - flèches ou D-pad tactile', Icon: Gamepad2,  grad: 'linear-gradient(135deg,#16a34a,#06d6a0)', accent: '#16a34a', howTo: "Dirigez le serpent avec les flèches (ou le D-pad tactile) sur la grille 6×7. Mangez les pommes pour grandir et marquer, sans toucher les murs ni votre corps." },
                  };

                  const builtinCards: GameCard[] = (['color-speed', 'maitre-blanc', 'puissance4', 'metamere', 'chromaticite-jeu', 'canal-mix', 'intrus', 'snake'] as const).map((gameId) => {
                    const m = BUILTIN_META[gameId];
                    return {
                      key: `builtin:${gameId}`,
                      title: m.title,
                      desc: m.desc,
                      Icon: m.Icon,
                      iconBg: m.grad,
                      iconColor: '#fff',
                      badgeLabel: 'natif',
                      accent: m.accent,
                      selected: activeBuiltinGame === gameId,
                      howTo: m.howTo,
                      launch: () => {
                        setTetrisStandalone(false);
                        setCustomRun(null);
                        setHudRun(null);
                        setCurrentGame(null);
                        setSimonActive(false);
                        setActiveBuiltinGame(gameId);
                        setGameActive(true);
                        setMessage(m.title + " - c'est parti !");
                      },
                    };
                  });

                  const spectreCard: GameCard = {
                    key: 'spectre',
                    title: 'Spectre Chromatique',
                    desc: "Mémorisez et reproduisez une couleur - jusqu'à 8 joueurs",
                    Icon: Palette,
                    iconBg: 'linear-gradient(135deg,#8b5cf6,#06d6a0)',
                    iconColor: '#fff',
                    badgeLabel: 'multi',
                    accent: '#8b5cf6',
                    selected: spectreActive,
                    launch: () => {
                      setTetrisStandalone(false);
                      setCustomRun(null);
                      setHudRun(null);
                      setCurrentGame(null);
                      setSimonActive(false);
                      setActiveBuiltinGame(null);
                      setSpectreActive(true);
                      setGameActive(true);
                      setMessage('Spectre Chromatique - créez ou rejoignez une salle !');
                    },
                  };

                  const dbCards: GameCard[] = dbGames.map((g) => {
                    const isEditor = String(g.kind) === 'editor';
                    const cfg = g.config as any;
                    const nodeCount = Array.isArray(cfg?.nodes) ? cfg.nodes.length : 0;
                    const tileCount = typeof cfg?.tileCount === 'number' ? cfg.tileCount : 42;
                    const iconName: string = typeof cfg?.icon === 'string' ? cfg.icon : 'Lightbulb';
                    const GIcon = ICONS_MAP[iconName] ?? Lightbulb;
                    const accentColor = typeof cfg?.accentColor === 'string' ? cfg.accentColor : (isEditor ? '#a0aeff' : '#c4b5fd');
                    // Dégradé icône : couleur de fond -> couleur accent (configuré dans l'éditeur)
                    const iconBg = typeof cfg?.bgColor === 'string'
                      ? `linear-gradient(135deg, ${cfg.bgColor}, ${typeof cfg?.accentColor === 'string' ? cfg.accentColor : cfg.bgColor})`
                      : (isEditor ? 'linear-gradient(135deg,#1a2045,#2d1060)' : 'linear-gradient(135deg,#1a1040,#0d0830)');
                    const description = typeof cfg?.description === 'string' && cfg.description ? cfg.description : `${nodeCount} nœud${nodeCount !== 1 ? 's' : ''} · ${tileCount} dalles`;
                    return {
                      key: `db:${g.id}`,
                      title: g.name,
                      desc: description,
                      Icon: GIcon,
                      iconBg,
                      iconColor: accentColor,
                      badgeLabel: 'natif',
                      accent: accentColor,
                      selected: false,
                      launch: () => isEditor ? startHudFromDb({ id: g.id, name: g.name, config: g.config }) : startCustomFromDb({ id: g.id, name: g.name, config: g.config }),
                    };
                  });

                  const allCards: GameCard[] = [...nativeCards, ...builtinCards, spectreCard, ...dbCards];

                  const q = gameSearch.toLowerCase().trim();
                  const filtered = q
                    ? allCards.filter(c => c.title.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q))
                    : allCards;
                  const visible = q ? filtered : filtered.slice(0, gameVisibleCount);

                  if (filtered.length === 0) return (
                    <div style={{ padding: '16px', borderRadius: 14, textAlign: 'center', background: 'rgba(0,0,0,0.03)', border: '1px dashed rgba(0,0,0,0.1)' }}>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>{q ? `Aucun jeu pour « ${gameSearch} »` : 'Aucun jeu disponible.'}</p>
                    </div>
                  );

                  return (
                    <>
                      {dbGamesLoading && (
                        <div style={{ padding: '10px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>Chargement des jeux...</div>
                      )}
                      <div style={{ display: 'grid', gap: 8 }}>
                        {visible.map((c) => (
                          <div key={c.key}
                            className={`game-card${c.selected ? ' selected' : ''}`}
                            onClick={() => setPendingGame(c)}
                            role="button" tabIndex={0}
                          >
                            <div className="game-icon" style={{ background: c.iconBg }}>
                              <c.Icon size={20} color={c.iconColor} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                <h4>{c.title}</h4>
                                <span style={{ fontSize: 10, fontWeight: 700, color: c.accent, background: `${c.accent}22`, padding: '2px 7px', borderRadius: 5 }}>{c.badgeLabel}</span>
                              </div>
                              <p style={{ fontSize: 12, margin: 0, lineHeight: 1.35 }}>{c.desc}</p>
                            </div>
                            <button className="play-btn"
                              style={{ background: c.accent, color: '#fff', boxShadow: c.selected ? `0 0 0 2px ${c.accent}80, 0 4px 14px ${c.accent}66` : `0 3px 10px ${c.accent}55` }}
                              onClick={(e) => { e.stopPropagation(); setPendingGame(c); }}
                            ><Play size={15} /></button>
                          </div>
                        ))}
                      </div>

                      {/* Chargement progressif 4 par 4 (masqué pendant une recherche) */}
                      {!q && (
                        <>
                          <div style={{ display:'flex', gap:6, marginTop:8 }}>
                            {gameVisibleCount < filtered.length && (
                              <button
                                onClick={() => setGameVisibleCount(v => v + BATCH)}
                                style={{ flex:1, padding: '9px 14px', borderRadius: 12, border: '1.5px dashed rgba(67,97,238,0.3)', background: 'rgba(67,97,238,0.05)', color: 'var(--accent)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 140ms', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                              >
                                <ChevronDown size={14} /> Charger {Math.min(BATCH, filtered.length - gameVisibleCount)} de plus
                              </button>
                            )}
                            {gameVisibleCount > BATCH && (
                              <button
                                onClick={() => setGameVisibleCount(BATCH)}
                                style={{ padding: '9px 12px', borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.6)', color: 'var(--text-3)', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 140ms', display: 'flex', alignItems: 'center', gap: 4 }}
                              >
                                <ChevronUp size={14} /> Réduire
                              </button>
                            )}
                          </div>
                          <p style={{ margin: '8px 2px 0', fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
                            {Math.min(gameVisibleCount, filtered.length)} / {filtered.length} jeux
                          </p>
                        </>
                      )}
                    </>
                  );
                })()}
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

              <Room3D
                plateColors={plateColors}
                plateActive={plateActive}
                onPlateClick={handlePlateClick}
                height={420}
              />

              <div>
                {gameActive && customRun ? (
                  <div className="glass" style={{ padding: 14, borderRadius: 18, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <strong>{customRun.name}</strong>
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

                {/* Tetris Lumière standalone - toujours dispo */}
                {gameActive && tetrisStandalone && (
                  <div style={{ marginTop: 12, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)' }}>
                    <TetrisGame
                      params={{ speed: 500 }}
                      isPlaying={gameActive}
                      onSnapshot={(snap) => {
                        tetrisSnapRef.current = snap;
                        if (snap.gameOver && !tetrisAwardedRef.current) {
                          tetrisAwardedRef.current = true;
                          award(snap.score, `Tetris terminé ! Score : ${snap.score}`);
                        } else if (!snap.gameOver && tetrisAwardedRef.current) {
                          tetrisAwardedRef.current = false; // nouvelle partie
                        }
                      }}
                    />
                  </div>
                )}

                {/* Simon Lumière - panneau de jeu dédié */}
                {gameActive && simonActive && (
                  <div style={{ marginTop: 12, borderRadius: 18, padding: 20, background: 'rgba(10,10,20,0.95)', border: '1px solid rgba(239,71,111,0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div style={{ display: 'flex', gap: 16 }}>
                        <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '6px 14px', textAlign: 'center' }}>
                          <div style={{ fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Niveau</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: '#ef476f' }}>{simonLevel}</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '6px 14px', textAlign: 'center' }}>
                          <div style={{ fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{simonScore}</div>
                        </div>
                        {simonHighScore > 0 && (
                          <div style={{ background: 'rgba(255,215,0,0.08)', borderRadius: 10, padding: '6px 14px', textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Record</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: '#ffd700' }}>{simonHighScore}</div>
                          </div>
                        )}
                      </div>
                      <div style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700,
                        background: simonPhase === 'showing' ? 'rgba(255,165,0,0.2)' : simonPhase === 'input' ? 'rgba(68,255,170,0.15)' : 'rgba(239,71,111,0.2)',
                        color: simonPhase === 'showing' ? '#ffa500' : simonPhase === 'input' ? '#44ffaa' : '#ef476f',
                        border: `1px solid ${simonPhase === 'showing' ? 'rgba(255,165,0,0.4)' : simonPhase === 'input' ? 'rgba(68,255,170,0.4)' : 'rgba(239,71,111,0.4)'}`,
                      }}>
                        {simonPhase === 'showing' ? `Mémorisez… (${simonSequence.length} coups)` : simonPhase === 'input' ? `À vous ! ${simonPlayerInput.length}/${simonSequence.length}` : 'Game Over'}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {([0, 1, 2, 3] as const).map((ci) => {
                        const plateIdx = SIMON_PLATES[ci];
                        const color = SIMON_COLORS[ci];
                        const isLit = simonLitPlate === plateIdx;
                        const canClick = simonPhase === 'input';
                        const names = ['Rouge', 'Vert', 'Bleu', 'Jaune'];
                        return (
                          <button
                            key={ci}
                            onClick={() => { if (canClick) void handleSimonPlateClick(plateIdx); }}
                            style={{
                              height: 88,
                              borderRadius: 16,
                              border: `2px solid ${isLit ? color : color + '55'}`,
                              background: isLit ? color : color + '22',
                              cursor: canClick ? 'pointer' : 'default',
                              boxShadow: isLit ? `0 0 32px ${color}99, inset 0 0 20px ${color}44` : 'none',
                              transition: 'all 0.08s',
                              color: '#fff',
                              fontSize: 15,
                              fontWeight: 800,
                              letterSpacing: '0.03em',
                              transform: isLit ? 'scale(1.04)' : 'scale(1)',
                            }}
                          >
                            {names[ci]}
                          </button>
                        );
                      })}
                    </div>

                    {simonPhase === 'gameover' && (
                      <button
                        onClick={() => startSimonGame()}
                        style={{ marginTop: 14, width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#ef476f,#f72585)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
                      >
                        Rejouer
                      </button>
                    )}
                  </div>
                )}

                {/* Nouveaux jeux natifs */}
                {gameActive && activeBuiltinGame && (() => {
                  // Flush visuel via rAF - ne déclenche qu'un seul setPlateColors par frame
                  const flushVisual = () => {
                    const snap = new Map(visualBatchRef.current);
                    visualBatchRef.current.clear();
                    setPlateColors(prev => {
                      const n = [...prev];
                      snap.forEach(({ r, g, b, intensity }, i) => {
                        n[i] = intensity > 0 ? `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})` : '#000000';
                      });
                      return n;
                    });
                    setPlateActive(prev => {
                      const n = [...prev];
                      snap.forEach(({ intensity }, i) => { n[i] = intensity > 0; });
                      return n;
                    });
                  };
                  const tileActions = {
                    onSendColor: (idx: number, r: number, g: number, b: number, intensity = 80) => {
                      const plateId = PLATE_ID_BY_INDEX[idx];
                      if (!plateId) return;
                      // 1. Mémoriser l'état canonique
                      gameColorStateRef.current[idx] = { r, g, b, intensity };
                      // 2. Envoyer au hardware immédiatement (event-driven, pas de polling)
                      sendRgbToPlate({ r, g, b }, intensity, plateId);
                      // 3. Mettre à jour le visuel 3D via rAF (max 1 setPlateColors/frame)
                      visualBatchRef.current.set(idx, { r, g, b, intensity });
                      cancelAnimationFrame(rafRef.current);
                      rafRef.current = requestAnimationFrame(flushVisual);
                    },
                    onTurnOff: (idx: number) => {
                      const plateId = PLATE_ID_BY_INDEX[idx];
                      if (!plateId) return;
                      gameColorStateRef.current[idx] = null;
                      sendRgbToPlate({ r: 0, g: 0, b: 0 }, 0, plateId);
                      visualBatchRef.current.set(idx, { r: 0, g: 0, b: 0, intensity: 0 });
                      cancelAnimationFrame(rafRef.current);
                      rafRef.current = requestAnimationFrame(flushVisual);
                    },
                    onTurnOffAll: () => {
                      gameColorStateRef.current = new Array(42).fill(null);
                      cancelAnimationFrame(rafRef.current);
                      visualBatchRef.current.clear();
                      // Annuler tout envoi en attente sans vider le cache dedup
                      hwFlushScheduledRef.current = false;
                      hwBatchPendingRef.current.clear();
                      hwPendingPlatesRef.current = null;
                      hwFetchGenRef.current++;
                      hwCurrentCtrlRef.current?.abort();
                      hwCurrentCtrlRef.current = null;
                      hwInFlightRef.current = false;
                      // Reset hardware via le PUT global (1 seule requête rapide)
                      fetch('/api/supervision/', { method: 'PUT', cache: 'no-store' }).catch(() => {});
                      // IMPORTANT : pré-remplir le cache dedup avec 0 pour toutes les dalles
                      // au lieu de le vider → le prochain onSendColor n'envoie QUE les canaux
                      // qui changent depuis 0 (6-10 canaux max), pas les 32×42=1344
                      for (let pid = 1; pid <= 42; pid++) {
                        for (let ch = 0; ch < 32; ch++) {
                          hwLastSentRef.current[`${pid}:${ch}`] = 0;
                        }
                      }
                      setPlateColors(Array(42).fill('#000000'));
                      setPlateActive(Array(42).fill(false));
                    },
                    onSendRawChannels: (idx: number, channels: number[]) => {
                      const plateId = PLATE_ID_BY_INDEX[idx];
                      if (!plateId) return;
                      // Envoyer chaque canal directement (0-100 déjà) sans conversion RGB
                      for (let ch = 0; ch < Math.min(channels.length, 32); ch++) {
                        scheduleSetCanal(plateId, ch, Math.max(0, Math.min(100, Math.round(channels[ch] ?? 0))));
                      }
                      // Mise à jour visuelle : reconstituer une couleur approximative depuis les 3 premiers canaux
                      const r = clamp255(Math.round((channels[0] ?? 0) * 2.55));
                      const g = clamp255(Math.round((channels[1] ?? 0) * 2.55));
                      const b = clamp255(Math.round((channels[2] ?? 0) * 2.55));
                      const intensity = channels.some(v => v > 0) ? 80 : 0;
                      visualBatchRef.current.set(idx, { r, g, b, intensity });
                      cancelAnimationFrame(rafRef.current);
                      rafRef.current = requestAnimationFrame(flushVisual);
                    },
                    onQuit: () => { setActiveBuiltinGame(null); setGameActive(false); },
                    tileCount: 42,
                    onRegisterClickHandler: (fn: ((idx: number) => void) | null) => { gameClickHandlerRef.current = fn; },
                    // Score universel + jeux réussis : appelé à la fin de chaque partie
                    onComplete: (points: number) => {
                      const pts = Math.max(0, Math.round(points));
                      setScore((s) => s + pts);
                      setGamesCompleted((v) => v + 1);
                      if (pts > 0) { setScorePlusValue(pts); setScorePlusAnimKey((k) => k + 1); }
                    },
                  };
                  return (
                    <div style={{ marginTop: 12, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(10,10,18,0.95)' }}>
                      {activeBuiltinGame === 'color-speed'      && <GameColorSpeed      {...tileActions} />}
                      {activeBuiltinGame === 'maitre-blanc'    && <GameMaitreDuBlanc   {...tileActions} />}
                      {activeBuiltinGame === 'puissance4'      && <GamePuissance4      {...tileActions} />}
                      {activeBuiltinGame === 'metamere'        && <GameMetamerisme     {...tileActions} />}
                      {activeBuiltinGame === 'chromaticite-jeu'&& <GameChromaticite   {...tileActions} />}
                      {activeBuiltinGame === 'canal-mix'        && <GameCanalMix       {...tileActions} onSendRawChannels={tileActions.onSendRawChannels!} />}
                      {activeBuiltinGame === 'intrus'           && <GameIntrus         {...tileActions} />}
                      {activeBuiltinGame === 'snake'            && <SnakeGame          {...tileActions} />}
                    </div>
                  );
                })()}

                {/* Spectre Chromatique - jeu multijoueur rendu inline (sous les dalles) */}
                {gameActive && spectreActive && (
                  <div style={{ marginTop: 12, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: '#f8f9ff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'linear-gradient(135deg,#8b5cf6,#06d6a0)' }}>
                      <strong style={{ color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Palette size={16} color="#fff" /> Spectre Chromatique
                      </strong>
                      <button
                        onClick={() => { setSpectreActive(false); setSpectreJoinCode(''); setGameActive(false); }}
                        style={{ padding: '6px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
                      >
                        ✕ Quitter
                      </button>
                    </div>
                    <SpectrePage
                      embedded
                      initialJoinCode={spectreJoinCode || undefined}
                      onExit={() => { setSpectreActive(false); setSpectreJoinCode(''); setGameActive(false); }}
                    />
                  </div>
                )}

                {/* Tetris Lumière - si le jeu éditeur contient un noeud game_tetris */}
                {gameActive && !tetrisStandalone && hudRun && (() => {
                  const nodes = Array.isArray(hudRun.cfg.nodes) ? (hudRun.cfg.nodes as EditorNode[]) : [];
                  const tetrisNode = nodes.find((n) => n.kind === 'game_tetris' && n.enabled !== false);
                  if (!tetrisNode) return null;
                  const speed = typeof tetrisNode.params?.speed === 'number' ? tetrisNode.params.speed : 500;
                  return (
                    <div style={{ marginTop: 12, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)' }}>
                      <TetrisGame
                        params={{ speed: Math.max(50, speed) }}
                        isPlaying={gameActive}
                        onSnapshot={(snap) => { tetrisSnapRef.current = snap; }}
                      />
                    </div>
                  );
                })()}

                {/* Jeux natifs lancés depuis un nœud de l'éditeur (game_*) — exécutent
                    le VRAI composant, donc identiques aux jeux de la liste. */}
                {gameActive && !tetrisStandalone && hudRun && (() => {
                  const nodes = Array.isArray(hudRun.cfg.nodes) ? (hudRun.cfg.nodes as EditorNode[]) : [];
                  const NATIVE_MAP: Record<string, any> = {
                    game_color_speed: GameColorSpeed,
                    game_maitre_blanc: GameMaitreDuBlanc,
                    game_puissance4: GamePuissance4,
                    game_metamere: GameMetamerisme,
                    game_chromaticite: GameChromaticite,
                    game_canal_mix: GameCanalMix,
                    game_intrus: GameIntrus,
                    game_snake: SnakeGame,
                  };
                  const gNode = nodes.find((n) => NATIVE_MAP[n.kind] && n.enabled !== false);
                  if (!gNode) return null;
                  const Comp = NATIVE_MAP[gNode.kind];
                  const extra = gNode.kind === 'game_snake' && typeof gNode.params?.speed === 'number' ? { speed: gNode.params.speed } : {};
                  const ta = {
                    onSendColor: (idx: number, r: number, g: number, b: number, intensity = 80) => {
                      const p = PLATE_ID_BY_INDEX[idx]; if (!p) return;
                      sendRgbToPlate({ r, g, b }, intensity, p); setPlateColor(idx, `rgb(${r},${g},${b})`, intensity > 0);
                    },
                    onTurnOff: (idx: number) => { const p = PLATE_ID_BY_INDEX[idx]; if (!p) return; sendRgbToPlate({ r: 0, g: 0, b: 0 }, 0, p); setPlateColor(idx, '#000000', false); },
                    onTurnOffAll: () => { void blackoutHardware(); },
                    onSendRawChannels: (idx: number, channels: number[]) => { const p = PLATE_ID_BY_INDEX[idx]; if (!p) return; for (let i = 0; i < 32; i++) scheduleSetCanal(p, i, clamp255(channels[i] ?? 0)); },
                    onQuit: () => { void blackoutHardware(); setHudRun(null); setGameActive(false); },
                    tileCount: 42,
                    onRegisterClickHandler: (fn: ((idx: number) => void) | null) => { gameClickHandlerRef.current = fn; },
                    onComplete: (points: number) => { const pts = Math.max(0, Math.round(points)); setScore((s) => s + pts); setGamesCompleted((v) => v + 1); if (pts > 0) { setScorePlusValue(pts); setScorePlusAnimKey((k) => k + 1); } },
                  };
                  return (
                    <div style={{ marginTop: 12, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: hudRun?.cfg.bgColor ?? '#0d1119' }}>
                      <Comp {...ta} {...extra} />
                    </div>
                  );
                })()}

                {/* Interface du jeu éditeur (composants UI dessinés dans /editeur, dont le diagramme CIE) */}
                {gameActive && !tetrisStandalone && hudRun && Array.isArray(hudRun.cfg.uiLayout) && hudRun.cfg.uiLayout.length > 0 && (
                  <div style={{ marginTop: 12, borderRadius: 18, padding: 16, background: hudRun?.cfg.bgColor ?? '#0d1119', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <h3 style={{ marginTop: 0, color: 'rgba(255,255,255,0.85)' }}><Gamepad2 size={16} /> Interface du jeu</h3>
                    <HudUiOverlay
                      components={hudRun.cfg.uiLayout}
                      vars={{ ...hudVarsRef.current }}
                      plate={{
                        onSendColor: (idx, r, g, b, intensity = 80) => {
                          const plateId = PLATE_ID_BY_INDEX[idx];
                          if (!plateId) return;
                          sendRgbToPlate({ r, g, b }, intensity, plateId);
                          setPlateColor(idx, `rgb(${r},${g},${b})`, intensity > 0);
                        },
                        onTurnOff: (idx) => {
                          const plateId = PLATE_ID_BY_INDEX[idx];
                          if (!plateId) return;
                          sendRgbToPlate({ r: 0, g: 0, b: 0 }, 0, plateId);
                          setPlateColor(idx, '#000000', false);
                        },
                        onTurnOffAll: () => { void blackoutHardware(); },
                        onComplete: (points: number) => {
                          const pts = Math.max(0, Math.round(points));
                          setScore((s) => s + pts);
                          setGamesCompleted((v) => v + 1);
                          if (pts > 0) { setScorePlusValue(pts); setScorePlusAnimKey((k) => k + 1); }
                        },
                        plateColors,
                        // Clic d'un composant UI -> lance le graphe depuis le nœud d'événement correspondant
                        onEvent: (eventId: string) => {
                          const base = eventId.split(':')[0];
                          const nodes = Array.isArray(hudRun?.cfg.nodes) ? (hudRun!.cfg.nodes as EditorNode[]) : [];
                          const ev = nodes.find((n) => (n.kind === 'on_ui_click' || n.kind === 'ui_event_click') && n.enabled !== false &&
                            (String(n.params?.buttonId ?? '') === base || String(n.params?.eventType ?? '') === base || String(n.params?.buttonId ?? '') === eventId));
                          playGameSound('click');
                          if (ev) fireHudEvent(String(ev.id)); // ne coupe PAS la boucle principale
                        },
                      }}
                    />
                  </div>
                )}

                {gameActive && mpStatus === 'active' ? (
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
                          <span style={{ opacity: 0.75, fontSize: 12 }}>Session: {mpSessionId || '-'}</span>
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
                        <div style={{ marginTop: 10, opacity: 0.75 }}>-</div>
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
                        <div style={{ marginTop: 10, opacity: 0.75 }}>-</div>
                      )}
                    </div>

                    <div className="led-slider led-slider--special">
                      <label>
                        <span>Ton slider ({mpState && mpSeat ? seatTintLabel(mpState.channelBySeat?.[mpSeat]) : '-'})</span>
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
                      Session: {mpSessionId ? mpSessionId : '-'} • Ton siège: {mpSeat ?? '-'}
                    </div>
                  </div>
                ) : null}

                {gameActive && mpStatus === 'active' && mpPlusValue > 0 ? (
                  <div className="mp-center-overlay" aria-hidden="true">
                    <div key={mpCenterAnimKey} className="mp-center-plusone">
                      <span className="mp-center-plusone-text">+{mpPlusValue}</span>
                    </div>
                  </div>
                ) : null}

                {gameActive && customRun ? (
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

                {/* Tetrix sera recréé dans l'éditeur */}
                {false ? (
                  <>
                    <div 
                      className="glass"
                      style={{ 
                        padding: '24px', 
                        borderRadius: 24, 
                        marginBottom: 20,
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div>
                          <h3 style={{ fontWeight: 800, fontSize: '1.4rem', marginBottom: 4 }}>Tetrix Light</h3>
                          <p style={{ fontSize: 13, opacity: 0.7 }}>Alignez 3 dalles pour les faire disparaître</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 }}>Score</div>
                          <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'SF Pro Display, -apple-system, sans-serif' }}>{tetrixScore}</div>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div style={{ 
                        display: 'flex', 
                        gap: 16, 
                        marginBottom: 24,
                        padding: '12px 16px',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: 16,
                        backdropFilter: 'blur(10px)'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase' }}>Niveau</div>
                          <div style={{ fontSize: 20, fontWeight: 700 }}>{tetrixLevel}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase' }}>Lignes</div>
                          <div style={{ fontSize: 20, fontWeight: 700 }}>{tetrixLines}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase' }}>Prochaine</div>
                          <div style={{ 
                            width: 24, 
                            height: 24, 
                            borderRadius: 6, 
                            background: tetrixNextPiece?.color || '#666',
                            boxShadow: `0 0 12px ${tetrixNextPiece?.color || '#666'}`
                          }} />
                        </div>
                      </div>

                      {/* Game status */}
                      {tetrixGameOver ? (
                        <div style={{ 
                          padding: '20px', 
                          borderRadius: 16, 
                          background: 'rgba(255, 59, 92, 0.2)',
                          border: '1px solid rgba(255, 59, 92, 0.4)',
                          textAlign: 'center',
                          marginBottom: 20
                        }}>
                          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Game Over!</div>
                          <div style={{ fontSize: 14, opacity: 0.8 }}>Score final: {tetrixScore}</div>
                        </div>
                      ) : null}

                      {/* Controls - Glass Liquid Style */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(3, 1fr)', 
                        gap: 12,
                        maxWidth: 200,
                        margin: '0 auto 20px'
                      }}>
                        <div />
                        <button
                          onClick={() => rotateTetrixPiece()}
                          className="btn btn--glass"
                          style={{
                            aspectRatio: '1',
                            borderRadius: 16,
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
                            border: '1px solid rgba(255,255,255,0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 20,
                            cursor: 'pointer',
                            backdropFilter: 'blur(10px)',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                          }}
                        >
                          ↻
                        </button>
                        <div />
                        <button
                          onClick={() => moveTetrixPiece('left')}
                          className="btn btn--glass"
                          style={{
                            aspectRatio: '1',
                            borderRadius: 16,
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
                            border: '1px solid rgba(255,255,255,0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 20,
                            cursor: 'pointer',
                            backdropFilter: 'blur(10px)',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                          }}
                        >
                          ←
                        </button>
                        <button
                          onClick={() => moveTetrixPiece('down')}
                          className="btn btn--glass"
                          style={{
                            aspectRatio: '1',
                            borderRadius: 16,
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%)',
                            border: '1px solid rgba(255,255,255,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 20,
                            cursor: 'pointer',
                            backdropFilter: 'blur(10px)',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)'
                          }}
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => moveTetrixPiece('right')}
                          className="btn btn--glass"
                          style={{
                            aspectRatio: '1',
                            borderRadius: 16,
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
                            border: '1px solid rgba(255,255,255,0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 20,
                            cursor: 'pointer',
                            backdropFilter: 'blur(10px)',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                          }}
                        >
                          →
                        </button>
                      </div>

                      {/* Keyboard hint */}
                      <div style={{ 
                        textAlign: 'center', 
                        fontSize: 12, 
                        opacity: 0.5,
                        fontFamily: 'SF Pro Text, -apple-system, sans-serif'
                      }}>
                        Utilisez les flèches ou les boutons pour contrôler
                      </div>
                    </div>
                  </>
                ) : null}

                {/* Message de sélection supprimé : les jeux sont lancés directement */}
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
                      <span>-</span>
                      <span>-</span>
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
                  <option value="candlelight">1900K - Lumière de bougie</option>
                  <option value="warmwhite">2700K - Blanc chaud</option>
                  <option value="softwhite">3000K - Blanc doux</option>
                  <option value="coolwhite">5000K - Blanc froid</option>
                  <option value="daylight">6500K - Lumière du jour</option>
                  <option value="bluesky">10000K - Ciel bleu</option>
                  <option value="special">Spéciale (damier)</option>
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

      {/* Pop-up "Commencer le jeu" : description + comment ça marche */}
      {pendingGame && (
        <div
          onClick={() => setPendingGame(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(8,10,20,0.62)', backdropFilter: 'blur(14px)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(440px, 100%)', borderRadius: 24, overflow: 'hidden', background: 'linear-gradient(180deg,#161a26,#10131d)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', animation: 'fadeIn 0.2s ease' }}
          >
            <div style={{ height: 96, background: pendingGame.iconBg, display: 'grid', placeItems: 'center', position: 'relative' }}>
              <span style={{ width: 60, height: 60, borderRadius: 18, background: 'rgba(255,255,255,0.14)', display: 'grid', placeItems: 'center', backdropFilter: 'blur(8px)' }}>
                <pendingGame.Icon size={32} color="#fff" />
              </span>
            </div>
            <div style={{ padding: '20px 24px 24px' }}>
              <div style={{ fontSize: 21, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', marginBottom: 6 }}>{pendingGame.title}</div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6, marginBottom: 14 }}>
                <Lightbulb size={16} style={{ color: pendingGame.accent, flexShrink: 0, marginTop: 2 }} />
                <span>{pendingGame.desc}</span>
              </div>
              {pendingGame.howTo && (
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: pendingGame.accent, marginBottom: 6 }}>
                    <Gamepad2 size={13} /> Comment jouer
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.6 }}>{pendingGame.howTo}</p>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setPendingGame(null)}
                  style={{ padding: '12px 18px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                >Annuler</button>
                <button
                  onClick={() => { const g = pendingGame; setPendingGame(null); g.launch(); }}
                  style={{ flex: 1, padding: '12px 18px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${pendingGame.accent}, ${pendingGame.accent}cc)`, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 6px 20px ${pendingGame.accent}55` }}
                >
                  <Play size={17} /> Commencer le jeu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Popup Modal */}
      {gameOverPopup.open && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.98)',
              borderRadius: 24,
              padding: '40px 48px',
              textAlign: 'center',
              border: '1px solid rgba(0,0,0,0.08)',
              boxShadow: '0 25px 50px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)',
              animation: 'slideUp 0.4s ease-out',
              maxWidth: 400,
              width: '90%'
            }}
          >
            <div style={{ display:'flex', justifyContent:'center', marginBottom: 16, color:'#4361ee' }}><Trophy size={48} /></div>
            <h2 style={{
              fontSize: 28,
              fontWeight: 800,
              marginBottom: 12,
              background: 'linear-gradient(135deg, #4361ee, #7c3aed)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Jeu Terminé !
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(26,29,46,0.6)', marginBottom: 8 }}>
              {gameOverPopup.game}
            </p>
            <div style={{
              fontSize: 42,
              fontWeight: 800,
              color: '#1a1d2e',
              marginBottom: 8,
              fontFamily: 'SF Pro Display, -apple-system, sans-serif'
            }}>
              {gameOverPopup.score} pts
            </div>
            <p style={{ fontSize: 14, color: 'rgba(26,29,46,0.5)', marginBottom: 32 }}>
              {gameOverPopup.message}
            </p>

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <button
                onClick={() => {
                  setGameOverPopup(prev => ({ ...prev, open: false }));
                  // Restart current game based on which one was active
                  if (spectralActive) startSpectralChallenge();
                  else if (chaseActive) startChaseGame();
                  else if (mpActive) startMatchPairGame();
                  else if (snakeActive) startSnakeGame();
                  else if (tetrixActive) startTetrixGame();
                  else if (simonActive) startSimonGame();
                }}
                style={{
                  padding: '14px 28px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(34, 197, 94, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(34, 197, 94, 0.3)';
                }}
              >
                <RefreshCcw size={16} /> Relancer
              </button>
              <button
                onClick={() => {
                  setGameOverPopup(prev => ({ ...prev, open: false }));
                  stopGame();
                }}
                style={{
                  padding: '14px 28px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'transform 0.2s, background 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }}
              >
                <X size={16} /> Quitter
              </button>
            </div>
          </div>

          <style jsx>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(30px) scale(0.95);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `}</style>
        </div>
      )}
    </div>
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
