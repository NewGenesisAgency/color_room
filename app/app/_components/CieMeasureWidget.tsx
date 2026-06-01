'use client';

import { useMemo, useState } from 'react';
import { Crosshair, RefreshCcw, Ruler } from 'lucide-react';
import cs160Service from '@/app/_services/cs160';
import CieDiagramCanvas, { type CieMarker } from './CieDiagramCanvas';

// ── CIE 1931 spectral locus (horseshoe) ──────────────────────────────────────
const HORSESHOE: [number, number][] = [
  [0.1741, 0.0050], [0.1740, 0.0050], [0.1738, 0.0049], [0.1736, 0.0050], [0.1730, 0.0048],
  [0.1721, 0.0048], [0.1714, 0.0051], [0.1689, 0.0082], [0.1644, 0.0139], [0.1566, 0.0214],
  [0.1440, 0.0297], [0.1241, 0.0578], [0.0913, 0.1327], [0.0454, 0.2950], [0.0082, 0.5384],
  [0.0139, 0.7502], [0.0743, 0.8338], [0.1547, 0.8059], [0.2296, 0.7543], [0.3016, 0.6923],
  [0.3731, 0.6245], [0.4441, 0.5547], [0.5125, 0.4866], [0.5752, 0.4242], [0.6270, 0.3725],
  [0.6658, 0.3340], [0.7006, 0.2993], [0.7301, 0.2700], [0.7548, 0.2452], [0.7800, 0.2200],
  [0.8000, 0.2000], [0.8210, 0.1790], [0.8507, 0.1493],
];

// ── Diagram coordinate system ─────────────────────────────────────────────────
const DW = 440, DH = 400;
const X_MIN = 0.0, X_MAX = 0.86, Y_MIN = 0.0, Y_MAX = 0.92;
const PAD_L = 30, PAD_R = 14, PAD_T = 10, PAD_B = 24;

function xyToSvg(x: number, y: number) {
  const px = PAD_L + (x - X_MIN) / (X_MAX - X_MIN) * (DW - PAD_L - PAD_R);
  const py = (DH - PAD_B) - (y - Y_MIN) / (Y_MAX - Y_MIN) * (DH - PAD_T - PAD_B);
  return { px, py };
}

function inHorseshoe(cx: number, cy: number): boolean {
  let inside = false;
  for (let i = 0, j = HORSESHOE.length - 1; i < HORSESHOE.length; j = i++) {
    const [xi, yi] = HORSESHOE[i]!, [xj, yj] = HORSESHOE[j]!;
    if ((yi > cy) !== (yj > cy) && cx < (xj - xi) * (cy - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

// ── CIE xy → sRGB 0-255 (D65, IEC 61966-2-1) ─────────────────────────────────
function xyToRgb255(x: number, y: number): { r: number; g: number; b: number } | null {
  if (y < 1e-8 || x < 0 || x + y > 1) return null;
  const X = x / y, Y = 1.0, Z = (1 - x - y) / y;
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
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

// ── ΔE76 entre deux chromaticités (Lab via D65, Y=100 commun) ─────────────────
const WHITE = { X: 95.047, Y: 100, Z: 108.883 };
function labFromXy(x: number, y: number): { L: number; a: number; b: number } {
  const Yl = 100;
  const X = y <= 0 ? 0 : (x / y) * Yl;
  const Z = y <= 0 ? 0 : ((1 - x - y) / y) * Yl;
  const f = (t: number) => (t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29);
  const fx = f(X / WHITE.X), fy = f(Yl / WHITE.Y), fz = f(Z / WHITE.Z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}
function deltaE76(x1: number, y1: number, x2: number, y2: number): number {
  const A = labFromXy(x1, y1), B = labFromXy(x2, y2);
  return Math.sqrt((A.L - B.L) ** 2 + (A.a - B.a) ** 2 + (A.b - B.b) ** 2);
}

// ── Cible aléatoire dans le gamut sRGB, pas trop terne ────────────────────────
function randomTarget(): { x: number; y: number; rgb: { r: number; g: number; b: number } } {
  const candidates: [number, number][] = [
    [0.6400, 0.3300], [0.3000, 0.6000], [0.1500, 0.0600], [0.4338, 0.4760],
    [0.1750, 0.1580], [0.2247, 0.3290], [0.4500, 0.4000], [0.2020, 0.2100],
    [0.2500, 0.5000], [0.5500, 0.3700], [0.3500, 0.5500], [0.2800, 0.1500],
  ];
  for (let attempt = 0; attempt < 200; attempt++) {
    const base = candidates[Math.floor(Math.random() * candidates.length)]!;
    const x = Math.max(0.05, Math.min(0.75, base[0] + (Math.random() - 0.5) * 0.12));
    const y = Math.max(0.05, Math.min(0.80, base[1] + (Math.random() - 0.5) * 0.10));
    if (x + y >= 1 || !inHorseshoe(x, y)) continue;
    const rgb = xyToRgb255(x, y);
    if (!rgb) continue;
    if (Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b) < 40) continue;
    return { x, y, rgb };
  }
  return { x: 0.6400, y: 0.3300, rgb: xyToRgb255(0.64, 0.33)! };
}

export type CieMeasureWidgetProps = {
  targetX?: number;
  targetY?: number;
  tolerance?: number;       // seuil ΔE pour "réussi"
  randomTarget?: boolean;   // génère une cible aléatoire + bouton "Nouvelle cible"
  points?: number;          // points max attribués à un ΔE = 0
  width?: number;
  height?: number;
  /** Optionnel : allume la couleur cible sur les dalles physiques. */
  onSendColor?: (idx: number, r: number, g: number, b: number, intensity: number) => void;
  onTurnOffAll?: () => void;
};

const horseshoePath = (() => {
  let d = '';
  HORSESHOE.forEach((p, i) => {
    const { px, py } = xyToSvg(p[0], p[1]);
    d += `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)} `;
  });
  return d + 'Z';
})();

export default function CieMeasureWidget({
  targetX = 0.3127, targetY = 0.3290, tolerance = 8, randomTarget: rnd = false,
  points = 1000, width = 360, height, onSendColor,
}: CieMeasureWidgetProps) {
  const initialTarget = useMemo(
    () => (rnd ? randomTarget() : { x: targetX, y: targetY, rgb: xyToRgb255(targetX, targetY) ?? { r: 255, g: 255, b: 255 } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [target, setTarget] = useState(initialTarget);
  const [measured, setMeasured] = useState<{ x: number; y: number } | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [best, setBest] = useState<number | null>(null);

  const lightTarget = (t: { rgb: { r: number; g: number; b: number } }) => {
    if (!onSendColor) return;
    for (let i = 0; i < 42; i++) onSendColor(i, t.rgb.r, t.rgb.g, t.rgb.b, 85);
  };

  const newTarget = () => {
    const t = randomTarget();
    setTarget(t);
    setMeasured(null);
    setError(null);
    lightTarget(t);
  };

  async function measure() {
    setMeasuring(true);
    setError(null);
    try {
      const { lvxy } = await cs160Service.oneShotMeasurement();
      if (lvxy && Number.isFinite(lvxy.x) && Number.isFinite(lvxy.y)) {
        const m = { x: lvxy.x, y: lvxy.y };
        setMeasured(m);
        const dE = deltaE76(target.x, target.y, m.x, m.y);
        const pts = Math.round(points * Math.max(0, 1 - dE / 100));
        setBest((b) => (b === null ? pts : Math.max(b, pts)));
      } else {
        setError('Mesure indisponible — appareil CS-160 non connecté ?');
      }
    } catch {
      setError('Erreur de communication avec le CS-160');
    } finally {
      setMeasuring(false);
    }
  }

  const dE = measured ? deltaE76(target.x, target.y, measured.x, measured.y) : null;
  const success = dE !== null && dE <= tolerance;
  const score = dE !== null ? Math.round(points * Math.max(0, 1 - dE / 100)) : null;

  const tColor = `rgb(${target.rgb.r},${target.rgb.g},${target.rgb.b})`;
  const markers: CieMarker[] = [
    { x: target.x, y: target.y, color: tColor, ring: true, label: 'Cible' },
    ...(measured ? [{ x: measured.x, y: measured.y, crosshair: true, ring: true, radius: 6 } as CieMarker] : []),
  ];

  const cell: React.CSSProperties = {
    flex: 1, padding: '7px 9px', borderRadius: 10, background: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(0,0,0,0.07)', textAlign: 'center',
  };
  const cellLabel: React.CSSProperties = {
    fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8a8f9c',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'inherit', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: '#5a6072' }}>
        <Crosshair size={13} /> Diagramme CIE 1931
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <CieDiagramCanvas size={Math.max(300, Math.round(width))} markers={markers} />
      </div>

      {/* Lecture */}
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={cell}>
          <div style={cellLabel}>Cible x,y</div>
          <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#1a1d2e' }}>{target.x.toFixed(3)}, {target.y.toFixed(3)}</div>
        </div>
        <div style={cell}>
          <div style={cellLabel}>Mesure x,y</div>
          <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: measured ? '#1a1d2e' : '#c2c6d0' }}>{measured ? `${measured.x.toFixed(3)}, ${measured.y.toFixed(3)}` : '—, —'}</div>
        </div>
        <div style={{ ...cell, background: dE === null ? 'rgba(255,255,255,0.7)' : success ? 'rgba(5,150,105,0.1)' : 'rgba(239,68,68,0.08)' }}>
          <div style={cellLabel}>ΔE</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: dE === null ? '#c2c6d0' : success ? '#059669' : '#ef4444' }}>{dE === null ? '—' : dE.toFixed(1)}</div>
        </div>
      </div>

      {dE !== null && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 11px', borderRadius: 10, background: success ? 'rgba(5,150,105,0.1)' : 'rgba(0,0,0,0.04)', border: `1px solid ${success ? 'rgba(5,150,105,0.25)' : 'rgba(0,0,0,0.06)'}` }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: success ? '#059669' : '#5a6072' }}>
            {success ? `Réussi ! (≤ ${tolerance})` : `Trop loin (cible ≤ ${tolerance})`}
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#4361ee' }}>+{score} pts{best !== null && best !== score ? ` · record ${best}` : ''}</span>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, padding: '6px 10px', borderRadius: 9, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 7 }}>
        <button onClick={measure} disabled={measuring} style={{
          flex: 1, padding: '11px 14px', borderRadius: 12, border: 'none', cursor: measuring ? 'wait' : 'pointer',
          fontFamily: 'inherit', fontWeight: 800, fontSize: 14, color: '#fff',
          background: measuring ? '#94a3b8' : 'linear-gradient(135deg,#4361ee,#7c3aed)',
          boxShadow: measuring ? 'none' : '0 4px 14px rgba(67,97,238,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 150ms',
        }}>
          <Ruler size={15} /> {measuring ? 'Mesure en cours…' : 'Mesurer (CS-160)'}
        </button>
        {rnd && (
          <button onClick={newTarget} disabled={measuring} style={{
            padding: '11px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
            border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.8)', color: '#5a6072',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <RefreshCcw size={14} /> Nouvelle cible
          </button>
        )}
      </div>
    </div>
  );
}
