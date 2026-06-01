'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RotateCcw, Trophy } from 'lucide-react';
import TouchControls, { type TouchKey } from './TouchControls';
import type { GameTileProps } from './GameColorSpeed';

// Snake « lumière » sur les 42 dalles (6 colonnes × 7 lignes).
// Tourne sur les plaques physiques via onSendColor (API supervision), au clavier
// (flèches) et avec un D-pad tactile pour tablette / mobile.
const COLS = 6;
const ROWS = 7;
const CELLS = COLS * ROWS;

type Pt = { x: number; y: number };
type Dir = 'up' | 'down' | 'left' | 'right';

const DELTA: Record<Dir, Pt> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPP: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const idxOf = (p: Pt) => p.y * COLS + p.x;

const HEAD = { r: 60, g: 255, b: 150 };
const BODY = { r: 22, g: 175, b: 90 };
const FOOD = { r: 255, g: 45, b: 45 };

const SNAKE_TOUCH: TouchKey[] = [
  { key: 'ArrowUp',    slot: 'up',    label: <ChevronUp size={22} /> },
  { key: 'ArrowLeft',  slot: 'left',  label: <ChevronLeft size={22} /> },
  { key: 'ArrowRight', slot: 'right', label: <ChevronRight size={22} /> },
  { key: 'ArrowDown',  slot: 'down',  label: <ChevronDown size={22} /> },
];

type SnakeState = { snake: Pt[]; dir: Dir; nextDir: Dir; food: Pt; over: boolean; score: number };

function spawnFood(snake: Pt[]): Pt {
  const occ = new Set(snake.map(idxOf));
  const free: Pt[] = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!occ.has(y * COLS + x)) free.push({ x, y });
  }
  if (!free.length) return { x: 0, y: 0 };
  return free[Math.floor(Math.random() * free.length)];
}

function freshState(): SnakeState {
  const snake: Pt[] = [{ x: 2, y: 3 }, { x: 1, y: 3 }];
  return { snake, dir: 'right', nextDir: 'right', food: spawnFood(snake), over: false, score: 0 };
}

export default function SnakeGame({
  onSendColor, onTurnOff, onTurnOffAll, onQuit, speed = 350, onComplete,
}: GameTileProps & { speed?: number }) {
  const gs = useRef<SnakeState>(freshState());
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => (t + 1) % 1_000_000), []);

  // Pousse l'état courant sur les dalles physiques
  const draw = useCallback(() => {
    const s = gs.current;
    const colors = new Map<number, { r: number; g: number; b: number }>();
    s.snake.forEach((p, i) => colors.set(idxOf(p), i === 0 ? HEAD : BODY));
    colors.set(idxOf(s.food), FOOD);
    for (let i = 0; i < CELLS; i++) {
      const c = colors.get(i);
      if (c) onSendColor(i, c.r, c.g, c.b, 85);
      else onTurnOff(i);
    }
  }, [onSendColor, onTurnOff]);

  const restart = useCallback(() => { gs.current = freshState(); draw(); rerender(); }, [draw, rerender]);

  // Boucle de jeu
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = gs.current;
      if (s.over) return;
      if (s.nextDir !== OPP[s.dir]) s.dir = s.nextDir;
      const head = s.snake[0];
      const nx = { x: head.x + DELTA[s.dir].x, y: head.y + DELTA[s.dir].y };
      if (nx.x < 0 || nx.x >= COLS || nx.y < 0 || nx.y >= ROWS) { s.over = true; onCompleteRef.current?.(s.score); rerender(); return; }
      const willEat = nx.x === s.food.x && nx.y === s.food.y;
      const body = willEat ? s.snake : s.snake.slice(0, -1);   // la queue libère sa case sauf si on grandit
      if (body.some((p) => p.x === nx.x && p.y === nx.y)) { s.over = true; onCompleteRef.current?.(s.score); rerender(); return; }
      s.snake = [nx, ...(willEat ? s.snake : s.snake.slice(0, -1))];
      if (willEat) { s.score += 10; s.food = spawnFood(s.snake); }
      draw();
      rerender();
    }, Math.max(80, speed));
    return () => window.clearInterval(id);
  }, [speed, draw, rerender]);

  // Clavier (flèches) — change de direction, interdit le demi-tour
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = gs.current;
      const map: Record<string, Dir | undefined> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      const d = map[e.key];
      if (d) { e.preventDefault(); if (d !== OPP[s.dir]) s.nextDir = d; return; }
      if ((e.key === 'Enter' || e.key === ' ') && s.over) { e.preventDefault(); restart(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [restart]);

  // Dessin initial + extinction des dalles à la sortie
  useEffect(() => {
    draw();
    return () => onTurnOffAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = gs.current;
  const cellColor = (x: number, y: number): string => {
    const i = s.snake.findIndex((p) => p.x === x && p.y === y);
    if (i === 0) return `rgb(${HEAD.r},${HEAD.g},${HEAD.b})`;
    if (i > 0) return `rgb(${BODY.r},${BODY.g},${BODY.b})`;
    if (s.food.x === x && s.food.y === y) return `rgb(${FOOD.r},${FOOD.g},${FOOD.b})`;
    return '#e8edf4';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, fontFamily: 'inherit', padding: 16, background: '#fff', borderRadius: 16, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 320 }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8' }}>Snake Lumière</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 900, color: '#16a34a' }}><Trophy size={15} /> {s.score}</span>
      </div>

      {/* Grille (miroir des dalles) */}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 34px)`, gridTemplateRows: `repeat(${ROWS}, 34px)`, gap: 5, background: '#f1f5f9', border: '2px solid #e2e8f0', borderRadius: 12, padding: 7 }}>
          {Array.from({ length: CELLS }, (_, i) => {
            const x = i % COLS, y = Math.floor(i / COLS);
            const col = cellColor(x, y);
            const lit = col !== '#e8edf4';
            return <div key={i} style={{ width: 34, height: 34, borderRadius: 8, background: col, border: lit ? '2px solid rgba(255,255,255,0.6)' : '2px solid #dde3ec', boxShadow: lit ? `0 2px 8px ${col}66` : 'none', transition: 'background 0.06s' }} />;
          })}
        </div>
        {s.over && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(15,18,28,0.78)', borderRadius: 12, color: '#fff' }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Perdu !</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Score : {s.score}</div>
            <button onClick={restart} style={{ marginTop: 4, padding: '9px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 14, color: '#fff', background: 'linear-gradient(135deg,#16a34a,#06d6a0)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <RotateCcw size={15} /> Rejouer
            </button>
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Flèches pour diriger · Entrée pour rejouer</div>

      {/* D-pad tactile (tablette / mobile) */}
      <TouchControls keys={SNAKE_TOUCH} />

      {onQuit && (
        <button onClick={() => { onTurnOffAll(); onQuit(); }} style={{ padding: '7px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(0,0,0,0.03)', color: '#64748b', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Quitter</button>
      )}
    </div>
  );
}
