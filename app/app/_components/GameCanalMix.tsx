'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { GameTileProps } from './GameColorSpeed';

/* ─────────────────────────────────────────────────────────────────────────
   Profils RGB (0-1) des 32 canaux physiques — identiques à chromaticite/page.tsx
   Les valeurs sont encodées gamma (sRGB). On les délinéarise pour calculer
   le xy CIE exact par mélange additif.
───────────────────────────────────────────────────────────────────────── */
const CHANNEL_PROFILES: [number, number, number][] = [
  [0.35, 0.00, 0.60], // 0  404nm — Violet foncé
  [0.55, 0.00, 0.85], // 1  421nm — Violet clair
  [0.28, 0.00, 0.95], // 2  435nm — Bleu-violet
  [0.10, 0.04, 0.98], // 3  448nm — Bleu marine
  [0.00, 0.45, 1.00], // 4  479nm — Bleu turquoise
  [0.00, 0.95, 0.38], // 5  513nm — Vert clair
  [0.00, 0.72, 0.18], // 6  ~525nm — Vert foncé
  [0.50, 1.00, 0.00], // 7  541nm — Jaune-vert (lime)
  [1.00, 0.72, 0.00], // 8  593nm — Orange/ambre
  [1.00, 0.38, 0.00], // 9  605nm — Orange-rouge (rouge/orangé marron)
  [0.92, 0.06, 0.00], // 10 629nm — Rouge (un peu foncé)
  [1.00, 0.03, 0.00], // 11 642nm — Rouge pétant
  [0.96, 0.00, 0.05], // 12 658nm — Rouge cerise
  [0.92, 0.00, 0.06], // 13 658nm — Rouge cerise+
  [0.55, 0.00, 0.00], // 14 698nm — Rouge foncé
  [0.26, 0.00, 0.00], // 15 731nm — Rouge très foncé (near-IR)
  [0.12, 0.00, 0.00], // 16 758nm — Rouge invisible (IR)
  [0.06, 0.00, 0.00], // 17 780nm — Rouge invisible (IR)
  [1.00, 0.52, 0.00], // 18 — Jaune orange (phosphore chaud)
  [1.00, 0.65, 0.06], // 19 — Jaune orange clair
  [1.00, 0.68, 0.10], // 20 — Jaune orange clair (dim)
  [1.00, 0.72, 0.12], // 21 — Jaune orange clair (dim2)
  [1.00, 0.75, 0.14], // 22 — Jaune orange clair (dim3)
  [1.00, 0.90, 0.62], // 23 — Blanc chaud orangé
  [1.00, 0.96, 0.85], // 24 — Blanc légèrement jaunis
  [1.00, 1.00, 1.00], // 25 — Blanc pur
  [1.00, 1.00, 0.98], // 26 — Blanc (dim)
  [0.98, 0.98, 0.96], // 27 — Blanc (dim2)
  [0.62, 0.62, 0.62], // 28 — Gris
  [0.50, 0.50, 0.50], // 29 — Gris foncé
  [0.82, 0.82, 0.80], // 30 — Blanc/Gris
  [0.92, 0.92, 0.90], // 31 — Blanc dim
];

const CHANNEL_NAMES = [
  'Violet foncé 404nm','Violet clair 421nm','Bleu-violet 435nm','Bleu marine 448nm','Bleu 479nm',
  'Vert clair 513nm','Vert foncé','Jaune-vert 541nm','Orange 593nm','Orange-rouge 605nm',
  'Rouge 629nm','Rouge pétant 642nm','Rouge cerise 658nm','Rouge cerise+ 658nm','Rouge foncé 698nm',
  'Rouge IR 731nm','IR 758nm','IR 780nm',
  'Jaune orange','Jaune orange clair','Jaune orange (dim)','Jaune orange (dim2)','Jaune orange (dim3)',
  'Blanc chaud','Blanc jaunis','Blanc','Blanc (dim)','Blanc (dim2)',
  'Gris','Gris foncé','Blanc/Gris','Blanc dim',
];

/* Canaux intéressants (bonne diversité chromatique, pas trop sombres) */
const INTERESTING = [0, 1, 2, 4, 5, 6, 7, 8, 9, 11, 12, 18, 23, 24, 25];

/* ─── Conversion couleur ─────────────────────────────────────────────── */
function toLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function rgbLinToXyz(r: number, g: number, b: number) {
  return {
    X: 0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    Y: 0.2126729 * r + 0.7151522 * g + 0.0721750 * b,
    Z: 0.0193339 * r + 0.1192000 * g + 0.9503041 * b,
  };
}

/** CIE xy du mélange additif de canaux (intensité égale pour chacun) */
function mixChannelsXy(idxs: number[]): { x: number; y: number } {
  let X = 0, Y = 0, Z = 0;
  for (const i of idxs) {
    const [r, g, b] = CHANNEL_PROFILES[i];
    const xyz = rgbLinToXyz(toLinear(r), toLinear(g), toLinear(b));
    X += xyz.X; Y += xyz.Y; Z += xyz.Z;
  }
  const s = X + Y + Z;
  if (s < 1e-9) return { x: 0.3127, y: 0.3290 };
  return { x: X / s, y: Y / s };
}

/** Couleur sRGB du mélange pour le rendu UI */
function mixChannelsRgb255(idxs: number[]): { r: number; g: number; b: number } {
  let R = 0, G = 0, B = 0;
  for (const i of idxs) {
    const [r, g, b] = CHANNEL_PROFILES[i];
    R += r; G += g; B += b;
  }
  const mx = Math.max(R, G, B, 1e-9);
  const gam = (c: number) => c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return {
    r: Math.round(Math.min(1, gam(R / mx)) * 255),
    g: Math.round(Math.min(1, gam(G / mx)) * 255),
    b: Math.round(Math.min(1, gam(B / mx)) * 255),
  };
}

/* ─── CIE 1931 diagram ───────────────────────────────────────────────── */
const HORSESHOE: [number, number][] = [
  [0.1741,0.0050],[0.1740,0.0050],[0.1738,0.0049],[0.1736,0.0050],[0.1730,0.0048],
  [0.1721,0.0048],[0.1714,0.0051],[0.1689,0.0082],[0.1644,0.0139],[0.1566,0.0214],
  [0.1440,0.0297],[0.1241,0.0578],[0.0913,0.1327],[0.0454,0.2950],[0.0082,0.5384],
  [0.0139,0.7502],[0.0743,0.8338],[0.1547,0.8059],[0.2296,0.7543],[0.3016,0.6923],
  [0.3731,0.6245],[0.4441,0.5547],[0.5125,0.4866],[0.5752,0.4242],[0.6270,0.3725],
  [0.6658,0.3340],[0.7006,0.2993],[0.7301,0.2700],[0.7548,0.2452],[0.7800,0.2200],
  [0.8000,0.2000],[0.8210,0.1790],[0.8507,0.1493],
];

const DW = 420, DH = 380;
const X_MIN = 0, X_MAX = 0.85, Y_MIN = 0, Y_MAX = 0.92;
const PAD_L = 28, PAD_R = 14, PAD_T = 10, PAD_B = 22;

function xyToSvg(x: number, y: number) {
  return {
    px: PAD_L + (x - X_MIN) / (X_MAX - X_MIN) * (DW - PAD_L - PAD_R),
    py: (DH - PAD_B) - (y - Y_MIN) / (Y_MAX - Y_MIN) * (DH - PAD_T - PAD_B),
  };
}
function svgToXy(px: number, py: number) {
  return {
    x: (px - PAD_L) / (DW - PAD_L - PAD_R) * (X_MAX - X_MIN) + X_MIN,
    y: ((DH - PAD_B) - py) / (DH - PAD_T - PAD_B) * (Y_MAX - Y_MIN) + Y_MIN,
  };
}
function inHorseshoe(cx: number, cy: number) {
  let inside = false;
  for (let i = 0, j = HORSESHOE.length - 1; i < HORSESHOE.length; j = i++) {
    const [xi, yi] = HORSESHOE[i], [xj, yj] = HORSESHOE[j];
    if ((yi > cy) !== (yj > cy) && cx < (xj - xi) * (cy - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function xyToRgb255(x: number, y: number) {
  if (y < 1e-8 || x < 0 || x + y > 1) return null;
  const Xv = x / y, Y = 1.0, Z = (1 - x - y) / y;
  let r = 3.2406 * Xv - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * Xv + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * Xv - 0.2040 * Y + 1.0570 * Z;
  const mn = Math.min(r, g, b);
  if (mn < 0) { r -= mn; g -= mn; b -= mn; }
  const mx = Math.max(r, g, b, 1e-9);
  r /= mx; g /= mx; b /= mx;
  const gam = (c: number) => c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return {
    r: Math.round(Math.min(1, Math.max(0, gam(r))) * 255),
    g: Math.round(Math.min(1, Math.max(0, gam(g))) * 255),
    b: Math.round(Math.min(1, Math.max(0, gam(b))) * 255),
  };
}

/* ─── Game constants ─────────────────────────────────────────────────── */
const TOTAL_ROUNDS = 5;
const AUTO_S = 4;
const HW_INTENSITY = 80; // valeur 0-100 envoyée à chaque canal

/* ─── Styles ─────────────────────────────────────────────────────────── */
const G: Record<string, React.CSSProperties> = {
  wrap: {
    background: 'linear-gradient(160deg,rgba(8,12,24,.94),rgba(10,14,32,.90))',
    backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
    border: '1px solid rgba(255,255,255,.07)', borderRadius: 20, overflow: 'hidden',
    fontFamily: 'system-ui,-apple-system,sans-serif', color: '#e8eaf0',
  },
  tag: {
    display: 'inline-block',
    background: 'linear-gradient(135deg,rgba(139,92,246,.3),rgba(6,214,160,.2))',
    border: '1px solid rgba(139,92,246,.5)', borderRadius: 8,
    padding: '3px 10px', fontSize: 12, fontWeight: 800, color: '#a78bfa',
    marginBottom: 8, letterSpacing: '.04em',
  },
  playBtn: {
    padding: '11px 26px', borderRadius: 14, border: 'none',
    background: 'linear-gradient(135deg,#8b5cf6,#06d6a0)',
    boxShadow: '0 4px 20px rgba(139,92,246,.35)',
    color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
  },
  quitBtn: {
    padding: '10px 20px', borderRadius: 14,
    border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)',
    color: 'rgba(255,255,255,.7)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
  },
  statCard: {
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 12, padding: '8px 16px', textAlign: 'center' as const, minWidth: 72,
  },
  statLbl: { fontSize: 10, color: 'rgba(255,255,255,.38)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 3 },
  statVal: { fontSize: 22, fontWeight: 900 },
  glass: { background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12 },
  stopBtn: {
    padding: '4px 12px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.05)',
    color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: 12,
  },
};

/* ─── Props ──────────────────────────────────────────────────────────── */
interface GameCanalMixProps extends GameTileProps {
  /** Envoi direct de 32 valeurs de canaux (0-100) vers une dalle */
  onSendRawChannels: (tileIdx: number, channels: number[]) => void;
}

export default function GameCanalMix({
  onSendColor, onTurnOffAll, onQuit, onSendRawChannels, tileCount = 42,
}: GameCanalMixProps) {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'result' | 'finished'>('ready');
  const [round, setRound] = useState(0);
  const [roundChans, setRoundChans] = useState<number[]>([]); // 3 channel indices courants
  const [roundXy, setRoundXy] = useState({ x: 0.3127, y: 0.3290 });
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [confirmed, setConfirmed] = useState<{ x: number; y: number } | null>(null);
  const [dist, setDist] = useState(0);
  const [roundPts, setRoundPts] = useState(0);
  const [totalPts, setTotalPts] = useState(0);
  const [countdown, setCountdown] = useState(AUTO_S);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const hwTimer = useRef<number>(0);
  const numTiles = Math.min(tileCount, 42);

  /* ── Dessiner le diagramme CIE (une fois au montage) ── */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const iw = cv.width, ih = cv.height;
    const img = ctx.createImageData(iw, ih);
    for (let py = 0; py < ih; py++) {
      for (let px = 0; px < iw; px++) {
        const { x, y } = svgToXy(px * DW / iw, py * DH / ih);
        const idx = (py * iw + px) * 4;
        if (!inHorseshoe(x, y) || x < X_MIN || y < Y_MIN) {
          img.data[idx] = 8; img.data[idx+1] = 8; img.data[idx+2] = 18; img.data[idx+3] = 255;
          continue;
        }
        const c = xyToRgb255(x, y);
        if (c) { img.data[idx]=c.r; img.data[idx+1]=c.g; img.data[idx+2]=c.b; img.data[idx+3]=255; }
        else   { img.data[idx]=8;   img.data[idx+1]=8;   img.data[idx+2]=18;  img.data[idx+3]=255; }
      }
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  useEffect(() => () => { onTurnOffAll(); window.clearTimeout(hwTimer.current); }, []); // eslint-disable-line

  /* ── Envoyer les 3 canaux aux dalles ── */
  const sendChannelsToAll = useCallback((idxs: number[]) => {
    const chs = new Array(32).fill(0);
    for (const i of idxs) chs[i] = HW_INTENSITY;
    for (let t = 0; t < numTiles; t++) onSendRawChannels(t, chs);
  }, [numTiles, onSendRawChannels]);

  /* ── Couleur curseur → dalles (aperçu en temps réel) ── */
  const sendCursorToTiles = useCallback((x: number, y: number) => {
    window.clearTimeout(hwTimer.current);
    hwTimer.current = window.setTimeout(() => {
      const c = xyToRgb255(x, y);
      if (c) for (let t = 0; t < numTiles; t++) onSendColor(t, c.r, c.g, c.b, 80);
    }, 30);
  }, [numTiles, onSendColor]);

  /* ── Auto-avance après résultat ── */
  useEffect(() => {
    if (phase !== 'result') return;
    let n = AUTO_S;
    setCountdown(n);
    const id = window.setInterval(() => {
      n--;
      setCountdown(n);
      if (n <= 0) {
        window.clearInterval(id);
        setTotalPts(s => s + roundPts);
        const next = round + 1;
        if (next >= TOTAL_ROUNDS) { onTurnOffAll(); setPhase('finished'); }
        else {
          const chans = pick3();
          setRoundChans(chans);
          setRoundXy(mixChannelsXy(chans));
          setRound(next);
          setCursor(null); setConfirmed(null);
          setPhase('playing');
          sendChannelsToAll(chans);
        }
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]); // eslint-disable-line

  /* ── Pioche 3 canaux distincts dans la liste intéressante ── */
  function pick3(): number[] {
    const pool = [...INTERESTING];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3);
  }

  function startGame() {
    const chans = pick3();
    setRoundChans(chans);
    setRoundXy(mixChannelsXy(chans));
    setRound(0); setTotalPts(0);
    setCursor(null); setConfirmed(null);
    setPhase('playing');
    sendChannelsToAll(chans);
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (phase !== 'playing') return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { x, y } = svgToXy(
      (e.clientX - rect.left) * DW / rect.width,
      (e.clientY - rect.top)  * DH / rect.height,
    );
    const cx = Math.max(X_MIN, Math.min(X_MAX, x));
    const cy = Math.max(Y_MIN, Math.min(Y_MAX, y));
    setCursor({ x: cx, y: cy });
    if (inHorseshoe(cx, cy)) sendCursorToTiles(cx, cy);
  }

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (phase !== 'playing' || !cursor) return;
    e.preventDefault();
    const d = Math.sqrt((cursor.x - roundXy.x) ** 2 + (cursor.y - roundXy.y) ** 2);
    const pts = Math.max(0, Math.round(1000 * (1 - d / 0.3)));
    setConfirmed(cursor);
    setDist(parseFloat(d.toFixed(4)));
    setRoundPts(pts);
    setPhase('result');
    /* révéler la couleur cible sur les dalles */
    sendChannelsToAll(roundChans);
  }

  /* ─── SVG helpers ─── */
  const horsePath = HORSESHOE.map(([x, y], i) => {
    const { px, py } = xyToSvg(x, y);
    return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(' ') + ' Z';
  const srgbPath = [[0.64,0.33],[0.30,0.60],[0.15,0.06]].map(([x,y],i) => {
    const { px, py } = xyToSvg(x, y);
    return `${i===0?'M':'L'}${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(' ') + ' Z';

  const tgtSvg  = xyToSvg(roundXy.x, roundXy.y);
  const curSvg  = cursor    ? xyToSvg(cursor.x,    cursor.y)    : null;
  const confSvg = confirmed ? xyToSvg(confirmed.x, confirmed.y) : null;
  const curColor = cursor ? xyToRgb255(cursor.x, cursor.y) : null;
  const mixRgb = roundChans.length === 3 ? mixChannelsRgb255(roundChans) : null;

  /* ─── READY ─── */
  if (phase === 'ready') return (
    <div style={G.wrap}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:20, padding:'18px 22px' }}>
        <div style={{ flex:1 }}>
          <span style={G.tag}>🎲 Mix de Canaux</span>
          <p style={{ fontSize:13, color:'rgba(255,255,255,.62)', lineHeight:1.65, margin:'0 0 10px' }}>
            3 canaux aléatoires s&apos;allument sur les dalles.<br />
            Retrouvez la couleur obtenue sur le <em>diagramme CIE 1931</em>.<br />
            <span style={{ color:'#a78bfa' }}>Déplacez le curseur et cliquez pour valider.</span>
          </p>
          <p style={{ fontSize:12, color:'rgba(255,255,255,.4)', margin:0 }}>{TOTAL_ROUNDS} manches · max {TOTAL_ROUNDS * 1000} pts</p>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>
          <button onClick={startGame} style={G.playBtn}>Jouer</button>
          <button onClick={onQuit}    style={G.quitBtn}>Quitter</button>
        </div>
      </div>
    </div>
  );

  /* ─── FINISHED ─── */
  if (phase === 'finished') return (
    <div style={G.wrap}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:20, padding:'16px 22px', flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {([['Score', totalPts+roundPts,'#a78bfa'],['Manches',TOTAL_ROUNDS,'#fff'],['Max',TOTAL_ROUNDS*1000,'rgba(255,255,255,.4)']] as [string,number,string][]).map(([k,v,c])=>(
            <div key={k} style={G.statCard}><div style={G.statLbl}>{k}</div><div style={{...G.statVal,color:c}}>{v}</div></div>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>
          <button onClick={startGame} style={G.playBtn}>Rejouer</button>
          <button onClick={onQuit}    style={G.quitBtn}>Menu</button>
        </div>
      </div>
    </div>
  );

  /* ─── PLAYING / RESULT ─── */
  return (
    <div style={G.wrap}>
      <div style={{ display:'flex', flexDirection:'column', gap:10, padding:'12px 16px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 10px', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', borderRadius:10 }}>
          <span style={{ fontWeight:700, fontSize:13 }}>Manche {round+1}/{TOTAL_ROUNDS}</span>
          <span style={{ fontWeight:800, fontSize:15, color:'#a78bfa' }}>{totalPts} pts</span>
          <button onClick={() => { onTurnOffAll(); onQuit(); }} style={G.stopBtn}><X size={12}/></button>
        </div>

        {/* Canaux sélectionnés */}
        <div style={{ ...G.glass, padding:'10px 14px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:6 }}>
            {roundChans.map(i => {
              const [r,g,b] = CHANNEL_PROFILES[i];
              return (
                <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                  <div style={{ width:28, height:28, borderRadius:6, background:`rgb(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)})`, border:'1.5px solid rgba(255,255,255,.25)' }} />
                  <span style={{ fontSize:10, color:'rgba(255,255,255,.5)', fontWeight:600 }}>ch{i}</span>
                </div>
              );
            })}
          </div>
          {mixRgb && (
            <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:4 }}>
              <span style={{ fontSize:11, color:'rgba(255,255,255,.3)' }}>→</span>
              <div style={{ width:34, height:34, borderRadius:8, background:`rgb(${mixRgb.r},${mixRgb.g},${mixRgb.b})`, border:'1.5px solid rgba(255,255,255,.25)' }} />
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#e8eaf0' }}>{roundChans.map(i=>CHANNEL_NAMES[i]).join(' + ')}</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,.45)' }}>
                  {phase==='result' ? `cible : x=${roundXy.x.toFixed(4)}, y=${roundXy.y.toFixed(4)}` : (cursor ? `curseur : x=${cursor.x.toFixed(3)}, y=${cursor.y.toFixed(3)}` : 'Déplacez le curseur')}
                </div>
              </div>
            </div>
          )}
          {curColor && phase==='playing' && (
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:22, height:22, borderRadius:5, background:`rgb(${curColor.r},${curColor.g},${curColor.b})`, border:'1px solid rgba(255,255,255,.2)' }} />
              <span style={{ fontSize:10, color:'rgba(255,255,255,.35)' }}>curseur</span>
            </div>
          )}
        </div>

        {/* Diagramme CIE */}
        <div style={{ position:'relative', borderRadius:12, overflow:'hidden', border:'1px solid rgba(255,255,255,.10)' }}>
          <canvas ref={canvasRef} width={DW} height={DH} style={{ display:'block', width:'100%', height:'auto' }} />
          <svg ref={svgRef} viewBox={`0 0 ${DW} ${DH}`} width="100%"
            style={{ position:'absolute', top:0, left:0, cursor: phase==='playing' ? 'none' : 'default' }}
            onMouseMove={handleMouseMove} onClick={handleClick}
          >
            <path d={horsePath} fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" />
            <path d={srgbPath}  fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="1" strokeDasharray="5,4" />
            {(() => { const {px,py}=xyToSvg(0.64,0.33); return <text x={px+4} y={py-4} fill="rgba(255,255,255,.35)" fontSize="8">R</text>; })()}
            {(() => { const {px,py}=xyToSvg(0.30,0.60); return <text x={px-8} y={py-4} fill="rgba(255,255,255,.35)" fontSize="8">G</text>; })()}
            {(() => { const {px,py}=xyToSvg(0.15,0.06); return <text x={px-8} y={py+10} fill="rgba(255,255,255,.35)" fontSize="8">B</text>; })()}
            {[0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8].map(v => { const {px}=xyToSvg(v,0); return <text key={v} x={px} y={DH-5} fill="rgba(255,255,255,.25)" fontSize="8" textAnchor="middle">{v.toFixed(1)}</text>; })}
            {[0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9].map(v => { const {py}=xyToSvg(0,v); return <text key={v} x={PAD_L-3} y={py+3} fill="rgba(255,255,255,.25)" fontSize="8" textAnchor="end">{v.toFixed(1)}</text>; })}
            <text x={DW/2} y={DH-3} fill="rgba(255,255,255,.35)" fontSize="10" textAnchor="middle" fontStyle="italic">x</text>
            <text x={8} y={DH/2} fill="rgba(255,255,255,.35)" fontSize="10" textAnchor="middle" fontStyle="italic" transform={`rotate(-90 8 ${DH/2})`}>y</text>
            {/* D65 */}
            {(() => { const {px,py}=xyToSvg(0.3127,0.3290); return <><circle cx={px} cy={py} r={4} fill="#fff" opacity={.6}/><text x={px+6} y={py+4} fill="rgba(255,255,255,.4)" fontSize="8">D65</text></>; })()}
            {/* Curseur */}
            {curSvg && phase==='playing' && (
              <g>
                <line x1={curSvg.px-14} y1={curSvg.py} x2={curSvg.px+14} y2={curSvg.py} stroke="#fff" strokeWidth={1.5}/>
                <line x1={curSvg.px} y1={curSvg.py-14} x2={curSvg.px} y2={curSvg.py+14} stroke="#fff" strokeWidth={1.5}/>
                <circle cx={curSvg.px} cy={curSvg.py} r={7} fill="none" stroke="#fff" strokeWidth={1.5}/>
                {curColor && <circle cx={curSvg.px} cy={curSvg.py} r={3} fill={`rgb(${curColor.r},${curColor.g},${curColor.b})`}/>}
              </g>
            )}
            {/* Réponse confirmée */}
            {confSvg && phase==='result' && (
              <g>
                <circle cx={confSvg.px} cy={confSvg.py} r={9} fill="none" stroke="#fff" strokeWidth={2}/>
                <circle cx={confSvg.px} cy={confSvg.py} r={3} fill="#fff"/>
              </g>
            )}
            {/* Cible révélée */}
            {phase==='result' && (
              <g>
                <circle cx={tgtSvg.px} cy={tgtSvg.py} r={11} fill="none" stroke="#a78bfa" strokeWidth={2.5}/>
                <circle cx={tgtSvg.px} cy={tgtSvg.py} r={4} fill="#a78bfa"/>
                {confSvg && <line x1={confSvg.px} y1={confSvg.py} x2={tgtSvg.px} y2={tgtSvg.py} stroke="rgba(255,255,255,.4)" strokeWidth={1.5} strokeDasharray="4,3"/>}
              </g>
            )}
          </svg>
        </div>

        {/* Résultat */}
        {phase==='result' && (
          <div style={{
            ...G.glass,
            background: roundPts>=700 ? 'rgba(167,139,250,.10)' : 'rgba(251,191,36,.10)',
            border: `1px solid ${roundPts>=700 ? '#a78bfa33' : '#fbbf2433'}`,
            padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center',
          }}>
            <div>
              <div style={{ fontWeight:800, color: roundPts>=700 ? '#a78bfa' : '#fbbf24' }}>
                {roundPts>=800?'Excellent !':roundPts>=500?'Bien !':'Raté'}
              </div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,.55)', marginTop:2 }}>
                Distance xy = {dist} · canaux {roundChans.map(i=>`ch${i}`).join('+')}
              </div>
            </div>
            <div style={{ textAlign:'right', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
              <div style={{ fontSize:20, fontWeight:800 }}>+{roundPts} pts</div>
              <div style={{ fontSize:12, color:'#a78bfa', fontWeight:700 }}>
                {round+1<TOTAL_ROUNDS ? `Suivant dans ${countdown}s` : `Résultats dans ${countdown}s`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
