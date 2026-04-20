'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Tetromino definitions ────────────────────────────────────────
const PIECES: { shape: number[][]; color: string; name: string }[] = [
  { name: 'I', color: '#00d7ff', shape: [[1, 1, 1, 1]] },
  { name: 'O', color: '#ffdd00', shape: [[1, 1], [1, 1]] },
  { name: 'T', color: '#b829dd', shape: [[0, 1, 0], [1, 1, 1]] },
  { name: 'S', color: '#22c55e', shape: [[0, 1, 1], [1, 1, 0]] },
  { name: 'Z', color: '#ef4444', shape: [[1, 1, 0], [0, 1, 1]] },
  { name: 'L', color: '#ff8c00', shape: [[1, 0], [1, 0], [1, 1]] },
  { name: 'J', color: '#4361ee', shape: [[0, 1], [0, 1], [1, 1]] },
];

const COLS = 6;
const ROWS = 12;

type Piece = { shape: number[][]; color: string; x: number; y: number };
type Cell = string | null;
type Grid = Cell[][];

function emptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece(): Piece {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  const w = p.shape[0].length;
  return { shape: p.shape, color: p.color, x: Math.floor((COLS - w) / 2), y: 0 };
}

function rotateCW(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const out: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) out[c][rows - 1 - r] = shape[r][c];
  return out;
}

function collides(grid: Grid, piece: Piece): boolean {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      const gx = piece.x + c;
      const gy = piece.y + r;
      if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
      if (gy >= 0 && grid[gy][gx] !== null) return true;
    }
  }
  return false;
}

function lockPiece(grid: Grid, piece: Piece): Grid {
  const next = grid.map((row) => [...row]);
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      const gx = piece.x + c;
      const gy = piece.y + r;
      if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
        next[gy][gx] = piece.color;
      }
    }
  }
  return next;
}

function clearLines(grid: Grid): { grid: Grid; cleared: number } {
  const kept = grid.filter((row) => row.some((c) => c === null));
  const cleared = ROWS - kept.length;
  while (kept.length < ROWS) kept.unshift(Array(COLS).fill(null));
  return { grid: kept, cleared };
}

// ─── Component ────────────────────────────────────────────────────
export type TetrisParams = {
  speed?: number;         // initial drop interval ms (default 500)
  bgColor?: string;       // grid bg color
  borderColor?: string;   // border color
};

export type TetrisSnapshot = {
  grid: Grid;
  piece: Piece | null;
  score: number;
  gameOver: boolean;
};

export default function TetrisGame({
  params,
  isPlaying,
  onSnapshot,
}: {
  params?: TetrisParams;
  isPlaying: boolean;
  onSnapshot?: (snap: TetrisSnapshot) => void;
}) {
  const baseSpeed = params?.speed ?? 500;
  const bgColor = params?.bgColor ?? '#0a0a0f';
  const borderColor = params?.borderColor ?? '#222233';

  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [piece, setPiece] = useState<Piece | null>(null);
  const [nextPiece, setNextPiece] = useState<Piece>(randomPiece);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const gridRef = useRef(grid);
  gridRef.current = grid;
  const pieceRef = useRef(piece);
  pieceRef.current = piece;
  const gameOverRef = useRef(gameOver);
  gameOverRef.current = gameOver;
  const nextPieceRef = useRef(nextPiece);
  nextPieceRef.current = nextPiece;

  // Notify parent of state changes
  useEffect(() => {
    onSnapshot?.({ grid, piece, score, gameOver });
  }, [grid, piece, score, gameOver]);

  const level = Math.floor(lines / 5);
  const dropInterval = Math.max(80, baseSpeed - level * 40);

  const spawnNew = useCallback(() => {
    const np = nextPieceRef.current;
    const spawned: Piece = { ...np, x: Math.floor((COLS - np.shape[0].length) / 2), y: 0 };
    if (collides(gridRef.current, spawned)) {
      setGameOver(true);
      return;
    }
    setPiece(spawned);
    setNextPiece(randomPiece());
  }, []);

  const moveDown = useCallback(() => {
    const p = pieceRef.current;
    if (!p || gameOverRef.current) return;
    const moved = { ...p, y: p.y + 1 };
    if (collides(gridRef.current, moved)) {
      // Lock
      const locked = lockPiece(gridRef.current, p);
      const { grid: cleared, cleared: n } = clearLines(locked);
      setGrid(cleared);
      if (n > 0) {
        const pts = n === 1 ? 100 : n === 2 ? 300 : n === 3 ? 500 : 800;
        setScore((s) => s + pts);
        setLines((l) => l + n);
      }
      setPiece(null);
      setTimeout(() => spawnNew(), 50);
    } else {
      setPiece(moved);
    }
  }, [spawnNew]);

  const moveHorizontal = useCallback((dx: number) => {
    const p = pieceRef.current;
    if (!p || gameOverRef.current) return;
    const moved = { ...p, x: p.x + dx };
    if (!collides(gridRef.current, moved)) setPiece(moved);
  }, []);

  const rotate = useCallback(() => {
    const p = pieceRef.current;
    if (!p || gameOverRef.current) return;
    const rotated = { ...p, shape: rotateCW(p.shape) };
    if (!collides(gridRef.current, rotated)) {
      setPiece(rotated);
    } else {
      // Wall kick attempts
      for (const kick of [-1, 1, -2, 2]) {
        const kicked = { ...rotated, x: rotated.x + kick };
        if (!collides(gridRef.current, kicked)) { setPiece(kicked); return; }
      }
    }
  }, []);

  const hardDrop = useCallback(() => {
    const p = pieceRef.current;
    if (!p || gameOverRef.current) return;
    let y = p.y;
    while (!collides(gridRef.current, { ...p, y: y + 1 })) y++;
    const dropped = { ...p, y };
    const locked = lockPiece(gridRef.current, dropped);
    const { grid: cleared, cleared: n } = clearLines(locked);
    setGrid(cleared);
    if (n > 0) {
      const pts = n === 1 ? 100 : n === 2 ? 300 : n === 3 ? 500 : 800;
      setScore((s) => s + pts);
      setLines((l) => l + n);
    }
    setPiece(null);
    setTimeout(() => spawnNew(), 50);
  }, [spawnNew]);

  const restart = useCallback(() => {
    setGrid(emptyGrid());
    setPiece(null);
    setNextPiece(randomPiece());
    setScore(0);
    setLines(0);
    setGameOver(false);
    setStarted(false);
  }, []);

  // Start game
  useEffect(() => {
    if (isPlaying && !started && !gameOver) {
      setStarted(true);
      spawnNew();
    }
  }, [isPlaying, started, gameOver, spawnNew]);

  // Gravity tick
  useEffect(() => {
    if (!isPlaying || gameOver || !piece) return;
    const timer = setInterval(moveDown, dropInterval);
    return () => clearInterval(timer);
  }, [isPlaying, gameOver, piece, dropInterval, moveDown]);

  // Keyboard controls
  useEffect(() => {
    if (!isPlaying) return;
    const onKey = (e: KeyboardEvent) => {
      if (gameOverRef.current) return;
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); moveHorizontal(-1); break;
        case 'ArrowRight': e.preventDefault(); moveHorizontal(1); break;
        case 'ArrowDown': e.preventDefault(); moveDown(); break;
        case 'ArrowUp': e.preventDefault(); rotate(); break;
        case ' ': e.preventDefault(); hardDrop(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPlaying, moveHorizontal, moveDown, rotate, hardDrop]);

  // Ghost piece (drop preview)
  const ghost: Piece | null = piece ? (() => {
    let y = piece.y;
    while (!collides(grid, { ...piece, y: y + 1 })) y++;
    return { ...piece, y };
  })() : null;

  // Render merged grid for display
  const displayGrid: Cell[][] = grid.map((row) => [...row]);
  if (ghost) {
    for (let r = 0; r < ghost.shape.length; r++)
      for (let c = 0; c < ghost.shape[r].length; c++) {
        if (!ghost.shape[r][c]) continue;
        const gx = ghost.x + c;
        const gy = ghost.y + r;
        if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS && !displayGrid[gy][gx])
          displayGrid[gy][gx] = ghost.color + '30'; // transparent ghost
      }
  }
  if (piece) {
    for (let r = 0; r < piece.shape.length; r++)
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        const gx = piece.x + c;
        const gy = piece.y + r;
        if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS)
          displayGrid[gy][gx] = piece.color;
      }
  }

  // Next piece preview
  const nextShape = nextPiece.shape;

  const CELL = 28;
  const GAP = 2;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      padding: 16, height: '100%', fontFamily: 'system-ui, sans-serif',
      background: 'linear-gradient(135deg, #0a0a12 0%, #12121e 100%)',
      borderRadius: 12, overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', justifyContent: 'center' }}>
        <div style={{
          background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</span>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{score}</span>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lignes</span>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{lines}</span>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 12px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Niv.</span>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#4361ee', fontVariantNumeric: 'tabular-nums' }}>{level + 1}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
          gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`,
          gap: GAP,
          background: bgColor,
          border: `2px solid ${borderColor}`,
          borderRadius: 8,
          padding: 4,
          position: 'relative',
        }}>
          {displayGrid.flat().map((cell, i) => {
            const isGhost = cell && cell.length > 7; // has alpha suffix
            const baseColor = cell ? cell.slice(0, 7) : null;
            return (
              <div
                key={i}
                style={{
                  width: CELL, height: CELL,
                  borderRadius: 4,
                  background: baseColor
                    ? isGhost
                      ? `${baseColor}22`
                      : baseColor
                    : 'rgba(255,255,255,0.03)',
                  border: baseColor && !isGhost
                    ? `1px solid rgba(255,255,255,0.15)`
                    : isGhost
                      ? `1px dashed rgba(255,255,255,0.1)`
                      : '1px solid rgba(255,255,255,0.04)',
                  boxShadow: baseColor && !isGhost
                    ? `inset 0 1px 0 rgba(255,255,255,0.2), 0 0 8px ${baseColor}44`
                    : 'none',
                  transition: 'background 0.08s, box-shadow 0.08s',
                }}
              />
            );
          })}

          {/* Game Over Overlay */}
          {gameOver && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)',
              display: 'grid', placeItems: 'center', borderRadius: 6, zIndex: 10,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#ef4444', marginBottom: 8 }}>GAME OVER</div>
                <div style={{ fontSize: 14, color: '#fff', marginBottom: 12 }}>Score: {score}</div>
                <button
                  onClick={restart}
                  style={{
                    background: '#4361ee', color: '#fff', border: 'none', borderRadius: 8,
                    padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Rejouer
                </button>
              </div>
            </div>
          )}

          {/* Not playing overlay */}
          {!isPlaying && !gameOver && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
              display: 'grid', placeItems: 'center', borderRadius: 6, zIndex: 10,
            }}>
              <div style={{ textAlign: 'center', color: '#fff' }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Tetris Lumiere</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Appuie sur Play pour commencer</div>
              </div>
            </div>
          )}
        </div>

        {/* Side panel: next piece + controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 90 }}>
          {/* Next piece */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 10, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Suivant</span>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${nextShape[0].length}, 18px)`,
              gridTemplateRows: `repeat(${nextShape.length}, 18px)`,
              gap: 2,
            }}>
              {nextShape.flat().map((v, i) => (
                <div key={i} style={{
                  width: 18, height: 18, borderRadius: 3,
                  background: v ? nextPiece.color : 'rgba(255,255,255,0.04)',
                  border: v ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
                  boxShadow: v ? `0 0 6px ${nextPiece.color}44` : 'none',
                }} />
              ))}
            </div>
          </div>

          {/* Controls */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12,
            display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center',
          }}>
            <span style={{ fontSize: 10, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Controles</span>
            
            {/* Rotate */}
            <button onClick={rotate} style={btnStyle}>
              <span style={{ fontSize: 16 }}>↻</span>
            </button>

            {/* Left / Down / Right */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => moveHorizontal(-1)} style={btnStyle}>
                <span style={{ fontSize: 14 }}>◀</span>
              </button>
              <button onClick={moveDown} style={btnStyle}>
                <span style={{ fontSize: 14 }}>▼</span>
              </button>
              <button onClick={() => moveHorizontal(1)} style={btnStyle}>
                <span style={{ fontSize: 14 }}>▶</span>
              </button>
            </div>

            {/* Hard drop */}
            <button onClick={hardDrop} style={{ ...btnStyle, width: '100%', fontSize: 11, fontWeight: 700 }}>
              ⤓ Drop
            </button>

            {/* Restart */}
            <button onClick={restart} style={{ ...btnStyle, width: '100%', fontSize: 11, fontWeight: 700, marginTop: 4, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
              Restart
            </button>
          </div>

          {/* Keyboard hints */}
          <div style={{ fontSize: 9, color: '#555', lineHeight: 1.6, textAlign: 'center' }}>
            ← → Deplacer<br />
            ↑ Tourner<br />
            ↓ Descendre<br />
            Espace Drop
          </div>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: 36, height: 36,
  display: 'grid', placeItems: 'center',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  transition: 'background 0.15s',
};
