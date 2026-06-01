'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Crosshair, Ruler, Target, Timer, Trophy, X } from 'lucide-react';
import type { GameTileProps } from './GameColorSpeed';
import cs160Service from '@/app/_services/cs160';

// ── L'Intrus — mode "Sniper" de précision ─────────────────────────────────────
// Toutes les dalles s'allument dans une couleur identique sauf UNE, légèrement
// différente (teinte ou luminosité), presque invisible à l'œil. Le joueur vise
// chaque dalle avec le CS-160, lit la mesure, et désigne l'intrus. Course contre
// la montre : à chaque niveau la différence devient plus subtile.

const COLS = 6;
const ROWS = 7;
const CELLS = COLS * ROWS;
const LEVEL_TIME = 60;          // secondes par niveau
const WRONG_PENALTY = 12;       // secondes perdues sur une mauvaise désignation

type RGB = { r: number; g: number; b: number };
type Reading = { x: number; y: number; Lv: number };

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

// Couleurs de base (claires et saturées → un écart est mesurable)
const BASE_PALETTE: RGB[] = [
  { r: 220, g: 60, b: 70 }, { r: 70, g: 180, b: 90 }, { r: 70, g: 110, b: 230 },
  { r: 235, g: 180, b: 50 }, { r: 180, g: 80, b: 210 }, { r: 60, g: 200, b: 200 },
  { r: 240, g: 130, b: 60 }, { r: 200, g: 200, b: 210 },
];

// Écart de l'intrus selon le niveau (de net à quasi invisible)
// Écart de l'intrus : déjà SUBTIL dès le niveau 1 (≈9 % → à peine visible sur les
// dalles, indétectable à l'écran), puis de plus en plus fin. Toujours mesurable au CS-160.
function deltaForLevel(level: number): number {
  return Math.max(0.012, 0.09 * Math.pow(0.8, level - 1));
}

function makeIntruder(base: RGB, delta: number, mode: 'lum' | 'hue'): RGB {
  if (mode === 'lum') {
    const f = Math.random() < 0.5 ? 1 - delta : 1 + delta;
    return { r: clamp255(base.r * f), g: clamp255(base.g * f), b: clamp255(base.b * f) };
  }
  // Décalage de teinte : on pousse un canal et on en retire un autre
  return { r: clamp255(base.r * (1 + delta)), g: clamp255(base.g * (1 - delta * 0.7)), b: clamp255(base.b * (1 - delta * 0.4)) };
}

// RGB → lecture colorimétrique (x, y, Lv) — sert de simulation quand le CS-160
// n'est pas connecté, et de référence interne.
function rgbToReading(c: RGB): Reading {
  const lin = (v: number) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const r = lin(c.r), g = lin(c.g), b = lin(c.b);
  const X = 0.4124 * r + 0.3576 * g + 0.1805 * b;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
  const s = X + Y + Z;
  return { x: s > 1e-9 ? X / s : 0.33, y: s > 1e-9 ? Y / s : 0.33, Lv: Y * 250 };
}

// Écart perçu entre deux lectures (chromaticité + luminance relative)
function readingDelta(a: Reading, b: Reading): number {
  const dxy = Math.hypot(a.x - b.x, a.y - b.y) * 1000;
  const dlv = Math.abs(a.Lv - b.Lv) / Math.max(1, (a.Lv + b.Lv) / 2) * 100;
  return dxy + dlv;
}

const S: Record<string, React.CSSProperties> = {
  wrap: { background: 'linear-gradient(160deg,#0b0f1c,#0d1226)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 18, color: '#e8eaf0', fontFamily: 'system-ui,sans-serif', overflow: 'hidden' },
  btn: { padding: '11px 22px', borderRadius: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 14, color: '#fff', background: 'linear-gradient(135deg,#06d6a0,#4361ee)', boxShadow: '0 4px 18px rgba(6,214,160,.3)' },
  ghost: { padding: '10px 18px', borderRadius: 13, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.75)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  glass: { background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12 },
  stat: { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '8px 14px', textAlign: 'center', minWidth: 66 },
  statLbl: { fontSize: 10, color: 'rgba(255,255,255,.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3 },
};

export default function GameIntrus({ onSendColor, onTurnOff, onTurnOffAll, onQuit, onComplete, tileCount = 42 }: GameTileProps) {
  const numTiles = Math.min(tileCount, CELLS);
  const [phase, setPhase] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(LEVEL_TIME);
  const [tiles, setTiles] = useState<RGB[]>([]);       // couleurs réelles envoyées aux dalles
  const [baseRgb, setBaseRgb] = useState<RGB>({ r: 128, g: 128, b: 128 }); // couleur commune affichée à l'écran
  const [intruderIdx, setIntruderIdx] = useState(-1);
  const [selected, setSelected] = useState<number | null>(null);
  const [readings, setReadings] = useState<Record<number, Reading>>({});
  const [measuring, setMeasuring] = useState(false);
  const [msg, setMsg] = useState('');
  const [reveal, setReveal] = useState(false);

  const phaseRef = useRef(phase); phaseRef.current = phase;
  const scoreRef = useRef(0); scoreRef.current = score;

  useEffect(() => { if (phase === 'finished') onComplete?.(scoreRef.current); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onTurnOffAll(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Génère un niveau : base identique + 1 intrus
  const buildLevel = useCallback((lvl: number) => {
    const base = BASE_PALETTE[Math.floor(Math.random() * BASE_PALETTE.length)];
    const idx = Math.floor(Math.random() * numTiles);
    const mode: 'lum' | 'hue' = Math.random() < 0.6 ? 'lum' : 'hue';
    const intr = makeIntruder(base, deltaForLevel(lvl), mode);
    const next: RGB[] = Array.from({ length: numTiles }, (_, i) => (i === idx ? intr : base));
    setTiles(next);
    setBaseRgb(base);
    setIntruderIdx(idx);
    setSelected(null);
    setReadings({});
    setReveal(false);
    setMsg('Visez une dalle avec le CS-160 puis analysez-la.');
    for (let i = 0; i < numTiles; i++) onSendColor(i, next[i].r, next[i].g, next[i].b, 80);
  }, [numTiles, onSendColor]);

  function startGame() {
    setLevel(1); setScore(0); setTimeLeft(LEVEL_TIME); setPhase('playing');
    buildLevel(1);
  }

  // Chrono
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { window.clearInterval(id); onTurnOffAll(); setReveal(true); setPhase('finished'); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, level]); // eslint-disable-line react-hooks/exhaustive-deps

  // Analyse de la dalle sélectionnée via le CS-160 (sinon simulation)
  async function analyse() {
    if (selected === null || phase !== 'playing' || measuring) return;
    setMeasuring(true);
    let reading: Reading | null = null;
    try {
      const { lvxy } = await cs160Service.oneShotMeasurement();
      if (lvxy && Number.isFinite(lvxy.x) && Number.isFinite(lvxy.y)) {
        reading = { x: lvxy.x, y: lvxy.y, Lv: lvxy.Lv };
      }
    } catch { /* appareil indisponible → simulation */ }
    if (!reading) {
      // Simulation : la dalle réellement allumée + un léger bruit de mesure
      const base = rgbToReading(tiles[selected] ?? { r: 0, g: 0, b: 0 });
      const n = () => (Math.random() - 0.5) * 0.0006;
      reading = { x: base.x + n(), y: base.y + n(), Lv: base.Lv * (1 + (Math.random() - 0.5) * 0.01) };
    }
    setReadings((r) => ({ ...r, [selected]: reading! }));
    setMsg(`Dalle ${selected + 1} analysée — Lv=${reading.Lv.toFixed(1)} · x=${reading.x.toFixed(4)} y=${reading.y.toFixed(4)}`);
    setMeasuring(false);
  }

  function accuse() {
    if (selected === null || phase !== 'playing') return;
    if (selected === intruderIdx) {
      const bonus = Math.round(timeLeft * 5 + level * 50);
      setScore((s) => s + bonus);
      setMsg(`Intrus démasqué ! +${bonus} pts`);
      const nextLvl = level + 1;
      setLevel(nextLvl);
      setTimeLeft(LEVEL_TIME);
      buildLevel(nextLvl);
    } else {
      setTimeLeft((t) => Math.max(1, t - WRONG_PENALTY));
      setMsg(`Ce n'est pas l'intrus. -${WRONG_PENALTY}s`);
    }
  }

  // Écart de chaque dalle mesurée vs la médiane des mesures (aide visuelle)
  const measuredIdx = Object.keys(readings).map(Number);
  const refReading = (() => {
    if (measuredIdx.length < 2) return null;
    const sorted = [...measuredIdx].sort((a, b) => readings[a].Lv - readings[b].Lv);
    return readings[sorted[Math.floor(sorted.length / 2)]]; // médiane par Lv
  })();
  const deviations: Record<number, number> = {};
  let suspect = -1, suspectDev = -1;
  if (refReading) {
    for (const i of measuredIdx) {
      const d = readingDelta(readings[i], refReading);
      deviations[i] = d;
      if (d > suspectDev) { suspectDev = d; suspect = i; }
    }
  }

  // ── READY ──
  if (phase === 'ready') return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', padding: '20px 22px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 900, marginBottom: 8 }}>
            <Crosshair size={20} color="#06d6a0" /> L&apos;Intrus — Mode Sniper
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.62)', lineHeight: 1.65, margin: '0 0 8px' }}>
            Toutes les dalles ont la <strong>même couleur</strong>… sauf une, à peine différente.<br />
            Visez chaque dalle avec le <strong style={{ color: '#06d6a0' }}>CS-160</strong>, lisez la mesure, et désignez l&apos;intrus.<br />
            À chaque niveau, l&apos;écart devient plus subtil. Course contre la montre !
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={startGame} style={S.btn}>Démarrer</button>
          <button onClick={onQuit} style={S.ghost}>Quitter</button>
        </div>
      </div>
    </div>
  );

  // ── FINISHED ──
  if (phase === 'finished') return (
    <div style={S.wrap}>
      <div style={{ padding: '22px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, color: '#06d6a0' }}><Trophy size={40} /></div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Temps écoulé !</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>Niveau atteint : {level} · Score : {score}</div>
        {intruderIdx >= 0 && <div style={{ fontSize: 12, color: '#fbbf24', marginTop: 6 }}>L&apos;intrus était la dalle {intruderIdx + 1}.</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button onClick={startGame} style={S.btn}>Rejouer</button>
          <button onClick={() => { onTurnOffAll(); onQuit(); }} style={S.ghost}>Menu</button>
        </div>
      </div>
    </div>
  );

  // ── PLAYING ──
  const low = timeLeft <= 10;
  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={S.stat}><div style={S.statLbl}>Niveau</div><div style={{ fontSize: 20, fontWeight: 900, color: '#06d6a0' }}>{level}</div></div>
          <div style={S.stat}><div style={S.statLbl}>Score</div><div style={{ fontSize: 20, fontWeight: 900 }}>{score}</div></div>
          <div style={{ ...S.stat, background: low ? 'rgba(239,68,68,.14)' : S.stat.background }}>
            <div style={S.statLbl}>Temps</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: low ? '#ef4444' : '#fff', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}><Timer size={15} /> {timeLeft}s</div>
          </div>
          <button onClick={() => { onTurnOffAll(); onQuit(); }} style={{ ...S.ghost, marginLeft: 'auto', padding: 8 }}><X size={14} /></button>
        </div>

        {/* Grille à l'écran : TOUTES les dalles montrent la couleur de base (aucune triche
            possible au PC). La vraie différence n'existe que sur les dalles physiques et la
            mesure CS-160 ; l'intrus n'est révélé qu'en fin de partie. */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 6 }}>
          {tiles.map((c, i) => {
            const isSel = selected === i;
            const isSuspect = suspect === i && measuredIdx.length >= 2;
            const measured = readings[i] !== undefined;
            const isIntr = reveal && i === intruderIdx;
            const shown = isIntr ? c : baseRgb;   // identique partout, sauf l'intrus révélé à la fin
            return (
              <button key={i} onClick={() => setSelected(i)}
                style={{
                  position: 'relative', aspectRatio: '1', borderRadius: 9, cursor: 'pointer',
                  background: `rgb(${shown.r},${shown.g},${shown.b})`,
                  border: isIntr ? '3px solid #fbbf24' : isSel ? '3px solid #fff' : isSuspect ? '2px solid #ef4444' : '2px solid rgba(0,0,0,0.25)',
                  boxShadow: isSel ? '0 0 0 3px rgba(255,255,255,0.35)' : 'none',
                }}>
                <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 9, fontWeight: 800, color: 'rgba(0,0,0,0.5)' }}>{i + 1}</span>
                {measured && <span style={{ position: 'absolute', bottom: 2, right: 3, width: 7, height: 7, borderRadius: '50%', background: isSuspect ? '#ef4444' : '#0d1226', border: '1px solid rgba(255,255,255,0.5)' }} />}
              </button>
            );
          })}
        </div>

        {/* Lecture CS-160 de la dalle sélectionnée */}
        <div style={{ ...S.glass, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>
            {selected === null ? 'Sélectionnez une dalle à analyser' : `Dalle ${selected + 1}`}
            {selected !== null && readings[selected] && (
              <span style={{ marginLeft: 8, fontFamily: 'monospace', color: '#06d6a0' }}>
                Lv={readings[selected].Lv.toFixed(1)} · x={readings[selected].x.toFixed(4)} · y={readings[selected].y.toFixed(4)}
                {refReading && <> · écart={(deviations[selected] ?? 0).toFixed(1)}</>}
              </span>
            )}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={analyse} disabled={selected === null || measuring} style={{ ...S.btn, padding: '9px 16px', opacity: selected === null || measuring ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Ruler size={15} /> {measuring ? 'Mesure…' : 'Analyser (CS-160)'}
            </button>
            <button onClick={accuse} disabled={selected === null} style={{ ...S.btn, background: 'linear-gradient(135deg,#ef4444,#a855f7)', padding: '9px 16px', opacity: selected === null ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Target size={15} /> C&apos;est l&apos;intrus
            </button>
          </div>
        </div>

        {msg && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', textAlign: 'center' }}>{msg}</div>}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textAlign: 'center' }}>
          {measuredIdx.length} dalle{measuredIdx.length > 1 ? 's' : ''} analysée{measuredIdx.length > 1 ? 's' : ''}{suspect >= 0 ? ` · dalle ${suspect + 1} la plus différente (rouge)` : ''}
        </div>
      </div>
    </div>
  );
}
