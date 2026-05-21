'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameTileProps } from './GameColorSpeed';

// Hardware layout: 7 rows × 6 cols = 42 plates
const ROWS = 7;
const COLS = 6;

const P1 = 1 as const;
const P2 = 2 as const;
const P1_COLOR = { r: 255, g: 30, b: 30 };
const P2_COLOR = { r: 30,  g: 80, b: 255 };
const P1_CSS   = '#ff1e1e';
const P2_CSS   = '#1e50ff';

type Cell = 0 | 1 | 2;
type Grid = Cell[][];
type Mode = 'pvp' | 'cpu';
type Phase = 'ready' | 'playing' | 'finished';

function emptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0) as Cell[]);
}

// Plate index = row * COLS + col  (matches hardware row-major 6-col layout)
function tileIdx(row: number, col: number): number {
  return row * COLS + col;
}

function dropPiece(grid: Grid, col: number, player: Cell): Grid | null {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (grid[row][col] === 0) {
      const next = grid.map(r => [...r]) as Grid;
      next[row][col] = player;
      return next;
    }
  }
  return null; // column full
}

function checkWin(grid: Grid): Cell | null {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (!cell) continue;
      for (const [dr, dc] of dirs) {
        let n = 1;
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k, nc = c + dc * k;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || grid[nr][nc] !== cell) break;
          n++;
        }
        if (n >= 4) return cell;
      }
    }
  }
  return null;
}

function cpuMove(grid: Grid): number {
  // Win if possible
  for (let c = 0; c < COLS; c++) {
    const g = dropPiece(grid, c, P2);
    if (g && checkWin(g) === P2) return c;
  }
  // Block opponent win
  for (let c = 0; c < COLS; c++) {
    const g = dropPiece(grid, c, P1);
    if (g && checkWin(g) === P1) return c;
  }
  // Center-preference for 6-col board
  for (const c of [2, 3, 1, 4, 0, 5]) {
    if (dropPiece(grid, c, P2)) return c;
  }
  return 0;
}

/* ── Styles ──────────────────────────────────────────────────────────── */
const S: Record<string, React.CSSProperties> = {
  wrap: {
    background: 'linear-gradient(160deg,rgba(8,12,24,.94) 0%,rgba(10,14,32,.90) 100%)',
    backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
    border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 20, overflow: 'hidden',
    fontFamily: 'system-ui,-apple-system,sans-serif', color: '#e8eaf0',
  },
  readyRow: {
    display: 'flex', alignItems: 'flex-start', gap: 20, padding: '18px 22px',
  },
  tag: {
    display: 'inline-block',
    background: 'linear-gradient(135deg,rgba(255,30,30,.25),rgba(30,80,255,.2))',
    border: '1px solid rgba(255,30,30,.35)', borderRadius: 8,
    padding: '3px 10px', fontSize: 12, fontWeight: 800, color: '#ff6b6b',
    marginBottom: 8, letterSpacing: '.04em',
  },
  rules: {
    fontSize: 13, color: 'rgba(255,255,255,.62)', lineHeight: 1.65, margin: '0 0 10px',
  },
  playBtn: {
    padding: '11px 26px', borderRadius: 14, border: 'none',
    background: 'linear-gradient(135deg,#ff1e1e 0%,#1e50ff 100%)',
    boxShadow: '0 4px 20px rgba(255,30,30,.35), inset 0 1px 0 rgba(255,255,255,.15)',
    color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', letterSpacing: '.02em',
  },
  quitBtn: {
    padding: '10px 20px', borderRadius: 14,
    border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)',
    color: 'rgba(255,255,255,.7)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
  },
  finRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 20, padding: '16px 22px', flexWrap: 'wrap' as const,
  },
  statGrid: { display: 'flex', gap: 10, flexWrap: 'wrap' as const },
  statCard: {
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 12, padding: '8px 16px', textAlign: 'center' as const, minWidth: 72,
  },
  statLbl: {
    fontSize: 10, color: 'rgba(255,255,255,.38)', fontWeight: 700,
    textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 3,
  },
  statVal: { fontSize: 22, fontWeight: 900 },
  stopBtn: {
    padding: '4px 12px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.05)',
    color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: 12,
  },
};

export default function GamePuissance4({
  onSendColor, onTurnOff, onTurnOffAll, onQuit, onRegisterClickHandler,
}: GameTileProps) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [mode, setMode] = useState<Mode>('pvp');
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [currentPlayer, setCurrentPlayer] = useState<Cell>(P1);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [winner, setWinner] = useState<Cell | null>(null);
  const [winMsg, setWinMsg] = useState('');

  const gridRef = useRef<Grid>(emptyGrid());
  const currentPlayerRef = useRef<Cell>(P1);
  const phaseRef = useRef<Phase>('ready');

  function syncHardware(g: Grid) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = tileIdx(r, c);
        const cell = g[r][c];
        if (cell === P1) onSendColor(idx, P1_COLOR.r, P1_COLOR.g, P1_COLOR.b, 90);
        else if (cell === P2) onSendColor(idx, P2_COLOR.r, P2_COLOR.g, P2_COLOR.b, 90);
        else onTurnOff(idx);
      }
    }
  }

  function makeMove(col: number) {
    if (phaseRef.current !== 'playing') return;
    if (mode === 'cpu' && currentPlayerRef.current === P2) return;

    const player = currentPlayerRef.current;
    const next = dropPiece(gridRef.current, col, player);
    if (!next) return;

    gridRef.current = next;
    setGrid(next.map(r => [...r]) as Grid);

    // Flash the column white then sync
    for (let r = 0; r < ROWS; r++) onSendColor(tileIdx(r, col), 255, 255, 255, 40);
    window.setTimeout(() => syncHardware(next), 100);

    const w = checkWin(next);
    if (w) {
      setWinner(w);
      setWinMsg(w === P1
        ? (mode === 'pvp' ? 'Joueur 1 gagne !' : 'Vous gagnez !')
        : (mode === 'pvp' ? 'Joueur 2 gagne !' : "L'IA gagne !"));
      phaseRef.current = 'finished';
      setPhase('finished');
      // Victory flash
      for (let i = 0; i < 6; i++) {
        const rgb = i % 2 === 0 ? P1_COLOR : P2_COLOR;
        window.setTimeout(() => {
          for (let j = 0; j < 42; j++) onSendColor(j, rgb.r, rgb.g, rgb.b, 65);
        }, i * 350);
      }
      // BUG FIX: reset all tiles to off after the flash sequence ends
      window.setTimeout(() => onTurnOffAll(), 6 * 350 + 100);
      return;
    }

    const isFull = next[0].every(c => c !== 0);
    if (isFull) {
      setWinMsg('Match nul !');
      phaseRef.current = 'finished';
      setPhase('finished');
      return;
    }

    const next_p = player === P1 ? P2 : P1;
    currentPlayerRef.current = next_p;
    setCurrentPlayer(next_p);

    if (mode === 'cpu' && next_p === P2) {
      window.setTimeout(() => { makeMove(cpuMove(gridRef.current)); }, 420);
    }
  }

  function startGame() {
    const g = emptyGrid();
    gridRef.current = g;
    currentPlayerRef.current = P1;
    phaseRef.current = 'playing';
    setGrid(emptyGrid());
    setCurrentPlayer(P1);
    setHoverCol(null);
    setWinner(null);
    setWinMsg('');
    setPhase('playing');
    onTurnOffAll();
  }

  // Keyboard
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (phaseRef.current !== 'playing') return;
    if (mode === 'cpu' && currentPlayerRef.current === P2) return;
    if (e.key === 'ArrowLeft')  setHoverCol(c => Math.max(0, (c ?? 2) - 1));
    if (e.key === 'ArrowRight') setHoverCol(c => Math.min(COLS - 1, (c ?? 2) + 1));
    if ((e.key === ' ' || e.key === 'Enter') && hoverCol !== null) {
      e.preventDefault();
      makeMove(hoverCol);
    }
  }, [hoverCol, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  useEffect(() => () => onTurnOffAll(), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onRegisterClickHandler?.((idx: number) => makeMove(idx % COLS));
    return () => { onRegisterClickHandler?.(null); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const playerCss = (p: Cell) => p === P1 ? P1_CSS : P2_CSS;
  const playerLabel = (p: Cell) => mode === 'pvp' ? `Joueur ${p}` : p === P1 ? 'Vous' : 'IA';

  /* ── READY ── */
  if (phase === 'ready') return (
    <div style={S.wrap}>
      <div style={S.readyRow}>
        <div style={{ flex: 1 }}>
          <span style={S.tag}>🔴 Puissance 4</span>
          <p style={S.rules}>
            Grille 7 lignes × 6 colonnes sur les 42 dalles.
            Alignez 4 couleurs pour gagner !
            <span style={{ color: 'rgba(255,255,255,.35)', marginLeft: 6 }}>← → Espace · Clic colonne</span>
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            {(['pvp', 'cpu'] as Mode[]).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: '7px 18px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 13,
                border: `1px solid ${mode === m ? '#4361ee' : 'rgba(255,255,255,.15)'}`,
                background: mode === m ? 'rgba(67,97,238,.22)' : 'rgba(255,255,255,.04)',
                color: mode === m ? '#a5b4fc' : 'rgba(255,255,255,.6)',
                transition: 'all .15s',
              }}>
                {m === 'pvp' ? '2 Joueurs' : 'vs IA'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <button onClick={startGame} style={S.playBtn}>Jouer</button>
          <button onClick={onQuit}    style={S.quitBtn}>Quitter</button>
        </div>
      </div>
    </div>
  );

  /* ── FINISHED ── */
  if (phase === 'finished') return (
    <div style={S.wrap}>
      <div style={S.finRow}>
        <div style={S.statGrid}>
          <div style={S.statCard}>
            <div style={S.statLbl}>Vainqueur</div>
            <div style={{ ...S.statVal, color: winner ? playerCss(winner) : '#94a3b8', fontSize: 15 }}>
              {winner ? playerLabel(winner) : 'Nul'}
            </div>
          </div>
          <div style={S.statCard}>
            <div style={S.statLbl}>Mode</div>
            <div style={{ ...S.statVal, fontSize: 15, color: '#e8eaf0' }}>{mode === 'pvp' ? '2P' : 'IA'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <button onClick={startGame}                         style={S.playBtn}>Rejouer</button>
          <button onClick={() => { onTurnOffAll(); onQuit(); }} style={S.quitBtn}>Menu</button>
        </div>
      </div>
    </div>
  );

  /* ── PLAYING ── */
  const curCss = playerCss(currentPlayer);

  return (
    <div style={{ ...S.wrap, userSelect: 'none' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px' }}>
        {/* Header bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 13, height: 13, borderRadius: '50%', background: curCss, boxShadow: `0 0 8px ${curCss}` }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: curCss }}>
              Tour de {playerLabel(currentPlayer)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>← → Espace</span>
            <button onClick={() => { onTurnOffAll(); onQuit(); }} style={S.stopBtn}>⏹</button>
          </div>
        </div>

        {/* Column drop buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 3 }}>
          {Array.from({ length: COLS }, (_, c) => (
            <button key={c}
              onMouseEnter={() => setHoverCol(c)}
              onMouseLeave={() => setHoverCol(null)}
              onClick={() => makeMove(c)}
              style={{
                height: 26, borderRadius: 6, border: '1px solid rgba(255,255,255,.06)', cursor: 'pointer',
                background: hoverCol === c ? curCss + '44' : 'rgba(255,255,255,.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
            >
              {hoverCol === c && (
                <div style={{ width: 11, height: 11, borderRadius: '50%', background: curCss, boxShadow: `0 0 6px ${curCss}` }} />
              )}
            </button>
          ))}
        </div>

        {/* Game grid — 7 rows × 6 cols */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
          gap: 4,
          background: 'rgba(255,255,255,.04)',
          border: '1px solid rgba(255,255,255,.08)',
          borderRadius: 12,
          padding: 6,
        }}>
          {grid.map((row, r) => row.map((cell, c) => {
            const isHoverCol = hoverCol === c;
            const cellCss = cell === P1 ? P1_CSS : cell === P2 ? P2_CSS : null;
            return (
              <div key={`${r}-${c}`}
                onClick={() => makeMove(c)}
                onMouseEnter={() => setHoverCol(c)}
                onMouseLeave={() => setHoverCol(null)}
                style={{
                  aspectRatio: '1',
                  borderRadius: '50%',
                  background: cellCss ?? (isHoverCol ? curCss + '18' : 'rgba(255,255,255,.06)'),
                  border: `2px solid ${isHoverCol && !cellCss ? curCss + '55' : cellCss ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.06)'}`,
                  boxShadow: cellCss ? `0 0 10px ${cellCss}77, inset 0 1px 0 rgba(255,255,255,.2)` : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              />
            );
          }))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', fontSize: 12, paddingTop: 2 }}>
          {([P1, P2] as Cell[]).map(p => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: playerCss(p), boxShadow: `0 0 5px ${playerCss(p)}` }} />
              <span style={{ color: playerCss(p), fontWeight: 600 }}>{playerLabel(p)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
