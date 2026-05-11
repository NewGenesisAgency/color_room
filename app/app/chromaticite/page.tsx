'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ── CIE 1931 spectral locus (horseshoe boundary) ────────────────────────────
const HORSESHOE: [number, number][] = [
  [0.1741,0.0050],[0.1740,0.0050],[0.1738,0.0049],[0.1736,0.0050],[0.1730,0.0048],
  [0.1721,0.0048],[0.1714,0.0051],[0.1689,0.0082],[0.1644,0.0139],[0.1566,0.0214],
  [0.1440,0.0297],[0.1241,0.0578],[0.0913,0.1327],[0.0454,0.2950],[0.0082,0.5384],
  [0.0139,0.7502],[0.0743,0.8338],[0.1547,0.8059],[0.2296,0.7543],[0.3016,0.6923],
  [0.3731,0.6245],[0.4441,0.5547],[0.5125,0.4866],[0.5752,0.4242],[0.6270,0.3725],
  [0.6658,0.3340],[0.7006,0.2993],[0.7301,0.2700],[0.7548,0.2452],[0.7800,0.2200],
  [0.8000,0.2000],[0.8210,0.1790],[0.8507,0.1493],
];

// Wavelength labels on the spectral locus (index into HORSESHOE, wavelength nm)
const WL_LABELS: { idx: number; nm: number; offset: [number, number] }[] = [
  { idx: 0,  nm: 380, offset: [6, -4] },
  { idx: 6,  nm: 420, offset: [6, 2] },
  { idx: 10, nm: 460, offset: [6, 4] },
  { idx: 13, nm: 490, offset: [-30, 0] },
  { idx: 16, nm: 520, offset: [6, -6] },
  { idx: 19, nm: 550, offset: [6, -4] },
  { idx: 22, nm: 580, offset: [6, 4] },
  { idx: 24, nm: 600, offset: [6, 4] },
  { idx: 26, nm: 620, offset: [6, 4] },
  { idx: 29, nm: 660, offset: [8, 4] },
  { idx: 32, nm: 700, offset: [6, 10] },
];

// Planckian locus (blackbody radiation, key temperatures)
const PLANCKIAN: { K: number; x: number; y: number }[] = [
  { K: 1000, x: 0.6499, y: 0.3474 },
  { K: 1500, x: 0.5856, y: 0.3831 },
  { K: 2000, x: 0.5267, y: 0.4133 },
  { K: 2500, x: 0.4770, y: 0.4137 },
  { K: 3000, x: 0.4369, y: 0.4041 },
  { K: 3500, x: 0.4053, y: 0.3907 },
  { K: 4000, x: 0.3805, y: 0.3768 },
  { K: 4500, x: 0.3608, y: 0.3636 },
  { K: 5000, x: 0.3451, y: 0.3516 },
  { K: 5500, x: 0.3329, y: 0.3411 },
  { K: 6000, x: 0.3221, y: 0.3318 },
  { K: 6500, x: 0.3135, y: 0.3237 },
  { K: 7000, x: 0.3064, y: 0.3166 },
  { K: 8000, x: 0.2952, y: 0.3048 },
  { K: 10000,x: 0.2812, y: 0.2882 },
];

// ── Canvas geometry ──────────────────────────────────────────────────────────
const DW = 460, DH = 420;
const X_MIN = 0, X_MAX = 0.85, Y_MIN = 0, Y_MAX = 0.92;
const PAD_L = 32, PAD_R = 16, PAD_T = 12, PAD_B = 28;

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

// ── Point-in-horseshoe (ray casting) ────────────────────────────────────────
function inHorseshoe(cx: number, cy: number): boolean {
  let inside = false;
  for (let i = 0, j = HORSESHOE.length - 1; i < HORSESHOE.length; j = i++) {
    const [xi, yi] = HORSESHOE[i], [xj, yj] = HORSESHOE[j];
    if ((yi > cy) !== (yj > cy) && cx < (xj - xi) * (cy - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ── CIE XYZ → sRGB ──────────────────────────────────────────────────────────
function xyToRgb255(x: number, y: number): { r: number; g: number; b: number } | null {
  if (y < 1e-8 || x < 0 || x + y > 1) return null;
  const X = x / y, Y = 1.0, Z = (1 - x - y) / y;
  let r =  3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b =  0.0557 * X - 0.2040 * Y + 1.0570 * Z;
  const mn = Math.min(r, g, b);
  if (mn < 0) { r -= mn; g -= mn; b -= mn; }
  const mx = Math.max(r, g, b, 1e-9);
  r /= mx; g /= mx; b /= mx;
  const gam = (c: number) => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return {
    r: Math.round(Math.min(1, Math.max(0, gam(r))) * 255),
    g: Math.round(Math.min(1, Math.max(0, gam(g))) * 255),
    b: Math.round(Math.min(1, Math.max(0, gam(b))) * 255),
  };
}

// ── sRGB primaries triangle ──────────────────────────────────────────────────
const SRGB_PRIMARIES = [[0.64, 0.33], [0.30, 0.60], [0.15, 0.06]];

// ── Hardware API ─────────────────────────────────────────────────────────────
function rgbToChannels32(r: number, g: number, b: number, intensity: number): number[] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const sc = intensity / 100;
  const y = Math.min(rn, gn), w = (rn + gn + bn) / 3;
  const ch = Array(32).fill(0);
  ch[0] = Math.round(bn * 255 * 1.0 * sc);
  ch[1] = Math.round(bn * 255 * 0.85 * sc);
  ch[4] = Math.round(bn * 255 * 0.8 * sc);
  ch[5] = Math.round(gn * 255 * 1.0 * sc);
  ch[6] = Math.round(gn * 255 * 0.75 * sc);
  ch[7] = Math.round(y * 255 * 1.0 * sc);
  ch[8] = Math.round(y * 255 * 0.85 * sc);
  ch[10] = Math.round(rn * 255 * 0.7 * sc);
  ch[11] = Math.round(rn * 255 * 1.0 * sc);
  ch[12] = Math.round(rn * 255 * 0.9 * sc);
  ch[18] = Math.round(y * 255 * 0.9 * sc);
  ch[19] = Math.round(y * 255 * 0.75 * sc);
  ch[25] = Math.round(w * 255 * 1.0 * sc);
  ch[26] = Math.round(w * 255 * 0.85 * sc);
  return ch.map(v => Math.max(0, Math.min(255, v)));
}

async function sendColorToAllPlates(r: number, g: number, b: number, intensity = 85) {
  const channels = rgbToChannels32(r, g, b, intensity);
  const channelArray = channels.map((v, i) => ({ index: i, value: v }));
  const sends: Promise<void>[] = [];
  for (let plateId = 1; plateId <= 42; plateId++) {
    sends.push(
      fetch('/api/supervision/batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plateId, channels: channelArray, fast: true }),
        cache: 'no-store',
      }).then(() => {}).catch(() => {})
    );
  }
  await Promise.all(sends);
}

async function clearAllPlates() {
  const channels = Array.from({ length: 32 }, (_, i) => ({ index: i, value: 0 }));
  for (let plateId = 1; plateId <= 42; plateId++) {
    fetch('/api/supervision/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plateId, channels }),
      cache: 'no-store',
    }).catch(() => {});
  }
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ChromaticitePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const hwTimerRef = useRef<number>(0);

  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [intensity, setIntensity] = useState(85);
  const [liveOnPlates, setLiveOnPlates] = useState(false);

  const cursorRgb = cursor ? xyToRgb255(cursor.x, cursor.y) : null;
  const selectedRgb = selected ? xyToRgb255(selected.x, selected.y) : null;

  // Draw the CIE 1931 diagram on canvas
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
        const idx4 = (py * iw + px) * 4;
        if (!inHorseshoe(x, y) || x < X_MIN || y < Y_MIN || x > X_MAX || y > Y_MAX) {
          img.data[idx4] = 6; img.data[idx4+1] = 8; img.data[idx4+2] = 18; img.data[idx4+3] = 255;
          continue;
        }
        const c = xyToRgb255(x, y);
        if (c) {
          img.data[idx4] = c.r; img.data[idx4+1] = c.g; img.data[idx4+2] = c.b; img.data[idx4+3] = 255;
        } else {
          img.data[idx4] = 6; img.data[idx4+1] = 8; img.data[idx4+2] = 18; img.data[idx4+3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  // Send cursor color to plates live (debounced 40ms)
  const sendLiveToPlates = useCallback((x: number, y: number) => {
    if (!liveOnPlates) return;
    window.clearTimeout(hwTimerRef.current);
    hwTimerRef.current = window.setTimeout(() => {
      const c = xyToRgb255(x, y);
      if (!c) return;
      sendColorToAllPlates(c.r, c.g, c.b, intensity).catch(() => {});
    }, 40);
  }, [liveOnPlates, intensity]);

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) * (DW / rect.width);
    const py = (e.clientY - rect.top) * (DH / rect.height);
    const { x, y } = svgToXy(px, py);
    const cx = Math.max(X_MIN, Math.min(X_MAX, x));
    const cy = Math.max(Y_MIN, Math.min(Y_MAX, y));
    setCursor({ x: cx, y: cy });
    if (inHorseshoe(cx, cy)) sendLiveToPlates(cx, cy);
  }

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) * (DW / rect.width);
    const py = (e.clientY - rect.top) * (DH / rect.height);
    const { x, y } = svgToXy(px, py);
    const cx = Math.max(X_MIN, Math.min(X_MAX, x));
    const cy = Math.max(Y_MIN, Math.min(Y_MAX, y));
    setSelected({ x: cx, y: cy });
  }

  async function handleSendToPlates() {
    if (!selected) return;
    const c = xyToRgb255(selected.x, selected.y);
    if (!c) return;
    setSending(true);
    await sendColorToAllPlates(c.r, c.g, c.b, intensity);
    setSending(false);
    setSentOk(true);
    window.setTimeout(() => setSentOk(false), 1500);
  }

  useEffect(() => {
    return () => {
      window.clearTimeout(hwTimerRef.current);
      clearAllPlates();
    };
  }, []);

  // SVG path for horseshoe outline
  const horsePath = HORSESHOE.map(([x, y], i) => {
    const { px, py } = xyToSvg(x, y);
    return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(' ') + ' Z';

  // sRGB triangle path
  const srgbPts = SRGB_PRIMARIES.map(([x, y]) => xyToSvg(x, y));
  const srgbPath = srgbPts.map(({ px, py }, i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ') + ' Z';

  // Planckian locus path
  const planckPath = PLANCKIAN.map(({ x, y }, i) => {
    const { px, py } = xyToSvg(x, y);
    return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(' ');

  const curSvg = cursor ? xyToSvg(cursor.x, cursor.y) : null;
  const selSvg = selected ? xyToSvg(selected.x, selected.y) : null;

  // Approximate closest wavelength from selected xy
  function approxWavelength(x: number, y: number): number | null {
    let best = Infinity, bestNm = null;
    for (const { idx, nm } of WL_LABELS) {
      const [hx, hy] = HORSESHOE[idx];
      const d = Math.hypot(x - hx, y - hy);
      if (d < best) { best = d; bestNm = nm; }
    }
    return best < 0.08 ? bestNm : null;
  }

  const selWl = selected ? approxWavelength(selected.x, selected.y) : null;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg,#06080f 0%,#0a0d1a 100%)',
      color: '#e8eaf0',
      fontFamily: 'system-ui, sans-serif',
      padding: '28px 20px',
    }}>
      {/* Header */}
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#e8eaf0' }}>
            Diagramme de Chromaticité CIE 1931
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
            Cliquez sur le diagramme pour sélectionner une couleur et l'envoyer aux dalles Lumen
          </p>
        </div>

        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* ── Diagram ── */}
          <div style={{ flex: '1 1 460px', minWidth: 320 }}>
            <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
              <canvas
                ref={canvasRef}
                width={DW}
                height={DH}
                style={{ display: 'block', width: '100%', height: 'auto' }}
              />
              <svg
                ref={svgRef}
                viewBox={`0 0 ${DW} ${DH}`}
                width="100%"
                style={{ position: 'absolute', top: 0, left: 0, cursor: 'crosshair' }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setCursor(null)}
                onClick={handleClick}
              >
                {/* Horseshoe outline */}
                <path d={horsePath} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />

                {/* sRGB gamut triangle */}
                <path d={srgbPath} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="5,4" />
                {/* sRGB labels */}
                {(() => { const {px,py}=xyToSvg(0.64,0.33); return <text x={px+5} y={py-4} fill="rgba(255,255,255,0.45)" fontSize="9" fontWeight="700">R</text>; })()}
                {(() => { const {px,py}=xyToSvg(0.30,0.60); return <text x={px-10} y={py-5} fill="rgba(255,255,255,0.45)" fontSize="9" fontWeight="700">G</text>; })()}
                {(() => { const {px,py}=xyToSvg(0.15,0.06); return <text x={px-10} y={py+12} fill="rgba(255,255,255,0.45)" fontSize="9" fontWeight="700">B</text>; })()}

                {/* Planckian locus */}
                <path d={planckPath} fill="none" stroke="rgba(255,220,100,0.65)" strokeWidth="1.5" strokeDasharray="3,3" />
                {/* Planckian label */}
                {(() => { const {px,py}=xyToSvg(0.45,0.41); return <text x={px} y={py-7} fill="rgba(255,220,100,0.7)" fontSize="8" fontStyle="italic">Locus de Planck</text>; })()}
                {/* Some K labels */}
                {[2700, 4000, 6500].map(K => {
                  const pt = PLANCKIAN.find(p => p.K === K);
                  if (!pt) return null;
                  const {px,py} = xyToSvg(pt.x, pt.y);
                  return <g key={K}>
                    <circle cx={px} cy={py} r={3} fill="rgba(255,220,100,0.7)" />
                    <text x={px+5} y={py+3} fill="rgba(255,220,100,0.8)" fontSize="8">{K}K</text>
                  </g>;
                })}

                {/* Axis ticks */}
                {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map(v => {
                  const { px } = xyToSvg(v, 0);
                  return <text key={v} x={px} y={DH - 6} fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="middle">{v.toFixed(1)}</text>;
                })}
                {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map(v => {
                  const { py } = xyToSvg(0, v);
                  return <text key={v} x={PAD_L - 4} y={py + 3} fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="end">{v.toFixed(1)}</text>;
                })}
                <text x={DW / 2} y={DH - 2} fill="rgba(255,255,255,0.4)" fontSize="10" textAnchor="middle" fontStyle="italic">x</text>
                <text x={8} y={DH / 2} fill="rgba(255,255,255,0.4)" fontSize="10" textAnchor="middle" fontStyle="italic" transform={`rotate(-90 8 ${DH / 2})`}>y</text>

                {/* Wavelength labels on spectral locus */}
                {WL_LABELS.map(({ idx, nm, offset }) => {
                  const [hx, hy] = HORSESHOE[idx];
                  const { px, py } = xyToSvg(hx, hy);
                  return (
                    <g key={nm}>
                      <line x1={px} y1={py} x2={px + offset[0] * 0.6} y2={py + offset[1] * 0.6}
                        stroke="rgba(255,255,255,0.35)" strokeWidth={0.8} />
                      <text x={px + offset[0]} y={py + offset[1]} fill="rgba(255,255,255,0.55)"
                        fontSize="8" textAnchor="middle">{nm}</text>
                    </g>
                  );
                })}

                {/* D65 white point */}
                {(() => {
                  const { px, py } = xyToSvg(0.3127, 0.3290);
                  return <>
                    <circle cx={px} cy={py} r={4.5} fill="#fff" opacity={0.7} />
                    <text x={px + 7} y={py + 4} fill="rgba(255,255,255,0.6)" fontSize="8" fontWeight="700">D65</text>
                  </>;
                })()}

                {/* Cursor crosshair */}
                {curSvg && (
                  <g>
                    <line x1={curSvg.px - 16} y1={curSvg.py} x2={curSvg.px + 16} y2={curSvg.py} stroke="#fff" strokeWidth={1.2} opacity={0.7} />
                    <line x1={curSvg.px} y1={curSvg.py - 16} x2={curSvg.px} y2={curSvg.py + 16} stroke="#fff" strokeWidth={1.2} opacity={0.7} />
                    <circle cx={curSvg.px} cy={curSvg.py} r={7} fill="none" stroke="#fff" strokeWidth={1.5} opacity={0.8} />
                    {cursorRgb && <circle cx={curSvg.px} cy={curSvg.py} r={3} fill={`rgb(${cursorRgb.r},${cursorRgb.g},${cursorRgb.b})`} />}
                  </g>
                )}

                {/* Selected point */}
                {selSvg && (
                  <g>
                    <circle cx={selSvg.px} cy={selSvg.py} r={10} fill="none" stroke="#fff" strokeWidth={2.5} />
                    <circle cx={selSvg.px} cy={selSvg.py} r={4} fill="#fff" opacity={0.9} />
                    {selectedRgb && <circle cx={selSvg.px} cy={selSvg.py} r={4}
                      fill={`rgb(${selectedRgb.r},${selectedRgb.g},${selectedRgb.b})`} />}
                  </g>
                )}
              </svg>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 18, height: 2, background: 'rgba(255,255,255,0.5)' }} />
                <span>Locus spectral</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 18, height: 2, background: 'rgba(255,255,255,0.3)', borderTop: '1px dashed rgba(255,255,255,0.4)' }} />
                <span>Gamut sRGB</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 18, height: 2, background: 'rgba(255,220,100,0.65)', borderTop: '1px dashed rgba(255,220,100,0.7)' }} />
                <span>Locus de Planck</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', opacity: 0.7 }} />
                <span>D65 (lumière du jour)</span>
              </div>
            </div>
          </div>

          {/* ── Info panel ── */}
          <div style={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Hover preview */}
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 10, letterSpacing: '0.06em' }}>CURSEUR</div>
              {cursor && cursorRgb ? (
                <>
                  <div style={{ width: '100%', height: 40, borderRadius: 8, background: `rgb(${cursorRgb.r},${cursorRgb.g},${cursorRgb.b})`, border: '1px solid rgba(255,255,255,0.15)', marginBottom: 10 }} />
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
                    <div>x = <strong style={{ color: '#e8eaf0' }}>{cursor.x.toFixed(4)}</strong></div>
                    <div>y = <strong style={{ color: '#e8eaf0' }}>{cursor.y.toFixed(4)}</strong></div>
                    <div>RGB = <strong style={{ color: '#e8eaf0' }}>{cursorRgb.r}, {cursorRgb.g}, {cursorRgb.b}</strong></div>
                    {!inHorseshoe(cursor.x, cursor.y) && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>Hors du locus</div>}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Déplacez le curseur sur le diagramme</div>
              )}
            </div>

            {/* Selected color */}
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '14px 16px', border: `1px solid ${selected ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'}`, transition: 'border-color 0.2s' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 10, letterSpacing: '0.06em' }}>SÉLECTION</div>
              {selected && selectedRgb ? (
                <>
                  <div style={{ width: '100%', height: 56, borderRadius: 10, background: `rgb(${selectedRgb.r},${selectedRgb.g},${selectedRgb.b})`, border: '1px solid rgba(255,255,255,0.2)', marginBottom: 12, boxShadow: `0 0 20px rgb(${selectedRgb.r},${selectedRgb.g},${selectedRgb.b})44` }} />
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, marginBottom: 12 }}>
                    <div>x = <strong style={{ color: '#e8eaf0' }}>{selected.x.toFixed(4)}</strong></div>
                    <div>y = <strong style={{ color: '#e8eaf0' }}>{selected.y.toFixed(4)}</strong></div>
                    <div>RGB = <strong style={{ color: '#e8eaf0' }}>{selectedRgb.r}, {selectedRgb.g}, {selectedRgb.b}</strong></div>
                    {selWl && <div>λ ≈ <strong style={{ color: '#fbbf24' }}>{selWl} nm</strong></div>}
                    {!inHorseshoe(selected.x, selected.y) && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Hors gamut visible</div>}
                  </div>
                  <button
                    onClick={handleSendToPlates}
                    disabled={sending}
                    style={{
                      width: '100%', padding: '10px', borderRadius: 10, border: 'none',
                      background: sentOk ? '#4ade80' : `rgb(${selectedRgb.r},${selectedRgb.g},${selectedRgb.b})`,
                      color: sentOk ? '#000' : (selectedRgb.r * 0.299 + selectedRgb.g * 0.587 + selectedRgb.b * 0.114 > 128 ? '#000' : '#fff'),
                      fontWeight: 700, fontSize: 13, cursor: sending ? 'wait' : 'pointer',
                      boxShadow: `0 0 16px rgb(${selectedRgb.r},${selectedRgb.g},${selectedRgb.b})55`,
                      transition: 'all 0.15s', opacity: sending ? 0.7 : 1,
                    }}
                  >
                    {sentOk ? '✓ Envoyé !' : sending ? 'Envoi…' : 'Envoyer aux dalles'}
                  </button>
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Cliquez sur le diagramme pour sélectionner une couleur</div>
              )}
            </div>

            {/* Intensity slider */}
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 10, letterSpacing: '0.06em' }}>INTENSITÉ</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="range" min={10} max={100} value={intensity} onChange={e => setIntensity(Number(e.target.value))}
                  style={{ flex: 1, accentColor: '#a78bfa' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', width: 36, textAlign: 'right' }}>{intensity}%</span>
              </div>
            </div>

            {/* Live mode toggle */}
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e8eaf0' }}>Mode live</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Les dalles suivent le curseur</div>
                </div>
                <button
                  onClick={() => setLiveOnPlates(v => !v)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: liveOnPlates ? '#a78bfa' : 'rgba(255,255,255,0.15)',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 2, left: liveOnPlates ? 22 : 2, width: 20, height: 20,
                    borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            </div>

            {/* Éteindre */}
            <button
              onClick={() => clearAllPlates()}
              style={{ padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              Éteindre les dalles
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
