'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameTileProps } from './GameColorSpeed';

function rgbToXYZ(r: number, g: number, b: number): { X: number; Y: number; Z: number } {
  const lin = (c: number) => {
    const n = c / 255;
    return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  const rl = lin(r), gl = lin(g), bl = lin(b);
  return {
    X: rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375,
    Y: rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750,
    Z: rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041,
  };
}

function xyzDistance(a: { X: number; Y: number; Z: number }, b: { X: number; Y: number; Z: number }): number {
  return Math.sqrt(Math.pow(a.X - b.X, 2) + Math.pow(a.Y - b.Y, 2) + Math.pow(a.Z - b.Z, 2));
}

function xyzToxyY(xyz: { X: number; Y: number; Z: number }) {
  const sum = xyz.X + xyz.Y + xyz.Z;
  if (sum < 1e-9) return { x: 0.3127, y: 0.3290, Y: 0 };
  return { x: xyz.X / sum, y: xyz.Y / sum, Y: xyz.Y };
}

const TARGETS = [
  { name: 'Blanc Neutre 6500K',       r: 255, g: 255, b: 255, kelvin: 6500 },
  { name: 'Blanc Chaud 2700K',        r: 255, g: 197, b: 143, kelvin: 2700 },
  { name: 'Chandelle 1900K',          r: 255, g: 150, b: 79,  kelvin: 1900 },
  { name: 'Blanc Doux 3000K',         r: 255, g: 220, b: 170, kelvin: 3000 },
  { name: 'Blanc Froid 10000K',       r: 196, g: 214, b: 255, kelvin: 10000 },
  { name: 'Blanc Naturel 5000K',      r: 255, g: 247, b: 230, kelvin: 5000 },
  { name: 'Blanc Ivoire 4000K',       r: 255, g: 253, b: 215, kelvin: 4000 },
  { name: 'Blanc Bleuté 9000K',       r: 213, g: 228, b: 255, kelvin: 9000 },
  { name: 'Blanc Rosé 3200K',         r: 255, g: 237, b: 230, kelvin: 3200 },
  { name: 'Blanc Soleil 4500K',       r: 255, g: 254, b: 200, kelvin: 4500 },
];

const TOTAL_ROUNDS = 10;
const WIN_THRESHOLD = 0.025; // XYZ distance < this = victory

export default function GameMaitreDuBlanc({ onSendColor, onTurnOff, onTurnOffAll, onQuit, tileCount = 42 }: GameTileProps) {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'result' | 'finished'>('ready');
  const [roundIdx, setRoundIdx] = useState(0);
  const [order, setOrder] = useState<number[]>([]);
  const [pr, setPr] = useState(200);
  const [pg, setPg] = useState(200);
  const [pb, setPb] = useState(200);
  const [validated, setValidated] = useState(false);
  const [roundScore, setRoundScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [dist, setDist] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const lastSendRef = useRef<number>(0);
  const numTiles = Math.min(tileCount, 42);

  function shuffleOrder(): number[] {
    const arr = Array.from({ length: TOTAL_ROUNDS }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function startGame() {
    const ord = shuffleOrder();
    setOrder(ord);
    setRoundIdx(0);
    setTotalScore(0);
    setPhase('playing');
    setPr(200); setPg(200); setPb(200);
    setAttempts(0);
    setValidated(false);
    const target = TARGETS[ord[0]];
    // Light half tiles with target, half with player
    lightTiles(target.r, target.g, target.b, 200, 200, 200, ord[0]);
  }

  function lightTiles(tr: number, tg: number, tb: number, playerR: number, playerG: number, playerB: number, tIdx: number) {
    const halfA = Math.floor(numTiles / 2);
    for (let i = 0; i < halfA; i++) onSendColor(i, tr, tg, tb, 80);
    for (let i = halfA; i < numTiles; i++) onSendColor(i, playerR, playerG, playerB, 80);
  }

  function handleSliderChange(which: 'r' | 'g' | 'b', val: number) {
    const nr = which === 'r' ? val : pr;
    const ng = which === 'g' ? val : pg;
    const nb = which === 'b' ? val : pb;
    if (which === 'r') setPr(val);
    if (which === 'g') setPg(val);
    if (which === 'b') setPb(val);

    const now = Date.now();
    if (now - lastSendRef.current < 80) return;
    lastSendRef.current = now;
    if (order.length === 0) return;
    const target = TARGETS[order[roundIdx]];
    const halfA = Math.floor(numTiles / 2);
    for (let i = halfA; i < numTiles; i++) onSendColor(i, nr, ng, nb, 80);
    const xyz = rgbToXYZ(nr, ng, nb);
    const tgt = rgbToXYZ(target.r, target.g, target.b);
    setDist(parseFloat(xyzDistance(xyz, tgt).toFixed(4)));
  }

  function validate() {
    if (order.length === 0) return;
    setAttempts(a => a + 1);
    const target = TARGETS[order[roundIdx]];
    const playerXYZ = rgbToXYZ(pr, pg, pb);
    const targetXYZ = rgbToXYZ(target.r, target.g, target.b);
    const d = xyzDistance(playerXYZ, targetXYZ);
    const maxScore = 1000;
    const pts = Math.max(0, Math.round(maxScore * (1 - d / 0.5)));
    setRoundScore(pts);
    setDist(parseFloat(d.toFixed(4)));
    setValidated(true);
    setPhase('result');
  }

  function nextRound() {
    setTotalScore(s => s + roundScore);
    const next = roundIdx + 1;
    if (next >= TOTAL_ROUNDS) {
      onTurnOffAll();
      setPhase('finished');
      return;
    }
    setRoundIdx(next);
    setPhase('playing');
    setPr(200); setPg(200); setPb(200);
    setAttempts(0);
    setValidated(false);
    const target = TARGETS[order[next]];
    lightTiles(target.r, target.g, target.b, 200, 200, 200, next);
  }

  useEffect(() => { return () => onTurnOffAll(); }, []);

  if (phase === 'ready') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 40 }}>
      <div style={{ fontSize: 48 }}>🔆</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Le Maître du Blanc</h2>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', maxWidth: 420, lineHeight: 1.6 }}>
        La moitié gauche des dalles affiche un <strong>blanc cible</strong>.<br />
        Réglez vos curseurs R, G, B pour reproduire exactement la même teinte sur la moitié droite.<br />
        Le score est calculé à partir de la distance XYZ entre les deux couleurs.<br />
        <span style={{ color: '#fbbf24' }}>10 manches · {TOTAL_ROUNDS * 1000} points max</span>
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={startGame} style={{ padding: '14px 36px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>Jouer</button>
        <button onClick={onQuit} style={{ padding: '14px 24px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Quitter</button>
      </div>
    </div>
  );

  if (phase === 'finished') {
    const total = totalScore + roundScore;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 40 }}>
        <div style={{ fontSize: 48 }}>{total >= 7000 ? '🏆' : total >= 4000 ? '🥈' : '🥉'}</div>
        <h2 style={{ fontSize: 22, fontWeight: 800 }}>Terminé !</h2>
        <div style={{ fontSize: 48, fontWeight: 800, color: '#f59e0b' }}>{total}</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>/{TOTAL_ROUNDS * 1000} points</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button onClick={startGame} style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Rejouer</button>
          <button onClick={onQuit} style={{ padding: '12px 20px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Menu</button>
        </div>
      </div>
    );
  }

  const target = order.length > 0 ? TARGETS[order[roundIdx]] : TARGETS[0];
  const playerCss = `rgb(${pr},${pg},${pb})`;
  const targetCss = `rgb(${target.r},${target.g},${target.b})`;
  const playerXYZ = rgbToXYZ(pr, pg, pb);
  const targetXYZ = rgbToXYZ(target.r, target.g, target.b);
  const liveXYZ = xyzToxyY(playerXYZ);
  const targetxyY = xyzToxyY(targetXYZ);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Manche </span>
          <span style={{ fontWeight: 800 }}>{roundIdx + 1}/{TOTAL_ROUNDS}</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 18, color: '#f59e0b' }}>{totalScore}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>pts</span>
        </div>
        <button onClick={onQuit} style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' }}>⏹</button>
      </div>

      {/* Color preview comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: 14, background: targetCss, borderRadius: 12, minHeight: 80 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(0,0,0,0.5)', marginBottom: 4 }}>CIBLE</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(0,0,0,0.7)' }}>{target.name}</div>
          <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', marginTop: 4 }}>R{target.r} G{target.g} B{target.b}</div>
        </div>
        <div style={{ padding: 14, background: playerCss, borderRadius: 12, minHeight: 80 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(0,0,0,0.5)', marginBottom: 4 }}>VOTRE RÉPONSE</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(0,0,0,0.7)' }}>R{pr} G{pg} B{pb}</div>
        </div>
      </div>

      {/* Sliders */}
      {phase === 'playing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {([['R', pr, setPr, '#ef4444'], ['G', pg, setPg, '#4ade80'], ['B', pb, setPb, '#60a5fa']] as const).map(([label, val, setter, color]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 16, fontWeight: 800, color, fontSize: 14 }}>{label}</span>
              <input type="range" min={0} max={255} step={1} value={val}
                onChange={(e) => handleSliderChange(label.toLowerCase() as 'r' | 'g' | 'b', Number(e.target.value))}
                style={{ flex: 1, accentColor: color }} />
              <span style={{ width: 32, textAlign: 'right', fontSize: 13, fontWeight: 700, color }}>{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* XYZ readout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[['x', liveXYZ.x.toFixed(4), targetxyY.x.toFixed(4)], ['y', liveXYZ.y.toFixed(4), targetxyY.y.toFixed(4)], ['Y (lum)', liveXYZ.Y.toFixed(4), targetxyY.Y.toFixed(4)]].map(([label, pVal, tVal]) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px 10px', fontSize: 11 }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{label}</div>
            <div style={{ color: '#fff', fontWeight: 700 }}>{pVal}</div>
            <div style={{ color: 'rgba(255,255,255,0.35)' }}>cible: {tVal}</div>
          </div>
        ))}
      </div>

      {phase === 'playing' && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            Distance XYZ : <span style={{ fontWeight: 700, color: dist < WIN_THRESHOLD ? '#4ade80' : '#fff' }}>{dist}</span>
            {dist < WIN_THRESHOLD && <span style={{ color: '#4ade80', marginLeft: 8 }}>✓ Excellent !</span>}
          </div>
          <button onClick={validate}
            style={{ padding: '10px 28px', borderRadius: 12, border: 'none', background: dist < WIN_THRESHOLD ? '#4ade80' : 'linear-gradient(135deg,#f59e0b,#ef4444)', color: dist < WIN_THRESHOLD ? '#000' : '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Valider
          </button>
        </div>
      )}

      {phase === 'result' && (
        <div style={{ background: roundScore >= 700 ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.1)', border: `1px solid ${roundScore >= 700 ? '#4ade80' : '#fbbf24'}33`, borderRadius: 14, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: roundScore >= 700 ? '#4ade80' : '#fbbf24' }}>
            {roundScore >= 800 ? '🎯 Parfait !' : roundScore >= 500 ? '✅ Bien !' : '🎨 Continuez à pratiquer'}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Distance XYZ : <strong>{dist}</strong> (seuil : {WIN_THRESHOLD})</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>+{roundScore} pts</div>
          <button onClick={nextRound}
            style={{ marginTop: 4, padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#4361ee,#7c3aed)', color: '#fff', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}>
            {roundIdx + 1 < TOTAL_ROUNDS ? 'Manche suivante →' : 'Voir les résultats'}
          </button>
        </div>
      )}
    </div>
  );
}
