'use client';

/**
 * @file app/_components/CieDiagramCanvas.tsx
 * @brief Canvas réutilisable du diagramme de chromaticité CIE 1931 coloré.
 *
 * Rend le "fer à cheval" CIE 1931 avec son gamut peint pixel par pixel, le locus
 * spectral, le triangle sRGB, les axes et le point blanc D65. Le rendu est séparé
 * en deux couches : un fond statique dessiné une seule fois (par taille) et un
 * overlay redessiné à chaque changement de `markers`/`polylines` - ce qui rend le
 * déplacement de marqueurs (cible, mesure, point joueur) fluide. Utilisé par le
 * widget de mesure CIE et par plusieurs jeux de couleur. Les props principales
 * sont `markers` (points à afficher), `polylines` (tracés type triangle de
 * canaux), `size` (côté du canvas) et `onPick` (callback de clic renvoyant les
 * coordonnées x,y du diagramme).
 */

import { useEffect, useRef } from 'react';

// Diagramme de chromaticité CIE 1931 COLORÉ (gamut peint pixel par pixel),
// repris du diagramme de /mesure et rendu réutilisable pour les jeux.
// Deux couches : un fond statique (gamut + locus + triangle sRGB + axes) dessiné
// une seule fois, et un overlay redessiné à chaque changement de marqueurs
// (cible / mesure / point joueur) - performant pour le glissement de sliders.

const SPECTRAL_LOCUS: { nm: number; x: number; y: number }[] = [
  { nm: 380, x: 0.1741, y: 0.0050 }, { nm: 390, x: 0.1738, y: 0.0049 }, { nm: 400, x: 0.1733, y: 0.0048 },
  { nm: 410, x: 0.1726, y: 0.0048 }, { nm: 420, x: 0.1714, y: 0.0051 }, { nm: 430, x: 0.1689, y: 0.0069 },
  { nm: 440, x: 0.1644, y: 0.0109 }, { nm: 450, x: 0.1566, y: 0.0177 }, { nm: 460, x: 0.1440, y: 0.0297 },
  { nm: 470, x: 0.1241, y: 0.0578 }, { nm: 480, x: 0.0913, y: 0.1327 }, { nm: 490, x: 0.0454, y: 0.2950 },
  { nm: 500, x: 0.0082, y: 0.5384 }, { nm: 510, x: 0.0139, y: 0.7502 }, { nm: 520, x: 0.0743, y: 0.8338 },
  { nm: 530, x: 0.1547, y: 0.8059 }, { nm: 540, x: 0.2296, y: 0.7543 }, { nm: 550, x: 0.3016, y: 0.6923 },
  { nm: 560, x: 0.3731, y: 0.6245 }, { nm: 570, x: 0.4441, y: 0.5547 }, { nm: 580, x: 0.5125, y: 0.4866 },
  { nm: 590, x: 0.5752, y: 0.4242 }, { nm: 600, x: 0.6270, y: 0.3725 }, { nm: 610, x: 0.6658, y: 0.3340 },
  { nm: 620, x: 0.6915, y: 0.3083 }, { nm: 630, x: 0.7079, y: 0.2920 }, { nm: 640, x: 0.7190, y: 0.2809 },
  { nm: 650, x: 0.7260, y: 0.2740 }, { nm: 660, x: 0.7300, y: 0.2700 }, { nm: 680, x: 0.7334, y: 0.2666 },
  { nm: 700, x: 0.7347, y: 0.2653 },
];
const SRGB_R = { x: 0.6400, y: 0.3300 };
const SRGB_G = { x: 0.3000, y: 0.6000 };
const SRGB_B = { x: 0.1500, y: 0.0600 };
const D65 = { x: 0.3127, y: 0.3290 };
const NM_LABELS = [470, 480, 490, 500, 510, 520, 540, 560, 580, 600, 620, 700];

const X_MIN = 0, X_MAX = 0.78, Y_MIN = 0, Y_MAX = 0.92;

function xyzToSrgb(X: number, Y: number, Z: number) {
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
  const min = Math.min(r, g, b);
  if (min < 0) { r -= min; g -= min; b -= min; }
  const max = Math.max(r, g, b, 1e-9);
  r /= max; g /= max; b /= max;
  const gc = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  return { r: gc(r) * 255, g: gc(g) * 255, b: gc(b) * 255 };
}
function xyToPixel(x: number, y: number): [number, number, number] {
  if (y < 1e-6) return [0, 0, 0];
  const Y = 1, X = (x / y) * Y, Z = ((1 - x - y) / y) * Y;
  const { r, g, b } = xyzToSrgb(X, Y, Z);
  return [Math.round(Math.max(0, Math.min(255, r))), Math.round(Math.max(0, Math.min(255, g))), Math.round(Math.max(0, Math.min(255, b)))];
}
function insideLocus(px: number, py: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

/** Marqueur ponctuel affiché sur le diagramme (cible, mesure, point joueur…). */
export type CieMarker = {
  /** Coordonnée x (chromaticité) du marqueur. */
  x: number;
  /** Coordonnée y (chromaticité) du marqueur. */
  y: number;
  /** Couleur du remplissage. Par défaut : la couleur sRGB du point xy. */
  color?: string;
  ring?: boolean;        // anneau blanc autour
  crosshair?: boolean;   // viseur en pointillés
  /** Étiquette texte affichée à côté du marqueur. */
  label?: string;
  /** Rayon du marqueur en pixels (défaut : 8). */
  radius?: number;
};

/** Tracé (ligne brisée) optionnel superposé au diagramme, ex. triangle des canaux. */
export type CiePolyline = {
  /** Sommets du tracé en coordonnées de chromaticité. */
  points: { x: number; y: number }[];
  /** Couleur du trait. */
  color?: string;
  /** Épaisseur du trait. */
  width?: number;
  /** Trait en pointillés si vrai. */
  dash?: boolean;
  /** Ferme le tracé (relie le dernier point au premier) si vrai. */
  closed?: boolean;
};

/**
 * Diagramme de chromaticité CIE 1931 rendu sur deux canvas superposés.
 *
 * @param markers Marqueurs ponctuels à dessiner (cible, mesure, etc.).
 * @param polylines Tracés optionnels superposés (ex. triangle de canaux).
 * @param size Côté du canvas carré en pixels (défaut : 360).
 * @param onPick Callback appelé au clic avec les coordonnées (x, y) du diagramme ; active le curseur viseur.
 * @returns Le diagramme CIE 1931 interactif.
 */
export default function CieDiagramCanvas({
  markers = [], polylines = [], size = 360, onPick,
}: {
  markers?: CieMarker[];
  polylines?: CiePolyline[];
  size?: number;
  onPick?: (x: number, y: number) => void;
}) {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<HTMLCanvasElement>(null);
  const PAD = Math.round(size * 0.075);

  const toCanvas = (x: number, y: number): [number, number] => [
    PAD + (x - X_MIN) / (X_MAX - X_MIN) * (size - 2 * PAD),
    (size - PAD) - (y - Y_MIN) / (Y_MAX - Y_MIN) * (size - 2 * PAD),
  ];

  // ── Fond statique (gamut coloré) - dessiné une fois par taille ──────────────
  useEffect(() => {
    const canvas = bgRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const poly = SPECTRAL_LOCUS.map((p) => ({ x: p.x, y: p.y }));

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);

    const imgW = size - 2 * PAD, imgH = size - 2 * PAD;
    const imageData = ctx.createImageData(imgW, imgH);
    const d = imageData.data;
    for (let py = 0; py < imgH; py++) {
      for (let px = 0; px < imgW; px++) {
        const x = X_MIN + (px / imgW) * (X_MAX - X_MIN);
        const y = Y_MAX - (py / imgH) * (Y_MAX - Y_MIN);
        if (!insideLocus(x, y, poly)) continue;
        const [r, g, b] = xyToPixel(x, y);
        const idx = (py * imgW + px) * 4;
        d[idx] = r; d[idx + 1] = g; d[idx + 2] = b; d[idx + 3] = 225;
      }
    }
    ctx.putImageData(imageData, PAD, PAD);

    // Locus
    ctx.beginPath();
    SPECTRAL_LOCUS.forEach((p, i) => { const [cx, cy] = toCanvas(p.x, p.y); i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy); });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Triangle sRGB
    ctx.beginPath();
    const [rx, ry] = toCanvas(SRGB_R.x, SRGB_R.y);
    const [gx, gy] = toCanvas(SRGB_G.x, SRGB_G.y);
    const [bx, by] = toCanvas(SRGB_B.x, SRGB_B.y);
    ctx.moveTo(rx, ry); ctx.lineTo(gx, gy); ctx.lineTo(bx, by); ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);

    // Axes / grille
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 0.5;
    [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].forEach((v) => {
      const [ax] = toCanvas(v, Y_MIN);
      ctx.beginPath(); ctx.moveTo(ax, size - PAD); ctx.lineTo(ax, PAD); ctx.stroke();
      const [, ay] = toCanvas(X_MIN, v);
      ctx.beginPath(); ctx.moveTo(PAD, ay); ctx.lineTo(size - PAD, ay); ctx.stroke();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `${Math.round(size * 0.022)}px system-ui`;
    [0.2, 0.4, 0.6].forEach((v) => {
      const [ax] = toCanvas(v, Y_MIN); ctx.fillText(v.toFixed(1), ax - 8, size - PAD + 13);
      const [, ay] = toCanvas(X_MIN, v); ctx.fillText(v.toFixed(1), 3, ay + 4);
    });
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `bold ${Math.round(size * 0.026)}px system-ui`;
    ctx.fillText('x', size / 2, size - 3);
    ctx.save(); ctx.translate(10, size / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('y', 0, 0); ctx.restore();

    // Longueurs d'onde
    ctx.font = `${Math.round(size * 0.02)}px system-ui`;
    NM_LABELS.forEach((nm) => {
      const pt = SPECTRAL_LOCUS.find((p) => p.nm === nm);
      if (!pt) return;
      const [cx, cy] = toCanvas(pt.x, pt.y);
      const ox = pt.x - 0.24, oy = pt.y - 0.32;
      const len = Math.sqrt(ox * ox + oy * oy) || 1;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`${nm}`, cx + (ox / len) * 11 - 8, cy + (-oy / len) * 11 + 3);
    });

    // D65
    const [dx, dy] = toCanvas(D65.x, D65.y);
    ctx.beginPath(); ctx.arc(dx, dy, 3.5, 0, 2 * Math.PI); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = `${Math.round(size * 0.022)}px system-ui`;
    ctx.fillText('D65', dx + 6, dy + 4);
  }, [size]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Overlay des marqueurs - redessiné à chaque changement ──────────────────
  useEffect(() => {
    const canvas = fgRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    // Polylignes (ex: triangle des canaux)
    polylines.forEach((pl) => {
      if (pl.points.length < 2) return;
      ctx.beginPath();
      pl.points.forEach((p, i) => { const [cx, cy] = toCanvas(p.x, p.y); i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy); });
      if (pl.closed) ctx.closePath();
      ctx.strokeStyle = pl.color ?? 'rgba(255,255,255,0.8)';
      ctx.lineWidth = pl.width ?? 1.5;
      if (pl.dash) ctx.setLineDash([5, 4]); else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    markers.forEach((m) => {
      const [cx, cy] = toCanvas(m.x, m.y);
      const fill = m.color ?? (() => { const [r, g, b] = xyToPixel(m.x, m.y); return `rgb(${r},${g},${b})`; })();
      const rad = m.radius ?? 8;
      if (m.crosshair) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.8; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(PAD, cy); ctx.lineTo(size - PAD, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, PAD); ctx.lineTo(cx, size - PAD); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (m.ring) {
        ctx.beginPath(); ctx.arc(cx, cy, rad + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 2 * Math.PI);
      ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      if (m.label) {
        ctx.font = `bold ${Math.round(size * 0.024)}px system-ui`;
        const tw = ctx.measureText(m.label).width;
        const lx = Math.min(cx + 12, size - PAD - tw - 6);
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(lx - 4, cy - 22, tw + 8, 18);
        ctx.fillStyle = '#fff'; ctx.fillText(m.label, lx, cy - 9);
      }
    });
  }, [markers, polylines, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onPick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = size / rect.width;
    const px = (e.clientX - rect.left) * scale;
    const py = (e.clientY - rect.top) * scale;
    const x = X_MIN + (px - PAD) / (size - 2 * PAD) * (X_MAX - X_MIN);
    const y = Y_MIN + ((size - PAD) - py) / (size - 2 * PAD) * (Y_MAX - Y_MIN);
    onPick(Math.max(0, Math.min(X_MAX, x)), Math.max(0, Math.min(Y_MAX, y)));
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: size, aspectRatio: '1' }}>
      <canvas ref={bgRef} width={size} height={size} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 12 }} />
      <canvas
        ref={fgRef} width={size} height={size}
        onClick={onPick ? handleClick : undefined}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 12, cursor: onPick ? 'crosshair' : 'default' }}
      />
    </div>
  );
}
