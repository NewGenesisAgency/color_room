'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Crosshair, Trophy, X } from 'lucide-react';
import type { GameTileProps } from './GameColorSpeed';

/* ── CIE 1931 horseshoe boundary (spectral locus + purple line) ── */
const HORSESHOE: [number, number][] = [
  [0.1741,0.0050],[0.1740,0.0050],[0.1738,0.0049],[0.1736,0.0050],[0.1730,0.0048],
  [0.1721,0.0048],[0.1714,0.0051],[0.1689,0.0082],[0.1644,0.0139],[0.1566,0.0214],
  [0.1440,0.0297],[0.1241,0.0578],[0.0913,0.1327],[0.0454,0.2950],[0.0082,0.5384],
  [0.0139,0.7502],[0.0743,0.8338],[0.1547,0.8059],[0.2296,0.7543],[0.3016,0.6923],
  [0.3731,0.6245],[0.4441,0.5547],[0.5125,0.4866],[0.5752,0.4242],[0.6270,0.3725],
  [0.6658,0.3340],[0.7006,0.2993],[0.7301,0.2700],[0.7548,0.2452],[0.7800,0.2200],
  [0.8000,0.2000],[0.8210,0.1790],[0.8507,0.1493],
];

/* ── Diagram coordinate system ── */
const DW = 420, DH = 380;
const X_MIN = 0, X_MAX = 0.85, Y_MIN = 0, Y_MAX = 0.92;
const PAD_L = 28, PAD_R = 14, PAD_T = 10, PAD_B = 22;

function xyToSvg(x: number, y: number) {
  const px = PAD_L + (x - X_MIN) / (X_MAX - X_MIN) * (DW - PAD_L - PAD_R);
  const py = (DH - PAD_B) - (y - Y_MIN) / (Y_MAX - Y_MIN) * (DH - PAD_T - PAD_B);
  return { px, py };
}
function svgToXy(px: number, py: number) {
  return {
    x: (px - PAD_L) / (DW - PAD_L - PAD_R) * (X_MAX - X_MIN) + X_MIN,
    y: ((DH - PAD_B) - py) / (DH - PAD_T - PAD_B) * (Y_MAX - Y_MIN) + Y_MIN,
  };
}

/* ── Point-in-polygon (ray casting) ── */
function inHorseshoe(cx: number, cy: number): boolean {
  let inside = false;
  for (let i = 0, j = HORSESHOE.length - 1; i < HORSESHOE.length; j = i++) {
    const [xi, yi] = HORSESHOE[i], [xj, yj] = HORSESHOE[j];
    if ((yi > cy) !== (yj > cy) && cx < (xj - xi) * (cy - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ── CIE XYZ D65 → sRGB (IEC 61966-2-1) with gamut desaturation ── */
function xyToRgb255(x: number, y: number): { r: number; g: number; b: number } | null {
  if (y < 1e-8 || x < 0 || x + y > 1) return null;
  const X = x / y, Y = 1.0, Z = (1 - x - y) / y;
  let r =  3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b =  0.0557 * X - 0.2040 * Y + 1.0570 * Z;
  // Shift out-of-gamut toward white (additive desaturation)
  const mn = Math.min(r, g, b);
  if (mn < 0) { r -= mn; g -= mn; b -= mn; }
  // Normalize to max luminance
  const mx = Math.max(r, g, b, 1e-9);
  r /= mx; g /= mx; b /= mx;
  // sRGB gamma (IEC 61966-2-1)
  const gam = (c: number) => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return {
    r: Math.round(Math.min(1, Math.max(0, gam(r))) * 255),
    g: Math.round(Math.min(1, Math.max(0, gam(g))) * 255),
    b: Math.round(Math.min(1, Math.max(0, gam(b))) * 255),
  };
}

/* ── Game targets ── */
const TARGETS = [
  { x: 0.1741, y: 0.0050, label: '380 nm — Violet extrême' },
  { x: 0.0732, y: 0.2399, label: '480 nm — Bleu cyan' },
  { x: 0.1022, y: 0.5610, label: '520 nm — Vert vif' },
  { x: 0.2153, y: 0.7749, label: '560 nm — Vert-jaune' },
  { x: 0.3805, y: 0.6199, label: '590 nm — Jaune' },
  { x: 0.5752, y: 0.4242, label: '610 nm — Orange' },
  { x: 0.7006, y: 0.2993, label: '650 nm — Rouge vif' },
  { x: 0.8210, y: 0.1790, label: '700 nm — Rouge pur' },
  { x: 0.3127, y: 0.3290, label: 'Blanc D65' },
];

const TOTAL_ROUNDS = 8;
const AUTO_S = 4;

/* ── Styles ──────────────────────────────────────────────────────────── */
const G: Record<string, React.CSSProperties> = {
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
    background: 'linear-gradient(135deg,rgba(6,214,160,.25),rgba(67,97,238,.2))',
    border: '1px solid rgba(6,214,160,.4)', borderRadius: 8,
    padding: '3px 10px', fontSize: 12, fontWeight: 800, color: '#06d6a0',
    marginBottom: 8, letterSpacing: '.04em',
  },
  rules: {
    fontSize: 13, color: 'rgba(255,255,255,.62)', lineHeight: 1.65, margin: '0 0 10px',
  },
  playBtn: {
    padding: '11px 26px', borderRadius: 14, border: 'none',
    background: 'linear-gradient(135deg,#06d6a0,#4361ee)',
    boxShadow: '0 4px 20px rgba(6,214,160,.35), inset 0 1px 0 rgba(255,255,255,.15)',
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

export default function GameChasseurGamut({ onSendColor, onTurnOffAll, onQuit, tileCount = 42 }: GameTileProps) {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'result' | 'finished'>('ready');
  const [roundIdx, setRoundIdx] = useState(0);
  const [order, setOrder] = useState<number[]>([]);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [confirmed, setConfirmed] = useState<{ x: number; y: number } | null>(null);
  const [dist, setDist] = useState(0);
  const [roundScore, setRoundScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [countdown, setCountdown] = useState(AUTO_S);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const hwTimerRef = useRef<number>(0);
  const numTiles = Math.min(tileCount, 42);

  /* Draw the CIE 1931 diagram on canvas (once on mount) */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const iw = canvas.width, ih = canvas.height;
    const img = ctx.createImageData(iw, ih);
    for (let py = 0; py < ih; py++) {
      for (let px = 0; px < iw; px++) {
        const diagX = px * (DW / iw), diagY = py * (DH / ih);
        const { x, y } = svgToXy(diagX, diagY);
        const idx = (py * iw + px) * 4;
        if (!inHorseshoe(x, y) || x < X_MIN || y < Y_MIN || x > X_MAX || y > Y_MAX) {
          img.data[idx] = 8; img.data[idx + 1] = 8; img.data[idx + 2] = 18; img.data[idx + 3] = 255;
          continue;
        }
        const c = xyToRgb255(x, y);
        if (c) {
          img.data[idx] = c.r; img.data[idx + 1] = c.g; img.data[idx + 2] = c.b; img.data[idx + 3] = 255;
        } else {
          img.data[idx] = 8; img.data[idx + 1] = 8; img.data[idx + 2] = 18; img.data[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  /* Send cursor color to tiles (debounced 30 ms) */
  const sendToTiles = useCallback((x: number, y: number) => {
    window.clearTimeout(hwTimerRef.current);
    hwTimerRef.current = window.setTimeout(() => {
      const c = xyToRgb255(x, y);
      if (!c) return;
      for (let i = 0; i < numTiles; i++) onSendColor(i, c.r, c.g, c.b, 80);
    }, 30);
  }, [numTiles, onSendColor]);

  /* Auto-advance countdown after confirming */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase !== 'result') return;
    let n = AUTO_S;
    setCountdown(n);
    const id = window.setInterval(() => {
      n--;
      setCountdown(n);
      if (n <= 0) {
        window.clearInterval(id);
        /* inline next-round logic to avoid stale closure */
        setTotalScore(s => s + roundScore);
        const next = roundIdx + 1;
        if (next >= TOTAL_ROUNDS) { onTurnOffAll(); setPhase('finished'); }
        else {
          setRoundIdx(next);
          setCursor(null); setConfirmed(null);
          setPhase('playing');
          const t = TARGETS[order[next]];
          const c = xyToRgb255(t.x, t.y) ?? { r: 200, g: 200, b: 200 };
          for (let i = 0; i < numTiles; i++) onSendColor(i, c.r, c.g, c.b, 80);
        }
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]); // intentional: capture roundScore/roundIdx/order at phase transition

  useEffect(() => () => { onTurnOffAll(); window.clearTimeout(hwTimerRef.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function shuffle(): number[] {
    const arr = TARGETS.map((_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, TOTAL_ROUNDS);
  }

  function startGame() {
    const ord = shuffle();
    setOrder(ord); setRoundIdx(0); setTotalScore(0);
    setCursor(null); setConfirmed(null); setPhase('playing');
    const t = TARGETS[ord[0]];
    const c = xyToRgb255(t.x, t.y) ?? { r: 200, g: 200, b: 200 };
    for (let i = 0; i < numTiles; i++) onSendColor(i, c.r, c.g, c.b, 80);
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (phase !== 'playing') return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) * (DW / rect.width);
    const py = (e.clientY - rect.top) * (DH / rect.height);
    const { x, y } = svgToXy(px, py);
    const cx = Math.max(X_MIN, Math.min(X_MAX, x));
    const cy = Math.max(Y_MIN, Math.min(Y_MAX, y));
    setCursor({ x: cx, y: cy });
    if (inHorseshoe(cx, cy)) sendToTiles(cx, cy);
  }

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (phase !== 'playing' || !cursor) return;
    e.preventDefault();
    const tgt = TARGETS[order[roundIdx]];
    const d = Math.sqrt((cursor.x - tgt.x) ** 2 + (cursor.y - tgt.y) ** 2);
    const pts = Math.max(0, Math.round(1000 * (1 - d / 0.3)));
    setConfirmed(cursor);
    setDist(parseFloat(d.toFixed(4)));
    setRoundScore(pts);
    setPhase('result');
    /* reveal target color on tiles */
    const c = xyToRgb255(tgt.x, tgt.y) ?? { r: 255, g: 255, b: 255 };
    for (let i = 0; i < numTiles; i++) onSendColor(i, c.r, c.g, c.b, 80);
  }

  /* SVG path for horseshoe outline */
  const horseSvgPath = HORSESHOE.map(([x, y], i) => {
    const { px, py } = xyToSvg(x, y);
    return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(' ') + ' Z';

  const tgt = order.length > 0 ? TARGETS[order[roundIdx]] : TARGETS[0];
  const tgtSvg = xyToSvg(tgt.x, tgt.y);
  const curSvg = cursor ? xyToSvg(cursor.x, cursor.y) : null;
  const confSvg = confirmed ? xyToSvg(confirmed.x, confirmed.y) : null;
  const curColor = cursor ? xyToRgb255(cursor.x, cursor.y) : null;

  /* sRGB primaries triangle */
  const srgbPts = [[0.64, 0.33], [0.30, 0.60], [0.15, 0.06]].map(([x, y]) => xyToSvg(x, y));
  const srgbPath = srgbPts.map(({ px, py }, i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ') + ' Z';

  /* ── READY ── */
  if (phase === 'ready') return (
    <div style={G.wrap}>
      <div style={G.readyRow}>
        <div style={{ flex: 1 }}>
          <span style={G.tag}>🎯 Chasseur de Gamut</span>
          <p style={G.rules}>
            Une couleur s&apos;affiche sur les dalles Lumen.
            Déplacez le curseur sur le <em>diagramme CIE 1931</em> pour retrouver cette couleur.
            <span style={{ color: '#38bdf8', marginLeft: 6 }}>Cliquez pour confirmer — avance automatique après.</span>
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <button onClick={startGame} style={G.playBtn}>Jouer</button>
          <button onClick={onQuit}    style={G.quitBtn}>Quitter</button>
        </div>
      </div>
    </div>
  );

  /* ── FINISHED ── */
  if (phase === 'finished') return (
    <div style={G.wrap}>
      <div style={G.finRow}>
        <div style={G.statGrid}>
          {([
            ['Score',   totalScore + roundScore, '#06d6a0'],
            ['Manches', TOTAL_ROUNDS,             '#fff'   ],
            ['Max',     TOTAL_ROUNDS * 1000,      'rgba(255,255,255,.45)'],
          ] as [string, number, string][]).map(([k, v, c]) => (
            <div key={k} style={G.statCard}>
              <div style={G.statLbl}>{k}</div>
              <div style={{ ...G.statVal, color: c }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <button onClick={startGame} style={G.playBtn}>Rejouer</button>
          <button onClick={onQuit}    style={G.quitBtn}>Menu</button>
        </div>
      </div>
    </div>
  );

  /* ── PLAYING / RESULT ── */
  return (
    <div style={G.wrap}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 16px' }}>
        {/* Compact header bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10 }}>
          <span style={{ fontWeight: 700, color: '#e8eaf0', fontSize: 13 }}>Manche {roundIdx + 1}/{TOTAL_ROUNDS}</span>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#06d6a0' }}>{totalScore} pts</span>
          <button onClick={() => { onTurnOffAll(); onQuit(); }} style={G.stopBtn}>
            <X size={12} />
          </button>
        </div>

        {/* Info bar */}
        <div style={{ ...G.glassCard, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{tgt.label}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>
              {phase === 'playing'
                ? (cursor ? `x=${cursor.x.toFixed(3)}, y=${cursor.y.toFixed(3)}` : 'Déplacez le curseur sur le diagramme')
                : `x=${tgt.x.toFixed(4)}, y=${tgt.y.toFixed(4)}`}
            </div>
          </div>
          {curColor && phase === 'playing' && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: `rgb(${curColor.r},${curColor.g},${curColor.b})`, border: '1px solid rgba(255,255,255,.2)', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>curseur</span>
            </div>
          )}
        </div>

        {/* CIE Diagram — canvas background + SVG overlay */}
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,.10)' }}>
          <canvas ref={canvasRef} width={DW} height={DH} style={{ display: 'block', width: '100%', height: 'auto' }} />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${DW} ${DH}`}
            width="100%"
            style={{ position: 'absolute', top: 0, left: 0, cursor: phase === 'playing' ? 'none' : 'default' }}
            onMouseMove={handleMouseMove}
            onClick={handleClick}
          >
            {/* Horseshoe outline */}
            <path d={horseSvgPath} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            {/* sRGB triangle */}
            <path d={srgbPath} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="5,4" />
            {/* sRGB labels */}
            {(() => { const {px,py}=xyToSvg(0.64,0.33); return <text x={px+4} y={py-4} fill="rgba(255,255,255,0.4)" fontSize="8">R</text>; })()}
            {(() => { const {px,py}=xyToSvg(0.30,0.60); return <text x={px-8} y={py-4} fill="rgba(255,255,255,0.4)" fontSize="8">G</text>; })()}
            {(() => { const {px,py}=xyToSvg(0.15,0.06); return <text x={px-8} y={py+10} fill="rgba(255,255,255,0.4)" fontSize="8">B</text>; })()}
            {/* Axis ticks */}
            {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map(v => { const { px } = xyToSvg(v, 0); return <text key={v} x={px} y={DH - 5} fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="middle">{v.toFixed(1)}</text>; })}
            {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map(v => { const { py } = xyToSvg(0, v); return <text key={v} x={PAD_L - 3} y={py + 3} fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="end">{v.toFixed(1)}</text>; })}
            {/* Axis labels */}
            <text x={DW / 2} y={DH - 3} fill="rgba(255,255,255,0.4)" fontSize="10" textAnchor="middle" fontStyle="italic">x</text>
            <text x={8} y={DH / 2} fill="rgba(255,255,255,0.4)" fontSize="10" textAnchor="middle" fontStyle="italic" transform={`rotate(-90 8 ${DH / 2})`}>y</text>
            {/* White point D65 */}
            {(() => { const { px, py } = xyToSvg(0.3127, 0.3290); return <><circle cx={px} cy={py} r={4} fill="#fff" opacity={0.65} /><text x={px + 6} y={py + 4} fill="rgba(255,255,255,0.5)" fontSize="8">D65</text></>; })()}
            {/* Moving cursor crosshair */}
            {curSvg && phase === 'playing' && (
              <g>
                <line x1={curSvg.px - 14} y1={curSvg.py} x2={curSvg.px + 14} y2={curSvg.py} stroke="#fff" strokeWidth={1.5} />
                <line x1={curSvg.px} y1={curSvg.py - 14} x2={curSvg.px} y2={curSvg.py + 14} stroke="#fff" strokeWidth={1.5} />
                <circle cx={curSvg.px} cy={curSvg.py} r={7} fill="none" stroke="#fff" strokeWidth={1.5} />
                {curColor && <circle cx={curSvg.px} cy={curSvg.py} r={3} fill={`rgb(${curColor.r},${curColor.g},${curColor.b})`} />}
              </g>
            )}
            {/* Confirmed position */}
            {confSvg && phase === 'result' && (
              <g>
                <circle cx={confSvg.px} cy={confSvg.py} r={9} fill="none" stroke="#fff" strokeWidth={2} />
                <circle cx={confSvg.px} cy={confSvg.py} r={3} fill="#fff" />
              </g>
            )}
            {/* Target revealed after click */}
            {phase === 'result' && (
              <g>
                <circle cx={tgtSvg.px} cy={tgtSvg.py} r={11} fill="none" stroke="#4ade80" strokeWidth={2.5} />
                <circle cx={tgtSvg.px} cy={tgtSvg.py} r={4} fill="#4ade80" />
                {confSvg && (
                  <line x1={confSvg.px} y1={confSvg.py} x2={tgtSvg.px} y2={tgtSvg.py} stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} strokeDasharray="4,3" />
                )}
              </g>
            )}
          </svg>
        </div>

        {/* Result bar (auto-advances) */}
        {phase === 'result' && (
          <div style={{
            ...G.glassCard,
            background: roundScore >= 700 ? 'rgba(74,222,128,.10)' : 'rgba(251,191,36,.10)',
            border: `1px solid ${roundScore >= 700 ? '#4ade8033' : '#fbbf2433'}`,
            padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontWeight: 800, color: roundScore >= 700 ? '#4ade80' : '#fbbf24' }}>
                {roundScore >= 800 ? 'Excellent !' : roundScore >= 500 ? 'Bien !' : 'Raté'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>
                Distance xy = {dist}
              </div>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#e8eaf0' }}>+{roundScore} pts</div>
              <div style={{ fontSize: 12, color: '#06d6a0', fontWeight: 700 }}>
                {roundIdx + 1 < TOTAL_ROUNDS ? `Suivant dans ${countdown}s` : `Résultats dans ${countdown}s`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
