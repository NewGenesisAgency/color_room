'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RotateCcw, Trophy, Zap } from 'lucide-react';
import TouchControls, { type TouchKey } from './TouchControls';
import type { GameTileProps } from './GameColorSpeed';
import { DIFF_LABELS, type DifficultyLevel } from './GameColorSpeed';

// ── Snake Chromatique — 42 dalles (6 col × 7 row) ───────────────────────────
// Le serpent traverse les deux salles (gauche + droite).
// Chaque nourriture a une longueur d'onde spectrale différente.
// Manger une nourriture flash la couleur du serpent vers cette longueur d'onde.
// La vitesse augmente à chaque niveau (toutes les 5 bouches mangées).

const COLS = 6;
const ROWS = 7;
const CELLS = COLS * ROWS;

type Pt  = { x: number; y: number };
type Dir = 'up' | 'down' | 'left' | 'right';

const DELTA: Record<Dir, Pt> = {
  up:    { x:  0, y: -1 },
  down:  { x:  0, y:  1 },
  left:  { x: -1, y:  0 },
  right: { x:  1, y:  0 },
};
const OPP: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const cellIdx = (p: Pt) => p.y * COLS + p.x;

// Nourritures spectrales : longueur d'onde, couleur LED, points
const FOODS = [
  { nm: 404, label: 'Violet',      r:  90, g:   0, b: 160, pts: 50 },
  { nm: 441, label: 'Bleu-violet', r:  40, g:   0, b: 220, pts: 45 },
  { nm: 470, label: 'Bleu',        r:   0, g:  60, b: 255, pts: 40 },
  { nm: 499, label: 'Cyan',        r:   0, g: 180, b: 220, pts: 35 },
  { nm: 523, label: 'Vert',        r:   0, g: 220, b:  80, pts: 30 },
  { nm: 541, label: 'Jaune-vert',  r: 120, g: 255, b:   0, pts: 25 },
  { nm: 593, label: 'Orange',      r: 255, g: 140, b:   0, pts: 20 },
  { nm: 620, label: 'Rouge',       r: 240, g:  20, b:   0, pts: 15 },
  { nm: 658, label: 'Rouge pr.',   r: 180, g:   0, b:  20, pts: 10 },
  { nm: 698, label: 'Bordeaux',    r: 120, g:   0, b:  10, pts:  8 },
] as const;
type FoodType = typeof FOODS[number];

// Couleurs du serpent selon le niveau
const LEVEL_CLR = [
  { head: { r:  60, g: 255, b: 150 }, body: { r:  20, g: 180, b: 100 } },
  { head: { r:   0, g: 200, b: 255 }, body: { r:   0, g: 140, b: 200 } },
  { head: { r:  80, g:  80, b: 255 }, body: { r:  50, g:  50, b: 200 } },
  { head: { r: 180, g:   0, b: 255 }, body: { r: 120, g:   0, b: 180 } },
  { head: { r: 255, g: 220, b:   0 }, body: { r: 200, g: 160, b:   0 } },
  { head: { r: 255, g: 100, b:   0 }, body: { r: 200, g:  60, b:   0 } },
  { head: { r: 255, g:   0, b:  80 }, body: { r: 200, g:   0, b:  60 } },
  { head: { r: 255, g: 255, b: 255 }, body: { r: 180, g: 180, b: 180 } },
];
const SNAKE_DIFF = {
  facile:    { baseSpeed: 900,  minSpeed: 200, eatPerLevel: 7 },
  moyen:     { baseSpeed: 700,  minSpeed: 120, eatPerLevel: 5 },
  difficile: { baseSpeed: 500,  minSpeed: 100, eatPerLevel: 4 },
  expert:    { baseSpeed: 350,  minSpeed: 80,  eatPerLevel: 3 },
} satisfies Record<DifficultyLevel, { baseSpeed: number; minSpeed: number; eatPerLevel: number }>;

const getLevelClr = (l: number) => LEVEL_CLR[Math.min(l - 1, LEVEL_CLR.length - 1)];
const speedMs = (l: number, cfg: typeof SNAKE_DIFF[DifficultyLevel]) => Math.max(cfg.minSpeed, cfg.baseSpeed - (l - 1) * 60);
const foodCount = (l: number) => Math.min(2 + Math.floor((l - 1) / 2), 5);

function pickFood(): FoodType {
  const total = FOODS.reduce((s, f) => s + (101 - f.pts), 0);
  let r = Math.random() * total;
  for (const f of FOODS) { r -= (101 - f.pts); if (r <= 0) return f; }
  return FOODS[FOODS.length - 1];
}

function spawnPos(snake: Pt[], others: Pt[]): Pt {
  const occ = new Set([...snake, ...others].map(cellIdx));
  const free: Pt[] = [];
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if (!occ.has(y * COLS + x)) free.push({ x, y });
  if (!free.length) return snake[0];
  return free[Math.floor(Math.random() * free.length)];
}

type Food = { pos: Pt; type: FoodType };
type GS = {
  snake: Pt[]; dir: Dir; nextDir: Dir; foods: Food[];
  over: boolean; score: number; level: number; eaten: number;
  flash: number; flashTick: number;
};

function makeFoods(snake: Pt[], level: number): Food[] {
  const foods: Food[] = [];
  for (let i = 0; i < foodCount(level); i++)
    foods.push({ pos: spawnPos(snake, foods.map(f => f.pos)), type: pickFood() });
  return foods;
}

function fresh(): GS {
  const snake: Pt[] = [{ x: 2, y: 3 }, { x: 1, y: 3 }];
  return { snake, dir: 'right', nextDir: 'right', foods: makeFoods(snake, 1),
    over: false, score: 0, level: 1, eaten: 0, flash: -1, flashTick: 0 };
}

const TOUCH_KEYS: TouchKey[] = [
  { key: 'ArrowUp',    slot: 'up',    label: <ChevronUp size={22} /> },
  { key: 'ArrowLeft',  slot: 'left',  label: <ChevronLeft size={22} />, repeat: true },
  { key: 'ArrowRight', slot: 'right', label: <ChevronRight size={22} />, repeat: true },
  { key: 'ArrowDown',  slot: 'down',  label: <ChevronDown size={22} />, repeat: true },
];

export default function SnakeGame({ onSendColor, onTurnOff, onTurnOffAll, onQuit, onComplete, onScoreDelta, difficulty = 'moyen' }: GameTileProps) {
  const cfg = SNAKE_DIFF[difficulty];
  const gs = useRef<GS>(fresh());
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onScoreDeltaRef = useRef(onScoreDelta);
  onScoreDeltaRef.current = onScoreDelta;
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick(t => (t + 1) % 1_000_000), []);

  const draw = useCallback((s: GS) => {
    const lc = getLevelClr(s.level);
    const flashFood = s.flash >= 0 ? FOODS[s.flash] : null;
    const headClr  = flashFood ?? lc.head;
    const bodyBase = flashFood ?? lc.body;
    const snakeSet = new Set(s.snake.map(cellIdx));
    const foodMap  = new Map<number, Food>();
    s.foods.forEach(f => { if (!snakeSet.has(cellIdx(f.pos))) foodMap.set(cellIdx(f.pos), f); });

    for (let i = 0; i < CELLS; i++) {
      const si = s.snake.findIndex(p => cellIdx(p) === i);
      if (si === 0) { onSendColor(i, headClr.r, headClr.g, headClr.b, 90); continue; }
      if (si > 0) {
        const fade = Math.max(0.3, 1 - si * 0.04);
        onSendColor(i,
          Math.round(bodyBase.r * fade), Math.round(bodyBase.g * fade), Math.round(bodyBase.b * fade),
          Math.round(70 * fade));
        continue;
      }
      const fd = foodMap.get(i);
      if (fd) { onSendColor(i, fd.type.r, fd.type.g, fd.type.b, 85); continue; }
      onTurnOff(i);
    }
  }, [onSendColor, onTurnOff]);

  const restart = useCallback(() => { gs.current = fresh(); draw(gs.current); rerender(); }, [draw, rerender]);

  // Boucle principale — redémarre quand le niveau change
  useEffect(() => {
    const s = gs.current;
    if (s.over) return;
    const id = window.setInterval(() => {
      const s = gs.current;
      if (s.over) return;
      if (s.flash >= 0) { s.flashTick--; if (s.flashTick <= 0) s.flash = -1; draw(s); rerender(); return; }
      if (s.nextDir !== OPP[s.dir]) s.dir = s.nextDir;
      const h = s.snake[0];
      const nx: Pt = { x: h.x + DELTA[s.dir].x, y: h.y + DELTA[s.dir].y };
      if (nx.x < 0 || nx.x >= COLS || nx.y < 0 || nx.y >= ROWS) {
        s.over = true; draw(s); rerender(); onScoreDeltaRef.current?.(-20, 'Game over −20'); onCompleteRef.current?.(0); return;
      }
      const fi = s.foods.findIndex(f => f.pos.x === nx.x && f.pos.y === nx.y);
      const eating = fi >= 0;
      const checkBody = eating ? s.snake : s.snake.slice(0, -1);
      if (checkBody.some(p => p.x === nx.x && p.y === nx.y)) {
        s.over = true; draw(s); rerender(); onScoreDeltaRef.current?.(-20, 'Game over −20'); onCompleteRef.current?.(0); return;
      }
      s.snake = [nx, ...(eating ? s.snake : s.snake.slice(0, -1))];
      if (eating) {
        const ate = s.foods[fi];
        s.score += ate.type.pts;
        onScoreDeltaRef.current?.(ate.type.pts, `${ate.type.nm}nm +${ate.type.pts}`);
        s.eaten++;
        s.level = Math.floor(s.eaten / cfg.eatPerLevel) + 1;
        s.flash = FOODS.indexOf(ate.type);
        s.flashTick = 3;
        s.foods = s.foods.filter((_, i) => i !== fi);
        const cnt = foodCount(s.level);
        while (s.foods.length < cnt)
          s.foods.push({ pos: spawnPos(s.snake, s.foods.map(f => f.pos)), type: pickFood() });
      }
      draw(s); rerender();
    }, speedMs(s.level, cfg));
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.current.level, gs.current.over, draw, rerender]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = gs.current;
      const map: Record<string, Dir | undefined> = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' };
      const d = map[e.key];
      if (d) { e.preventDefault(); if (d !== OPP[s.dir]) s.nextDir = d; return; }
      if ((e.key === 'Enter' || e.key === ' ') && s.over) { e.preventDefault(); restart(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [restart]);

  useEffect(() => { draw(gs.current); return () => onTurnOffAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const s  = gs.current;
  const lc = getLevelClr(s.level);

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:'18px 14px', fontFamily:'system-ui,sans-serif', background:'#0b0f1c', color:'#e8eaf0', minHeight:'100%' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.2em', color:'#06d6a0', textTransform:'uppercase' }}>Snake Chromatique</div>
        {difficulty !== 'moyen' && (
          <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:800, background:`${DIFF_LABELS[difficulty].color}22`, color:DIFF_LABELS[difficulty].color, border:`1px solid ${DIFF_LABELS[difficulty].color}44` }}>
            {DIFF_LABELS[difficulty].emoji} {DIFF_LABELS[difficulty].label}
          </span>
        )}
      </div>

      {/* Stats */}
      <div style={{ display:'flex', gap:8, width:'100%', maxWidth:380 }}>
        {([
          { lbl:'Score',   val:s.score,            clr:'#f8fafc' },
          { lbl:'Niveau',  val:s.level,             clr:`rgb(${lc.head.r},${lc.head.g},${lc.head.b})` },
          { lbl:'Longueur',val:s.snake.length,      clr:'#94a3b8' },
          { lbl:'Vitesse', val:`${speedMs(s.level, cfg)}ms`, clr: s.level >= 5 ? '#f97316' : '#64748b' },
        ] as const).map(({ lbl, val, clr }) => (
          <div key={lbl} style={{ flex:1, background:'#0f172a', border:'1px solid #1e293b', borderRadius:10, padding:'7px 6px', textAlign:'center' }}>
            <div style={{ fontSize:9, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'.08em' }}>{lbl}</div>
            <div style={{ fontSize:16, fontWeight:900, color: clr, marginTop:2 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Grille */}
      <div style={{ position:'relative' }}>
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${COLS},52px)`, gridTemplateRows:`repeat(${ROWS},52px)`, gap:4, background:'#0f172a', border:'2px solid #1e293b', borderRadius:12, padding:6, boxShadow:'0 0 40px rgba(6,214,160,0.06)' }}>
          {/* Séparateur salles */}
          <div style={{ position:'absolute', left:6+3*52+3*4, top:6, bottom:6, width:2, background:'rgba(255,255,255,0.05)', borderRadius:1 }} />

          {Array.from({ length:CELLS }, (_, i) => {
            const x = i % COLS, y = Math.floor(i / COLS);
            const si = s.snake.findIndex(p => p.x === x && p.y === y);
            const fd = s.foods.find(f => f.pos.x === x && f.pos.y === y && si < 0);
            let bg = '#0f172a', border = '1px solid #1a2233', shadow = 'none';
            if (si === 0) {
              const c = lc.head;
              bg = `rgb(${c.r},${c.g},${c.b})`;
              shadow = `0 0 14px rgb(${c.r},${c.g},${c.b})`;
              border = '2px solid rgba(255,255,255,0.2)';
            } else if (si > 0) {
              const c = lc.body;
              const fade = Math.max(0.3, 1 - si * 0.04);
              bg = `rgba(${c.r},${c.g},${c.b},${fade.toFixed(2)})`;
              border = '1px solid rgba(255,255,255,0.08)';
            } else if (fd) {
              bg = `rgb(${fd.type.r},${fd.type.g},${fd.type.b})`;
              shadow = `0 0 12px rgb(${fd.type.r},${fd.type.g},${fd.type.b})`;
              border = '2px solid rgba(255,255,255,0.15)';
            }
            return (
              <div key={i} style={{ width:52, height:52, borderRadius:8, background:bg, border, boxShadow:shadow }}>
                {fd && (
                  <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontSize:9, fontWeight:900, color:'rgba(255,255,255,0.85)', textAlign:'center', lineHeight:1.2 }}>
                      {fd.type.nm}<br />nm
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {s.over && (
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, background:'rgba(0,0,0,0.84)', borderRadius:12 }}>
            <Trophy size={30} color="#fbbf24" />
            <div style={{ fontSize:20, fontWeight:900 }}>Game Over</div>
            <div style={{ fontSize:13, color:'#94a3b8' }}>Score : {s.score} · Niv {s.level} · {s.snake.length} dalles</div>
            <button onClick={restart} style={{ marginTop:4, padding:'10px 20px', borderRadius:12, border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:800, fontSize:14, color:'#fff', background:'linear-gradient(135deg,#06d6a0,#4361ee)', display:'flex', alignItems:'center', gap:7 }}>
              <RotateCcw size={15} /> Rejouer
            </button>
          </div>
        )}
      </div>

      {/* Légende spectrale */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:5, justifyContent:'center', maxWidth:400 }}>
        {FOODS.map(f => (
          <div key={f.nm} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 7px', borderRadius:8, background:'#0f172a', border:'1px solid #1e293b' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:`rgb(${f.r},${f.g},${f.b})`, flexShrink:0 }} />
            <span style={{ fontSize:9, color:'#64748b', fontWeight:700 }}>{f.nm}nm</span>
            <span style={{ fontSize:9, color:'#334155' }}>+{f.pts}</span>
          </div>
        ))}
      </div>

      {!s.over && (
        <div style={{ fontSize:11, color:'#334155', display:'flex', alignItems:'center', gap:5 }}>
          <Zap size={10} color="#475569" />
          {5 - (s.eaten % 5)} bouche(s) → niv {s.level + 1}
        </div>
      )}

      <div style={{ fontSize:10, color:'#1e293b' }}>← → ↑ ↓ · Entrée = rejouer</div>

      <TouchControls keys={TOUCH_KEYS} forceShow />

      {onQuit && (
        <button onClick={() => { onTurnOffAll(); onQuit(); }} style={{ padding:'7px 14px', borderRadius:10, border:'1px solid #1e293b', background:'#0f172a', color:'#475569', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
          Quitter
        </button>
      )}
    </div>
  );
}
