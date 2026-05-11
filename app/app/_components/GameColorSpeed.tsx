'use client';

import { useEffect, useRef, useState } from 'react';

export interface GameTileProps {
  onSendColor: (tileIdx: number, r: number, g: number, b: number, intensity?: number) => void;
  onTurnOff: (tileIdx: number) => void;
  onTurnOffAll: () => void;
  onQuit: () => void;
  tileCount?: number;
}

function flashTiles(
  numTiles: number,
  onSendColor: GameTileProps['onSendColor'],
  r: number, g: number, b: number,
) {
  for (let i = 0; i < numTiles; i++) onSendColor(i, r, g, b, 55);
}

function flashTilesThenRestore(
  numTiles: number,
  onSendColor: GameTileProps['onSendColor'],
  onTurnOffAll: GameTileProps['onTurnOffAll'],
  r: number, g: number, b: number,
  restoreActiveTile: number | null,
  restoreColor: { r: number; g: number; b: number } | null,
) {
  for (let i = 0; i < numTiles; i++) onSendColor(i, r, g, b, 55);
  window.setTimeout(() => {
    onTurnOffAll();
    if (restoreActiveTile !== null && restoreColor) {
      window.setTimeout(() => onSendColor(restoreActiveTile, restoreColor.r, restoreColor.g, restoreColor.b, 90), 20);
    }
  }, 200);
}

const GAME_DURATION = 60;
const COLORS = [
  { r: 255, g: 30,  b: 30,  css: '#ff1e1e', label: 'Rouge' },
  { r: 30,  g: 220, b: 80,  css: '#1edc50', label: 'Vert' },
  { r: 40,  g: 80,  b: 255, css: '#2850ff', label: 'Bleu' },
  { r: 255, g: 200, b: 0,   css: '#ffc800', label: 'Jaune' },
  { r: 200, g: 0,   b: 255, css: '#c800ff', label: 'Violet' },
];

export default function GameColorSpeed({ onSendColor, onTurnOff, onTurnOffAll, onQuit, tileCount = 42 }: GameTileProps) {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [activeTile, setActiveTile] = useState<number | null>(null);
  const [activeCss, setActiveCss] = useState<string>('#fff');
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState(0);
  const [combo, setCombo] = useState(0);
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null);
  const [bestScore, setBestScore] = useState(() => {
    try { return Number(localStorage.getItem('cs_best_score') ?? 0); } catch { return 0; }
  });

  const activeTileRef = useRef<number | null>(null);
  const activeColorRef = useRef<{ r: number; g: number; b: number } | null>(null);
  const speedRef = useRef(1500);
  const comboRef = useRef(0);
  const tileTimerRef = useRef<number>(0);
  const gameTimerRef = useRef<number>(0);
  const numTiles = Math.min(tileCount, 42);

  function lightNextTile() {
    if (activeTileRef.current !== null) onTurnOff(activeTileRef.current);
    const idx = Math.floor(Math.random() * numTiles);
    const col = COLORS[Math.floor(Math.random() * COLORS.length)];
    activeTileRef.current = idx;
    activeColorRef.current = { r: col.r, g: col.g, b: col.b };
    setActiveTile(idx);
    setActiveCss(col.css);
    onSendColor(idx, col.r, col.g, col.b, 90);

    if (tileTimerRef.current) window.clearTimeout(tileTimerRef.current);
    tileTimerRef.current = window.setTimeout(() => {
      comboRef.current = 0;
      setCombo(0);
      setMissed(m => m + 1);
      triggerFlash('bad');
      flashTilesThenRestore(numTiles, onSendColor, onTurnOffAll, 200, 20, 20, null, null);
      window.setTimeout(() => lightNextTile(), 250);
    }, speedRef.current);
  }

  function triggerFlash(kind: 'good' | 'bad') {
    setFlash(kind);
    window.setTimeout(() => setFlash(null), 250);
  }

  function startGame() {
    setPhase('playing');
    setTimeLeft(GAME_DURATION);
    setScore(0);
    setMissed(0);
    setCombo(0);
    comboRef.current = 0;
    speedRef.current = 1500;

    let elapsed = 0;
    if (gameTimerRef.current) window.clearInterval(gameTimerRef.current);
    gameTimerRef.current = window.setInterval(() => {
      elapsed++;
      setTimeLeft(GAME_DURATION - elapsed);
      if (elapsed % 8 === 0) {
        speedRef.current = Math.max(350, Math.round(speedRef.current * 0.82));
      }
      if (elapsed >= GAME_DURATION) {
        window.clearInterval(gameTimerRef.current);
        window.clearTimeout(tileTimerRef.current);
        if (activeTileRef.current !== null) onTurnOff(activeTileRef.current);
        activeTileRef.current = null;
        setActiveTile(null);
        setPhase('finished');
        setScore(s => {
          const final = s;
          setBestScore(prev => {
            const next = Math.max(prev, final);
            try { localStorage.setItem('cs_best_score', String(next)); } catch {}
            return next;
          });
          return final;
        });
      }
    }, 1000);
    lightNextTile();
  }

  function handleTileClick(idx: number) {
    if (phase !== 'playing' || activeTileRef.current === null) return;
    if (idx === activeTileRef.current) {
      comboRef.current++;
      setCombo(comboRef.current);
      const bonusSpeed = Math.max(1, Math.floor(1500 / speedRef.current));
      const bonusCombo = Math.min(comboRef.current, 5);
      setScore(s => s + 10 + bonusSpeed + bonusCombo);
      triggerFlash('good');
      window.clearTimeout(tileTimerRef.current);
      flashTiles(numTiles, onSendColor, 20, 200, 60);
      window.setTimeout(() => lightNextTile(), 160);
    } else {
      comboRef.current = 0;
      setCombo(0);
      setMissed(m => m + 1);
      triggerFlash('bad');
      flashTilesThenRestore(numTiles, onSendColor, onTurnOffAll, 200, 20, 20, activeTileRef.current, activeColorRef.current);
    }
  }

  useEffect(() => {
    return () => {
      window.clearInterval(gameTimerRef.current);
      window.clearTimeout(tileTimerRef.current);
      onTurnOffAll();
    };
  }, []);

  const timerPct = (timeLeft / GAME_DURATION) * 100;
  const timerColor = timeLeft > 20 ? '#4ade80' : timeLeft > 10 ? '#fbbf24' : '#ef4444';

  if (phase === 'ready') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 40, background: 'linear-gradient(160deg, #080c14 0%, #0c1020 100%)', fontFamily: 'system-ui, sans-serif', color: '#e8eaf0' }}>
      <div style={{ fontSize: 48 }}>⚡</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#e8eaf0' }}>Color Speed</h2>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', maxWidth: 380, lineHeight: 1.6 }}>
        Une dalle s'allume — cliquez dessus le plus vite possible !<br />
        La vitesse augmente toutes les 8 secondes. Combos = bonus de points.<br />
        <strong>Durée : 60 secondes</strong>
      </p>
      {bestScore > 0 && <p style={{ color: '#fbbf24', fontWeight: 700 }}>🏆 Meilleur score : {bestScore}</p>}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={startGame} style={{ padding: '14px 36px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#4361ee,#7c3aed)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>Jouer</button>
        <button onClick={onQuit} style={{ padding: '14px 24px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Quitter</button>
      </div>
    </div>
  );

  if (phase === 'finished') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 40, background: 'linear-gradient(160deg, #080c14 0%, #0c1020 100%)', fontFamily: 'system-ui, sans-serif', color: '#e8eaf0' }}>
      <div style={{ fontSize: 48 }}>🏁</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#e8eaf0' }}>Partie terminée !</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, width: '100%', maxWidth: 360 }}>
        {[['Score', score], ['Manqués', missed], ['Meilleur', bestScore], ['Vitesse min', `${speedRef.current}ms`]].map(([k, v]) => (
          <div key={String(k)} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{k}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={startGame} style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#4361ee,#7c3aed)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Rejouer</button>
        <button onClick={onQuit} style={{ padding: '12px 20px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Menu</button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px', background: 'linear-gradient(160deg, #080c14 0%, #0c1020 100%)', fontFamily: 'system-ui, sans-serif', color: '#e8eaf0', borderRadius: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, color: 'rgba(255,255,255,0.5)' }}>
            <span>Temps</span><span style={{ color: timerColor, fontWeight: 700 }}>{timeLeft}s</span>
          </div>
          <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${timerPct}%`, background: timerColor, transition: 'width 1s linear, background 0.3s' }} />
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: flash === 'good' ? '#4ade80' : flash === 'bad' ? '#ef4444' : '#fff', transition: 'color 0.1s' }}>{score}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>pts</div>
        </div>
        {combo > 1 && <div style={{ background: '#fbbf24', color: '#000', fontWeight: 800, fontSize: 13, padding: '4px 10px', borderRadius: 8 }}>x{combo} COMBO</div>}
        <button onClick={() => { window.clearInterval(gameTimerRef.current); window.clearTimeout(tileTimerRef.current); onTurnOffAll(); onQuit(); }} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', fontSize: 12, cursor: 'pointer' }}>⏹</button>
      </div>

      <div style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
        {activeTile !== null && <>Dalle <span style={{ fontWeight: 800, color: activeCss }}>{activeTile + 1}</span> — cliquez vite !</>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, maxWidth: 560, margin: '0 auto', width: '100%' }}>
        {Array.from({ length: numTiles }, (_, i) => {
          const isActive = i === activeTile;
          return (
            <button
              key={i}
              onClick={() => handleTileClick(i)}
              style={{
                aspectRatio: '1',
                borderRadius: 8,
                border: isActive ? `2px solid ${activeCss}` : '1px solid rgba(255,255,255,0.08)',
                background: isActive ? activeCss + '33' : 'rgba(255,255,255,0.04)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: isActive ? activeCss : 'rgba(255,255,255,0.35)',
                fontWeight: isActive ? 800 : 400,
                boxShadow: isActive ? `0 0 12px ${activeCss}88` : 'none',
                transition: 'all 0.1s',
                transform: isActive ? 'scale(1.08)' : 'scale(1)',
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
        <span>Vitesse : {speedRef.current}ms</span>
        <span>Manqués : {missed}</span>
      </div>
    </div>
  );
}
