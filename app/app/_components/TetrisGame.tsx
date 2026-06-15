'use client';

/**
 * @file app/_components/TetrisGame.tsx
 * @brief Mini-jeu "Tetris Lumière" (color-match) joué sur la grille de dalles (6×7).
 *
 * Variante color-match adaptée aux dalles : on empile de PETITES pièces (1 ou 2
 * cases, voir {@link SHAPES}) d'une couleur de la palette {@link PALETTE}. Dès
 * qu'au moins {@link MATCH} cases de la même couleur sont connectées, le groupe
 * fusionne et disparaît, puis les cases du dessus tombent (gravité), ce qui peut
 * enchaîner des combos. Un Tetris classique (pièces de 4 cases) serait impossible
 * à gagner sur une grille 6×7 : ce mode est conçu pour être jouable et gagnable.
 * Le contrôle se fait au clavier ou via le pavé {@link TouchControls}.
 * À la différence des autres jeux, ce composant ne reçoit pas {@link GameTileProps}
 * mais des props dédiées : `params` ({@link TetrisParams} : vitesse/difficulté),
 * `isPlaying`, et `onSnapshot` qui pousse l'état courant ({@link TetrisSnapshot})
 * au parent - c'est ce dernier qui projette le plateau sur les dalles physiques.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsDown, RotateCw } from 'lucide-react';
import TouchControls, { type TouchKey } from './TouchControls';
import { DIFF_LABELS, type DifficultyLevel } from './GameColorSpeed';
import { SHOW_SCREEN_BOARD } from '@/lib/game/displayMode';

const TETRIS_TOUCH: TouchKey[] = [
  { key: 'ArrowUp',    slot: 'up',    label: <RotateCw size={20} /> },
  { key: 'ArrowLeft',  slot: 'left',  label: <ChevronLeft size={22} />,  repeat: true },
  { key: 'ArrowRight', slot: 'right', label: <ChevronRight size={22} />, repeat: true },
  { key: 'ArrowDown',  slot: 'down',  label: <ChevronDown size={22} />,  repeat: true },
  { key: ' ',          slot: 'a',     label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ChevronsDown size={18} /> Drop</span>, accent: '#4361ee' },
];

// ─── Pièces : MAX 2 carreaux (mono-couleur) ──────────────────────────────────
// Le jeu n'est plus un Tetris classique (impossible à gagner sur 6×7 avec des
// pièces de 4 cases) mais un "color-match" façon Puyo : on empile de petites
// pièces colorées et tout groupe d'AU MOINS 3 cases de la même couleur reliées
// (haut/bas/gauche/droite) fusionne et disparaît. Les cases du dessus tombent
// alors (gravité), ce qui peut déclencher des combos en chaîne.
const SHAPES: number[][][] = [
  [[1]],          // une case
  [[1, 1]],       // domino horizontal
  [[1], [1]],     // domino vertical
];

// Palette volontairement courte (4 couleurs) pour que les fusions soient faciles.
const PALETTE = ['#ef4444', '#22c55e', '#4361ee', '#ffd600']; // rouge, vert, bleu, jaune

/** Nombre minimum de cases connectées de même couleur pour qu'un groupe disparaisse. */
const MATCH = 3;

const COLS = 6;
const ROWS = 7;
const CELL = 72;
const GAP = 5;
const OVER_CLR = '#ff2020';

const TETRIS_DIFF = {
  facile:    { baseSpeed: 1500, linesPerLevel: 14 },
  moyen:     { baseSpeed: 1100, linesPerLevel: 12 },
  difficile: { baseSpeed: 800,  linesPerLevel: 10 },
  expert:    { baseSpeed: 550,  linesPerLevel: 8  },
} satisfies Record<DifficultyLevel, { baseSpeed: number; linesPerLevel: number }>;

type Cell = string | null;
type Grid = Cell[][];
type Piece = { shape: number[][]; color: string; x: number; y: number };
/** Descripteur d'une pièce à venir : forme + couleur (tirées au hasard). */
type PieceDesc = { shapeIdx: number; color: string };

export type TetrisSnapshot = { grid: Grid; piece: Piece | null; score: number; gameOver: boolean };
export type TetrisParams = { speed?: number; difficulty?: DifficultyLevel };

// ─── Tirage des pièces ───────────────────────────────────────────────────────
/** Tire une pièce au hasard : une forme (1 ou 2 cases) + une couleur de la palette. */
function makeDesc(): PieceDesc {
  return {
    shapeIdx: Math.floor(Math.random() * SHAPES.length),
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
  };
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────
function emptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function pieceFromDesc(d: PieceDesc): Piece {
  const shape = SHAPES[d.shapeIdx];
  return { shape, color: d.color, x: Math.floor((COLS - shape[0].length) / 2), y: 0 };
}

function rotateCW(s: number[][]): number[][] {
  const R = s.length, C = s[0].length;
  const out: number[][] = Array.from({ length: C }, () => Array(R).fill(0));
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) out[c][R - 1 - r] = s[r][c];
  return out;
}

function rotateCCW(s: number[][]): number[][] {
  return rotateCW(rotateCW(rotateCW(s)));
}

function collides(grid: Grid, p: Piece): boolean {
  for (let r = 0; r < p.shape.length; r++)
    for (let c = 0; c < p.shape[r].length; c++) {
      if (!p.shape[r][c]) continue;
      const gx = p.x + c, gy = p.y + r;
      if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
      if (gy >= 0 && grid[gy][gx] !== null) return true;
    }
  return false;
}

function lockPiece(grid: Grid, p: Piece): Grid {
  const g = grid.map(r => [...r]);
  for (let r = 0; r < p.shape.length; r++)
    for (let c = 0; c < p.shape[r].length; c++) {
      if (!p.shape[r][c]) continue;
      const gx = p.x + c, gy = p.y + r;
      if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) g[gy][gx] = p.color;
    }
  return g;
}

/** Fait tomber chaque colonne (gravité Puyo) : les cases pleines glissent en bas. */
function applyGravity(grid: Grid): Grid {
  const g = emptyGrid();
  for (let c = 0; c < COLS; c++) {
    const stack: Cell[] = [];
    for (let r = ROWS - 1; r >= 0; r--) if (grid[r][c]) stack.push(grid[r][c]);
    for (let i = 0; i < stack.length; i++) g[ROWS - 1 - i][c] = stack[i];
  }
  return g;
}

/** Marque toutes les cases appartenant à un groupe de même couleur ≥ MATCH (flood-fill 4-voisins). */
function findMatches(grid: Grid): boolean[][] {
  const mark = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const color = grid[r][c];
      if (!color || seen[r][c]) continue;
      // BFS sur les cases voisines de même couleur
      const group: [number, number][] = [];
      const stack: [number, number][] = [[r, c]];
      seen[r][c] = true;
      while (stack.length) {
        const [y, x] = stack.pop()!;
        group.push([y, x]);
        const neigh: [number, number][] = [[y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]];
        for (const [ny, nx] of neigh) {
          if (ny < 0 || ny >= ROWS || nx < 0 || nx >= COLS) continue;
          if (seen[ny][nx] || grid[ny][nx] !== color) continue;
          seen[ny][nx] = true;
          stack.push([ny, nx]);
        }
      }
      if (group.length >= MATCH) for (const [gy, gx] of group) mark[gy][gx] = true;
    }
  }
  return mark;
}

/**
 * Résout les fusions en chaîne après le verrouillage d'une pièce :
 * tant qu'il existe un groupe de ≥ MATCH cases de même couleur, on le retire,
 * on applique la gravité, et on recommence (combos). Renvoie le nouveau plateau,
 * le nombre total de cases effacées et le nombre de chaînes déclenchées.
 */
function resolveMatches(grid: Grid): { grid: Grid; cleared: number; chains: number } {
  let g = applyGravity(grid);
  let cleared = 0;
  let chains = 0;
  // Garde-fou : 42 cases max => jamais plus de quelques chaînes, on borne à 20.
  for (let guard = 0; guard < 20; guard++) {
    const mark = findMatches(g);
    let removed = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (mark[r][c]) { g[r][c] = null; removed++; }
    if (removed === 0) break;
    cleared += removed;
    chains++;
    g = applyGravity(g);
  }
  return { grid: g, cleared, chains };
}

function ghostPiece(grid: Grid, p: Piece): Piece {
  let y = p.y;
  while (!collides(grid, { ...p, y: y + 1 })) y++;
  return { ...p, y };
}

// Wall kicks SRS (décalages essayés lors d'une rotation bloquée)
const KICKS = [0, -1, 1, -2, 2, 2, -2];

function tryRotate(grid: Grid, p: Piece, cw: boolean): Piece | null {
  const rotated = { ...p, shape: cw ? rotateCW(p.shape) : rotateCCW(p.shape) };
  for (const kick of KICKS) {
    const k = { ...rotated, x: rotated.x + kick };
    if (!collides(grid, k)) return k;
  }
  return null;
}

// ─── Scoring (color-match) ─────────────────────────────────────────────────────
const CELL_PTS = 10;        // points par case effacée
const HARD_DROP_PTS = 2;    // 2 pts par cellule en hard drop
const SOFT_DROP_PTS = 1;    // 1 pt par cellule en soft drop

// ─── Vitesse par niveau (en ms) ───────────────────────────────────────────────
// Chute plus douce (les pièces sont petites) : -45 ms par niveau, plancher 220 ms.
function speedForLevel(level: number, base: number): number {
  return Math.max(220, base - (level - 1) * 45);
}

// ─── Mutable game state ───────────────────────────────────────────────────────
type GS = {
  grid: Grid;
  piece: Piece | null;
  hold: Piece | null;
  holdUsed: boolean;
  queue: PieceDesc[];       // 3 pièces suivantes (forme + couleur)
  score: number;
  lines: number;            // total de cases effacées (sert au niveau)
  combo: number;
  over: boolean;
};

function initGS(): GS {
  return {
    grid: emptyGrid(),
    piece: null,
    hold: null,
    holdUsed: false,
    queue: [makeDesc(), makeDesc(), makeDesc()],
    score: 0,
    lines: 0,
    combo: 0,
    over: false,
  };
}

function spawnNext(s: GS): boolean {
  const desc = s.queue.shift()!;
  s.queue.push(makeDesc());
  const spawned = pieceFromDesc(desc);
  if (collides(s.grid, spawned)) {
    s.piece = null;
    s.over = true;
    s.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(OVER_CLR));
    return false;
  }
  s.piece = spawned;
  s.holdUsed = false;
  return true;
}

function lockAndClear(s: GS): void {
  if (!s.piece) return;
  const locked = lockPiece(s.grid, s.piece);
  const { grid, cleared, chains } = resolveMatches(locked);
  s.grid = grid;
  if (cleared > 0) {
    s.combo++;
    // Points = cases effacées × valeur × multiplicateur de chaîne (combos en cascade).
    s.score += cleared * CELL_PTS * Math.max(1, chains);
    s.lines += cleared;
  } else {
    s.combo = 0;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
/**
 * Composant du mini-jeu Tetris.
 *
 * @param params Paramètres de partie (vitesse, difficulté) - voir {@link TetrisParams}.
 * @param isPlaying Vrai si la partie doit tourner (boucle de chute active).
 * @param onSnapshot Callback recevant l'état courant ({@link TetrisSnapshot}) à projeter sur les dalles.
 * @returns Le plateau de Tetris et ses contrôles.
 */
export default function TetrisGame({
  params,
  isPlaying,
  onSnapshot,
}: {
  params?: TetrisParams;
  isPlaying: boolean;
  onSnapshot?: (snap: TetrisSnapshot) => void;
}) {
  const diffCfg = TETRIS_DIFF[params?.difficulty ?? 'moyen'];
  const baseSpeed = params?.speed ?? diffCfg.baseSpeed;
  const LINES_PER_LEVEL = diffCfg.linesPerLevel;

  const gs = useRef<GS>(initGS());
  const [render, setRender] = useState(0);
  const [startKey, setStartKey] = useState(0);

  const tick = () => setRender(n => n + 1);

  // Perf tablette : on ne pousse un snapshot (qui repeint les 42 dalles 3D) que
  // si l'affichage a RÉELLEMENT changé. On compare une signature légère
  // (plateau + position/forme de la pièce) à la précédente.
  const lastSigRef = useRef<string>('');
  function snap() {
    const s = gs.current;
    const p = s.piece;
    const sig = `${s.over ? 'X' : ''}|${p ? `${p.x},${p.y},${p.color},${p.shape.length}x${p.shape[0].length}` : '-'}|${s.grid.map(r => r.map(c => c ?? '.').join('')).join('')}`;
    if (sig === lastSigRef.current) return; // rien de visible n'a changé → on n'embête pas la 3D
    lastSigRef.current = sig;
    onSnapshot?.({ grid: s.grid, piece: s.piece, score: s.score, gameOver: s.over });
  }

  function restart() {
    gs.current = initGS();
    setStartKey(k => k + 1);
    tick();
  }

  // Spawn first piece
  useEffect(() => {
    if (!isPlaying) return;
    const s = gs.current;
    if (s.piece || s.over) return;
    spawnNext(s);
    tick();
    snap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, startKey]);

  // Gravity
  useEffect(() => {
    if (!isPlaying || gs.current.over) return;
    const level = Math.floor(gs.current.lines / LINES_PER_LEVEL) + 1;
    const interval = speedForLevel(level, baseSpeed);

    const id = setInterval(() => {
      const s = gs.current;
      if (!s.piece || s.over) return;
      const moved = { ...s.piece, y: s.piece.y + 1 };
      if (collides(s.grid, moved)) {
        lockAndClear(s);
        spawnNext(s);
      } else {
        s.piece = moved;
      }
      tick();
      snap();
    }, interval);

    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, startKey, render && gs.current.lines]);

  // Keyboard
  useEffect(() => {
    if (!isPlaying) return;
    const onKey = (e: KeyboardEvent) => {
      const s = gs.current;
      if (e.key === 'Enter') { restart(); return; }
      if (s.over || !s.piece) return;
      switch (e.key) {
        case 'ArrowLeft': {
          e.preventDefault();
          const m = { ...s.piece, x: s.piece.x - 1 };
          if (!collides(s.grid, m)) { s.piece = m; tick(); snap(); }
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const m = { ...s.piece, x: s.piece.x + 1 };
          if (!collides(s.grid, m)) { s.piece = m; tick(); snap(); }
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const m = { ...s.piece, y: s.piece.y + 1 };
          if (!collides(s.grid, m)) {
            s.piece = m;
            s.score += SOFT_DROP_PTS;
            tick(); snap();
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const rotated = tryRotate(s.grid, s.piece, true);
          if (rotated) { s.piece = rotated; tick(); snap(); }
          break;
        }
        case 'z':
        case 'Z': {
          e.preventDefault();
          const rotated = tryRotate(s.grid, s.piece, false);
          if (rotated) { s.piece = rotated; tick(); snap(); }
          break;
        }
        case ' ': {
          e.preventDefault();
          const ghost = ghostPiece(s.grid, s.piece);
          s.score += (ghost.y - s.piece.y) * HARD_DROP_PTS;
          s.piece = ghost;
          lockAndClear(s);
          spawnNext(s);
          tick(); snap();
          break;
        }
        case 'c':
        case 'C':
        case 'Shift': {
          e.preventDefault();
          if (s.holdUsed) break;
          const current = s.piece;
          if (s.hold) {
            s.piece = { ...s.hold, x: Math.floor((COLS - s.hold.shape[0].length) / 2), y: 0 };
            s.hold = { ...current, x: 0, y: 0 };
          } else {
            s.hold = { ...current, x: 0, y: 0 };
            spawnNext(s);
          }
          s.holdUsed = true;
          tick(); snap();
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, startKey]);

  // ─── Build display grid ──────────────────────────────────────────────────────
  const s = gs.current;
  const display: Cell[][] = s.grid.map(r => [...r]);

  if (s.piece && !s.over) {
    const ghost = ghostPiece(s.grid, s.piece);
    for (let r = 0; r < ghost.shape.length; r++)
      for (let c = 0; c < ghost.shape[r].length; c++) {
        if (!ghost.shape[r][c]) continue;
        const gx = ghost.x + c, gy = ghost.y + r;
        if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS && !display[gy][gx])
          display[gy][gx] = 'ghost:' + ghost.color;
      }
    for (let r = 0; r < s.piece.shape.length; r++)
      for (let c = 0; c < s.piece.shape[r].length; c++) {
        if (!s.piece.shape[r][c]) continue;
        const gx = s.piece.x + c, gy = s.piece.y + r;
        if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS)
          display[gy][gx] = s.piece.color;
      }
  }

  const level = Math.floor(s.lines / LINES_PER_LEVEL) + 1;
  const speed = speedForLevel(level, baseSpeed);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
      padding: 24, fontFamily: 'system-ui, sans-serif',
      background: '#0b0f1c', minHeight: '100%',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', color: '#06d6a0', textTransform: 'uppercase' }}>
        Tetris Lumière
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: -12, textAlign: 'center', maxWidth: 360 }}>
        Aligne au moins 3 dalles de la même couleur (côte à côte) pour les faire disparaître. Combos en cascade !
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* Hold */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 90 }}>
          <div style={panelBox}>
            <div style={panelLabel}>Hold <span style={{ color: '#64748b', fontWeight: 400, fontSize: 9 }}>(C/⇧)</span></div>
            <div style={{ marginTop: 8, minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {s.hold ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${s.hold.shape[0].length}, 18px)`,
                  gap: 2, opacity: s.holdUsed ? 0.35 : 1,
                }}>
                  {s.hold.shape.flat().map((v, i) => (
                    <div key={i} style={{
                      width: 18, height: 18, borderRadius: 3,
                      background: v ? s.hold!.color : 'transparent',
                      boxShadow: v ? `0 0 6px ${s.hold!.color}80` : 'none',
                    }} />
                  ))}
                </div>
              ) : <div style={{ color: '#334155', fontSize: 11 }}>-</div>}
            </div>
          </div>

          {/* Stats */}
          <div style={panelBox}>
            <div style={panelLabel}>Score</div>
            <div style={{ ...panelValue, color: '#f8fafc' }}>{s.score}</div>
          </div>
          <div style={panelBox}>
            <div style={panelLabel}>Niveau</div>
            <div style={{ ...panelValue, color: '#06d6a0' }}>{level}</div>
            <div style={{ ...panelLabel, marginTop: 8 }}>Cases</div>
            <div style={{ ...panelValue, fontSize: 18, color: '#cbd5e1' }}>{s.lines}</div>
            {(params?.difficulty && params.difficulty !== 'moyen') && (
              <div style={{ marginTop: 6, display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:800, background:`${DIFF_LABELS[params.difficulty].color}22`, color:DIFF_LABELS[params.difficulty].color, border:`1px solid ${DIFF_LABELS[params.difficulty].color}44` }}>
                {DIFF_LABELS[params.difficulty].emoji} {DIFF_LABELS[params.difficulty].label}
              </div>
            )}
          </div>
          {s.combo > 1 && (
            <div style={{ ...panelBox, background: 'rgba(6,214,160,0.12)', border: '1px solid rgba(6,214,160,0.4)' }}>
              <div style={{ ...panelLabel, color: '#06d6a0' }}>Combo</div>
              <div style={{ ...panelValue, color: '#06d6a0', fontSize: 22 }}>×{s.combo}</div>
            </div>
          )}
          <div style={{ ...panelBox, fontSize: 10, color: '#475569', lineHeight: 2 }}>
            <div style={{ ...panelLabel, marginBottom: 4 }}>Vitesse</div>
            <div style={{ color: level >= 5 ? '#f97316' : '#64748b' }}>{speed}ms</div>
          </div>
        </div>

        {/* Grille - masquée par défaut : on joue sur les dalles de la Color Room */}
        {SHOW_SCREEN_BOARD ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
          gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`,
          gap: GAP,
          background: '#0f172a',
          border: '2px solid #1e293b',
          borderRadius: 12,
          padding: 8,
          boxShadow: '0 0 40px rgba(6,214,160,0.08)',
        }}>
          {display.flat().map((cell, i) => {
            const isGhost = typeof cell === 'string' && cell.startsWith('ghost:');
            const color = isGhost ? (cell as string).slice(6) : cell;
            return (
              <div key={i} style={{
                width: CELL, height: CELL,
                borderRadius: 8,
                background: color
                  ? isGhost ? color + '18' : color
                  : '#0f172a',
                border: color && !isGhost
                  ? `2px solid rgba(255,255,255,0.25)`
                  : isGhost
                    ? `2px dashed ${color}60`
                    : '1px solid #1e293b',
                boxShadow: color && !isGhost
                  ? `inset 0 2px 0 rgba(255,255,255,0.2), 0 0 12px ${color}60`
                  : 'none',
                transition: 'background 0.04s',
              }} />
            );
          })}
        </div>
        ) : (
          <div style={{ width: COLS * CELL + (COLS - 1) * GAP + 16, minHeight: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center', padding: 20, background: '#0f172a', border: '2px solid #1e293b', borderRadius: 12, boxShadow: '0 0 40px rgba(6,214,160,0.08)' }}>
            <div style={{ fontSize: 34 }}>👁️</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#e2e8f0' }}>Regarde la Color Room</div>
            <div style={{ fontSize: 12, color: '#64748b', maxWidth: 200 }}>Le Tetris se joue sur les dalles - utilise les contrôles.</div>
          </div>
        )}

        {/* Queue des 3 pièces suivantes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 80 }}>
          <div style={{ ...panelLabel, textAlign: 'center', marginBottom: 4 }}>Suivant</div>
          {s.queue.map((desc, qi) => {
            const shape = SHAPES[desc.shapeIdx];
            return (
              <div key={qi} style={{
                ...panelBox,
                alignItems: 'center', padding: '8px 6px',
                opacity: qi === 0 ? 1 : qi === 1 ? 0.65 : 0.35,
                transform: `scale(${qi === 0 ? 1 : 0.88})`,
                transition: 'opacity 0.2s',
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${shape[0].length}, 16px)`,
                  gap: 2,
                }}>
                  {shape.flat().map((v, i) => (
                    <div key={i} style={{
                      width: 16, height: 16, borderRadius: 3,
                      background: v ? desc.color : 'transparent',
                      boxShadow: v ? `0 0 5px ${desc.color}80` : 'none',
                    }} />
                  ))}
                </div>
              </div>
            );
          })}

          <div style={{ ...panelBox, marginTop: 8, fontSize: 10, color: '#475569', lineHeight: 2 }}>
            <div style={panelLabel}>Touches</div>
            <div style={{ marginTop: 4 }}>
              ← → ↓ ↑<br />
              Z : ↺<br />
              C/⇧ : Hold<br />
              Espace : Drop<br />
              <span style={{ color: '#06d6a0' }}>Entrée : Reset</span>
            </div>
          </div>
        </div>
      </div>

      <TouchControls keys={TETRIS_TOUCH} />

      {s.over && (
        <div style={{
          marginTop: 8, padding: '16px 32px', borderRadius: 12,
          background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.4)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#ef4444', letterSpacing: '0.05em' }}>GAME OVER</div>
          <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>Score : {s.score} · Niveau {level} · {s.lines} cases</div>
          <button onClick={restart} style={{
            marginTop: 12, padding: '10px 28px', borderRadius: 8,
            background: 'linear-gradient(135deg,#ef4444,#b91c1c)', color: '#fff', border: 'none',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(239,68,68,0.4)',
          }}>
            Rejouer
          </button>
        </div>
      )}

      {!isPlaying && !s.over && !s.piece && (
        <div style={{ color: '#475569', fontSize: 13 }}>Appuie sur Play pour démarrer</div>
      )}
    </div>
  );
}

const panelBox: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: 10,
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
};

const panelLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
};

const panelValue: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.1,
  marginTop: 2,
};
