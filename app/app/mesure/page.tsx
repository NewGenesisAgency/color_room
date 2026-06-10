'use client';

/**
 * @file app/mesure/page.tsx
 * @brief Page de mesure colorimétrique avec le CS-160 (Konica Minolta).
 *
 * Pilote le colorimètre CS-160 via un bridge réseau (API /api/cs160) :
 * connexion/déconnexion, lancement d'une mesure (luminance Lv + chromaticité
 * x,y + tristimulus XYZ) et lecture des samples de l'appareil. Affiche les
 * résultats (cartes Lv/x/y, XYZ, xyY, pastille sRGB) et trace la mesure ainsi
 * que l'historique (30 dernières) sur un diagramme de chromaticité CIE 1931
 * dessiné sur canvas (locus spectral coloré, triangle sRGB, point blanc D65,
 * trajectoire colorée par la composante z). La page gère aussi une référence
 * de blanc (refY) et un seuil de bruit pour rendre fidèlement la pastille de
 * couleur (dalle éteinte → noir). N'interagit pas avec les dalles (lecture
 * seule via le colorimètre).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, Power, Gauge, RefreshCw, CheckCircle, XCircle, AlertCircle, Database } from 'lucide-react';

/** @brief Résultat d'une mesure CS-160 : horodatage, tristimulus XYZ et Lv/x/y. */
interface MeasureResult {
  timestamp: string;
  xyz: { X: number; Y: number; Z: number };
  lvxy: { Lv: number; x: number; y: number };
}

// ── CIE 1931 spectral locus (real data, 380–700 nm, 5 nm steps) ────────────
const SPECTRAL_LOCUS: { nm: number; x: number; y: number }[] = [
  { nm: 380, x: 0.1741, y: 0.0050 }, { nm: 385, x: 0.1740, y: 0.0050 },
  { nm: 390, x: 0.1738, y: 0.0049 }, { nm: 395, x: 0.1736, y: 0.0049 },
  { nm: 400, x: 0.1733, y: 0.0048 }, { nm: 405, x: 0.1730, y: 0.0048 },
  { nm: 410, x: 0.1726, y: 0.0048 }, { nm: 415, x: 0.1721, y: 0.0048 },
  { nm: 420, x: 0.1714, y: 0.0051 }, { nm: 425, x: 0.1703, y: 0.0058 },
  { nm: 430, x: 0.1689, y: 0.0069 }, { nm: 435, x: 0.1669, y: 0.0086 },
  { nm: 440, x: 0.1644, y: 0.0109 }, { nm: 445, x: 0.1611, y: 0.0138 },
  { nm: 450, x: 0.1566, y: 0.0177 }, { nm: 455, x: 0.1510, y: 0.0227 },
  { nm: 460, x: 0.1440, y: 0.0297 }, { nm: 465, x: 0.1355, y: 0.0399 },
  { nm: 470, x: 0.1241, y: 0.0578 }, { nm: 475, x: 0.1096, y: 0.0868 },
  { nm: 480, x: 0.0913, y: 0.1327 }, { nm: 485, x: 0.0687, y: 0.2007 },
  { nm: 490, x: 0.0454, y: 0.2950 }, { nm: 495, x: 0.0235, y: 0.4127 },
  { nm: 500, x: 0.0082, y: 0.5384 }, { nm: 505, x: 0.0039, y: 0.6548 },
  { nm: 510, x: 0.0139, y: 0.7502 }, { nm: 515, x: 0.0389, y: 0.8120 },
  { nm: 520, x: 0.0743, y: 0.8338 }, { nm: 525, x: 0.1142, y: 0.8262 },
  { nm: 530, x: 0.1547, y: 0.8059 }, { nm: 535, x: 0.1929, y: 0.7816 },
  { nm: 540, x: 0.2296, y: 0.7543 }, { nm: 545, x: 0.2658, y: 0.7243 },
  { nm: 550, x: 0.3016, y: 0.6923 }, { nm: 555, x: 0.3373, y: 0.6589 },
  { nm: 560, x: 0.3731, y: 0.6245 }, { nm: 565, x: 0.4087, y: 0.5896 },
  { nm: 570, x: 0.4441, y: 0.5547 }, { nm: 575, x: 0.4788, y: 0.5202 },
  { nm: 580, x: 0.5125, y: 0.4866 }, { nm: 585, x: 0.5448, y: 0.4544 },
  { nm: 590, x: 0.5752, y: 0.4242 }, { nm: 595, x: 0.6029, y: 0.3965 },
  { nm: 600, x: 0.6270, y: 0.3725 }, { nm: 605, x: 0.6482, y: 0.3514 },
  { nm: 610, x: 0.6658, y: 0.3340 }, { nm: 615, x: 0.6801, y: 0.3197 },
  { nm: 620, x: 0.6915, y: 0.3083 }, { nm: 625, x: 0.7006, y: 0.2993 },
  { nm: 630, x: 0.7079, y: 0.2920 }, { nm: 635, x: 0.7140, y: 0.2859 },
  { nm: 640, x: 0.7190, y: 0.2809 }, { nm: 645, x: 0.7230, y: 0.2770 },
  { nm: 650, x: 0.7260, y: 0.2740 }, { nm: 655, x: 0.7283, y: 0.2717 },
  { nm: 660, x: 0.7300, y: 0.2700 }, { nm: 665, x: 0.7311, y: 0.2689 },
  { nm: 670, x: 0.7320, y: 0.2680 }, { nm: 675, x: 0.7327, y: 0.2673 },
  { nm: 680, x: 0.7334, y: 0.2666 }, { nm: 685, x: 0.7340, y: 0.2660 },
  { nm: 690, x: 0.7344, y: 0.2656 }, { nm: 695, x: 0.7346, y: 0.2654 },
  { nm: 700, x: 0.7347, y: 0.2653 },
];

// sRGB primaries + D65 white point
const SRGB_R  = { x: 0.6400, y: 0.3300 };
const SRGB_G  = { x: 0.3000, y: 0.6000 };
const SRGB_B  = { x: 0.1500, y: 0.0600 };
const D65     = { x: 0.3127, y: 0.3290 };

// Wavelength labels to show on the horseshoe
const NM_LABELS = [460, 470, 480, 490, 500, 510, 520, 530, 540, 550, 560, 570, 580, 590, 600, 610, 620, 650, 700];

// ── Colour maths ───────────────────────────────────────────────────────────

/**
 * @brief Conversion XYZ → sRGB normalisée par chromaticité (Y=1).
 *
 * Utilisée uniquement pour colorer le diagramme CIE 1931, jamais pour afficher
 * une mesure absolue (la normalisation par max efface la luminosité).
 *
 * @param X Composante tristimulus X.
 * @param Y Composante tristimulus Y.
 * @param Z Composante tristimulus Z.
 * @returns Composantes sRGB { r, g, b } dans [0..255].
 */
function xyzToSrgb(X: number, Y: number, Z: number) {
  let r =  3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b =  0.0557 * X - 0.2040 * Y + 1.0570 * Z;
  const min = Math.min(r, g, b);
  if (min < 0) { r -= min; g -= min; b -= min; }
  const max = Math.max(r, g, b, 1e-9);
  r /= max; g /= max; b /= max;
  const gc = (c: number) => c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return { r: gc(r) * 255, g: gc(g) * 255, b: gc(b) * 255 };
}

/**
 * Conversion XYZ → sRGB tenant compte de la LUMINANCE — utilisée pour la
 * pastille de couleur mesurée.
 *
 * Problème de la version simple : diviser par max(r,g,b) efface toute
 * information de luminosité. Une dalle éteinte (Y ≈ 0.001 cd/m²) avec un
 * bruit léger donne la même saturation qu'une dalle à pleine puissance —
 * d'où l'affichage de #00fff0 quand la dalle devrait être #000000.
 *
 * Solution :
 *  • Si Y < noiseFloor → noir (#000000), signal = bruit de fond / fuite LED.
 *  • Si refY fourni (mesure d'un blanc de référence) → normaliser par refY
 *    pour obtenir la luminance relative [0–1].
 *  • Sinon → normalisation chromatique classique (couleur sans info de luminance).
 *
 * @param refY  Y (en cd/m²) mesuré sur un blanc de référence. null = non calibré.
 * @param noiseFloor  Seuil sous lequel Y est considéré comme bruit (défaut 0.1 cd/m²).
 */
function xyzToSrgbForSwatch(
  X: number, Y: number, Z: number,
  refY: number | null,
  noiseFloor = 0.1,
): { r: number; g: number; b: number } {
  // Bruit / dalle éteinte → noir pur
  const floor = refY != null ? refY * 0.005 : noiseFloor;
  if (Y < floor) return { r: 0, g: 0, b: 0 };

  let r =  3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b =  0.0557 * X - 0.2040 * Y + 1.0570 * Z;

  // Supprimer les valeurs hors-gamut sans décaler la chromaticité
  r = Math.max(0, r); g = Math.max(0, g); b = Math.max(0, b);

  // Normaliser :
  //  • par refY si disponible → luminance relative (1.0 = blanc de réf.)
  //  • sinon par max → chromaticité seule (saturé, sans info de brillance)
  const norm = refY != null ? refY : Math.max(r, g, b, 1e-9);
  r = Math.min(1, r / norm);
  g = Math.min(1, g / norm);
  b = Math.min(1, b / norm);

  const gc = (c: number) => c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return { r: gc(r) * 255, g: gc(g) * 255, b: gc(b) * 255 };
}

/**
 * @brief Convertit une chromaticité (x,y) en pixel sRGB [0..255] (en supposant Y=1).
 * @param x Chromaticité x.
 * @param y Chromaticité y.
 * @returns Le triplet [r, g, b] (entiers 0..255).
 */
function xyToPixel(x: number, y: number): [number, number, number] {
  if (y < 1e-6) return [0, 0, 0];
  const Y = 1, X = (x / y) * Y, Z = ((1 - x - y) / y) * Y;
  const { r, g, b } = xyzToSrgb(X, Y, Z);
  return [Math.round(Math.max(0, Math.min(255, r))),
          Math.round(Math.max(0, Math.min(255, g))),
          Math.round(Math.max(0, Math.min(255, b)))];
}

/**
 * @brief Teste si un point (px,py) est à l'intérieur du locus (ray casting).
 * @param px Coordonnée x du point.
 * @param py Coordonnée y du point.
 * @param poly Polygone fermé du locus spectral.
 * @returns true si le point est dans le polygone.
 */
function insideLocus(px: number, py: number, poly: {x:number;y:number}[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

// ── Curve helpers (Z-aware) ───────────────────────────────────────────────────

/**
 * @brief Chromaticité z = 1 − x − y (composante « bleue ») bornée à [0,1].
 * @param x Chromaticité x.
 * @param y Chromaticité y.
 * @returns La composante z clampée.
 */
function zChrom(x: number, y: number): number {
  return Math.max(0, Math.min(1, 1 - x - y));
}

/**
 * @brief Couleur du dégradé chaud (ambre) ↔ froid (bleu glacé) selon z.
 * @param zn Valeur z normalisée [0,1].
 * @param alpha Opacité du trait.
 * @returns Une chaîne CSS rgba().
 */
function zColor(zn: number, alpha: number): string {
  const r = Math.round(255 * (1 - zn) + 30  * zn);
  const g = Math.round(160 * (1 - zn) + 200 * zn);
  const b = Math.round( 20 * (1 - zn) + 255 * zn);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * @brief Calcule une spline Catmull-Rom passant par une liste de points canvas.
 * @param pts Points de contrôle [cx, cy].
 * @param steps Nombre de subdivisions par segment (défaut 20).
 * @returns La liste des points interpolés de la courbe.
 */
function catmullRomPoints(pts: [number, number][], steps = 20): [number, number][] {
  if (pts.length < 2) return pts;
  const out: [number, number][] = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    for (let t = 0; t <= steps; t++) {
      const s = t / steps;
      const s2 = s * s, s3 = s2 * s;
      const x = 0.5 * ((2 * p1[0])
        + (-p0[0] + p2[0]) * s
        + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * s2
        + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * s3);
      const y = 0.5 * ((2 * p1[1])
        + (-p0[1] + p2[1]) * s
        + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * s2
        + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * s3);
      out.push([x, y]);
    }
  }
  return out;
}

// ── ChromaticityDiagram component ────────────────────────────────────────────

/** @brief Point de l'historique tracé sur le diagramme (chromaticité + Z + libellé). */
interface DiagramPoint { x: number; y: number; Z: number; label: string; }

/** @brief Props du diagramme de chromaticité : mesure courante + historique. */
interface DiagramProps {
  current: { x: number; y: number; Z: number } | null;
  history: DiagramPoint[];
}

/**
 * @brief Composant canvas du diagramme de chromaticité CIE 1931.
 *
 * Dessine le locus spectral coloré pixel par pixel, le triangle sRGB, le point
 * blanc D65, les graduations de longueur d'onde, la grille, puis la trajectoire
 * de l'historique (spline colorée par z, épaisseur par Z) et le point de mesure
 * courant avec réticule et étiquette de coordonnées.
 *
 * @param current Mesure courante à mettre en évidence (ou null).
 * @param history Points historiques à tracer en trajectoire.
 * @returns L'élément <canvas> du diagramme.
 */
function ChromaticityDiagram({ current, history }: DiagramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const SIZE = 480;
  const PAD  = 36; // padding for axes

  // Map CIE xy → canvas pixel
  const X_MIN = 0, X_MAX = 0.78, Y_MIN = 0, Y_MAX = 0.92;
  function toCanvas(x: number, y: number): [number, number] {
    const cx = PAD + (x - X_MIN) / (X_MAX - X_MIN) * (SIZE - 2 * PAD);
    const cy = (SIZE - PAD) - (y - Y_MIN) / (Y_MAX - Y_MIN) * (SIZE - 2 * PAD);
    return [cx, cy];
  }

  // Build closed polygon (locus + purple line back to 380)
  const poly = [
    ...SPECTRAL_LOCUS.map(p => ({ x: p.x, y: p.y })),
    { x: SPECTRAL_LOCUS[0].x, y: SPECTRAL_LOCUS[0].y },
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // ── 1. Fill background ────────────────────────────────────────────────
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // ── 2. Paint coloured horseshoe pixel-by-pixel ─────────────────────
    const imgW = SIZE - 2 * PAD, imgH = SIZE - 2 * PAD;
    const imageData = ctx.createImageData(imgW, imgH);
    const d = imageData.data;

    for (let py = 0; py < imgH; py++) {
      for (let px = 0; px < imgW; px++) {
        const x = X_MIN + (px / imgW) * (X_MAX - X_MIN);
        const y = Y_MAX - (py / imgH) * (Y_MAX - Y_MIN); // flip y
        if (!insideLocus(x, y, poly)) continue;
        const [r, g, b] = xyToPixel(x, y);
        const idx = (py * imgW + px) * 4;
        d[idx]     = r;
        d[idx + 1] = g;
        d[idx + 2] = b;
        d[idx + 3] = 220;
      }
    }
    ctx.putImageData(imageData, PAD, PAD);

    // ── 3. Spectral locus outline ─────────────────────────────────────────
    ctx.beginPath();
    SPECTRAL_LOCUS.forEach((p, i) => {
      const [cx, cy] = toCanvas(p.x, p.y);
      i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
    });
    // close with purple line (line of purples)
    const [fx, fy] = toCanvas(SPECTRAL_LOCUS[0].x, SPECTRAL_LOCUS[0].y);
    ctx.lineTo(fx, fy);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ── 4. sRGB triangle ──────────────────────────────────────────────────
    ctx.beginPath();
    const [rx, ry] = toCanvas(SRGB_R.x, SRGB_R.y);
    const [gx, gy] = toCanvas(SRGB_G.x, SRGB_G.y);
    const [bx, by] = toCanvas(SRGB_B.x, SRGB_B.y);
    ctx.moveTo(rx, ry); ctx.lineTo(gx, gy); ctx.lineTo(bx, by); ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // sRGB labels
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 10px system-ui';
    ctx.fillText('sR', rx + 4, ry - 4);
    ctx.fillText('sG', gx - 14, gy - 4);
    ctx.fillText('sB', bx - 14, by + 12);

    // ── 5. D65 white point ────────────────────────────────────────────────
    const [dx, dy] = toCanvas(D65.x, D65.y);
    ctx.beginPath();
    ctx.arc(dx, dy, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '10px system-ui';
    ctx.fillText('D65', dx + 6, dy + 4);

    // ── 6. Wavelength tick labels ──────────────────────────────────────────
    ctx.font = '9px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    NM_LABELS.forEach(nm => {
      const pt = SPECTRAL_LOCUS.find(p => p.nm === nm);
      if (!pt) return;
      const [cx, cy] = toCanvas(pt.x, pt.y);
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();

      // Offset label outward from centre of locus
      const ox = pt.x - 0.24, oy = pt.y - 0.32;
      const len = Math.sqrt(ox * ox + oy * oy) || 1;
      const lx = cx + (ox / len) * 10;
      const ly = cy + (-oy / len) * 10; // flipped y
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillText(`${nm}`, lx - 8, ly + 3);
    });

    // ── 7. Grid / axes ────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.5;
    [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].forEach(v => {
      const [ax] = toCanvas(v, Y_MIN);
      const [, ay2] = toCanvas(v, Y_MAX);
      ctx.beginPath(); ctx.moveTo(ax, SIZE - PAD); ctx.lineTo(ax, PAD); ctx.stroke();

      const [, ay] = toCanvas(X_MIN, v);
      const [ax2] = toCanvas(X_MAX, v);
      ctx.beginPath(); ctx.moveTo(PAD, ay); ctx.lineTo(SIZE - PAD, ay); ctx.stroke();
    });

    // Axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px system-ui';
    [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].forEach(v => {
      const [ax] = toCanvas(v, Y_MIN);
      ctx.fillText(v.toFixed(1), ax - 8, SIZE - PAD + 14);
      const [, ay] = toCanvas(X_MIN, v);
      ctx.fillText(v.toFixed(1), 2, ay + 4);
    });

    // Axis titles
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 11px system-ui';
    ctx.fillText('x', SIZE / 2, SIZE - 2);
    ctx.save(); ctx.translate(11, SIZE / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('y', 0, 0); ctx.restore();

    // ── 8. History curve + points (Z-aware) ──────────────────────────────────
    const chrono = [...history].reverse(); // oldest → newest

    // Normalise absolute Z values within history for size encoding
    const zVals = chrono.map(h => h.Z);
    const zMin  = Math.min(...zVals, 0);
    const zMax  = Math.max(...zVals, 1e-6);
    const zNorm = (Z: number) => (zMax > zMin) ? (Z - zMin) / (zMax - zMin) : 0.5;

    // Draw Catmull-Rom spline through history points, coloured by z chromaticity
    if (chrono.length >= 2) {
      const canvasPts: [number, number][] = chrono.map(h => toCanvas(h.x, h.y));
      const spline = catmullRomPoints(canvasPts, 16);

      // Build per-segment colour by interpolating z from source points
      const totalSegs = spline.length - 1;
      for (let si = 0; si < totalSegs; si++) {
        // Map spline index back to original points
        const t = si / totalSegs;
        const srcIdx = Math.floor(t * (chrono.length - 1));
        const h0 = chrono[Math.min(srcIdx, chrono.length - 1)];
        const h1 = chrono[Math.min(srcIdx + 1, chrono.length - 1)];
        const zn = (zChrom(h0.x, h0.y) + zChrom(h1.x, h1.y)) / 2;
        const alpha = 0.25 + 0.65 * t;           // fade in oldest → brightest newest
        const width  = 1.2 + zn * 2.2;           // thicker for more blue
        ctx.beginPath();
        ctx.moveTo(spline[si][0], spline[si][1]);
        ctx.lineTo(spline[si + 1][0], spline[si + 1][1]);
        ctx.strokeStyle = zColor(zn, alpha);
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Arrowhead on the last segment to show direction
      const last  = spline[spline.length - 1];
      const prev  = spline[Math.max(0, spline.length - 5)];
      const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
      const arrowLen = 10, arrowAngle = Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(last[0], last[1]);
      ctx.lineTo(last[0] - arrowLen * Math.cos(angle - arrowAngle), last[1] - arrowLen * Math.sin(angle - arrowAngle));
      ctx.moveTo(last[0], last[1]);
      ctx.lineTo(last[0] - arrowLen * Math.cos(angle + arrowAngle), last[1] - arrowLen * Math.sin(angle + arrowAngle));
      const hn = chrono[chrono.length - 1];
      ctx.strokeStyle = zColor(zChrom(hn.x, hn.y), 0.9);
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    // Draw history dots, sized by normalised absolute Z
    chrono.forEach((h, i) => {
      const [cx, cy] = toCanvas(h.x, h.y);
      const zn  = zChrom(h.x, h.y);
      const znA = zNorm(h.Z);
      const alpha  = 0.3 + 0.6 * (i / Math.max(chrono.length - 1, 1));
      const radius = 3 + znA * 5; // 3–8 px driven by absolute Z
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.fillStyle = zColor(zn, alpha);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.7})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    });

    // ── 9. Current measurement point ─────────────────────────────────────
    if (current) {
      const [cx, cy] = toCanvas(current.x, current.y);

      // Crosshair
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(PAD, cy); ctx.lineTo(SIZE - PAD, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, PAD); ctx.lineTo(cx, SIZE - PAD); ctx.stroke();
      ctx.setLineDash([]);

      // Outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Fill dot with measured colour
      const [pr, pg, pb] = xyToPixel(current.x, current.y);
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, 2 * Math.PI);
      ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Coordinate label with z chromaticity
      const zn  = zChrom(current.x, current.y);
      const zVal = zn.toFixed(4);
      const labelX = cx + 14, labelY = cy - 14;
      ctx.font = 'bold 11px system-ui';
      const txt  = `x=${current.x.toFixed(4)}  y=${current.y.toFixed(4)}  z=${zVal}`;
      const txt2 = `Z=${current.Z.toFixed(4)}`;
      const tw  = Math.max(ctx.measureText(txt).width, ctx.measureText(txt2).width);
      const lx  = Math.min(labelX, SIZE - PAD - tw - 4);
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(lx - 4, labelY - 13, tw + 8, 32);
      ctx.fillStyle = '#fff';
      ctx.fillText(txt, lx, labelY);
      ctx.fillStyle = zColor(zn, 0.9);
      ctx.fillText(txt2, lx, labelY + 14);
    }
  }, [current, history]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      style={{ borderRadius: 12, display: 'block', width: '100%', maxWidth: SIZE }}
    />
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

/**
 * @brief Composant de la page de mesure colorimétrique.
 *
 * Gère l'état de connexion au bridge CS-160, les actions (connecter, mesurer,
 * déconnecter, charger les samples), l'historique des mesures et la référence
 * de blanc / seuil de bruit pour la pastille de couleur.
 *
 * @returns L'arbre JSX de la page de mesure.
 */
export default function MesurePage() {
  const [connected, setConnected]     = useState(false);
  const [loading,   setLoading]       = useState(false);
  const [statusLabel, setStatusLabel] = useState('Vérification…');
  const [devicePort,  setDevicePort]  = useState('');
  const [measurement, setMeasurement] = useState<MeasureResult | null>(null);
  const [error,       setError]       = useState('');
  const [history,     setHistory]     = useState<MeasureResult[]>([]);
  const [samples,     setSamples]     = useState<any | null>(null);

  // ── Référence blanche pour la pastille de couleur ────────────────────────
  // refY : Y (cd/m²) mesuré sur un blanc de référence — null = non calibré.
  // noiseFloor : seuil sous lequel Y est traité comme bruit (dalle éteinte).
  const [refY,       setRefY]       = useState<number | null>(null);
  const [noiseFloor, setNoiseFloor] = useState<number>(0.1);

  /** @brief Interroge l'état du bridge/CS-160 (/api/cs160?action=status). */
  const checkStatus = useCallback(async () => {
    try {
      const res  = await fetch('/api/cs160?action=status', { cache: 'no-store' });
      const data = await res.json();
      setConnected(!!data.connected);
      if (data.port) setDevicePort(data.port);
      setStatusLabel(data.connected
        ? `CS-160 connecté${data.device ? ` — ${data.device}` : ''}`
        : 'CS-160 déconnecté');
      setError('');
    } catch {
      setConnected(false);
      setStatusLabel('Bridge inaccessible (172.17.50.39:3000)');
    }
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  /** @brief Connecte l'appareil CS-160 via POST /api/cs160 (action 'connect'). */
  const connect = async () => {
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/cs160', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'connect' }) });
      const data = await res.json();
      if (data.success) { setConnected(true); await checkStatus(); }
      else setError(data.error || 'Échec de connexion');
    } catch (e: any) { setError(e.message || 'Erreur réseau'); }
    setLoading(false);
  };

  /** @brief Déconnecte l'appareil CS-160 (action 'disconnect'). */
  const disconnect = async () => {
    setLoading(true); setError('');
    try {
      await fetch('/api/cs160', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'disconnect' }) });
      setConnected(false); setStatusLabel('CS-160 déconnecté'); setMeasurement(null);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  /** @brief Lance une mesure (action 'measure') et l'ajoute à l'historique. */
  const measure = async () => {
    setLoading(true); setError(''); setMeasurement(null);
    try {
      const res  = await fetch('/api/cs160', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'measure' }) });
      const data = await res.json();
      if (data.success && data.data) {
        const result: MeasureResult = {
          timestamp: new Date(data.data.timestamp || Date.now()).toLocaleTimeString('fr-FR'),
          xyz:  data.data.xyz,
          lvxy: data.data.lvxy,
        };
        setMeasurement(result);
        setHistory(prev => [result, ...prev].slice(0, 30));
      } else {
        setError(data.error || 'Échec de la mesure');
      }
    } catch (e: any) { setError(e.message || 'Erreur réseau'); }
    setLoading(false);
  };

  /** @brief Récupère les samples stockés dans l'appareil (action 'samples'). */
  const loadSamples = async () => {
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/cs160?action=samples', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) setSamples(data.data);
      else setError(data.error || 'Impossible de récupérer les samples');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const xyY = measurement?.xyz ? (() => {
    const { X, Y, Z } = measurement.xyz;
    const s = X + Y + Z;
    return s < 1e-6 ? null : { x: X / s, y: Y / s, Y };
  })() : null;

  // Points for diagram (carry Z for curve encoding)
  const currentPoint = measurement
    ? { x: measurement.lvxy.x, y: measurement.lvxy.y, Z: measurement.xyz.Z }
    : null;
  const historyPoints: DiagramPoint[] = history.slice(1).map(h => ({
    x: h.lvxy.x, y: h.lvxy.y, Z: h.xyz.Z,
    label: h.timestamp,
  }));

  return (
    <div style={{ padding: '28px 20px', maxWidth: 1100, margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Gauge size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Colorimètre CS-160</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Konica Minolta — Luminance &amp; Chromaticité CIE 1931</p>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>
          <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>172.17.50.39:3000</code>
          {devicePort && <div style={{ marginTop: 2, color: '#059669' }}><code style={{ background: '#f0fdf4', padding: '2px 6px', borderRadius: 4 }}>{devicePort}</code></div>}
        </div>
      </div>

      {/* Status */}
      <div style={{ padding: 16, borderRadius: 12, background: connected ? '#f0fdf4' : '#fef2f2', border: `2px solid ${connected ? '#86efac' : '#fca5a5'}`, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: connected ? '#22c55e' : '#ef4444', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          {connected ? <CheckCircle size={18} color="#fff" /> : <XCircle size={18} color="#fff" />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: connected ? '#166534' : '#991b1b' }}>{connected ? 'Appareil connecté' : 'Appareil déconnecté'}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{statusLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={checkStatus} disabled={loading} title="Rafraîchir" style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          {connected
            ? <button onClick={disconnect} disabled={loading} style={btnStyle('#ef4444')}><Power size={14} /> Déconnecter</button>
            : <button onClick={connect}    disabled={loading} style={btnStyle('#22c55e')}><Power size={14} /> {loading ? 'Connexion…' : 'Connecter'}</button>}
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <AlertCircle size={16} />{error}
        </div>
      )}

      {/* Measure button */}
      <button onClick={measure} disabled={!connected || loading} style={{
        width: '100%', padding: '16px', borderRadius: 12, border: 'none',
        background: connected && !loading ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#cbd5e1',
        color: '#fff', fontSize: 16, fontWeight: 700, cursor: !connected || loading ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        marginBottom: 20, opacity: !connected || loading ? 0.65 : 1,
      }}>
        <Activity size={20} />
        {loading ? 'Mesure en cours…' : 'Lancer une mesure'}
      </button>

      {/* Main layout: diagram + results */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 20, alignItems: 'start' }}>

        {/* Chromaticity diagram */}
        <div style={{ flex: '0 1 480px', minWidth: 0, background: '#1e293b', borderRadius: 14, padding: 12, border: '1px solid #334155', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 10, letterSpacing: 0.5 }}>
            DIAGRAMME DE CHROMATICITÉ CIE 1931
            {currentPoint && <span style={{ marginLeft: 8, color: '#e2e8f0' }}>● mesure courante</span>}
            {historyPoints.length > 0 && <span style={{ marginLeft: 8, color: 'rgba(226,232,240,0.45)' }}>— trajectoire (couleur = z, épaisseur = Z)</span>}
          </div>
          <ChromaticityDiagram current={currentPoint} history={historyPoints} />
        </div>

        {/* Results panel */}
        <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {measurement ? (
            <>
              <div style={{ padding: 16, borderRadius: 12, background: '#eff6ff', border: '2px solid #93c5fd' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 12 }}>Résultats — {measurement.timestamp}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <ResultCard title="Lv/x/y">
                    <BigVal>{measurement.lvxy.Lv.toFixed(4)}</BigVal>
                    <Unit>cd/m²</Unit>
                    <Row label="x" val={measurement.lvxy.x.toFixed(5)} />
                    <Row label="y" val={measurement.lvxy.y.toFixed(5)} />
                  </ResultCard>
                  <ResultCard title="XYZ">
                    <Row label="X" val={measurement.xyz.X.toFixed(4)} />
                    <Row label="Y" val={measurement.xyz.Y.toFixed(4)} />
                    <Row label="Z" val={measurement.xyz.Z.toFixed(4)} />
                  </ResultCard>
                  {xyY && (
                    <ResultCard title="xyY (CIE 1931)">
                      <Row label="x" val={xyY.x.toFixed(5)} />
                      <Row label="y" val={xyY.y.toFixed(5)} />
                      <Row label="Y" val={xyY.Y.toFixed(4)} />
                    </ResultCard>
                  )}
                  <ResultCard title="Couleur sRGB">
                    <ColorSwatch
                      xyz={measurement.xyz}
                      refY={refY}
                      noiseFloor={noiseFloor}
                    />
                    {/* Contrôles de référence luminance */}
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => setRefY(measurement.xyz.Y)}
                          title="Utiliser cette mesure comme blanc 100% (Y de référence)"
                          style={{ flex: 1, padding: '5px 8px', borderRadius: 5, border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Fixer blanc de réf. {refY != null ? `(Y=${refY.toFixed(3)})` : ''}
                        </button>
                        {refY != null && (
                          <button
                            onClick={() => setRefY(null)}
                            title="Retirer la référence blanche (revenir en mode chromatique)"
                            style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>Seuil bruit Y&lt;</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={noiseFloor}
                          onChange={e => setNoiseFloor(Math.max(0, Number(e.target.value)))}
                          style={{ width: 64, padding: '3px 6px', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 10, fontFamily: 'monospace' }}
                        />
                        <span style={{ fontSize: 10, color: '#64748b' }}>cd/m²</span>
                      </div>
                      {refY == null && (
                        <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.3 }}>
                          Sans réf. blanche : chromaticité seule (luminance ignorée).
                          Pointez sur blanc à fond, cliquez « Fixer blanc ».
                        </div>
                      )}
                    </div>
                  </ResultCard>
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: 24, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
              Lancez une mesure pour voir les résultats et le point sur le diagramme.
            </div>
          )}

          {/* History */}
          <div style={{ padding: 14, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Historique ({history.length})</div>
            {history.length === 0
              ? <div style={{ fontSize: 11, color: '#94a3b8' }}>Aucune mesure.</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflowY: 'auto' }}>
                  {history.map((h, i) => {
                    const z = (1 - h.lvxy.x - h.lvxy.y);
                    const zClamp = Math.max(0, Math.min(1, z));
                    const zR = Math.round(255 * (1 - zClamp) + 30  * zClamp);
                    const zG = Math.round(160 * (1 - zClamp) + 200 * zClamp);
                    const zB = Math.round( 20 * (1 - zClamp) + 255 * zClamp);
                    return (
                      <div key={i} style={{ padding: '5px 8px', borderRadius: 6, background: i === 0 ? '#eff6ff' : '#fff', fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, border: `1px solid ${i === 0 ? '#93c5fd' : '#f1f5f9'}` }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: `rgb(${zR},${zG},${zB})`, flexShrink: 0 }} />
                        <span style={{ color: '#64748b', flexShrink: 0 }}>{h.timestamp}</span>
                        <span style={{ fontFamily: 'monospace', color: '#1e40af', fontWeight: 600, flex: 1, textAlign: 'right' }}>
                          Lv={h.lvxy.Lv.toFixed(3)} x={h.lvxy.x.toFixed(4)} y={h.lvxy.y.toFixed(4)} z={z.toFixed(4)} Z={h.xyz.Z.toFixed(4)}
                        </span>
                      </div>
                    );
                  })}
                </div>
            }
          </div>

          {/* Samples */}
          <div style={{ padding: 14, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}><Database size={13} /> Samples (appareil)</span>
              <button onClick={loadSamples} disabled={!connected || loading} style={{ ...btnStyle('#6366f1'), padding: '4px 10px', fontSize: 11 }}>Charger</button>
            </div>
            {samples
              ? <div style={{ fontSize: 11 }}>
                  <div style={{ color: '#64748b', marginBottom: 4 }}>{samples.count} sample(s)</div>
                  {(samples.samples as any[]).slice(0, 8).map((s: any) => (
                    <div key={s.index} style={{ padding: '3px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace' }}>
                      <span style={{ color: '#64748b' }}>#{s.index}</span>
                      <span>X:{s.X?.toFixed(3)} Y:{s.Y?.toFixed(3)} Z:{s.Z?.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              : <div style={{ fontSize: 11, color: '#94a3b8' }}>Cliquez "Charger" pour lire les données.</div>}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── UI helpers ────────────────────────────────────────────────────────────────

/**
 * @brief Construit le style inline d'un bouton coloré.
 * @param bg Couleur de fond du bouton.
 * @returns L'objet de style CSS.
 */
function btnStyle(bg: string): React.CSSProperties {
  return { padding: '7px 14px', borderRadius: 7, border: 'none', background: bg, color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 };
}

/**
 * @brief Carte de résultat avec titre et contenu.
 * @param title Titre de la carte.
 * @param children Contenu (lignes de valeurs).
 * @returns La carte JSX.
 */
function ResultCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 12, borderRadius: 9, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

/** @brief Affiche une valeur principale en grand. */
function BigVal({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 22, fontWeight: 700, color: '#1e3a8a', lineHeight: 1 }}>{children}</div>;
}

/** @brief Affiche une unité de mesure discrète. */
function Unit({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6 }}>{children}</div>;
}

/**
 * @brief Ligne « label : valeur » d'une carte de résultat.
 * @param label Libellé de la grandeur.
 * @param val Valeur formatée.
 * @returns La ligne JSX.
 */
function Row({ label, val }: { label: string; val: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
      <span style={{ color: '#64748b', fontWeight: 600 }}>{label}</span>
      <span style={{ fontFamily: 'monospace' }}>{val}</span>
    </div>
  );
}

/**
 * @brief Pastille de couleur sRGB calculée à partir d'une mesure XYZ.
 *
 * Utilise xyzToSrgbForSwatch (avec référence de blanc et seuil de bruit) pour
 * afficher la couleur, son code hexadécimal et la luminance Y. Une dalle
 * éteinte (sous le seuil) s'affiche en noir avec la mention « Noir / éteint ».
 *
 * @param xyz Tristimulus mesuré { X, Y, Z }.
 * @param refY Y de référence d'un blanc (null = mode chromatique).
 * @param noiseFloor Seuil de luminance sous lequel on rend du noir.
 * @returns La pastille JSX de couleur.
 */
function ColorSwatch({
  xyz,
  refY = null,
  noiseFloor = 0.1,
}: {
  xyz: { X: number; Y: number; Z: number };
  refY?: number | null;
  noiseFloor?: number;
}) {
  const { r, g, b } = xyzToSrgbForSwatch(xyz.X, xyz.Y, xyz.Z, refY, noiseFloor);
  const hex = `#${[r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
  const isBlack = r < 1 && g < 1 && b < 1;
  return (
    <div>
      <div style={{
        width: '100%', height: 52, borderRadius: 7,
        background: hex,
        border: `1px solid ${isBlack ? '#334155' : 'rgba(0,0,0,.08)'}`,
        marginBottom: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isBlack && (
          <span style={{ fontSize: 10, color: '#475569' }}>Noir / éteint</span>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#1e40af', fontFamily: 'monospace', textAlign: 'center', fontWeight: 700 }}>
        {hex.toUpperCase()}
      </div>
      <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 2 }}>
        Y = {xyz.Y.toFixed(4)} cd/m²
      </div>
    </div>
  );
}
