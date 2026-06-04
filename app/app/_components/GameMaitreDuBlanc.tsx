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

const LEFT_IDX  = [0,1,2,6,7,8,12,13,14,18,19,20,24,25,26,30,31,32,36,37,38];
const RIGHT_IDX = [3,4,5,9,10,11,15,16,17,21,22,23,27,28,29,33,34,35,39,40,41];

/* ── Styles ──────────────────────────────────────────────────────────── */
const P: Record<string, React.CSSProperties> = {
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
    background: 'linear-gradient(135deg,rgba(245,158,11,.28),rgba(239,68,68,.18))',
    border: '1px solid rgba(245,158,11,.4)', borderRadius: 8,
    padding: '3px 10px', fontSize: 12, fontWeight: 800, color: '#f59e0b',
    marginBottom: 8, letterSpacing: '.04em',
  },
  rules: {
    fontSize: 13, color: 'rgba(255,255,255,.62)', lineHeight: 1.65, margin: '0 0 10px',
  },
  playBtn: {
    padding: '11px 26px', borderRadius: 14, border: 'none',
    background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
    boxShadow: '0 4px 20px rgba(245,158,11,.40), inset 0 1px 0 rgba(255,255,255,.15)',
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
  glassCard: {
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12,
  },
};

export default function GameMaitreDuBlanc({ onSendColor, onTurnOff, onTurnOffAll, onQuit, tileCount = 42, onComplete }: GameTileProps) {
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
  useEffect(() => { if (phase === 'finished') onComplete?.(Math.round(totalScore / 5)); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const [attempts, setAttempts] = useState(0);
  const lastSendRef = useRef<number>(0);
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
    lightTiles(target.r, target.g, target.b, 200, 200, 200, ord[0]);
  }

  function lightTiles(tr: number, tg: number, tb: number, playerR: number, playerG: number, playerB: number, _tIdx: number) {
    for (const i of RIGHT_IDX) onSendColor(i, tr, tg, tb, 90);
    for (const i of LEFT_IDX)  onSendColor(i, playerR, playerG, playerB, 80);
  }

  function handleSliderChange(which: 'r' | 'g' | 'b', val: number) {
    const nr = which === 'r' ? val : pr;
    const ng = which === 'g' ? val : pg;
    const nb = which === 'b' ? val : pb;
    if (which === 'r') setPr(val);
    if (which === 'g') setPg(val);
    if (which === 'b') setPb(val);

    const now = Date.now();
    if (now - lastSendRef.current < 30) return;
    lastSendRef.current = now;
    if (order.length === 0) return;
    const target = TARGETS[order[roundIdx]];
    for (const i of LEFT_IDX) onSendColor(i, nr, ng, nb, 80);
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

  useEffect(() => { return () => onTurnOffAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── READY ── */
  if (phase === 'ready') return (
    <div style={P.wrap}>
      <div style={P.readyRow}>
        <div style={{ flex: 1 }}>
          <span style={P.tag}>🔆 Maître du Blanc</span>
          <p style={P.rules}>
            La moitié gauche des dalles affiche un <em>blanc cible</em>.
            Réglez vos curseurs R, G, B pour reproduire la même teinte sur la moitié droite.
            Score calculé sur la distance XYZ entre les deux couleurs.
            <span style={{ color: 'rgba(255,255,255,.35)', marginLeft: 6 }}>10 manches · {TOTAL_ROUNDS * 1000} pts max</span>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
            {([
              ['≤ 0.025', 'Excellent', '#4ade80'],
              ['≤ 0.05',  'Bien',      '#fbbf24'],
              ['≤ 0.1',   'Moyen',     '#f97316'],
              ['> 0.1',   'Loin',      '#ef4444'],
            ] as [string, string, string][]).map(([d, lbl, c]) => (
              <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.04)', border: `1px solid ${c}44`, borderRadius: 8, padding: '4px 10px', fontSize: 12, color: c }}>
                <span style={{ fontWeight: 800 }}>{lbl}</span>
                <span style={{ opacity: .65, fontSize: 10 }}>{d}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <button onClick={startGame} style={P.playBtn}>Jouer</button>
          <button onClick={onQuit}    style={P.quitBtn}>Quitter</button>
        </div>
      </div>
    </div>
  );

  /* ── FINISHED ── */
  if (phase === 'finished') {
    const total = totalScore + roundScore;
    return (
      <div style={P.wrap}>
        <div style={P.finRow}>
          <div style={P.statGrid}>
            {([
              ['Score',  total,         '#f59e0b'],
              ['Manches', TOTAL_ROUNDS, '#fff'   ],
              ['Max',    TOTAL_ROUNDS * 1000, 'rgba(255,255,255,.45)'],
            ] as [string, number, string][]).map(([k, v, c]) => (
              <div key={k} style={P.statCard}>
                <div style={P.statLbl}>{k}</div>
                <div style={{ ...P.statVal, color: c }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            <button onClick={startGame} style={P.playBtn}>Rejouer</button>
            <button onClick={onQuit}    style={P.quitBtn}>Menu</button>
          </div>
        </div>
      </div>
    );
  }

  function adaptiveTextColor(r: number, g: number, b: number): string {
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return lum > 128 ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.85)';
  }

  const target = order.length > 0 ? TARGETS[order[roundIdx]] : TARGETS[0];
  const playerCss = `rgb(${pr},${pg},${pb})`;
  const targetCss = `rgb(${target.r},${target.g},${target.b})`;
  const playerXYZ = rgbToXYZ(pr, pg, pb);
  const targetXYZ = rgbToXYZ(target.r, target.g, target.b);
  const liveXYZ = xyzToxyY(playerXYZ);
  const targetxyY = xyzToxyY(targetXYZ);

  /* Distance bar color */
  const distBarColor = dist <= 0.025 ? '#4ade80' : dist <= 0.05 ? '#a3e635' : dist <= 0.1 ? '#f97316' : '#ef4444';
  const distBarPct = Math.max(0, Math.min(100, (1 - dist / 0.25) * 100));

  /* ── PLAYING / RESULT ── */
  return (
    <div style={P.wrap}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 20px' }}>
        {/* Compact header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.45)' }}>Manche</span>
            <span style={{ fontWeight: 800, color: '#e8eaf0' }}>{roundIdx + 1}/{TOTAL_ROUNDS}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 900, fontSize: 16, color: '#f59e0b' }}>{totalScore}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>pts</span>
          </div>
          <button onClick={onQuit} style={P.stopBtn}>⏹</button>
        </div>

        {/* Color swatches */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ ...P.glassCard, padding: 14, background: targetCss, minHeight: 80 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: adaptiveTextColor(target.r, target.g, target.b), marginBottom: 4 }}>CIBLE</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: adaptiveTextColor(target.r, target.g, target.b) }}>{target.name}</div>
            <div style={{ fontSize: 11, color: adaptiveTextColor(target.r, target.g, target.b), marginTop: 4 }}>R{target.r} G{target.g} B{target.b}</div>
          </div>
          <div style={{ ...P.glassCard, padding: 14, background: playerCss, minHeight: 80 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: adaptiveTextColor(pr, pg, pb), marginBottom: 4 }}>VOTRE RÉPONSE</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: adaptiveTextColor(pr, pg, pb) }}>R{pr} G{pg} B{pb}</div>
          </div>
        </div>

        {/* Sliders */}
        {phase === 'playing' && (
          <div style={{ ...P.glassCard, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            <div key={label} style={{ ...P.glassCard, padding: '8px 10px', fontSize: 11 }}>
              <div style={{ color: 'rgba(255,255,255,.4)', marginBottom: 2 }}>{label}</div>
              <div style={{ color: '#fff', fontWeight: 700 }}>{pVal}</div>
              <div style={{ color: 'rgba(255,255,255,.35)' }}>cible: {tVal}</div>
            </div>
          ))}
        </div>

        {/* Distance gauge */}
        {phase === 'playing' && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,.45)', marginBottom: 4 }}>
                <span>Distance XYZ</span>
                <span style={{ fontWeight: 700, color: distBarColor }}>{dist}{dist < WIN_THRESHOLD ? ' ✓ Excellent !' : ''}</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${distBarPct}%`, borderRadius: 4,
                  background: distBarColor, transition: 'width .15s, background .15s',
                }} />
              </div>
            </div>
            <button onClick={validate}
              style={{
                padding: '10px 28px', borderRadius: 12, border: 'none', flexShrink: 0,
                background: dist < WIN_THRESHOLD ? '#4ade80' : 'linear-gradient(135deg,#f59e0b,#ef4444)',
                color: dist < WIN_THRESHOLD ? '#000' : '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}>
              Valider
            </button>
          </div>
        )}

        {/* Result panel */}
        {phase === 'result' && (
          <div style={{
            ...P.glassCard,
            background: roundScore >= 700 ? 'rgba(74,222,128,.12)' : 'rgba(251,191,36,.10)',
            border: `1px solid ${roundScore >= 700 ? '#4ade80' : '#fbbf24'}33`,
            padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: roundScore >= 700 ? '#4ade80' : '#fbbf24' }}>
              {roundScore >= 800 ? '🎯 Parfait !' : roundScore >= 500 ? '✅ Bien !' : '🎨 Continuez à pratiquer'}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>Distance XYZ : <strong>{dist}</strong> (seuil : {WIN_THRESHOLD})</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#e8eaf0' }}>+{roundScore} pts</div>
            <button onClick={nextRound}
              style={{ marginTop: 4, padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' as const }}>
              {roundIdx + 1 < TOTAL_ROUNDS ? 'Manche suivante →' : 'Voir les résultats'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
