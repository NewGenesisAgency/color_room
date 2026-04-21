'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameTileProps } from './GameColorSpeed';

/* ---- CIE 1931 chromaticity boundary (horseshoe) ---- */
const HORSESHOE: [number, number][] = [
  [0.1741,0.0050],[0.1740,0.0050],[0.1738,0.0049],[0.1736,0.0050],[0.1730,0.0048],
  [0.1721,0.0048],[0.1714,0.0051],[0.1689,0.0082],[0.1644,0.0139],[0.1566,0.0214],
  [0.1440,0.0297],[0.1241,0.0578],[0.0913,0.1327],[0.0454,0.2950],[0.0082,0.5384],
  [0.0139,0.7502],[0.0743,0.8338],[0.1547,0.8059],[0.2296,0.7543],[0.3016,0.6923],
  [0.3731,0.6245],[0.4441,0.5547],[0.5125,0.4866],[0.5752,0.4242],[0.6270,0.3725],
  [0.6658,0.3340],[0.7006,0.2993],[0.7301,0.2700],[0.7548,0.2452],[0.7800,0.2200],
  [0.8000,0.2000],[0.8210,0.1790],[0.8507,0.1493],
];

const SPECTRAL_SAMPLES: { x: number; y: number; r: number; g: number; b: number; label: string }[] = [
  { x: 0.1741, y: 0.0050, r: 80,  g: 0,   b: 220, label: '380nm (Violet)'     },
  { x: 0.1582, y: 0.0237, r: 130, g: 0,   b: 255, label: '430nm (Violet clair)'},
  { x: 0.0732, y: 0.2399, r: 0,   g: 80,  b: 255, label: '480nm (Bleu)'        },
  { x: 0.1022, y: 0.5610, r: 0,   g: 255, b: 120, label: '520nm (Vert)'        },
  { x: 0.2153, y: 0.7749, r: 50,  g: 255, b: 0,   label: '560nm (Jaune-Vert)'  },
  { x: 0.3805, y: 0.6199, r: 200, g: 255, b: 0,   label: '590nm (Jaune)'       },
  { x: 0.5752, y: 0.4242, r: 255, g: 160, b: 0,   label: '610nm (Orange)'      },
  { x: 0.7006, y: 0.2993, r: 255, g: 60,  b: 0,   label: '650nm (Rouge)'       },
  { x: 0.8210, y: 0.1790, r: 255, g: 0,   b: 0,   label: '700nm (Rouge pur)'   },
];

const WHITE_D65 = { x: 0.3127, y: 0.3290, r: 255, g: 255, b: 240, label: 'Blanc D65' };

const TARGETS = [...SPECTRAL_SAMPLES, WHITE_D65];
const TOTAL_ROUNDS = 8;
const WIN_DIST = 0.03;

/* Diagram pixel from xy */
const DW = 420, DH = 360;
const PAD = 30;
function xyToSvg(x: number, y: number) {
  const px = PAD + x * (DW - 2 * PAD);
  const py = (DH - PAD) - y * (DH - 2 * PAD);
  return { px, py };
}

function svgToXY(px: number, py: number) {
  const x = (px - PAD) / (DW - 2 * PAD);
  const y = ((DH - PAD) - py) / (DH - 2 * PAD);
  return { x, y };
}

function xyDistance(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

export default function GameChasseurGamut({ onSendColor, onTurnOff, onTurnOffAll, onQuit, tileCount = 42 }: GameTileProps) {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'result' | 'finished'>('ready');
  const [roundIdx, setRoundIdx] = useState(0);
  const [order, setOrder] = useState<number[]>([]);
  const [clicked, setClicked] = useState<{ x: number; y: number } | null>(null);
  const [dist, setDist] = useState(0);
  const [roundScore, setRoundScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const svgRef = useRef<SVGSVGElement | null>(null);

  function shuffleOrder(): number[] {
    const arr = Array.from({ length: TARGETS.length }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, TOTAL_ROUNDS);
  }

  function lightTarget(tgtIdx: number) {
    const t = TARGETS[tgtIdx];
    const numTiles = Math.min(tileCount, 42);
    for (let i = 0; i < numTiles; i++) {
      onSendColor(i, t.r, t.g, t.b, 80);
    }
  }

  function startGame() {
    const ord = shuffleOrder();
    setOrder(ord);
    setRoundIdx(0);
    setTotalScore(0);
    setClicked(null);
    setPhase('playing');
    lightTarget(ord[0]);
  }

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (phase !== 'playing') return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const scaleX = DW / rect.width;
    const scaleY = DH / rect.height;
    const { x, y } = svgToXY(rawX * scaleX, rawY * scaleY);
    const cx = Math.max(0, Math.min(1, x));
    const cy = Math.max(0, Math.min(1, y));
    setClicked({ x: cx, y: cy });

    const tgt = TARGETS[order[roundIdx]];
    const d = xyDistance(cx, cy, tgt.x, tgt.y);
    const pts = Math.max(0, Math.round(1000 * (1 - d / 0.3)));
    setDist(parseFloat(d.toFixed(4)));
    setRoundScore(pts);
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
    setClicked(null);
    setPhase('playing');
    lightTarget(order[next]);
  }

  useEffect(() => { return () => onTurnOffAll(); }, []);

  const horseSvgPath = HORSESHOE.map(([x, y], i) => {
    const { px, py } = xyToSvg(x, y);
    return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(' ') + ' Z';

  const sRGBPoints = [
    xyToSvg(0.64, 0.33),
    xyToSvg(0.30, 0.60),
    xyToSvg(0.15, 0.06),
  ];
  const sRGBPath = sRGBPoints.map(({ px, py }, i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ') + ' Z';

  if (phase === 'ready') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 40 }}>
      <div style={{ fontSize: 48 }}>🎯</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Chasseur de Gamut</h2>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', maxWidth: 420, lineHeight: 1.6 }}>
        Une couleur s'affiche sur les dalles Lumen.<br />
        Cliquez sur le <strong>point exact du diagramme chromatique CIE 1931</strong> correspondant.<br />
        <span style={{ color: '#38bdf8' }}>Score basé sur la précision (distance xy)</span>
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={startGame} style={{ padding: '14px 36px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#06d6a0,#4361ee)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>Jouer</button>
        <button onClick={onQuit} style={{ padding: '14px 24px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Quitter</button>
      </div>
    </div>
  );

  if (phase === 'finished') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 40 }}>
      <div style={{ fontSize: 48 }}>{totalScore + roundScore >= 6000 ? '🏆' : '🎨'}</div>
      <h2 style={{ fontSize: 22, fontWeight: 800 }}>Terminé !</h2>
      <div style={{ fontSize: 48, fontWeight: 800, color: '#38bdf8' }}>{totalScore + roundScore}</div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>/{TOTAL_ROUNDS * 1000} points</div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={startGame} style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#06d6a0,#4361ee)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Rejouer</button>
        <button onClick={onQuit} style={{ padding: '12px 20px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Menu</button>
      </div>
    </div>
  );

  const tgt = order.length > 0 ? TARGETS[order[roundIdx]] : TARGETS[0];
  const tgtSvg = xyToSvg(tgt.x, tgt.y);
  const clickSvg = clicked ? xyToSvg(clicked.x, clicked.y) : null;
  const whiteSvg = xyToSvg(WHITE_D65.x, WHITE_D65.y);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700 }}>Manche {roundIdx + 1}/{TOTAL_ROUNDS}</span>
        <span style={{ fontWeight: 800, fontSize: 18, color: '#38bdf8' }}>{totalScore} pts</span>
        <button onClick={() => { onTurnOffAll(); onQuit(); }} style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' }}>⏹</button>
      </div>

      {/* Target color hint */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: `rgb(${tgt.r},${tgt.g},${tgt.b})`, flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700 }}>{tgt.label}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            {phase === 'playing' ? 'Cliquez sur le diagramme !' : `x=${tgt.x.toFixed(4)}, y=${tgt.y.toFixed(4)}`}
          </div>
        </div>
      </div>

      {/* Chromaticity diagram */}
      <div style={{ borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${DW} ${DH}`}
          width="100%"
          style={{ display: 'block', cursor: phase === 'playing' ? 'crosshair' : 'default' }}
          onClick={handleSvgClick}
        >
          {/* Background gradient hint */}
          <defs>
            <radialGradient id="gamut-bg" cx="30%" cy="30%">
              <stop offset="0%" stopColor="#6600ff" stopOpacity="0.15" />
              <stop offset="40%" stopColor="#00ff88" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#ff4400" stopOpacity="0.1" />
            </radialGradient>
          </defs>
          <rect width={DW} height={DH} fill="#0a0a14" />

          {/* Horseshoe */}
          <path d={horseSvgPath} fill="url(#gamut-bg)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />

          {/* sRGB triangle */}
          <path d={sRGBPath} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4,4" />

          {/* Spectral locus dots */}
          {SPECTRAL_SAMPLES.map((s, i) => {
            const { px, py } = xyToSvg(s.x, s.y);
            return (
              <g key={i}>
                <circle cx={px} cy={py} r={4} fill={`rgb(${s.r},${s.g},${s.b})`} opacity={0.8} />
              </g>
            );
          })}

          {/* White point */}
          <circle cx={whiteSvg.px} cy={whiteSvg.py} r={5} fill="#fff" opacity={0.6} />
          <text x={whiteSvg.px + 7} y={whiteSvg.py + 4} fill="rgba(255,255,255,0.5)" fontSize="9">D65</text>

          {/* Axis labels */}
          <text x={DW / 2} y={DH - 4} fill="rgba(255,255,255,0.3)" fontSize="10" textAnchor="middle">x</text>
          <text x={8} y={DH / 2} fill="rgba(255,255,255,0.3)" fontSize="10" textAnchor="middle" transform={`rotate(-90 8 ${DH / 2})`}>y</text>

          {/* Player click */}
          {clickSvg && (
            <g>
              <circle cx={clickSvg.px} cy={clickSvg.py} r={8} fill="none" stroke="#fff" strokeWidth={2} />
              <circle cx={clickSvg.px} cy={clickSvg.py} r={3} fill="#fff" />
            </g>
          )}

          {/* Target (revealed after click) */}
          {phase === 'result' && (
            <g>
              <circle cx={tgtSvg.px} cy={tgtSvg.py} r={10} fill="none" stroke="#4ade80" strokeWidth={2.5} />
              <circle cx={tgtSvg.px} cy={tgtSvg.py} r={4} fill="#4ade80" />
              {clickSvg && (
                <line x1={clickSvg.px} y1={clickSvg.py} x2={tgtSvg.px} y2={tgtSvg.py}
                  stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} strokeDasharray="4,3" />
              )}
            </g>
          )}
        </svg>
      </div>

      {/* Result */}
      {phase === 'result' && (
        <div style={{ background: roundScore >= 700 ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)', border: `1px solid ${roundScore >= 700 ? '#4ade8033' : '#fbbf2433'}`, borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, color: roundScore >= 700 ? '#4ade80' : '#fbbf24' }}>
              {roundScore >= 800 ? '🎯 Excellent !' : roundScore >= 500 ? '✅ Bien !' : '❌ Raté'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
              Distance xy = {dist} · Cible : x={tgt.x.toFixed(4)}, y={tgt.y.toFixed(4)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>+{roundScore}</div>
            <button onClick={nextRound}
              style={{ marginTop: 6, padding: '8px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#06d6a0,#4361ee)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {roundIdx + 1 < TOTAL_ROUNDS ? 'Suivant →' : 'Résultats'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
