'use client';

/**
 * @file app/_games/chromaticity-diagram/ChromaticityDiagram.tsx
 * @brief Mini-jeu du diagramme de chromaticité CIE 1931 : repérer une couleur par ses coordonnées x,y.
 *
 * Une couleur cible est brièvement montrée sur les dalles, puis le joueur doit la
 * situer sur le diagramme CIE 1931 en réglant ses coordonnées de chromaticité
 * (sliders x/y) ou en cliquant dans le locus. Le score d'une manche dépend de la
 * proximité entre le point proposé et la cible (à l'intérieur du fer à cheval
 * spectral, voir {@link HORSESHOE}). Affiche l'aperçu via {@link CieDiagramCanvas}
 * et pilote les dalles. Reçoit les callbacks de pilotage et de scoring via
 * {@link GameTileProps} ; la difficulté règle la durée d'affichage et le nombre de manches.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameTileProps } from '../../_components/GameColorSpeed';
import { DIFF_LABELS, type DifficultyLevel } from '../../_components/GameColorSpeed';
import CieDiagramCanvas, { type CieMarker } from '../../_components/CieDiagramCanvas';
import { playSfx, vibrate } from '@/lib/audio/sfx';

// ── CIE 1931 spectral locus (horseshoe) ──────────────────────────────────────
const HORSESHOE: [number, number][] = [
  [0.1741,0.0050],[0.1740,0.0050],[0.1738,0.0049],[0.1736,0.0050],[0.1730,0.0048],
  [0.1721,0.0048],[0.1714,0.0051],[0.1689,0.0082],[0.1644,0.0139],[0.1566,0.0214],
  [0.1440,0.0297],[0.1241,0.0578],[0.0913,0.1327],[0.0454,0.2950],[0.0082,0.5384],
  [0.0139,0.7502],[0.0743,0.8338],[0.1547,0.8059],[0.2296,0.7543],[0.3016,0.6923],
  [0.3731,0.6245],[0.4441,0.5547],[0.5125,0.4866],[0.5752,0.4242],[0.6270,0.3725],
  [0.6658,0.3340],[0.7006,0.2993],[0.7301,0.2700],[0.7548,0.2452],[0.7800,0.2200],
  [0.8000,0.2000],[0.8210,0.1790],[0.8507,0.1493],
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
function svgToXy(px: number, py: number) {
  return {
    x: (px - PAD_L) / (DW - PAD_L - PAD_R) * (X_MAX - X_MIN) + X_MIN,
    y: ((DH - PAD_B) - py) / (DH - PAD_T - PAD_B) * (Y_MAX - Y_MIN) + Y_MIN,
  };
}

// ── Point-in-horseshoe (ray casting) ─────────────────────────────────────────
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

// ── Random target : point aléatoire dans le gamut sRGB (et pas trop terne) ───
function randomTarget(): { x: number; y: number; rgb: { r: number; g: number; b: number } } {
  // Liste de points bien répartis dans le gamut sRGB
  const candidates: [number, number][] = [
    [0.6400, 0.3300], // rouge sRGB
    [0.3000, 0.6000], // vert sRGB
    [0.1500, 0.0600], // bleu sRGB
    [0.3127, 0.3290], // blanc D65
    [0.4338, 0.4760], // jaune
    [0.1750, 0.1580], // violet
    [0.2247, 0.3290], // cyan neutre
    [0.4500, 0.4000], // orange
    [0.2020, 0.2100], // bleu-violet
    [0.2500, 0.5000], // vert clair
    [0.5500, 0.3700], // rouge-orangé
    [0.1200, 0.0900], // bleu profond
    [0.3500, 0.5500], // vert-jaune
    [0.5800, 0.4200], // orange vif
    [0.2800, 0.1500], // violet-bleu
  ];
  // Ajouter de la variabilité autour de chaque candidat
  for (let attempt = 0; attempt < 200; attempt++) {
    const base = candidates[Math.floor(Math.random() * candidates.length)]!;
    const jx = (Math.random() - 0.5) * 0.12;
    const jy = (Math.random() - 0.5) * 0.10;
    const x = Math.max(0.05, Math.min(0.75, base[0] + jx));
    const y = Math.max(0.05, Math.min(0.80, base[1] + jy));
    if (x + y >= 1) continue;
    if (!inHorseshoe(x, y)) continue;
    const rgb = xyToRgb255(x, y);
    if (!rgb) continue;
    // Exclure les couleurs trop ternes (proches du blanc)
    const sat = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
    if (sat < 40) continue;
    return { x, y, rgb };
  }
  // Fallback : rouge pur
  return { x: 0.6400, y: 0.3300, rgb: xyToRgb255(0.64, 0.33)! };
}

// ── Constantes jeu ────────────────────────────────────────────────────────────
const CHROMA_DIFF = {
  facile:    { showDuration: 8, rounds: 4 },
  moyen:     { showDuration: 5, rounds: 5 },
  difficile: { showDuration: 3, rounds: 7 },
  expert:    { showDuration: 2, rounds: 8 },
} satisfies Record<DifficultyLevel, { showDuration: number; rounds: number }>;
const INTENSITY     = 85;

const LEFT_IDX  = [0,1,2,6,7,8,12,13,14,18,19,20,24,25,26,30,31,32,36,37,38];
const RIGHT_IDX = [3,4,5,9,10,11,15,16,17,21,22,23,27,28,29,33,34,35,39,40,41];

// ── Styles ────────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  wrap: {
    background: 'linear-gradient(160deg,rgba(6,10,22,.96) 0%,rgba(8,12,32,.92) 100%)',
    backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
    border: '1px solid rgba(255,255,255,.07)', borderRadius: 20,
    overflow: 'hidden', fontFamily: 'system-ui,-apple-system,sans-serif', color: '#e8eaf0',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 22px', borderBottom: '1px solid rgba(255,255,255,.07)',
  },
  tag: {
    display: 'inline-block',
    background: 'linear-gradient(135deg,rgba(129,230,217,.25),rgba(67,97,238,.2))',
    border: '1px solid rgba(129,230,217,.4)', borderRadius: 8,
    padding: '3px 10px', fontSize: 12, fontWeight: 800, color: '#81e6d9', letterSpacing: '.04em',
  },
  body: { display: 'flex', gap: 0, alignItems: 'stretch', minHeight: 420 },
  diagramPane: {
    flex: '0 0 auto', padding: '16px 12px 16px 16px',
    borderRight: '1px solid rgba(255,255,255,.07)', position: 'relative',
  },
  ctrlPane: {
    flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14,
    minWidth: 220, maxWidth: 300,
  },
  phaseLabel: {
    fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.5)',
    textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2,
  },
  countdownRing: {
    width: 72, height: 72, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 28, fontWeight: 900, flexShrink: 0,
  },
  preview: {
    width: '100%', height: 60, borderRadius: 10,
    border: '1px solid rgba(255,255,255,.12)',
    transition: 'background 0.12s ease',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  sliderRow: { display: 'flex', flexDirection: 'column', gap: 6 },
  sliderLabel: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 12, color: 'rgba(255,255,255,.6)',
  },
  coordVal: { fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#81e6d9' },
  validateBtn: {
    padding: '11px 20px', borderRadius: 12, border: 'none',
    background: 'linear-gradient(135deg,#06d6a0,#4361ee)',
    boxShadow: '0 4px 18px rgba(6,214,160,.30), inset 0 1px 0 rgba(255,255,255,.15)',
    color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', width: '100%',
  },
  glassCard: {
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12,
    padding: '10px 14px',
  },
  scoreBig: { fontSize: 32, fontWeight: 900, lineHeight: 1 },
  stopBtn: {
    padding: '4px 12px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.05)',
    color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: 12,
  },
};

// ── Composant principal ────────────────────────────────────────────────────────
/**
 * Composant du mini-jeu Diagramme de chromaticité.
 *
 * @param props Props communes des jeux de dalles (voir {@link GameTileProps}).
 * @returns Les écrans ready / en jeu / résultat du jeu de localisation CIE 1931.
 */
export default function ChromaticityDiagram({ onSendColor, onTurnOffAll, onQuit, tileCount = 42, onComplete, difficulty = 'moyen' }: GameTileProps) {
  const cfg = CHROMA_DIFF[difficulty];
  const SHOW_DURATION = cfg.showDuration;
  const TOTAL_ROUNDS = cfg.rounds;
  type Phase = 'ready' | 'show' | 'guess' | 'result' | 'finished';

  const [phase,      setPhase]      = useState<Phase>('ready');
  const [roundIdx,   setRoundIdx]   = useState(0);
  const [target,     setTarget]     = useState<{ x: number; y: number; rgb: { r: number; g: number; b: number } } | null>(null);
  const [guessX,     setGuessX]     = useState(0.3127);
  const [guessY,     setGuessY]     = useState(0.3290);
  const [measuring,  setMeasuring]  = useState(false);
  const [measureMsg, setMeasureMsg] = useState('');
  const [confirmed,  setConfirmed]  = useState<{ x: number; y: number } | null>(null);
  const [countdown,  setCountdown]  = useState(SHOW_DURATION);
  const [roundScore, setRoundScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [dist,       setDist]       = useState(0);
  useEffect(() => { if (phase === 'finished') onComplete?.(Math.round(totalScore / 5)); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const canvasRef   = useRef<HTMLCanvasElement | null>(null);
  const svgRef      = useRef<SVGSVGElement | null>(null);
  const hwTimerRef  = useRef<number>(0);
  const phaseRef    = useRef<Phase>('ready');

  // Sync phaseRef avec state pour les closures de setInterval
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── Dessiner le diagramme CIE 1931 sur canvas ─────────────────────────────
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
          img.data[idx] = 6; img.data[idx + 1] = 8; img.data[idx + 2] = 20; img.data[idx + 3] = 255;
          continue;
        }
        const c = xyToRgb255(x, y);
        if (c) {
          img.data[idx] = c.r; img.data[idx + 1] = c.g; img.data[idx + 2] = c.b; img.data[idx + 3] = 255;
        } else {
          img.data[idx] = 6; img.data[idx + 1] = 8; img.data[idx + 2] = 20; img.data[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  // ── Cleanup au démontage ──────────────────────────────────────────────────
  useEffect(() => () => {
    onTurnOffAll();
    window.clearTimeout(hwTimerRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Démarrer une manche ───────────────────────────────────────────────────
  function startRound(idx: number, score: number) {
    const tgt = randomTarget();
    setTarget(tgt);
    setRoundIdx(idx);
    setTotalScore(score);
    setConfirmed(null);
    setGuessX(0.3127);
    setGuessY(0.3290);
    setCountdown(SHOW_DURATION);
    setPhase('show');
    for (const i of RIGHT_IDX) onSendColor(i, tgt.rgb.r, tgt.rgb.g, tgt.rgb.b, INTENSITY);
  }

  // ── Compte à rebours phase "show" ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'show') return;
    let n = SHOW_DURATION;
    const id = window.setInterval(() => {
      n--;
      setCountdown(n);
      if (n <= 0) {
        window.clearInterval(id);
        onTurnOffAll(); // dalles → noir
        setPhase('guess');
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Preview hardware en phase "guess" ─────────────────────────────────────
  const sendGuessToHw = useCallback((x: number, y: number) => {
    window.clearTimeout(hwTimerRef.current);
    hwTimerRef.current = window.setTimeout(() => {
      if (phaseRef.current !== 'guess') return;
      const c = xyToRgb255(x, y);
      if (!c) return;
      for (const i of LEFT_IDX) onSendColor(i, c.r, c.g, c.b, INTENSITY);
    }, 30);
  }, [onSendColor]);

  // ── Mettre à jour la devinette (sliders ou clic diagramme) ───────────────
  function updateGuess(x: number, y: number) {
    const cx = Math.max(0.01, Math.min(0.79, x));
    const cy = Math.max(0.01, Math.min(0.88, y));
    // Contraindre pour que z = 1-x-y >= 0
    const cy2 = Math.min(cy, 0.99 - cx);
    setGuessX(cx);
    setGuessY(cy2);
    sendGuessToHw(cx, cy2);
  }

  // ── Clic sur le diagramme ─────────────────────────────────────────────────
  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (phase !== 'guess') return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) * (DW / rect.width);
    const py = (e.clientY - rect.top)  * (DH / rect.height);
    const { x, y } = svgToXy(px, py);
    updateGuess(x, y);
  }
  function handleSvgMove(e: React.MouseEvent<SVGSVGElement>) {
    if (phase !== 'guess') return;
    if (!(e.buttons & 1)) return; // seulement si bouton gauche enfoncé
    handleSvgClick(e);
  }

  // ── Score d'un point (x,y) contre la cible ────────────────────────────────
  function scoreAt(px: number, py: number) {
    if (!target) return;
    const d = Math.sqrt((px - target.x) ** 2 + (py - target.y) ** 2);
    const pts = Math.max(0, Math.round(1000 * (1 - d / 0.25)));
    setGuessX(px); setGuessY(py);
    setConfirmed({ x: px, y: py });
    setDist(parseFloat(d.toFixed(5)));
    setRoundScore(pts);
    if (pts >= 600) playSfx('correct'); else { playSfx('wrong'); vibrate(60); }
    setPhase('result');
    for (const i of RIGHT_IDX) onSendColor(i, target.rgb.r, target.rgb.g, target.rgb.b, INTENSITY);
    const gc = xyToRgb255(px, py);
    if (gc) for (const i of LEFT_IDX) onSendColor(i, gc.r, gc.g, gc.b, INTENSITY);
  }

  // Estimation (sliders / clic sur le diagramme)
  function validate() { scoreAt(guessX, guessY); }

  // Validation par VRAIE mesure CS-160 de la dalle reproduite (salle gauche).
  async function validateByMeasure() {
    if (!target || measuring) return;
    setMeasuring(true); setMeasureMsg('Mesure en cours…');
    let m: { x: number; y: number } | null = null;
    try {
      const res = await fetch('/api/cs160', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'measure' }) });
      const data = await res.json();
      if (data.success && data.data?.lvxy) { const { x, y } = data.data.lvxy; if (Number.isFinite(x) && Number.isFinite(y)) m = { x, y }; }
    } catch { /* appareil absent */ }
    setMeasuring(false);
    if (!m) { setMeasureMsg('CS-160 non connecté — pointez l\'appareil sur une dalle de la salle gauche, puis réessayez.'); return; }
    setMeasureMsg('');
    scoreAt(m.x, m.y);
  }

  // ── Passer à la manche suivante / terminer ────────────────────────────────
  function nextRound() {
    const newScore = totalScore + roundScore;
    if (roundIdx + 1 >= TOTAL_ROUNDS) {
      setTotalScore(newScore);
      onTurnOffAll();
      setPhase('finished');
    } else {
      startRound(roundIdx + 1, newScore);
    }
  }

  // ── Données visuelles courantes ───────────────────────────────────────────
  const guessRgb   = xyToRgb255(guessX, guessY);
  const guessHex   = guessRgb ? `#${[guessRgb.r, guessRgb.g, guessRgb.b].map(v => v.toString(16).padStart(2, '0')).join('')}` : '#808080';
  const guessZ     = Math.max(0, 1 - guessX - guessY);
  const guessSvg   = xyToSvg(guessX, guessY);
  const tgtSvg     = target ? xyToSvg(target.x, target.y) : null;
  const confSvg    = confirmed ? xyToSvg(confirmed.x, confirmed.y) : null;

  // Triangle sRGB
  const srgbPts = [[0.64,0.33],[0.30,0.60],[0.15,0.06]].map(([x,y]) => xyToSvg(x!, y!));
  const srgbPath = srgbPts.map(({ px, py }, i) => `${i===0?'M':'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ') + ' Z';

  // Contour horseshoe
  const horsePath = HORSESHOE.map(([x,y], i) => {
    const { px, py } = xyToSvg(x!, y!);
    return `${i===0?'M':'L'}${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(' ') + ' Z';

  // ── Couleur anneau countdown ──────────────────────────────────────────────
  const pct = countdown / SHOW_DURATION;
  const ringColor = pct > 0.6 ? '#06d6a0' : pct > 0.3 ? '#fbbf24' : '#ef4444';

  // ── READY ─────────────────────────────────────────────────────────────────
  if (phase === 'ready') return (
    <div style={S.wrap}>
      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={S.tag}>🔬 Chromaticité CIE 1931</span>
          {difficulty !== 'moyen' && (
            <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:800, background:`${DIFF_LABELS[difficulty].color}22`, color:DIFF_LABELS[difficulty].color, border:`1px solid ${DIFF_LABELS[difficulty].color}44` }}>
              {DIFF_LABELS[difficulty].emoji} {DIFF_LABELS[difficulty].label}
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,.68)', lineHeight: 1.7, maxWidth: 500 }}>
          Une couleur s&apos;affichera sur toutes les dalles pendant <strong style={{ color: '#81e6d9' }}>{SHOW_DURATION} secondes</strong>.
          Mémorisez-la, puis retrouvez ses coordonnées <strong style={{ color: '#fbbf24' }}>x</strong>, <strong style={{ color: '#4ade80' }}>y</strong>, <strong style={{ color: '#a78bfa' }}>z</strong>
          sur le diagramme de chromaticité.<br />
          En bougeant les curseurs ou en cliquant sur le diagramme, vous verrez la couleur changer en temps réel sur les dalles.<br />
          <span style={{ color: '#38bdf8' }}>Cliquez « Valider » pour confirmer votre réponse.</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={S.validateBtn} onClick={() => startRound(0, 0)}>
            Démarrer ({TOTAL_ROUNDS} manches)
          </button>
          <button style={{ ...S.stopBtn, fontSize: 13, padding: '10px 18px' }} onClick={onQuit}>Quitter</button>
        </div>
      </div>
    </div>
  );

  // ── FINISHED ──────────────────────────────────────────────────────────────
  if (phase === 'finished') {
    const avg = Math.round(totalScore / TOTAL_ROUNDS);
    return (
      <div style={S.wrap}>
        <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', textAlign: 'center' }}>
          <span style={S.tag}>🏆 Résultats</span>
          <div style={{ fontSize: 48, lineHeight: 1 }}>
            {totalScore >= 4000 ? '🥇' : totalScore >= 2500 ? '🥈' : '🥉'}
          </div>
          <div style={{ ...S.scoreBig, color: '#81e6d9' }}>{totalScore} <span style={{ fontSize: 14, color: 'rgba(255,255,255,.45)' }}>pts</span></div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)' }}>Moyenne : {avg} pts / manche · max 1000 pts</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button style={S.validateBtn} onClick={() => startRound(0, 0)}>Rejouer</button>
            <button style={{ ...S.stopBtn, fontSize: 13, padding: '10px 18px' }} onClick={onQuit}>Menu</button>
          </div>
        </div>
      </div>
    );
  }

  // ── PLAYING (show / guess / result) ──────────────────────────────────────
  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={S.tag}>🔬 Chromaticité</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>
            Manche {roundIdx + 1}/{TOTAL_ROUNDS}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ ...S.glassCard, padding: '6px 14px', fontSize: 13 }}>
            Score&nbsp;<strong style={{ color: '#fbbf24', fontSize: 16 }}>{totalScore}</strong>
          </div>
          <button style={S.stopBtn} onClick={() => { onTurnOffAll(); onQuit(); }}>✕ Quitter</button>
        </div>
      </div>

      {/* Body */}
      <div style={S.body}>
        {/* ── Diagramme ── */}
        <div style={{ ...S.diagramPane, width: DW + 28 }}>
          <CieDiagramCanvas
            size={DW}
            onPick={phase === 'guess' ? (x, y) => updateGuess(x, y) : undefined}
            markers={[
              ...(phase === 'guess'
                ? [{ x: guessX, y: guessY, color: guessRgb ? `rgb(${guessRgb.r},${guessRgb.g},${guessRgb.b})` : '#cccccc', ring: true, crosshair: true, radius: 6 } as CieMarker]
                : []),
              ...(phase === 'result' && confirmed
                ? [{ x: confirmed.x, y: confirmed.y, color: '#fbbf24', ring: true, label: 'Vous' } as CieMarker]
                : []),
              ...(phase === 'result' && target
                ? [{ x: target.x, y: target.y, color: `rgb(${target.rgb.r},${target.rgb.g},${target.rgb.b})`, ring: true, label: 'Cible' } as CieMarker]
                : []),
            ]}
          />
        </div>

        {/* ── Panneau de contrôle ── */}
        <div style={S.ctrlPane}>

          {/* Phase : SHOW ───────────────────────────────────────────────── */}
          {phase === 'show' && target && (
            <>
              <div style={S.phaseLabel}>Mémorisez la couleur</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Anneau countdown */}
                <div style={{
                  ...S.countdownRing,
                  background: `conic-gradient(${ringColor} ${pct * 360}deg, rgba(255,255,255,.08) 0deg)`,
                  color: ringColor,
                }}>
                  {countdown}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', lineHeight: 1.4 }}>
                  secondes<br />restantes
                </div>
              </div>
              {/* Pastille couleur cible */}
              <div style={{
                ...S.preview,
                background: `rgb(${target.rgb.r},${target.rgb.g},${target.rgb.b})`,
                height: 90,
              }} />
              <div style={{ ...S.glassCard, fontSize: 11, color: 'rgba(255,255,255,.55)', lineHeight: 1.6 }}>
                <div>Cette couleur s&apos;affiche sur les dalles.</div>
                <div style={{ marginTop: 4, color: 'rgba(255,255,255,.25)' }}>
                  La cible disparaîtra dans {countdown}s.
                </div>
              </div>
            </>
          )}

          {/* Phase : GUESS ──────────────────────────────────────────────── */}
          {phase === 'guess' && (
            <>
              <div style={S.phaseLabel}>Retrouvez la couleur</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', lineHeight: 1.5, marginBottom: 4 }}>
                Cliquez sur le diagramme ou bougez les curseurs pour ajuster.
                Les dalles prévisualisent votre couleur en temps réel.
              </div>

              {/* Preview couleur devinette */}
              <div style={{ ...S.preview, background: guessHex }}>
                {!guessRgb && <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>Hors gamut</span>}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,.4)', textAlign: 'center' }}>
                {guessHex.toUpperCase()} · ({guessRgb?.r ?? '?'},{guessRgb?.g ?? '?'},{guessRgb?.b ?? '?'})
              </div>

              {/* Slider x */}
              <div style={S.sliderRow}>
                <div style={S.sliderLabel}>
                  <span style={{ color: '#fbbf24' }}>x (rouge–vert)</span>
                  <span style={S.coordVal}>{guessX.toFixed(4)}</span>
                </div>
                <input type="range" min={0.01} max={0.79} step={0.0001}
                  value={guessX}
                  onChange={e => updateGuess(Number(e.target.value), guessY)}
                  style={{ width: '100%', accentColor: '#fbbf24' }}
                />
              </div>

              {/* Slider y */}
              <div style={S.sliderRow}>
                <div style={S.sliderLabel}>
                  <span style={{ color: '#4ade80' }}>y (vert–bleu)</span>
                  <span style={S.coordVal}>{guessY.toFixed(4)}</span>
                </div>
                <input type="range" min={0.01} max={0.88} step={0.0001}
                  value={guessY}
                  onChange={e => updateGuess(guessX, Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#4ade80' }}
                />
              </div>

              {/* z calculé */}
              <div style={S.sliderRow}>
                <div style={S.sliderLabel}>
                  <span style={{ color: '#a78bfa' }}>z = 1 − x − y</span>
                  <span style={{ ...S.coordVal, color: '#a78bfa' }}>{guessZ.toFixed(4)}</span>
                </div>
                <div style={{
                  width: '100%', height: 6, borderRadius: 3,
                  background: `linear-gradient(90deg, rgba(167,139,250,0.15) 0%, rgba(167,139,250,0.8) ${(guessZ * 100).toFixed(0)}%, rgba(255,255,255,.08) ${(guessZ * 100).toFixed(0)}%)`,
                }} />
              </div>

              <button style={{ ...S.validateBtn, background: 'linear-gradient(135deg,#06d6a0,#4361ee)', opacity: measuring ? 0.6 : 1, cursor: measuring ? 'not-allowed' : 'pointer' }} onClick={() => void validateByMeasure()} disabled={measuring}>
                {measuring ? 'Mesure…' : 'Valider par mesure (CS-160)'}
              </button>
              {measureMsg && <div style={{ fontSize: 12, color: measureMsg.startsWith('CS-160') ? '#fca5a5' : '#94a3b8', marginTop: 6, textAlign: 'center' }}>{measureMsg}</div>}
              <button style={{ ...S.validateBtn, marginTop: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }} onClick={validate}>
                Valider l&apos;estimation (sans mesure)
              </button>
            </>
          )}

          {/* Phase : RESULT ─────────────────────────────────────────────── */}
          {phase === 'result' && target && (
            <>
              <div style={S.phaseLabel}>Résultat</div>

              {/* Score de la manche */}
              <div style={{ ...S.glassCard, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  ...S.scoreBig,
                  color: roundScore >= 700 ? '#4ade80' : roundScore >= 400 ? '#fbbf24' : '#ef4444',
                }}>
                  +{roundScore}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', lineHeight: 1.5 }}>
                  pts<br />Distance&nbsp;Δxy = {dist}
                </div>
              </div>

              {/* Comparaison cible vs devinette */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={S.glassCard}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Cible</div>
                  <div style={{ width: '100%', height: 36, borderRadius: 6, background: `rgb(${target.rgb.r},${target.rgb.g},${target.rgb.b})`, marginBottom: 4 }} />
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#81e6d9' }}>
                    x {target.x.toFixed(4)}<br />y {target.y.toFixed(4)}<br />z {(1-target.x-target.y).toFixed(4)}
                  </div>
                </div>
                {confirmed && (
                  <div style={S.glassCard}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Votre réponse</div>
                    <div style={{ width: '100%', height: 36, borderRadius: 6, background: guessHex, marginBottom: 4 }} />
                    <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#fbbf24' }}>
                      x {confirmed.x.toFixed(4)}<br />y {confirmed.y.toFixed(4)}<br />z {(1-confirmed.x-confirmed.y).toFixed(4)}
                    </div>
                  </div>
                )}
              </div>

              {/* Indication qualité */}
              <div style={{ fontSize: 12, color: roundScore >= 800 ? '#4ade80' : roundScore >= 500 ? '#fbbf24' : '#f87171', fontWeight: 700 }}>
                {roundScore >= 800 ? '🎯 Excellent !' : roundScore >= 500 ? '👍 Bien !' : roundScore >= 200 ? '🟡 Pas mal' : '❌ Trop loin'}
              </div>

              {/* Total provisoire */}
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>
                Total : <strong style={{ color: '#81e6d9' }}>{totalScore + roundScore}</strong> pts
              </div>

              <button style={S.validateBtn} onClick={nextRound}>
                {roundIdx + 1 < TOTAL_ROUNDS ? `Manche suivante (${roundIdx + 2}/${TOTAL_ROUNDS})` : 'Voir les résultats'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
