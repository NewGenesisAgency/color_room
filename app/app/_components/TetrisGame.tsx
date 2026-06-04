'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsDown, RotateCw } from 'lucide-react';
import TouchControls, { type TouchKey } from './TouchControls';

const TETRIS_TOUCH: TouchKey[] = [
  { key: 'ArrowUp',    slot: 'up',    label: <RotateCw size={20} /> },
  { key: 'ArrowLeft',  slot: 'left',  label: <ChevronLeft size={22} />,  repeat: true },
  { key: 'ArrowRight', slot: 'right', label: <ChevronRight size={22} />, repeat: true },
  { key: 'ArrowDown',  slot: 'down',  label: <ChevronDown size={22} />,  repeat: true },
  { key: ' ',          slot: 'a',     label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ChevronsDown size={18} /> Drop</span>, accent: '#4361ee' },
];

// ─── Tetrominos (7 pièces standard + 2 bonus) ────────────────────────────────
const PIECES: { shape: number[][]; color: string }[] = [
  { color: '#00c8ff', shape: [[1, 1, 1, 1]] },                          // I — cyan
  { color: '#ffd600', shape: [[1, 1], [1, 1]] },                        // O — jaune
  { color: '#b829dd', shape: [[0, 1, 0], [1, 1, 1]] },                  // T — violet
  { color: '#22c55e', shape: [[0, 1, 1], [1, 1, 0]] },                  // S — vert
  { color: '#ef4444', shape: [[1, 1, 0], [0, 1, 1]] },                  // Z — rouge
  { color: '#ff8c00', shape: [[1, 0], [1, 0], [1, 1]] },                // L — orange
  { color: '#4361ee', shape: [[0, 1], [0, 1], [1, 1]] },                // J — bleu
];

const COLS = 6;
const ROWS = 7;
const CELL = 72;
const GAP = 5;
const OVER_CLR = '#ff2020';
const LINES_PER_LEVEL = 10; // 10 lignes avant d'accélérer (au lieu de 5)

type Cell = string | null;
type Grid = Cell[][];
type Piece = { shape: number[][]; color: string; x: number; y: number };

export type TetrisSnapshot = { grid: Grid; piece: Piece | null; score: number; gameOver: boolean };
export type TetrisParams = { speed?: number };

// ─── 7-bag randomizer ────────────────────────────────────────────────────────
// Closure : évite les class private fields qui posent problème avec SWC/Babel.
// Garantit qu'on voit chaque pièce exactement une fois par cycle de 7.
function makeBag(): () => number {
  let pool: number[] = [];
  function refill() {
    pool = [0, 1, 2, 3, 4, 5, 6];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
  }
  return function nextIdx(): number {
    if (pool.length === 0) refill();
    return pool.pop()!;
  };
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────
function emptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function pieceFromIdx(idx: number): Piece {
  const p = PIECES[idx];
  return { ...p, x: Math.floor((COLS - p.shape[0].length) / 2), y: 0 };
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

function clearLines(grid: Grid): { grid: Grid; cleared: number } {
  const kept = grid.filter(row => row.some(c => c === null));
  const cleared = ROWS - kept.length;
  while (kept.length < ROWS) kept.unshift(Array(COLS).fill(null));
  return { grid: kept, cleared };
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

// ─── Scoring (système Tetris guideline) ───────────────────────────────────────
const LINE_PTS = [0, 50, 150, 350, 700]; // 0, 1, 2, 3, 4 lignes
const COMBO_BONUS = 50;                    // bonus par combo consécutif
const HARD_DROP_PTS = 2;                   // 2 pts par cellule en hard drop
const SOFT_DROP_PTS = 1;                   // 1 pt par cellule en soft drop

// ─── Vitesse par niveau (en ms) ───────────────────────────────────────────────
// Commence à 900ms, beaucoup plus doux qu'avant (600ms), plafond à 150ms
function speedForLevel(level: number, base: number): number {
  return Math.max(150, base - (level - 1) * 55);
}

// ─── Mutable game state ───────────────────────────────────────────────────────
type GS = {
  grid: Grid;
  piece: Piece | null;
  hold: Piece | null;
  holdUsed: boolean;
  queue: number[];          // 3 pièces suivantes (indices PIECES)
  nextIdx: () => number;    // 7-bag closure
  score: number;
  lines: number;
  combo: number;
  over: boolean;
};

function initGS(): GS {
  const nextIdx = makeBag();
  return {
    grid: emptyGrid(),
    piece: null,
    hold: null,
    holdUsed: false,
    queue: [nextIdx(), nextIdx(), nextIdx()],
    nextIdx,
    score: 0,
    lines: 0,
    combo: 0,
    over: false,
  };
}

function spawnNext(s: GS): boolean {
  const idx = s.queue.shift()!;
  s.queue.push(s.nextIdx());
  const spawned = pieceFromIdx(idx);
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
  const { grid: cleared, cleared: n } = clearLines(locked);
  s.grid = cleared;
  if (n > 0) {
    s.combo++;
    const pts = (LINE_PTS[n] ?? 800) + (s.combo - 1) * COMBO_BONUS;
    s.score += pts;
    s.lines += n;
  } else {
    s.combo = 0;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TetrisGame({
  params,
  isPlaying,
  onSnapshot,
}: {
  params?: TetrisParams;
  isPlaying: boolean;
  onSnapshot?: (snap: TetrisSnapshot) => void;
}) {
  const baseSpeed = params?.speed ?? 900;

  const gs = useRef<GS>(initGS());
  const [render, setRender] = useState(0);
  const [startKey, setStartKey] = useState(0);

  const tick = () => setRender(n => n + 1);

  function snap() {
    const s = gs.current;
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

  useEffect(() => { snap(); });

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
              ) : <div style={{ color: '#334155', fontSize: 11 }}>—</div>}
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
            <div style={{ ...panelLabel, marginTop: 8 }}>Lignes</div>
            <div style={{ ...panelValue, fontSize: 18, color: '#cbd5e1' }}>{s.lines}</div>
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

        {/* Grille */}
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

        {/* Queue des 3 pièces suivantes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 80 }}>
          <div style={{ ...panelLabel, textAlign: 'center', marginBottom: 4 }}>Suivant</div>
          {s.queue.map((idx, qi) => {
            const p = PIECES[idx];
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
                  gridTemplateColumns: `repeat(${p.shape[0].length}, 16px)`,
                  gap: 2,
                }}>
                  {p.shape.flat().map((v, i) => (
                    <div key={i} style={{
                      width: 16, height: 16, borderRadius: 3,
                      background: v ? p.color : 'transparent',
                      boxShadow: v ? `0 0 5px ${p.color}80` : 'none',
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
          <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>Score : {s.score} · Niveau {level} · {s.lines} lignes</div>
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
