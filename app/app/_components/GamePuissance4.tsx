'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Brain, Circle, Cpu, Flame, Minus, Play, RotateCcw, Square, Star, Trophy, Users, Zap } from 'lucide-react';
import type { GameTileProps } from './GameColorSpeed';
import { SHOW_SCREEN_BOARD } from '@/lib/game/displayMode';
import { playSfx, vibrate } from '@/lib/audio/sfx';

// ── Board constants ───────────────────────────────────────────────────────────
const ROWS = 7;
const COLS = 6;
const P1 = 1 as const;
const P2 = 2 as const;

type Cell = 0 | 1 | 2;
type Grid = Cell[][];
type Mode = 'pvp' | 'cpu';
type Phase = 'ready' | 'playing' | 'finished';
type Difficulty = 'novice' | 'facile' | 'moyen' | 'difficile' | 'legendaire';

const PLAYER_COLORS: Record<number, { css: string; r: number; g: number; b: number; glow: string; label: string }> = {
  [P1]: { css: '#ff3b6e', r: 255, g: 59, b: 110, glow: 'rgba(255,59,110,0.6)', label: '●' },
  [P2]: { css: '#3b82f6', r: 59, g: 130, b: 246, glow: 'rgba(59,130,246,0.6)', label: '●' },
};
const getPC = (p: Cell) => p === 1 || p === 2 ? PLAYER_COLORS[p] : null;

// ── Difficulty config ─────────────────────────────────────────────────────────
const DIFF_CONFIG = {
  novice:     { depth: 1, noise: 0.70, block: false, label: 'Novice',     Icon: Circle, color: '#34d399', desc: 'Joue au hasard presque toujours' },
  facile:     { depth: 2, noise: 0.30, block: false, label: 'Facile',     Icon: Star,   color: '#fbbf24', desc: 'Quelques erreurs tactiques' },
  moyen:      { depth: 5,  noise: 0.08, block: true,  label: 'Moyen',      Icon: Brain,  color: '#f97316', desc: 'Minimax profondeur 5' },
  difficile:  { depth: 9,  noise: 0.00, block: true,  label: 'Difficile',  Icon: Flame,  color: '#ef4444', desc: 'Profondeur 9 + anti-piege' },
  legendaire: { depth: 12, noise: 0.00, block: true,  label: 'Legendaire', Icon: Zap,    color: '#a855f7', desc: 'Profondeur 12 + anti-piege' },
} satisfies Record<Difficulty, { depth: number; noise: number; block: boolean; label: string; Icon: React.ElementType; color: string; desc: string }>;

// ── Board utilities ───────────────────────────────────────────────────────────
function emptyGrid(): Grid { return Array.from({ length: ROWS }, () => Array(COLS).fill(0) as Cell[]); }
function tileIdx(row: number, col: number): number { return row * COLS + col; }

function dropAt(grid: Grid, col: number, player: Cell): { grid: Grid; row: number } | null {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (grid[row][col] === 0) {
      const next = grid.map(r => [...r]) as Grid;
      next[row][col] = player;
      return { grid: next, row };
    }
  }
  return null;
}

function validCols(grid: Grid): number[] {
  return Array.from({ length: COLS }, (_, c) => c).filter(c => grid[0][c] === 0);
}

function winsAt(grid: Grid, row: number, col: number, p: Cell): boolean {
  for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]] as [number,number][]) {
    let n = 1;
    for (let k = 1; k < 4; k++) {
      const r = row+dr*k, c = col+dc*k;
      if (r<0||r>=ROWS||c<0||c>=COLS||grid[r][c]!==p) break; n++;
    }
    for (let k = 1; k < 4; k++) {
      const r = row-dr*k, c = col-dc*k;
      if (r<0||r>=ROWS||c<0||c>=COLS||grid[r][c]!==p) break; n++;
    }
    if (n >= 4) return true;
  }
  return false;
}

function checkWin(grid: Grid): Cell | null {
  for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]] as [number,number][]) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c]; if (!cell) continue;
      let n = 1;
      for (let k = 1; k < 4; k++) {
        const nr=r+dr*k, nc=c+dc*k;
        if (nr<0||nr>=ROWS||nc<0||nc>=COLS||grid[nr][nc]!==cell) break; n++;
      }
      if (n >= 4) return cell;
    }
  }
  return null;
}

// ── Évaluation & recherche (minimax + alpha-bêta, anti-piège) ─────────────────
// La position est notée en balayant toutes les fenêtres de 4 cases (poids appris
// style réseau à une couche) + contrôle du centre. La défense est pondérée plus
// fort que l'attaque, et l'IA écarte les coups qui offrent une victoire immédiate
// à l'adversaire (anti-piège). Recherche à approfondissement itératif borné.

const WIN_SCORE = 1_000_000;
const AI: Cell = P2;
const HUMAN: Cell = P1;
const CENTER = Math.floor(COLS / 2);

// Poids des colonnes : le centre vaut plus (théorie du Puissance 4)
const COL_WEIGHT = [1, 2, 4, 7, 4, 2]; // COLS = 6

// Note d'une fenêtre de 4 cases, du point de vue de l'IA.
// Défense > attaque → l'IA neutralise les alignements adverses.
function scoreWindow(me: number, opp: number): number {
  if (me > 0 && opp > 0) return 0;   // fenêtre mixte = morte
  if (me === 4)  return WIN_SCORE;
  if (opp === 4) return -WIN_SCORE;
  if (me === 3)  return 130;
  if (opp === 3) return -170;
  if (me === 2)  return 14;
  if (opp === 2) return -18;
  if (me === 1)  return 1;
  if (opp === 1) return -1;
  return 0;
}

function evaluateBoard(grid: Grid): number {
  let score = 0;
  // Contrôle des colonnes (centralité)
  for (let c = 0; c < COLS; c++) {
    const w = COL_WEIGHT[c] ?? 1;
    for (let r = 0; r < ROWS; r++) {
      if (grid[r][c] === AI) score += w;
      else if (grid[r][c] === HUMAN) score -= w;
    }
  }
  // Balayage de toutes les fenêtres de 4
  for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]] as [number,number][]) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const er = r+dr*3, ec = c+dc*3;
        if (er<0||er>=ROWS||ec<0||ec>=COLS) continue;
        let me=0, opp=0;
        for (let k=0;k<4;k++) {
          const v = grid[r+dr*k][c+dc*k];
          if (v===AI) me++; else if (v===HUMAN) opp++;
        }
        score += scoreWindow(me, opp);
      }
    }
  }
  return score;
}

// Colonnes où `player` gagne immédiatement en y jouant
function winningCols(grid: Grid, player: Cell): number[] {
  const out: number[] = [];
  for (const c of validCols(grid)) {
    const d = dropAt(grid, c, player);
    if (d && winsAt(d.grid, d.row, c, player)) out.push(c);
  }
  return out;
}

// Ordre des coups : centre d'abord → meilleur élagage alpha-bêta
function orderColumns(cols: number[]): number[] {
  return [...cols].sort((a, b) => (COL_WEIGHT[b] ?? 1) - (COL_WEIGHT[a] ?? 1));
}

function minimax(grid: Grid, depth: number, alpha: number, beta: number, maximizing: boolean): number {
  const valid = validCols(grid);
  if (valid.length === 0) return 0;            // match nul
  if (depth === 0) return evaluateBoard(grid);
  if (maximizing) {
    let value = -Infinity;
    for (const c of orderColumns(valid)) {
      const d = dropAt(grid, c, AI)!;
      const v = winsAt(d.grid, d.row, c, AI) ? WIN_SCORE + depth : minimax(d.grid, depth-1, alpha, beta, false);
      if (v > value) value = v;
      if (value > alpha) alpha = value;
      if (alpha >= beta) break;                // coupure bêta
    }
    return value;
  } else {
    let value = Infinity;
    for (const c of orderColumns(valid)) {
      const d = dropAt(grid, c, HUMAN)!;
      const v = winsAt(d.grid, d.row, c, HUMAN) ? -WIN_SCORE - depth : minimax(d.grid, depth-1, alpha, beta, true);
      if (v < value) value = v;
      if (value < beta) beta = value;
      if (alpha >= beta) break;                // coupure alpha
    }
    return value;
  }
}

// Recherche racine : meilleur coup parmi les candidats à une profondeur donnée
function rootSearch(grid: Grid, candidates: number[], depth: number): { col: number; val: number } {
  let best = candidates[0];
  let bestVal = -Infinity;
  for (const c of orderColumns(candidates)) {
    const d = dropAt(grid, c, AI)!;
    const v = winsAt(d.grid, d.row, c, AI) ? WIN_SCORE + depth : minimax(d.grid, depth-1, -Infinity, Infinity, false);
    if (v > bestVal) { bestVal = v; best = c; }
  }
  return { col: best, val: bestVal };
}

function bestMove(grid: Grid, difficulty: Difficulty): number {
  const valid = validCols(grid);
  if (!valid.length) return 0;
  const cfg = DIFF_CONFIG[difficulty];

  // 1. Gagner tout de suite si possible
  const myWins = winningCols(grid, AI);
  if (myWins.length) return myWins[0];

  // 2. Bruit aléatoire pour les niveaux faciles (après la victoire immédiate)
  if (cfg.noise > 0 && Math.random() < cfg.noise) {
    return valid[Math.floor(Math.random() * valid.length)];
  }

  // 3. Bloquer la victoire immédiate de l'adversaire
  if (cfg.block) {
    const theirWins = winningCols(grid, HUMAN);
    if (theirWins.length) return theirWins[0];
  }

  // 4. Anti-piège : écarter les coups qui donnent une victoire immédiate à
  //    l'adversaire au coup suivant (sauf si aucun coup n'est sûr).
  let candidates = valid;
  if (cfg.block) {
    const safe = valid.filter(c => {
      const d = dropAt(grid, c, AI)!;
      return winningCols(d.grid, HUMAN).length === 0;
    });
    if (safe.length) candidates = safe;
  }

  // 5. Minimax à approfondissement itératif, borné par un budget de temps
  let best = candidates.reduce((a, b) => (Math.abs(a - CENTER) <= Math.abs(b - CENTER) ? a : b));
  const start = Date.now();
  const budgetMs = cfg.depth >= 10 ? 650 : cfg.depth >= 8 ? 350 : 120;
  for (let d = Math.min(3, cfg.depth); d <= cfg.depth; d++) {
    const res = rootSearch(grid, candidates, d);
    best = res.col;
    if (Math.abs(res.val) >= WIN_SCORE) break;   // gain/perte forcé trouvé
    if (Date.now() - start > budgetMs) break;    // budget épuisé
  }
  return best;
}

// ── Component ─────────────────────────────────────────────────────────────────
// Mapping de la difficulté universelle (4 niveaux) vers l'échelle interne P4 (5 niveaux)
const DIFF_MAP: Record<string, Difficulty> = {
  facile: 'facile', moyen: 'moyen', difficile: 'difficile', expert: 'legendaire',
};

export default function GamePuissance4({ onSendColor, onTurnOff, onTurnOffAll, onQuit, onRegisterClickHandler, onComplete, difficulty: externalDiff }: GameTileProps) {
  const [phase, setPhase]           = useState<Phase>('ready');
  const [mode, setMode]             = useState<Mode>('cpu');
  const [difficulty, setDifficulty] = useState<Difficulty>(externalDiff ? (DIFF_MAP[externalDiff] ?? 'moyen') : 'moyen');
  const [grid, setGrid]             = useState<Grid>(emptyGrid);
  const [currentPlayer, setCurrentPlayer] = useState<Cell>(P1);
  const [hoverCol, setHoverCol]     = useState<number | null>(null);
  const [winner, setWinner]         = useState<Cell | null>(null);
  const [isDraw, setIsDraw]         = useState(false);
  // Ne compte comme "réussi" qu'une victoire du joueur (P1) ou un nul — pas une défaite.
  useEffect(() => { if (phase === 'finished' && (winner === P1 || isDraw)) onComplete?.(winner === P1 ? 300 : 100); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  // Son + vibration de fin de partie.
  useEffect(() => {
    if (phase !== 'finished') return;
    if (isDraw) { playSfx('alert'); vibrate(80); }
    else if (winner === P1) { playSfx('win'); vibrate([60, 40, 60, 40, 140]); }
    else { playSfx('lose'); vibrate([120, 60, 120]); }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const [thinking, setThinking]     = useState(false);
  const [moveCount, setMoveCount]   = useState(0);
  const [scores, setScores]         = useState({ p1: 0, p2: 0 });
  const [winCells, setWinCells]     = useState<[number,number][]>([]);

  const gridRef          = useRef<Grid>(emptyGrid());
  const currentRef       = useRef<Cell>(P1);
  const phaseRef         = useRef<Phase>('ready');
  const diffRef          = useRef<Difficulty>('moyen');
  const moveCountRef     = useRef(0);

  function syncHardware(g: Grid) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = g[r][c]; const idx = tileIdx(r, c);
      if (cell === P1) onSendColor(idx, 255, 59, 110, 88);
      else if (cell === P2) onSendColor(idx, 59, 130, 246, 88);
      else onTurnOff(idx);
    }
  }

  function findWinCells(g: Grid, p: Cell): [number,number][] {
    for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]] as [number,number][]) {
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (g[r][c] !== p) continue;
        const cells: [number,number][] = [[r,c]];
        for (let k=1;k<4;k++) {
          const nr=r+dr*k,nc=c+dc*k;
          if (nr<0||nr>=ROWS||nc<0||nc>=COLS||g[nr][nc]!==p) break;
          cells.push([nr,nc]);
        }
        if (cells.length >= 4) return cells;
      }
    }
    return [];
  }

  function makeMove(col: number, isAi = false) {
    if (phaseRef.current !== 'playing') return;
    // Bloque uniquement les actions humaines pendant le tour de l'IA.
    // Le coup de l'IA lui-même (isAi=true) doit passer ce garde.
    if (!isAi && mode === 'cpu' && currentRef.current === P2) return;
    const player = currentRef.current;
    const result = dropAt(gridRef.current, col, player);
    if (!result) return;
    playSfx('pop'); // son de dépôt d'un jeton

    gridRef.current = result.grid;
    moveCountRef.current += 1;
    setMoveCount(moveCountRef.current);
    setGrid(result.grid.map(r => [...r]) as Grid);

    // Mise à jour hardware directe, sans flash
    syncHardware(result.grid);

    const w = checkWin(result.grid);
    if (w) {
      const wc = findWinCells(result.grid, w);
      setWinCells(wc);
      setWinner(w);
      phaseRef.current = 'finished';
      setPhase('finished');
      setScores(s => ({ ...s, [w === P1 ? 'p1' : 'p2']: s[w === P1 ? 'p1' : 'p2'] + 1 }));
      // Garder l'état final affiché 2s puis éteindre
      setTimeout(() => onTurnOffAll(), 2000);
      return;
    }
    if (result.grid[0].every(c => c !== 0)) {
      setIsDraw(true); phaseRef.current = 'finished'; setPhase('finished'); return;
    }

    const next = player === P1 ? P2 : P1;
    currentRef.current = next; setCurrentPlayer(next);
    if (mode === 'cpu' && next === P2) {
      setHoverCol(null);   // masque tout aperçu de colonne pendant le tour de l'IA
      setThinking(true);
      const delay = diffRef.current === 'legendaire' ? 180 : diffRef.current === 'difficile' ? 240 : 400;
      setTimeout(() => { const c = bestMove(gridRef.current, diffRef.current); setThinking(false); makeMove(c, true); }, delay);
    }
  }

  function startGame() {
    const g = emptyGrid();
    gridRef.current = g; currentRef.current = P1; phaseRef.current = 'playing';
    diffRef.current = difficulty; moveCountRef.current = 0;
    setGrid(emptyGrid()); setCurrentPlayer(P1); setHoverCol(null);
    setWinner(null); setIsDraw(false); setThinking(false); setMoveCount(0);
    setWinCells([]); setPhase('playing');
    onTurnOffAll();
  }

  function resetAll() { setScores({ p1: 0, p2: 0 }); startGame(); }

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (phaseRef.current !== 'playing') return;
    if (mode === 'cpu' && currentRef.current === P2) return;
    if (e.key === 'ArrowLeft')  setHoverCol(c => Math.max(0, (c ?? CENTER) - 1));
    if (e.key === 'ArrowRight') setHoverCol(c => Math.min(COLS-1, (c ?? CENTER) + 1));
    if ((e.key === ' ' || e.key === 'Enter') && hoverCol !== null) { e.preventDefault(); makeMove(hoverCol); }
  }, [hoverCol, mode]); // eslint-disable-line

  useEffect(() => { window.addEventListener('keydown', handleKey); return () => window.removeEventListener('keydown', handleKey); }, [handleKey]);
  useEffect(() => () => onTurnOffAll(), []); // eslint-disable-line
  useEffect(() => { onRegisterClickHandler?.((idx: number) => makeMove(idx % COLS)); return () => { onRegisterClickHandler?.(null); }; }, []); // eslint-disable-line

  const curColor  = PLAYER_COLORS[currentPlayer];
  const diffCfg   = DIFF_CONFIG[difficulty];
  const playerName = (p: Cell) => mode === 'pvp' ? `Joueur ${p}` : p === P1 ? 'Vous' : 'IA';

  // ── Design tokens — dark minimalist, no liquid glass ───────────────────────
  const C = {
    shell:     'linear-gradient(180deg,#1a1e29 0%,#121420 100%)',
    raised:    '#262c3c',
    board:     '#0e1018',
    line:      'rgba(255,255,255,0.07)',
    text:      '#edeef4',
    textDim:   'rgba(237,238,244,0.55)',
    textFaint: 'rgba(237,238,244,0.30)',
    indigo:    '#818cf8',
  };
  const shellStyle: React.CSSProperties = {
    display:'flex', flexDirection:'column', gap:14, fontFamily:'inherit', color:C.text,
    background:C.shell, border:`1px solid ${C.line}`, borderRadius:22, padding:18,
  };
  const labelStyle: React.CSSProperties = {
    fontSize:10.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'.12em',
    color:C.textFaint, marginBottom:11,
  };

  // ── READY SCREEN ───────────────────────────────────────────────────────────
  if (phase === 'ready') return (
    <div style={shellStyle}>
      {/* Header */}
      <div style={{ textAlign:'center', paddingTop:4 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, marginBottom:11 }}>
          <span style={{ width:12, height:12, borderRadius:'50%', background:'#ff3b6e' }} />
          <span style={{ width:12, height:12, borderRadius:'50%', background:'#3b82f6' }} />
        </div>
        <div style={{ fontSize:25, fontWeight:800, letterSpacing:'-0.03em' }}>Puissance&nbsp;4</div>
        <div style={{ fontSize:12.5, color:C.textDim, marginTop:5 }}>IA neuronale · 5 niveaux de difficulté</div>
      </div>

      {/* Mode selector */}
      <div>
        <div style={labelStyle}>Mode de jeu</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {(['pvp','cpu'] as Mode[]).map(m => {
            const active = mode===m;
            return (
              <button key={m} onClick={() => setMode(m)} style={{
                padding:'13px 14px', borderRadius:13, cursor:'pointer', fontFamily:'inherit',
                border: active ? '1px solid rgba(129,140,248,0.55)' : `1px solid ${C.line}`,
                background: active ? 'rgba(129,140,248,0.14)' : C.raised,
                color: active ? '#c7d0fb' : C.textDim,
                fontWeight:700, fontSize:14, transition:'all 130ms',
                display:'flex', alignItems:'center', justifyContent:'center', gap:7,
              }}>
                {m==='pvp' ? <><Users size={15} /> 2 Joueurs</> : <><Cpu size={15} /> Contre l&apos;IA</>}
              </button>
            );
          })}
        </div>
      </div>

      {/* AI difficulty */}
      {mode === 'cpu' && (
        <div>
          <div style={labelStyle}>Niveau de l&apos;IA</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7, marginBottom:9 }}>
            {(['novice','facile','moyen','difficile','legendaire'] as Difficulty[]).map(d => {
              const cfg = DIFF_CONFIG[d]; const active = difficulty===d;
              return (
                <button key={d} onClick={() => setDifficulty(d)} style={{
                  padding:'11px 8px', borderRadius:12, cursor:'pointer', fontFamily:'inherit',
                  border: active ? `1px solid ${cfg.color}` : `1px solid ${C.line}`,
                  background: active ? `${cfg.color}1f` : C.raised,
                  color: active ? cfg.color : C.textDim,
                  fontWeight:700, fontSize:11, textAlign:'center', transition:'all 130ms',
                }}>
                  <div style={{ display:'flex', justifyContent:'center', marginBottom:5, color: active ? cfg.color : C.textFaint }}><cfg.Icon size={16} /></div>
                  <div>{cfg.label}</div>
                </button>
              );
            })}
          </div>
          {/* Description of selected difficulty */}
          <div style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 12px', borderRadius:11, background:`${diffCfg.color}14`, border:`1px solid ${diffCfg.color}2e` }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:diffCfg.color, flexShrink:0 }} />
            <span style={{ fontSize:12, color:C.textDim, fontWeight:600 }}>{diffCfg.desc}</span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, marginTop:2 }}>
        <button onClick={startGame} style={{
          padding:'14px 20px', borderRadius:14, border:'none', cursor:'pointer', fontFamily:'inherit',
          background:'linear-gradient(135deg,#ff3b6e 0%,#3b82f6 100%)',
          color:'#fff', fontWeight:800, fontSize:15.5, letterSpacing:'-0.01em',
          boxShadow:'0 6px 20px rgba(59,130,246,0.28)', transition:'all 150ms',
          display:'flex', alignItems:'center', justifyContent:'center', gap:7,
        }}>
          <Play size={16} /> Jouer
        </button>
        <button onClick={onQuit} style={{
          padding:'14px 18px', borderRadius:14, cursor:'pointer', fontFamily:'inherit',
          border:`1px solid ${C.line}`, background:C.raised, color:C.textDim, fontWeight:700, fontSize:14,
        }}>
          Quitter
        </button>
      </div>
    </div>
  );

  // ── FINISHED SCREEN ────────────────────────────────────────────────────────
  if (phase === 'finished') {
    const wColor = winner ? PLAYER_COLORS[winner].css : C.indigo;
    return (
      <div style={shellStyle}>
        {/* Result */}
        <div style={{ textAlign:'center', paddingTop:6 }}>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:10, color: wColor }}>
            {isDraw ? <Minus size={38} /> : winner===P1 ? <Trophy size={38} /> : <Cpu size={38} />}
          </div>
          <div style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.02em', color: wColor }}>
            {isDraw ? 'Match nul' : `${playerName(winner!)} gagne`}
          </div>
          <div style={{ fontSize:12, color:C.textDim, marginTop:5 }}>
            {moveCount} coups · {mode==='cpu' ? `IA ${diffCfg.label}` : '2 joueurs'}
          </div>
        </div>
        {/* Score board */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {([P1,P2] as Cell[]).map(p => {
            const won = winner === p;
            return (
              <div key={p} style={{ textAlign:'center', padding:'13px 10px', borderRadius:13, background: won ? `${PLAYER_COLORS[p].css}1c` : C.raised, border:`1px solid ${won ? `${PLAYER_COLORS[p].css}55` : C.line}` }}>
                <div style={{ fontSize:10.5, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'.08em', color:PLAYER_COLORS[p].css, marginBottom:5 }}>{playerName(p)}</div>
                <div style={{ fontSize:28, fontWeight:800, color:PLAYER_COLORS[p].css }}>{p===P1?scores.p1:scores.p2}</div>
              </div>
            );
          })}
        </div>
        {/* Actions */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:8, marginTop:2 }}>
          <button onClick={startGame} style={{ padding:'12px', borderRadius:13, border:'none', cursor:'pointer', fontFamily:'inherit', background:'linear-gradient(135deg,#ff3b6e,#3b82f6)', color:'#fff', fontWeight:800, fontSize:14, boxShadow:'0 4px 16px rgba(59,130,246,0.26)', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><RotateCcw size={14} /> Rejouer</button>
          <button onClick={resetAll} style={{ padding:'12px', borderRadius:13, cursor:'pointer', fontFamily:'inherit', border:`1px solid ${C.line}`, background:C.raised, color:C.textDim, fontWeight:700, fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><Minus size={13} /> Reset</button>
          <button onClick={() => { onTurnOffAll(); onQuit(); }} style={{ padding:'12px 16px', borderRadius:13, cursor:'pointer', fontFamily:'inherit', border:`1px solid ${C.line}`, background:C.raised, color:C.textFaint, fontWeight:700, fontSize:13 }}>Menu</button>
        </div>
      </div>
    );
  }

  // ── PLAYING SCREEN ─────────────────────────────────────────────────────────
  // Tour de l'IA : l'utilisateur ne peut ni interagir ni voir d'aperçu.
  const aiTurn = mode === 'cpu' && currentPlayer === P2;
  return (
    <div style={{ ...shellStyle, gap:11, userSelect:'none' }}>
      {/* Status bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:9, minWidth:0 }}>
          <div style={{ width:12, height:12, borderRadius:'50%', background:curColor.css, boxShadow:`0 0 12px ${curColor.glow}`, transition:'all 200ms', flexShrink:0 }} />
          <span style={{ fontWeight:700, fontSize:13.5, color:C.text, transition:'color 200ms', whiteSpace:'nowrap' }}>
            {thinking ? <span style={{ display:'flex', alignItems:'center', gap:6, color:C.textDim }}><Brain size={14} style={{ animation:'p4spin 0.7s linear infinite' }} /> IA réfléchit</span> : `Tour de ${playerName(currentPlayer)}`}
          </span>
          {mode==='cpu' && !thinking && (
            <span style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:7, fontSize:10.5, fontWeight:700, background:`${diffCfg.color}1c`, color:diffCfg.color }}>
              <diffCfg.Icon size={11} /> {diffCfg.label}
            </span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <div style={{ display:'flex', gap:5 }}>
            {([P1,P2] as Cell[]).map(p => (
              <div key={p} style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 8px', borderRadius:7, background:`${PLAYER_COLORS[p].css}18` }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:PLAYER_COLORS[p].css }} />
                <span style={{ fontSize:12, fontWeight:800, color:PLAYER_COLORS[p].css }}>{p===P1?scores.p1:scores.p2}</span>
              </div>
            ))}
          </div>
          <button onClick={() => { onTurnOffAll(); onQuit(); }} style={{ width:28, height:28, borderRadius:8, border:`1px solid ${C.line}`, background:C.raised, cursor:'pointer', display:'grid', placeItems:'center', color:C.textDim }}><Square size={12} /></button>
        </div>
      </div>

      {/* Drop indicators */}
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${COLS},1fr)`, gap:6, pointerEvents: aiTurn ? 'none' : 'auto', opacity: aiTurn ? 0.4 : 1 }}>
        {Array.from({length:COLS},(_,c) => {
          const active = hoverCol===c;
          return (
            <button key={c} onMouseEnter={() => setHoverCol(c)} onMouseLeave={() => setHoverCol(null)} onClick={() => makeMove(c)}
              style={{ height:22, borderRadius:7, border:'none', cursor:'pointer',
                background: active ? curColor.css : 'rgba(255,255,255,0.05)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
              {active && <div style={{ width:7, height:7, borderRadius:'50%', background:'#fff' }} />}
            </button>
          );
        })}
      </div>

      {/* Board */}
      <div style={{ borderRadius:16, padding:9, background:C.board, border:`1px solid ${C.line}`, pointerEvents: aiTurn ? 'none' : 'auto' }}>
        {SHOW_SCREEN_BOARD ? (
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${COLS},1fr)`, gridTemplateRows:`repeat(${ROWS},1fr)`, gap:6 }}>
          {grid.map((row, r) => row.map((cell, c) => {
            const isHover = hoverCol === c && !cell;
            const pc = cell ? PLAYER_COLORS[cell] : null;
            const isWin = winCells.some(([wr,wc]) => wr===r && wc===c);
            return (
              <div key={`${r}-${c}`} onClick={() => makeMove(c)} onMouseEnter={() => setHoverCol(c)} onMouseLeave={() => setHoverCol(null)}
                style={{
                  aspectRatio:'1', borderRadius:'50%', cursor:'pointer',
                  background: pc ? pc.css : isHover ? `${curColor.css}22` : 'rgba(255,255,255,0.04)',
                  border: isWin ? '3px solid #fff' : pc ? 'none' : `1px solid ${isHover ? `${curColor.css}66` : 'rgba(255,255,255,0.07)'}`,
                  outline: isWin ? `2px solid ${pc!.css}` : 'none',
                }}
              />
            );
          }))}
        </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, textAlign:'center', padding:'28px 16px' }}>
            <div style={{ fontSize:34 }}>👁️</div>
            <div style={{ fontSize:16, fontWeight:900, color:'#e2e8f0' }}>Regarde la Color Room</div>
            <div style={{ fontSize:12, color:C.textFaint, maxWidth:220 }}>Choisis une colonne ci-dessus ; les jetons s&apos;affichent sur les dalles.</div>
          </div>
        )}
      </div>

      {/* Keyboard hint */}
      <div style={{ textAlign:'center', fontSize:11, color:C.textFaint, fontWeight:600 }}>
        ← → Espace · Clic colonne · Clic dalle LED
      </div>

      <style>{`@keyframes p4spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
