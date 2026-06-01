'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsDown, RotateCw } from 'lucide-react';
import TouchControls, { type TouchKey } from './TouchControls';

// Contrôles tactiles : convertit les boutons à l'écran en KeyboardEvent
// (mêmes touches que le clavier → aucune duplication de logique de jeu).
const TETRIS_TOUCH: TouchKey[] = [
  { key: 'ArrowUp',    slot: 'up',    label: <RotateCw size={20} /> },
  { key: 'ArrowLeft',  slot: 'left',  label: <ChevronLeft size={22} />,  repeat: true },
  { key: 'ArrowRight', slot: 'right', label: <ChevronRight size={22} />, repeat: true },
  { key: 'ArrowDown',  slot: 'down',  label: <ChevronDown size={22} />,  repeat: true },
  { key: ' ',          slot: 'a',     label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ChevronsDown size={18} /> Drop</span>, accent: '#4361ee' },
];

// ─── Tetrominos ───────────────────────────────────────────────────
const PIECES: { shape: number[][]; color: string }[] = [
  { color: '#00c8ff', shape: [[1, 1, 1, 1]] },
  { color: '#ffd600', shape: [[1, 1], [1, 1]] },
  { color: '#b829dd', shape: [[0, 1, 0], [1, 1, 1]] },
  { color: '#22c55e', shape: [[0, 1, 1], [1, 1, 0]] },
  { color: '#ef4444', shape: [[1, 1, 0], [0, 1, 1]] },
  { color: '#ff8c00', shape: [[1, 0], [1, 0], [1, 1]] },
  { color: '#4361ee', shape: [[0, 1], [0, 1], [1, 1]] },
];

const COLS = 6;
const ROWS = 7;
const CELL = 72;
const GAP = 5;
const OVER_CLR = '#ff2020';

type Cell = string | null;
type Grid = Cell[][];
type Piece = { shape: number[][]; color: string; x: number; y: number };

export type TetrisSnapshot = { grid: Grid; piece: Piece | null; score: number; gameOver: boolean };
export type TetrisParams = { speed?: number };

// ─── Pure helpers ─────────────────────────────────────────────────
function emptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function newPiece(): Piece {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  return { ...p, x: Math.floor((COLS - p.shape[0].length) / 2), y: 0 };
}

function rotateCW(s: number[][]): number[][] {
  const R = s.length, C = s[0].length;
  const out: number[][] = Array.from({ length: C }, () => Array(R).fill(0));
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) out[c][R - 1 - r] = s[r][c];
  return out;
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

// ─── Mutable game state (avoids stale closures in interval) ───────
type GS = {
  grid: Grid;
  piece: Piece | null;
  next: Piece;
  score: number;
  lines: number;
  over: boolean;
};

function initGS(): GS {
  return { grid: emptyGrid(), piece: null, next: newPiece(), score: 0, lines: 0, over: false };
}

// ─── Component ────────────────────────────────────────────────────
export default function TetrisGame({
  params,
  isPlaying,
  onSnapshot,
}: {
  params?: TetrisParams;
  isPlaying: boolean;
  onSnapshot?: (snap: TetrisSnapshot) => void;
}) {
  const baseSpeed = params?.speed ?? 600;

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

  // Spawn first piece when game starts / restarts
  useEffect(() => {
    if (!isPlaying) return;
    const s = gs.current;
    if (s.piece || s.over) return;
    const spawned = { ...s.next, x: Math.floor((COLS - s.next.shape[0].length) / 2), y: 0 };
    if (collides(s.grid, spawned)) {
      s.over = true;
      s.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(OVER_CLR));
    } else {
      s.piece = spawned;
      s.next = newPiece();
    }
    tick();
    snap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, startKey]);

  // Gravity
  useEffect(() => {
    if (!isPlaying || gs.current.over) return;
    const level = Math.floor(gs.current.lines / 5);
    const interval = Math.max(80, baseSpeed - level * 50);

    const id = setInterval(() => {
      const s = gs.current;
      if (!s.piece || s.over) return;
      const moved = { ...s.piece, y: s.piece.y + 1 };
      if (collides(s.grid, moved)) {
        const locked = lockPiece(s.grid, s.piece);
        const { grid: cleared, cleared: n } = clearLines(locked);
        s.grid = cleared;
        if (n > 0) {
          const pts = [0, 100, 300, 500, 800][n] ?? 800;
          s.score += pts;
          s.lines += n;
        }
        const spawned = { ...s.next, x: Math.floor((COLS - s.next.shape[0].length) / 2), y: 0 };
        if (collides(s.grid, spawned)) {
          s.piece = null;
          s.over = true;
          s.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(OVER_CLR));
        } else {
          s.piece = spawned;
          s.next = newPiece();
        }
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
          if (!collides(s.grid, m)) { s.piece = m; tick(); snap(); }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const rot = { ...s.piece, shape: rotateCW(s.piece.shape) };
          let placed = false;
          for (const kick of [0, -1, 1, -2, 2]) {
            const k = { ...rot, x: rot.x + kick };
            if (!collides(s.grid, k)) { s.piece = k; placed = true; break; }
          }
          if (placed) { tick(); snap(); }
          break;
        }
        case ' ': {
          e.preventDefault();
          const ghost = ghostPiece(s.grid, s.piece);
          const locked = lockPiece(s.grid, ghost);
          const { grid: cleared, cleared: n } = clearLines(locked);
          s.grid = cleared;
          if (n > 0) { s.score += [0, 100, 300, 500, 800][n] ?? 800; s.lines += n; }
          const spawned = { ...s.next, x: Math.floor((COLS - s.next.shape[0].length) / 2), y: 0 };
          if (collides(s.grid, spawned)) {
            s.piece = null; s.over = true;
            s.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(OVER_CLR));
          } else {
            s.piece = spawned; s.next = newPiece();
          }
          tick(); snap();
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, startKey]);

  // Always send snapshot on render
  useEffect(() => { snap(); });

  // ─── Build display grid ─────────────────────────────────────────
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

  const level = Math.floor(s.lines / 5) + 1;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
      padding: 24, fontFamily: 'system-ui, sans-serif',
      background: '#ffffff', minHeight: '100%',
    }}>
      {/* Title */}
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', color: '#94a3b8', textTransform: 'uppercase' }}>
        Tetris Lumière
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
          gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`,
          gap: GAP,
          background: '#f1f5f9',
          border: '2px solid #e2e8f0',
          borderRadius: 12,
          padding: 8,
        }}>
          {display.flat().map((cell, i) => {
            const isGhost = typeof cell === 'string' && cell.startsWith('ghost:');
            const color = isGhost ? (cell as string).slice(6) : cell;
            return (
              <div key={i} style={{
                width: CELL, height: CELL,
                borderRadius: 8,
                background: color
                  ? isGhost ? color + '28' : color
                  : '#e8edf4',
                border: color && !isGhost
                  ? `2px solid rgba(255,255,255,0.6)`
                  : isGhost
                    ? `2px dashed ${color}55`
                    : '2px solid #dde3ec',
                boxShadow: color && !isGhost
                  ? `inset 0 2px 0 rgba(255,255,255,0.4), 0 2px 8px ${color}55`
                  : 'none',
                transition: 'background 0.05s',
              }} />
            );
          })}
        </div>

        {/* Side panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 110 }}>
          {/* Score */}
          <div style={panelBox}>
            <div style={panelLabel}>Score</div>
            <div style={{ ...panelValue, color: '#1e293b', fontSize: 22 }}>{s.score}</div>
          </div>

          {/* Level / Lines */}
          <div style={panelBox}>
            <div style={panelLabel}>Niveau</div>
            <div style={{ ...panelValue, color: '#4361ee' }}>{level}</div>
            <div style={{ ...panelLabel, marginTop: 8 }}>Lignes</div>
            <div style={{ ...panelValue, color: '#1e293b', fontSize: 18 }}>{s.lines}</div>
          </div>

          {/* Next piece */}
          <div style={{ ...panelBox, alignItems: 'center' }}>
            <div style={panelLabel}>Suivant</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${s.next.shape[0].length}, 20px)`,
              gridTemplateRows: `repeat(${s.next.shape.length}, 20px)`,
              gap: 3, marginTop: 6,
            }}>
              {s.next.shape.flat().map((v, i) => (
                <div key={i} style={{
                  width: 20, height: 20, borderRadius: 4,
                  background: v ? s.next.color : '#e8edf4',
                  border: v ? '2px solid rgba(255,255,255,0.5)' : '2px solid #dde3ec',
                  boxShadow: v ? `0 1px 4px ${s.next.color}55` : 'none',
                }} />
              ))}
            </div>
          </div>

          {/* Controls */}
          <div style={{ ...panelBox, fontSize: 11, color: '#94a3b8', lineHeight: 1.8 }}>
            <div style={panelLabel}>Contrôles</div>
            <div style={{ marginTop: 6 }}>
              ← → Déplacer<br />
              ↑ Tourner<br />
              ↓ Descendre<br />
              Espace Drop<br />
              <span style={{ color: '#4361ee', fontWeight: 600 }}>Entrée Rejouer</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contrôles tactiles (tablette / mobile) — masqués sur desktop */}
      <TouchControls keys={TETRIS_TOUCH} />

      {/* Game over banner */}
      {s.over && (
        <div style={{
          marginTop: 8, padding: '16px 32px', borderRadius: 12,
          background: '#fff1f2', border: '2px solid #fecaca',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#ef4444', letterSpacing: '0.05em' }}>GAME OVER</div>
          <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>Score final : {s.score}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Appuie sur Entrée pour rejouer</div>
          <button
            onClick={restart}
            style={{
              marginTop: 12, padding: '10px 28px', borderRadius: 8,
              background: '#ef4444', color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(239,68,68,0.4)',
            }}
          >
            Rejouer
          </button>
        </div>
      )}

      {/* Waiting overlay */}
      {!isPlaying && !s.over && !s.piece && (
        <div style={{ color: '#94a3b8', fontSize: 13 }}>Appuie sur Play pour démarrer</div>
      )}
    </div>
  );
}

const panelBox: React.CSSProperties = {
  background: '#f8fafc',
  border: '1.5px solid #e2e8f0',
  borderRadius: 10,
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
};

const panelLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#94a3b8',
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
