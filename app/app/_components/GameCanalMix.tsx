'use client';

import { useCallback, useEffect, useRef, useState, useLayoutEffect } from 'react';
import { Check, Ruler, X, RefreshCw } from 'lucide-react';
import type { GameTileProps } from './GameColorSpeed';
import { DIFF_LABELS, type DifficultyLevel } from './GameColorSpeed';
import CieDiagramCanvas, { type CieMarker, type CiePolyline } from './CieDiagramCanvas';
import { CHANNELS_ROUGE, CHANNELS_BLEU, type TileType } from '@/lib/tileChannels';

// ── Mix de Canaux — nouveau concept ────────────────────────────────────────────
// 1. La salle DROITE s'allume avec un mélange secret de 3 canaux spectraux.
// 2. Le joueur vise une dalle avec le CS-160 et clique "Mesurer".
// 3. La mesure (x, y CIE) alimente findChannelWeights() qui inverse le mélange.
// 4. Les 3 sliders se positionnent automatiquement sur les poids trouvés.
// 5. La salle GAUCHE montre le résultat en temps réel — le joueur affine si besoin.
// 6. "Valider" compare les deux mélanges et donne un score.

const INTERESTING_ROUGE = [0, 1, 2, 4, 5, 6, 7, 8, 9, 11, 12, 17, 22, 23, 24];
const INTERESTING_BLEU  = [0, 2, 4, 6, 7, 9, 10, 12, 13, 15, 17, 18, 22, 23, 24];

const LEFT_IDX  = [0,1,2,6,7,8,12,13,14,18,19,20,24,25,26,30,31,32,36,37,38];
const RIGHT_IDX = [3,4,5,9,10,11,15,16,17,21,22,23,27,28,29,33,34,35,39,40,41];

const CANAL_DIFF = {
  facile:    { rounds: 3, autoS: 6 },
  moyen:     { rounds: 5, autoS: 4 },
  difficile: { rounds: 7, autoS: 3 },
  expert:    { rounds: 8, autoS: 2 },
} satisfies Record<DifficultyLevel, { rounds: number; autoS: number }>;

const HW_INTENSITY = 80;

// ── Conversions couleur ────────────────────────────────────────────────────────
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

function mixWeightedXy(idxs: number[], ws: number[], profiles: [number,number,number][]) {
  let X = 0, Y = 0, Z = 0;
  idxs.forEach((i, k) => {
    const [r,g,b] = profiles[i];
    const xyz = rgbLinToXyz(toLinear(r), toLinear(g), toLinear(b));
    X += xyz.X * ws[k]; Y += xyz.Y * ws[k]; Z += xyz.Z * ws[k];
  });
  const s = X + Y + Z;
  if (s < 1e-9) return { x: 0.3127, y: 0.3290 };
  return { x: X / s, y: Y / s };
}

function mixChannelsXy(idxs: number[], profiles: [number,number,number][]) {
  return mixWeightedXy(idxs, idxs.map(() => 1), profiles);
}

/**
 * Retrouve les poids w1,w2,w3 ≥ 0 des 3 canaux qui reproduisent (tx, ty)
 * en minimisant la distance CIE xy par descente de gradient.
 */
function findChannelWeights(
  tx: number, ty: number,
  chanIdxs: number[],
  profiles: [number,number,number][],
): [number, number, number] {
  const chXyz = chanIdxs.map(i => {
    const [r,g,b] = profiles[i];
    return rgbLinToXyz(toLinear(r), toLinear(g), toLinear(b));
  });

  let w = [0.5, 0.5, 0.5];
  const lr = 0.08;

  for (let iter = 0; iter < 800; iter++) {
    let X = 0, Y = 0, Z = 0;
    for (let k = 0; k < 3; k++) {
      X += chXyz[k].X * w[k];
      Y += chXyz[k].Y * w[k];
      Z += chXyz[k].Z * w[k];
    }
    const s = X + Y + Z;
    if (s < 1e-9) break;
    const mx = X / s, my = Y / s;
    const dx = mx - tx, dy = my - ty;
    if (Math.abs(dx) < 0.0005 && Math.abs(dy) < 0.0005) break;

    for (let k = 0; k < 3; k++) {
      const dsdk = chXyz[k].X + chXyz[k].Y + chXyz[k].Z;
      const dmxdk = (chXyz[k].X * s - X * dsdk) / (s * s);
      const dmydk = (chXyz[k].Y * s - Y * dsdk) / (s * s);
      const grad = 2 * dx * dmxdk + 2 * dy * dmydk;
      w[k] = Math.max(0, Math.min(1, w[k] - lr * grad));
    }
  }

  // Normaliser pour que le max soit ~1
  const mx = Math.max(...w, 0.01);
  return [w[0] / mx, w[1] / mx, w[2] / mx] as [number, number, number];
}

// ── CIE diagram helpers ───────────────────────────────────────────────────────
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
  const gam = (c: number) => c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1/2.4) - 0.055;
  return {
    r: Math.round(Math.min(1, Math.max(0, gam(r))) * 255),
    g: Math.round(Math.min(1, Math.max(0, gam(g))) * 255),
    b: Math.round(Math.min(1, Math.max(0, gam(b))) * 255),
  };
}

// ── Styles ────────────────────────────────────────────────────────────────────
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
  measureBtn: {
    padding: '11px 20px', borderRadius: 13, border: 'none',
    background: 'linear-gradient(135deg,#06d6a0,#4361ee)',
    boxShadow: '0 4px 18px rgba(6,214,160,.3)',
    color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  quitBtn: {
    padding: '10px 20px', borderRadius: 14,
    border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)',
    color: 'rgba(255,255,255,.7)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
  },
  glass: {
    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12,
  },
  statCard: {
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 12, padding: '8px 16px', textAlign: 'center' as const, minWidth: 72,
  },
  statLbl: { fontSize: 10, color: 'rgba(255,255,255,.38)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 3 },
  statVal: { fontSize: 22, fontWeight: 900 },
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface GameCanalMixProps extends GameTileProps {
  onSendRawChannels: (tileIdx: number, channels: number[]) => void;
  plateType?: TileType;
}

export default function GameCanalMix({
  onSendColor, onTurnOffAll, onQuit, onSendRawChannels, tileCount = 42, onComplete, plateType = 'rouge', difficulty = 'moyen',
}: GameCanalMixProps) {
  const cfg = CANAL_DIFF[difficulty];
  const TOTAL_ROUNDS = cfg.rounds;
  const AUTO_S = cfg.autoS;

  type Phase = 'ready' | 'playing' | 'measured' | 'result' | 'finished';

  const [phase, setPhase]               = useState<Phase>('ready');
  const [round, setRound]               = useState(0);
  const [roundChans, setRoundChans]     = useState<number[]>([]);
  const [secretWeights, setSecretWeights] = useState<[number,number,number]>([0.5,0.5,0.5]);
  const [weights, setWeights]           = useState<[number,number,number]>([0.5,0.5,0.5]);
  const [target, setTarget]             = useState<{x:number;y:number}>({x:0.3127,y:0.3290});
  const [measured, setMeasured]         = useState<{x:number;y:number;Lv:number}|null>(null);
  const [measuring, setMeasuring]       = useState(false);
  const [dist, setDist]                 = useState(0);
  const [roundPts, setRoundPts]         = useState(0);
  const [totalPts, setTotalPts]         = useState(0);
  const [countdown, setCountdown]       = useState(AUTO_S);
  const [msg, setMsg]                   = useState('');
  useEffect(() => { if (phase === 'finished') onComplete?.(Math.round(totalPts / 5)); }, [phase]); // eslint-disable-line

  const hwTimer    = useRef<number>(0);
  const numTiles   = Math.min(tileCount, 42);
  const diagContRef = useRef<HTMLDivElement>(null);
  const [diagSize, setDiagSize] = useState(360);
  useLayoutEffect(() => {
    const el = diagContRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => {
      setDiagSize(Math.min(Math.floor(e.contentRect.width), 500));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const channelData  = plateType === 'bleu' ? CHANNELS_BLEU : CHANNELS_ROUGE;
  const profiles     = channelData.map(ch => ch.rgb) as [number,number,number][];
  const channelNames = channelData.map(ch => ch.nm != null ? `${ch.label} ${ch.nm}nm` : ch.label);
  const INTERESTING  = plateType === 'bleu' ? INTERESTING_BLEU : INTERESTING_ROUGE;

  // Dessin CIE
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const iw = cv.width, ih = cv.height;
    const img = ctx.createImageData(iw, ih);
    for (let py = 0; py < ih; py++) {
      for (let px = 0; px < iw; px++) {
        const { x, y } = svgToXy(px * DW / iw, py * DH / ih);
        const i2 = (py * iw + px) * 4;
        if (!inHorseshoe(x, y) || x < X_MIN || y < Y_MIN) {
          img.data[i2]=8; img.data[i2+1]=8; img.data[i2+2]=18; img.data[i2+3]=255; continue;
        }
        const c = xyToRgb255(x, y);
        if (c) { img.data[i2]=c.r; img.data[i2+1]=c.g; img.data[i2+2]=c.b; img.data[i2+3]=255; }
        else   { img.data[i2]=8;   img.data[i2+1]=8;   img.data[i2+2]=18;  img.data[i2+3]=255; }
      }
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  useEffect(() => () => { onTurnOffAll(); window.clearTimeout(hwTimer.current); }, []); // eslint-disable-line

  // Aperçu live salle gauche (mix courant du joueur)
  const sendPlayerMix = useCallback((chans: number[], ws: [number,number,number]) => {
    window.clearTimeout(hwTimer.current);
    hwTimer.current = window.setTimeout(() => {
      const chs = new Array(32).fill(0);
      chans.forEach((i, k) => { chs[i] = Math.round((ws[k] ?? 0) * HW_INTENSITY); });
      for (const t of LEFT_IDX) onSendRawChannels(t, chs);
    }, 30);
  }, [onSendRawChannels]);

  useEffect(() => {
    if ((phase === 'measured' || phase === 'playing') && roundChans.length === 3)
      sendPlayerMix(roundChans, weights);
  }, [weights, roundChans, phase, sendPlayerMix]);

  // Pioche 3 canaux distincts
  function pick3(): number[] {
    const pool = [...INTERESTING];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i+1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3);
  }

  // Nouvelle manche : secret = mélange aléatoire → allume salle droite
  function newRound(chans: number[]) {
    const sw: [number,number,number] = [
      0.25 + Math.random() * 0.75,
      0.25 + Math.random() * 0.75,
      0.25 + Math.random() * 0.75,
    ];
    const tgt = mixWeightedXy(chans, sw, profiles);
    setRoundChans(chans);
    setSecretWeights(sw);
    setTarget(tgt);
    setWeights([0.5, 0.5, 0.5]);
    setMeasured(null);
    setMsg('Pointez le CS-160 sur une dalle de la salle droite et mesurez.');

    // Salle droite = couleur cible (canaux secrets)
    const chs = new Array(32).fill(0);
    chans.forEach((i, k) => { chs[i] = Math.round(sw[k] * HW_INTENSITY); });
    for (const t of RIGHT_IDX) onSendRawChannels(t, chs);

    // Salle gauche = noire (attente mesure)
    const zeros = new Array(32).fill(0);
    for (const t of LEFT_IDX) onSendRawChannels(t, zeros);
  }

  // Mesure CS-160
  async function measure() {
    if (measuring) return;
    setMeasuring(true);
    setMsg('Mesure en cours…');
    let result: {x:number;y:number;Lv:number}|null = null;
    try {
      const res = await fetch('/api/cs160', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({action:'measure'}),
      });
      const data = await res.json();
      if (data.success && data.data?.lvxy) {
        const {Lv, x, y} = data.data.lvxy;
        if (Number.isFinite(x) && Number.isFinite(y)) result = {x, y, Lv};
      }
    } catch { /* appareil absent */ }

    if (!result) {
      setMsg('CS-160 non connecté — pointez l\'appareil sur une dalle de la salle droite et réessayez.');
      setMeasuring(false);
      return;
    }

    // Retrouver les poids depuis la mesure
    const computed = findChannelWeights(result.x, result.y, roundChans, profiles);
    setMeasured(result);
    setWeights(computed);
    setPhase('measured');
    setMsg(`Mesure : x=${result.x.toFixed(4)}, y=${result.y.toFixed(4)}, Lv=${result.Lv.toFixed(1)} cd/m² — Sliders calculés automatiquement.`);
    setMeasuring(false);
  }

  // Valider
  function confirm() {
    if (phase !== 'measured' && phase !== 'playing') return;
    const p = mixWeightedXy(roundChans, weights, profiles);
    const d = Math.sqrt((p.x - target.x) ** 2 + (p.y - target.y) ** 2);
    const pts = Math.max(0, Math.round(1000 * (1 - d / 0.3)));
    setDist(parseFloat(d.toFixed(4)));
    setRoundPts(pts);
    setPhase('result');
  }

  // Auto-avance
  useEffect(() => {
    if (phase !== 'result') return;
    let n = AUTO_S; setCountdown(n);
    const id = window.setInterval(() => {
      n--; setCountdown(n);
      if (n <= 0) {
        window.clearInterval(id);
        setTotalPts(s => s + roundPts);
        const next = round + 1;
        if (next >= TOTAL_ROUNDS) { onTurnOffAll(); setPhase('finished'); }
        else { newRound(pick3()); setRound(next); setPhase('playing'); }
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]); // eslint-disable-line

  function startGame() {
    setRound(0); setTotalPts(0);
    newRound(pick3());
    setPhase('playing');
  }

  // Rendu du diagramme
  const vertices = roundChans.length === 3 ? roundChans.map(i => mixChannelsXy([i], profiles)) : [];
  const playerXy = roundChans.length === 3 ? mixWeightedXy(roundChans, weights, profiles) : target;
  const targetRgb = xyToRgb255(target.x, target.y);
  const playerRgb = xyToRgb255(playerXy.x, playerXy.y);
  const measuredRgb = measured ? xyToRgb255(measured.x, measured.y) : null;
  const triangle: CiePolyline = { points: vertices, color: 'rgba(255,255,255,0.5)', width: 1.5, closed: true };
  const diagMarkers: CieMarker[] = [
    ...vertices.map((v, k) => {
      const [r,g,b] = profiles[roundChans[k]];
      return { x: v.x, y: v.y, color: `rgb(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)})`, radius: 5 } as CieMarker;
    }),
    { x: target.x, y: target.y, color: targetRgb ? `rgb(${targetRgb.r},${targetRgb.g},${targetRgb.b})` : '#a78bfa', ring: true, label: 'Cible' } as CieMarker,
    ...(measured ? [{ x: measured.x, y: measured.y, color: measuredRgb ? `rgb(${measuredRgb.r},${measuredRgb.g},${measuredRgb.b})` : '#06d6a0', radius: 7, label: 'Mesure' } as CieMarker] : []),
    { x: playerXy.x, y: playerXy.y, color: playerRgb ? `rgb(${playerRgb.r},${playerRgb.g},${playerRgb.b})` : '#fff', crosshair: true, radius: 6, label: phase === 'result' ? 'Vous' : undefined } as CieMarker,
  ];

  // ── READY ──
  if (phase === 'ready') return (
    <div style={G.wrap}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:20, padding:'18px 22px' }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <span style={G.tag}>Mix de Canaux · CS-160</span>
            {difficulty !== 'moyen' && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:800, background:`${DIFF_LABELS[difficulty].color}22`, color:DIFF_LABELS[difficulty].color, border:`1px solid ${DIFF_LABELS[difficulty].color}44` }}>
                {DIFF_LABELS[difficulty].emoji} {DIFF_LABELS[difficulty].label}
              </span>
            )}
          </div>
          <p style={{ fontSize:13, color:'rgba(255,255,255,.62)', lineHeight:1.65, margin:'0 0 10px' }}>
            La <strong style={{color:'#06d6a0'}}>salle droite</strong> s&apos;allume avec un mélange secret de 3 canaux LED.<br />
            Visez une dalle avec le <strong style={{color:'#a78bfa'}}>CS-160</strong> et cliquez <em>Mesurer</em>.<br />
            La mesure (x, y CIE) calcule automatiquement les <strong>poids des canaux</strong> sur les sliders.<br />
            Affinez si besoin, puis <em>Validez</em> — la <strong style={{color:'#4361ee'}}>salle gauche</strong> montre votre reconstitution.
          </p>
          <p style={{ fontSize:12, color:'rgba(255,255,255,.4)', margin:0 }}>{TOTAL_ROUNDS} manches · max {TOTAL_ROUNDS * 1000} pts</p>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>
          <button onClick={startGame} style={G.playBtn}>Jouer</button>
          <button onClick={onQuit} style={G.quitBtn}>Quitter</button>
        </div>
      </div>
    </div>
  );

  // ── FINISHED ──
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
          <button onClick={onQuit} style={G.quitBtn}>Menu</button>
        </div>
      </div>
    </div>
  );

  // ── PLAYING / MEASURED / RESULT ──
  return (
    <div style={G.wrap}>
      <div style={{ display:'flex', flexDirection:'column', gap:10, padding:'12px 16px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 10px', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', borderRadius:10 }}>
          <span style={{ fontWeight:700, fontSize:13 }}>Manche {round+1}/{TOTAL_ROUNDS}</span>
          <span style={{ fontWeight:800, fontSize:15, color:'#a78bfa' }}>{totalPts} pts</span>
          <button onClick={() => { onTurnOffAll(); onQuit(); }} style={{ padding:'4px 10px', borderRadius:7, border:'1px solid rgba(255,255,255,.1)', background:'rgba(255,255,255,.05)', color:'rgba(255,255,255,.5)', cursor:'pointer', fontSize:12 }}><X size={12}/></button>
        </div>

        {/* Couleurs cible + joueur */}
        <div style={{ ...G.glass, padding:'10px 14px', display:'flex', alignItems:'flex-start', gap:8, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flex:'1 1 120px', minWidth:0 }}>
            <div style={{ width:36, height:36, borderRadius:8, flexShrink:0, background: targetRgb ? `rgb(${targetRgb.r},${targetRgb.g},${targetRgb.b})` : '#111', border:'2px solid rgba(255,255,255,.3)' }} />
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#a78bfa' }}>Cible</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.45)', fontFamily:'monospace' }}>x={target.x.toFixed(3)}, y={target.y.toFixed(3)}</div>
            </div>
          </div>
          {measured && (
            <div style={{ display:'flex', alignItems:'center', gap:8, flex:'1 1 120px', minWidth:0 }}>
              <div style={{ width:36, height:36, borderRadius:8, flexShrink:0, background: measuredRgb ? `rgb(${measuredRgb.r},${measuredRgb.g},${measuredRgb.b})` : '#111', border:'2px solid #06d6a0' }} />
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:800, color:'#06d6a0' }}>Mesure CS-160</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,.45)', fontFamily:'monospace' }}>x={measured.x.toFixed(3)}, y={measured.y.toFixed(3)}</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,.35)' }}>Lv={measured.Lv.toFixed(1)} cd/m²</div>
              </div>
            </div>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:8, flex:'1 1 120px', minWidth:0, justifyContent:'flex-end' }}>
            <div style={{ minWidth:0, textAlign:'right' }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#4361ee' }}>Votre mix</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.45)', fontFamily:'monospace' }}>x={playerXy.x.toFixed(3)}, y={playerXy.y.toFixed(3)}</div>
            </div>
            <div style={{ width:36, height:36, borderRadius:8, flexShrink:0, background: playerRgb ? `rgb(${playerRgb.r},${playerRgb.g},${playerRgb.b})` : '#111', border:'2px solid rgba(67,97,238,.5)' }} />
          </div>
        </div>

        {/* Diagramme CIE */}
        <div ref={diagContRef} style={{ width: '100%' }}>
          <CieDiagramCanvas size={diagSize} markers={diagMarkers} polylines={[triangle]} />
        </div>

        {/* Bouton mesure CS-160 */}
        {(phase === 'playing') && (
          <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
            <button onClick={measure} disabled={measuring} style={{ ...G.measureBtn, opacity: measuring ? 0.6 : 1 }}>
              <Ruler size={16} /> {measuring ? 'Mesure en cours…' : 'Mesurer avec le CS-160'}
            </button>
          </div>
        )}

        {/* Message d'état */}
        {msg && (
          <div style={{ fontSize:12, color:'rgba(255,255,255,.55)', textAlign:'center', padding:'4px 8px', background:'rgba(255,255,255,.03)', borderRadius:8 }}>
            {msg}
          </div>
        )}

        {/* Sliders — actifs dès que mesurés ou en jeu (mode manuel) */}
        {(phase === 'measured' || phase === 'playing' || phase === 'result') && roundChans.length === 3 && (
          <div style={{ ...G.glass, padding:'12px 14px', display:'flex', flexDirection:'column', gap:11 }}>
            {phase === 'measured' && (
              <div style={{ fontSize:11, color:'#06d6a0', fontWeight:700, marginBottom:2, display:'flex', alignItems:'center', gap:6 }}>
                <RefreshCw size={12} /> Poids calculés depuis la mesure — affinez si nécessaire
              </div>
            )}
            {roundChans.map((ci, k) => {
              const [r,g,b] = profiles[ci];
              const col = `rgb(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)})`;
              const secret = secretWeights[k] ?? 0;
              const showSecret = phase === 'result';
              return (
                <div key={ci} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:22, height:22, borderRadius:6, flexShrink:0, background:col, border:'1.5px solid rgba(255,255,255,.25)' }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
                      <span style={{ color:'rgba(255,255,255,.6)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:160 }}>{channelNames[ci]}</span>
                      <span style={{ display:'flex', gap:8 }}>
                        <span style={{ fontWeight:800, color:'#e8eaf0' }}>{Math.round((weights[k] ?? 0)*100)}%</span>
                        {showSecret && <span style={{ color:'rgba(255,255,255,.35)' }}>secret: {Math.round(secret*100)}%</span>}
                      </span>
                    </div>
                    <div style={{ position:'relative' }}>
                      <input
                        type="range" min={0} max={1} step={0.01} value={weights[k] ?? 0}
                        disabled={phase === 'result'}
                        onChange={e => setWeights(w => { const n=[...w] as [number,number,number]; n[k]=Number(e.target.value); return n; })}
                        style={{ width:'100%', accentColor: col, cursor: phase!=='result' ? 'pointer' : 'default' }}
                      />
                      {/* Indicateur poids secret */}
                      {showSecret && (
                        <div style={{ position:'absolute', top:'50%', left:`calc(${secret*100}% - 2px)`, transform:'translateY(-50%)', width:4, height:16, background:'rgba(255,255,255,.5)', borderRadius:2, pointerEvents:'none' }} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {(phase === 'measured') && (
              <button onClick={confirm} style={{ ...G.playBtn, marginTop:2, display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                <Check size={16} /> Valider le mélange
              </button>
            )}
            {(phase === 'playing') && (
              <button onClick={confirm} style={{ ...G.measureBtn, justifyContent:'center', opacity: 0.7, marginTop:2 }}>
                Valider sans mesure
              </button>
            )}
          </div>
        )}

        {/* Résultat */}
        {phase === 'result' && (
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
                Distance xy = {dist} · Canaux : {roundChans.map(i => channelData[i].nm ? `${channelData[i].nm}nm` : `ch${i}`).join(' + ')}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:20, fontWeight:800 }}>+{roundPts} pts</div>
              <div style={{ fontSize:12, color:'#a78bfa', fontWeight:700 }}>
                {round+1 < TOTAL_ROUNDS ? `Suivant dans ${countdown}s` : `Résultats dans ${countdown}s`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
