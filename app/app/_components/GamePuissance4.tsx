'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameTileProps } from './GameColorSpeed';

const ROWS = 6;
const COLS = 7;
const P1 = 1; const P2 = 2;
const P1_COLOR = { r: 255, g: 40,  b: 40  };
const P2_COLOR = { r: 40,  g: 80,  b: 255 };
const P1_CSS   = '#ff2828';
const P2_CSS   = '#2850ff';

type Cell = 0 | 1 | 2;
type Grid = Cell[][];
type Mode = 'pvp' | 'cpu';
type Phase = 'ready' | 'playing' | 'finished';

function emptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0) as Cell[]);
}

function dropPiece(grid: Grid, col: number, player: Cell): Grid | null {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (grid[row][col] === 0) {
      const next = grid.map(r => [...r]);
      next[row][col] = player;
      return next as Grid;
    }
  }
  return null;
}

function checkWin(grid: Grid): Cell | null {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (!cell) continue;
      for (const [dr, dc] of dirs) {
        let count = 1;
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k, nc = c + dc * k;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || grid[nr][nc] !== cell) break;
          count++;
        }
        if (count >= 4) return cell;
      }
    }
  }
  return null;
}

function cpuMove(grid: Grid): number {
  // 1. Win if possible
  for (let c = 0; c < COLS; c++) {
    const g = dropPiece(grid, c, P2);
    if (g && checkWin(g) === P2) return c;
  }
  // 2. Block opponent
  for (let c = 0; c < COLS; c++) {
    const g = dropPiece(grid, c, P1);
    if (g && checkWin(g) === P1) return c;
  }
  // 3. Center preference
  const preferred = [3, 2, 4, 1, 5, 0, 6];
  for (const c of preferred) {
    if (dropPiece(grid, c, P2)) return c;
  }
  return 0;
}

export default function GamePuissance4({ onSendColor, onTurnOff, onTurnOffAll, onQuit, tileCount = 42 }: GameTileProps) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [mode, setMode] = useState<Mode>('pvp');
  const [grid, setGrid] = useState<Grid>(emptyGrid());
  const [currentPlayer, setCurrentPlayer] = useState<Cell>(P1);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [winner, setWinner] = useState<Cell | null>(null);
  const [winMsg, setWinMsg] = useState('');
  const gridRef = useRef<Grid>(emptyGrid());
  const currentPlayerRef = useRef<Cell>(P1);

  function tileIdx(row: number, col: number): number {
    return row * COLS + col;
  }

  function syncTilesToHardware(g: Grid) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = tileIdx(r, c);
        if (idx >= 42) continue;
        const cell = g[r][c];
        if (cell === P1) onSendColor(idx, P1_COLOR.r, P1_COLOR.g, P1_COLOR.b, 85);
        else if (cell === P2) onSendColor(idx, P2_COLOR.r, P2_COLOR.g, P2_COLOR.b, 85);
        else onTurnOff(idx);
      }
    }
  }

  function animateDrop(col: number, finalGrid: Grid) {
    for (let r = 0; r < ROWS; r++) {
      const idx = tileIdx(r, col);
      if (idx >= 42) continue;
      onSendColor(idx, 255, 255, 255, 50);
    }
    window.setTimeout(() => syncTilesToHardware(finalGrid), 80);
  }

  function makeMove(col: number) {
    const player = currentPlayerRef.current;
    const next = dropPiece(gridRef.current, col, player);
    if (!next) return; // column full

    gridRef.current = next;
    setGrid([...next.map(r => [...r])] as Grid);
    animateDrop(col, next);

    const w = checkWin(next);
    if (w) {
      setWinner(w);
      setWinMsg(w === P1 ? (mode === 'pvp' ? '🎉 Joueur 1 gagne !' : '🎉 Vous gagnez !') : (mode === 'pvp' ? '🎉 Joueur 2 gagne !' : '🤖 L\'IA gagne !'));
      setPhase('finished');
      // Victory animation
      for (let i = 0; i < 6; i++) {
        window.setTimeout(() => {
          const rgb = i % 2 === 0 ? P1_COLOR : P2_COLOR;
          for (let j = 0; j < 42; j++) onSendColor(j, rgb.r, rgb.g, rgb.b, 60);
        }, i * 400);
      }
      return;
    }
    // Check draw
    const isFull = next[0].every(c => c !== 0);
    if (isFull) {
      setWinMsg('Match nul !');
      setPhase('finished');
      return;
    }

    const nextPlayer = player === P1 ? P2 : P1;
    currentPlayerRef.current = nextPlayer;
    setCurrentPlayer(nextPlayer);

    if (mode === 'cpu' && nextPlayer === P2) {
      window.setTimeout(() => {
        const cpuCol = cpuMove(gridRef.current);
        makeMove(cpuCol);
      }, 400);
    }
  }

  function startGame() {
    const g = emptyGrid();
    gridRef.current = g;
    currentPlayerRef.current = P1;
    setGrid(emptyGrid());
    setCurrentPlayer(P1);
    setHoverCol(null);
    setWinner(null);
    setWinMsg('');
    setPhase('playing');
    onTurnOffAll();
  }

  // Keyboard controls
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (phase !== 'playing') return;
    if (mode === 'cpu' && currentPlayerRef.current === P2) return;
    if (e.key === 'ArrowLeft')  setHoverCol(c => Math.max(0, (c ?? 3) - 1));
    if (e.key === 'ArrowRight') setHoverCol(c => Math.min(COLS - 1, (c ?? 3) + 1));
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (hoverCol !== null) makeMove(hoverCol);
    }
  }, [phase, hoverCol, mode]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  useEffect(() => { return () => onTurnOffAll(); }, []);

  const playerColor = (p: Cell) => p === P1 ? P1_CSS : P2_CSS;
  const playerLabel = (p: Cell) => mode === 'pvp' ? `Joueur ${p}` : p === P1 ? 'Vous' : 'IA';

  if (phase === 'ready') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 40, color: '#e8eaf0' }}>
      <div style={{ fontSize: 48 }}>🔴🔵</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#e8eaf0' }}>Puissance 4 Chromatique</h2>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', maxWidth: 400, lineHeight: 1.6 }}>
        Grille 6×7 sur les dalles Lumen. Alignez 4 couleurs !<br />
        <strong>Flèches</strong> pour choisir la colonne, <strong>Espace</strong> pour valider.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        {(['pvp', 'cpu'] as Mode[]).map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{ padding: '10px 22px', borderRadius: 10, border: `2px solid ${mode === m ? '#4361ee' : 'rgba(255,255,255,0.15)'}`, background: mode === m ? 'rgba(67,97,238,0.18)' : 'rgba(255,255,255,0.05)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {m === 'pvp' ? '2 Joueurs' : 'vs IA'}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={startGame} style={{ padding: '14px 36px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#ff2828,#2850ff)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>Jouer</button>
        <button onClick={onQuit} style={{ padding: '14px 24px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Quitter</button>
      </div>
    </div>
  );

  if (phase === 'finished') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 40, color: '#e8eaf0' }}>
      <div style={{ fontSize: 48 }}>{winner ? '🏆' : '🤝'}</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#e8eaf0' }}>{winMsg}</h2>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={startGame} style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#ff2828,#2850ff)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Rejouer</button>
        <button onClick={onQuit} style={{ padding: '12px 20px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Menu</button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 20px', color: '#e8eaf0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: playerColor(currentPlayer) }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: playerColor(currentPlayer) }}>Tour de {playerLabel(currentPlayer)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>←→ Espace</span>
          <button onClick={() => { onTurnOffAll(); onQuit(); }} style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' }}>⏹</button>
        </div>
      </div>

      {/* Column headers / drop indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 4 }}>
        {Array.from({ length: COLS }, (_, c) => (
          <button key={c}
            onMouseEnter={() => setHoverCol(c)}
            onMouseLeave={() => setHoverCol(null)}
            onClick={() => makeMove(c)}
            style={{ height: 28, borderRadius: 6, border: 'none', background: hoverCol === c ? playerColor(currentPlayer) + '44' : 'rgba(255,255,255,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {hoverCol === c && <div style={{ width: 12, height: 12, borderRadius: '50%', background: playerColor(currentPlayer) }} />}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 4 }}>
        {grid.map((row, r) => row.map((cell, c) => (
          <div key={`${r}-${c}`}
            onClick={() => makeMove(c)}
            style={{
              aspectRatio: '1',
              borderRadius: '50%',
              background: cell === P1 ? P1_CSS : cell === P2 ? P2_CSS : 'rgba(255,255,255,0.07)',
              border: `2px solid ${hoverCol === c ? playerColor(currentPlayer) + '55' : 'rgba(255,255,255,0.08)'}`,
              cursor: 'pointer',
              boxShadow: cell ? `0 0 10px ${cell === P1 ? P1_CSS : P2_CSS}66` : 'none',
              transition: 'background 0.15s',
            }}
          />
        )))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: P1_CSS }} />
          <span style={{ color: P1_CSS }}>{playerLabel(P1)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: P2_CSS }} />
          <span style={{ color: P2_CSS }}>{playerLabel(P2)}</span>
        </div>
      </div>
    </div>
  );
}
