'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameTileProps } from './GameColorSpeed';

// ── Types ─────────────────────────────────────────────────────────────────────

type RGB = { r: number; g: number; b: number };
type Mode = 'cacher' | 'révéler';

interface Round {
  wordIdx: number;
  mode: Mode;
  startIllum: RGB;
}

// ── Colour helpers ─────────────────────────────────────────────────────────────

function colorDist(a: RGB, b: RGB): number {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3 * 255 * 255);
}

function css(c: RGB): string {
  return `rgb(${c.r},${c.g},${c.b})`;
}

// ── 50 physics/light vocabulary words with distinct colours ───────────────────

const PHYSICS_WORDS: { word: string; fg: RGB }[] = [
  { word: 'PHOTON',          fg: { r: 255, g: 220, b: 50  } },
  { word: 'PRISME',          fg: { r: 80,  g: 200, b: 255 } },
  { word: 'HALO',            fg: { r: 255, g: 170, b: 80  } },
  { word: 'FOYER',           fg: { r: 255, g: 80,  b: 80  } },
  { word: 'MIROIR',          fg: { r: 180, g: 180, b: 255 } },
  { word: 'SPECTRE',         fg: { r: 80,  g: 255, b: 140 } },
  { word: 'CORONA',          fg: { r: 255, g: 200, b: 0   } },
  { word: 'MIRAGE',          fg: { r: 0,   g: 200, b: 220 } },
  { word: 'DIOPTRE',         fg: { r: 200, g: 100, b: 255 } },
  { word: 'CAUSTIQUE',       fg: { r: 255, g: 120, b: 0   } },
  { word: 'VERGENCE',        fg: { r: 0,   g: 180, b: 255 } },
  { word: 'VISIBLE',         fg: { r: 100, g: 255, b: 100 } },
  { word: 'RÉFRACTION',      fg: { r: 255, g: 80,  b: 200 } },
  { word: 'DIFFRACTION',     fg: { r: 80,  g: 255, b: 200 } },
  { word: 'POLARISATION',    fg: { r: 200, g: 200, b: 50  } },
  { word: 'INTERFÉRENCE',    fg: { r: 50,  g: 150, b: 255 } },
  { word: 'DISPERSION',      fg: { r: 255, g: 50,  b: 100 } },
  { word: 'RÉFLEXION',       fg: { r: 180, g: 255, b: 80  } },
  { word: 'ABSORPTION',      fg: { r: 255, g: 140, b: 50  } },
  { word: 'ÉMISSION',        fg: { r: 100, g: 220, b: 255 } },
  { word: 'DIFFUSION',       fg: { r: 220, g: 100, b: 255 } },
  { word: 'COHÉRENCE',       fg: { r: 255, g: 255, b: 100 } },
  { word: 'FRÉQUENCE',       fg: { r: 100, g: 255, b: 180 } },
  { word: 'AMPLITUDE',       fg: { r: 255, g: 100, b: 180 } },
  { word: 'LUMINANCE',       fg: { r: 200, g: 220, b: 255 } },
  { word: 'IRRADIANCE',      fg: { r: 255, g: 180, b: 100 } },
  { word: 'ILLUMINANCE',     fg: { r: 100, g: 180, b: 255 } },
  { word: 'RÉFLECTANCE',     fg: { r: 180, g: 255, b: 180 } },
  { word: 'IRIDESCENCE',     fg: { r: 255, g: 100, b: 255 } },
  { word: 'SCINTILLATION',   fg: { r: 255, g: 255, b: 180 } },
  { word: 'FLUORESCENCE',    fg: { r: 80,  g: 255, b: 80  } },
  { word: 'DICHROÏSME',      fg: { r: 255, g: 50,  b: 50  } },
  { word: 'ABERRATION',      fg: { r: 50,  g: 50,  b: 255 } },
  { word: 'CHROMINANCE',     fg: { r: 255, g: 200, b: 100 } },
  { word: 'RAYONNEMENT',     fg: { r: 100, g: 200, b: 200 } },
  { word: 'PHOSPHORESCENCE', fg: { r: 180, g: 255, b: 50  } },
  { word: 'OPACITÉ',         fg: { r: 255, g: 150, b: 150 } },
  { word: 'TRANSPARENCE',    fg: { r: 150, g: 255, b: 255 } },
  { word: 'BIRÉFRINGENCE',   fg: { r: 200, g: 150, b: 255 } },
  { word: 'RÉFRINGENCE',     fg: { r: 255, g: 200, b: 150 } },
  { word: 'BIOLUMINESCENCE', fg: { r: 80,  g: 255, b: 180 } },
  { word: 'MONOCHROMATIQUE', fg: { r: 255, g: 80,  b: 160 } },
  { word: 'POLYCHROMATIQUE', fg: { r: 160, g: 80,  b: 255 } },
  { word: 'ACHROMATIQUE',    fg: { r: 200, g: 200, b: 200 } },
  { word: 'COLORIMÉTRIE',    fg: { r: 255, g: 160, b: 80  } },
  { word: 'PHOTOMÉTRIE',     fg: { r: 80,  g: 160, b: 255 } },
  { word: 'RADIOMÉTRIE',     fg: { r: 255, g: 255, b: 80  } },
  { word: 'CHROMATICITÉ',    fg: { r: 80,  g: 255, b: 255 } },
  { word: 'SYNCHROTRON',     fg: { r: 255, g: 50,  b: 150 } },
  { word: 'HOLOGRAMME',      fg: { r: 150, g: 50,  b: 255 } },
];

// ── Constants ──────────────────────────────────────────────────────────────────

const LEFT_IDX  = [0,1,2,6,7,8,12,13,14,18,19,20,24,25,26,30,31,32,36,37,38];
const RIGHT_IDX = [3,4,5,9,10,11,15,16,17,21,22,23,27,28,29,33,34,35,39,40,41];

const TOTAL_ROUNDS    = 8;
const ROUND_TIME      = 90;
const HIDE_WIN_DIST   = 0.08;
const REVEAL_WIN_DIST = 0.45;

// ── Round generation ───────────────────────────────────────────────────────────

function generateRounds(): Round[] {
  const indices = Array.from({ length: PHYSICS_WORDS.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, TOTAL_ROUNDS).map((wordIdx, i) => {
    const mode: Mode = i % 2 === 0 ? 'cacher' : 'révéler';
    const fg = PHYSICS_WORDS[wordIdx].fg;
    const startIllum: RGB = mode === 'cacher'
      ? { r: 255, g: 255, b: 255 }
      : { ...fg };
    return { wordIdx, mode, startIllum };
  });
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  wrap: {
    background: 'linear-gradient(160deg,rgba(8,12,24,.94) 0%,rgba(10,14,32,.90) 100%)',
    backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
    border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 20, overflow: 'hidden',
    fontFamily: 'system-ui,-apple-system,sans-serif', color: '#e8eaf0',
  },
  playBtn: {
    padding: '11px 26px', borderRadius: 14, border: 'none',
    background: 'linear-gradient(135deg,#7c3aed,#06d6a0)',
    boxShadow: '0 4px 20px rgba(124,58,237,.40)',
    color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
  },
  quitBtn: {
    padding: '10px 20px', borderRadius: 14,
    border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)',
    color: 'rgba(255,255,255,.7)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
  },
  glass: {
    background: 'rgba(255,255,255,.05)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 12,
  },
  stopBtn: {
    padding: '4px 12px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.05)',
    color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: 12,
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function GameMetamerisme({
  onSendColor, onTurnOffAll, onQuit, tileCount = 42, onComplete,
}: GameTileProps) {
  const [phase,      setPhase]      = useState<'ready' | 'playing' | 'result' | 'finished'>('ready');
  const [rounds,     setRounds]     = useState<Round[]>([]);
  const [roundIdx,   setRoundIdx]   = useState(0);
  const [illum,      setIllum]      = useState<RGB>({ r: 255, g: 255, b: 255 });
  const [timeLeft,   setTimeLeft]   = useState(ROUND_TIME);
  const [hintShown,  setHintShown]  = useState(false);
  const [roundScore, setRoundScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [validated,  setValidated]  = useState(false);
  useEffect(() => { if (phase === 'finished') onComplete?.(Math.round(totalScore / 5)); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const [autoAdv,    setAutoAdv]    = useState(5);

  const timerRef = useRef<number>(0);
  const hwRef    = useRef<number>(0);

  // Tiles always show the current illumination — same colour as the card background
  const sendIllumToTiles = useCallback((il: RGB) => {
    window.clearTimeout(hwRef.current);
    hwRef.current = window.setTimeout(() => {
      for (const i of LEFT_IDX) onSendColor(i, il.r, il.g, il.b, 80);
    }, 40);
  }, [onSendColor]);

  useEffect(() => () => {
    window.clearTimeout(hwRef.current);
    window.clearInterval(timerRef.current);
    onTurnOffAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──────────────────────────────────────────────────────────────────
  const round = rounds[roundIdx] ?? null;
  const entry = round ? PHYSICS_WORDS[round.wordIdx] : null;
  const dist  = entry ? colorDist(illum, entry.fg) : 0;
  const hasWon = round
    ? round.mode === 'cacher' ? dist <= HIDE_WIN_DIST : dist >= REVEAL_WIN_DIST
    : false;
  const contrastPct = Math.round(dist * 100);

  // ── Game flow ─────────────────────────────────────────────────────────────────
  function startGame() {
    const r = generateRounds();
    setRounds(r);
    setRoundIdx(0);
    setTotalScore(0);
    setPhase('playing');
    setValidated(false);
    setHintShown(false);
    setIllum(r[0].startIllum);
    sendIllumToTiles(r[0].startIllum);
    const firstEntry = PHYSICS_WORDS[r[0].wordIdx];
    for (const i of RIGHT_IDX) onSendColor(i, firstEntry.fg.r, firstEntry.fg.g, firstEntry.fg.b, 80);
    launchTimer();
  }

  function launchTimer() {
    window.clearInterval(timerRef.current);
    let t = ROUND_TIME;
    setTimeLeft(ROUND_TIME);
    timerRef.current = window.setInterval(() => {
      t--;
      setTimeLeft(t);
      if (t === Math.floor(ROUND_TIME * 0.4)) setHintShown(true);
      if (t <= 0) { window.clearInterval(timerRef.current); validate(0); }
    }, 1000) as unknown as number;
  }

  function changeIllum(ch: 'r' | 'g' | 'b', val: number) {
    const next = { ...illum, [ch]: val };
    setIllum(next);
    sendIllumToTiles(next);
  }

  function computeScore(): number {
    const timeBonus = Math.max(0, timeLeft) / ROUND_TIME;
    let accuracy = 0;
    if (round?.mode === 'cacher') {
      accuracy = Math.max(0, 1 - dist / 0.5);
    } else {
      accuracy = Math.max(0, (dist - 0.3) / 0.7);
    }
    return Math.round(700 * accuracy + 300 * timeBonus);
  }

  function validate(forcePts?: number) {
    if (validated) return;
    window.clearInterval(timerRef.current);
    setValidated(true);
    const pts = forcePts !== undefined ? forcePts : computeScore();
    setRoundScore(pts);
    setPhase('result');
    // Show reference (word colour) on RIGHT, player illuminant on LEFT
    if (round && entry) {
      const refColor = entry.fg;
      for (const i of RIGHT_IDX) onSendColor(i, refColor.r, refColor.g, refColor.b, 80);
      // LEFT keeps the current player illuminant (already sent via sendIllumToTiles)
    }
    let n = 5;
    setAutoAdv(n);
    const id = window.setInterval(() => {
      n--;
      setAutoAdv(n);
      if (n <= 0) { window.clearInterval(id); advanceRound(pts); }
    }, 1000);
  }

  function advanceRound(pts: number) {
    const nextTotal = totalScore + pts;
    const next = roundIdx + 1;
    if (next >= TOTAL_ROUNDS) {
      setTotalScore(nextTotal);
      onTurnOffAll();
      setPhase('finished');
      return;
    }
    setTotalScore(nextTotal);
    setRoundIdx(next);
    setValidated(false);
    setHintShown(false);
    const startIl = rounds[next].startIllum;
    setIllum(startIl);
    sendIllumToTiles(startIl);
    const nextEntry = PHYSICS_WORDS[rounds[next].wordIdx];
    for (const i of RIGHT_IDX) onSendColor(i, nextEntry.fg.r, nextEntry.fg.g, nextEntry.fg.b, 80);
    setPhase('playing');
    launchTimer();
  }

  const PRESETS: { label: string; col: RGB }[] = [
    { label: 'Blanc',   col: { r: 255, g: 255, b: 255 } },
    { label: 'Rouge',   col: { r: 255, g: 0,   b: 0   } },
    { label: 'Vert',    col: { r: 0,   g: 255, b: 0   } },
    { label: 'Bleu',    col: { r: 0,   g: 0,   b: 255 } },
    { label: 'Jaune',   col: { r: 255, g: 255, b: 0   } },
    { label: 'Cyan',    col: { r: 0,   g: 255, b: 255 } },
    { label: 'Magenta', col: { r: 255, g: 0,   b: 255 } },
  ];

  // ── READY ─────────────────────────────────────────────────────────────────────
  if (phase === 'ready') return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, padding: '18px 22px' }}>
        <div style={{ flex: 1 }}>
          <span style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg,rgba(124,58,237,.28),rgba(6,214,160,.18))',
            border: '1px solid rgba(124,58,237,.4)', borderRadius: 8,
            padding: '3px 10px', fontSize: 12, fontWeight: 800, color: '#a78bfa', marginBottom: 8,
          }}>
            🔬 Spectre de Mots
          </span>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.62)', lineHeight: 1.65, margin: '0 0 10px' }}>
            Un terme de physique lumineuse s&apos;affiche dans une couleur précise.
            Les dalles illuminent le fond avec la même couleur que l&apos;écran.{' '}
            <strong style={{ color: '#a78bfa' }}>CACHER :</strong> ajustez l&apos;éclairage jusqu&apos;à rendre le mot invisible.{' '}
            <strong style={{ color: '#f59e0b' }}>RÉVÉLER :</strong> le mot est déjà fondu — faites-le réapparaître.
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', margin: 0 }}>
            {TOTAL_ROUNDS} manches · {ROUND_TIME}s/manche · {TOTAL_ROUNDS * 1000} pts max
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <button onClick={startGame} style={S.playBtn}>Jouer</button>
          <button onClick={onQuit}    style={S.quitBtn}>Quitter</button>
        </div>
      </div>
    </div>
  );

  // ── FINISHED ──────────────────────────────────────────────────────────────────
  if (phase === 'finished') {
    const pct = Math.round(totalScore / (TOTAL_ROUNDS * 1000) * 100);
    return (
      <div style={S.wrap}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, padding: '20px 22px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontWeight: 700, letterSpacing: '.08em', marginBottom: 10 }}>RÉSULTATS FINAUX</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {([['Score', totalScore, '#a78bfa'], ['Réussite', `${pct}%`, '#06d6a0'], ['Manches', TOTAL_ROUNDS, '#fff']] as [string, string | number, string][]).map(([k, v, c]) => (
                <div key={k} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '8px 16px', textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.38)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>{k}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: c }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={startGame} style={S.playBtn}>Rejouer</button>
            <button onClick={onQuit}    style={S.quitBtn}>Menu</button>
          </div>
        </div>
      </div>
    );
  }

  if (!round || !entry) return null;

  const modeLabel  = round.mode === 'cacher' ? 'CACHER' : 'RÉVÉLER';
  const modeColor  = round.mode === 'cacher' ? '#7c3aed' : '#f59e0b';
  const modeBg     = round.mode === 'cacher' ? 'rgba(124,58,237,.25)' : 'rgba(245,158,11,.20)';
  const timerPct   = timeLeft / ROUND_TIME * 100;
  const timerColor = timeLeft > 30 ? '#4ade80' : timeLeft > 15 ? '#fbbf24' : '#ef4444';

  // ── PLAYING / RESULT ──────────────────────────────────────────────────────────
  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 18px' }}>

        {/* HUD */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: modeColor, background: modeBg, border: `1px solid ${modeColor}44`, padding: '3px 9px', borderRadius: 6 }}>
            {modeLabel}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>
            Manche <strong style={{ color: '#fff' }}>{roundIdx + 1}</strong>/{TOTAL_ROUNDS}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.10)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${timerPct}%`, background: timerColor, transition: 'width 1s linear', borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 10, color: timerColor, marginTop: 2, textAlign: 'right', fontWeight: 700 }}>{timeLeft}s</div>
          </div>
          <div style={{ fontWeight: 900, fontSize: 16, color: '#a78bfa' }}>{totalScore} pts</div>
          <button onClick={() => validate()} style={S.stopBtn}>⏹</button>
        </div>

        {/* Word display — fond = illum = couleur des dalles */}
        <div style={{
          ...S.glass,
          overflow: 'hidden',
          border: `2px solid ${hasWon ? '#4ade80' : 'rgba(255,255,255,.12)'}`,
          transition: 'border-color 0.2s',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.45)',
            background: 'rgba(255,255,255,.06)', padding: '5px 12px', letterSpacing: 0.5,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>FOND = COULEUR DES DALLES</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: css(illum), border: '1px solid rgba(255,255,255,.3)' }} />
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,.55)' }}>
                rgb({illum.r}, {illum.g}, {illum.b})
              </span>
            </div>
          </div>

          {/* The word — background mirrors tile colour exactly */}
          <div style={{
            padding: '36px 24px',
            background: css(illum),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 110,
            transition: 'background 0.06s',
          }}>
            <span style={{
              color: css(entry.fg),
              fontWeight: 900, fontSize: 30, letterSpacing: 5,
              fontFamily: 'monospace',
              transition: 'color 0.06s',
              userSelect: 'none',
            }}>
              {entry.word}
            </span>
          </div>

          {/* Colour legend */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,.25)' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: css(illum), border: '1px solid rgba(255,255,255,.2)', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>Fond · dalles</span>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,.08)' }} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: css(entry.fg), border: '1px solid rgba(255,255,255,.2)', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>
                Mot <span style={{ fontFamily: 'monospace' }}>rgb({entry.fg.r},{entry.fg.g},{entry.fg.b})</span> (fixe)
              </span>
            </div>
          </div>
        </div>

        {/* Distance gauge */}
        <div style={{ ...S.glass, padding: '8px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,.5)', marginBottom: 5 }}>
            <span>
              {round.mode === 'cacher' ? 'Distance fond → mot (↓ pour cacher)' : 'Distance fond → mot (↑ pour révéler)'}
            </span>
            <span style={{ fontWeight: 700, color: hasWon ? '#4ade80' : '#fff' }}>
              {contrastPct}%{hasWon ? ' ✓' : ''}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${contrastPct}%`,
              background: hasWon
                ? '#4ade80'
                : round.mode === 'cacher'
                  ? `hsl(${120 - contrastPct * 1.2},80%,55%)`
                  : `hsl(${contrastPct * 1.2},80%,55%)`,
              transition: 'width 0.08s, background 0.08s', borderRadius: 4,
            }} />
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 3 }}>
            {round.mode === 'cacher'
              ? `Cible : < ${Math.round(HIDE_WIN_DIST * 100)}% — rendez le fond identique à la couleur du mot`
              : `Cible : > ${Math.round(REVEAL_WIN_DIST * 100)}% — éloignez le fond de la couleur du mot`}
          </div>
        </div>

        {/* Presets */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <button key={p.label}
              onClick={() => { setIllum(p.col); sendIllumToTiles(p.col); }}
              style={{
                padding: '5px 12px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,.12)',
                background: `rgba(${p.col.r},${p.col.g},${p.col.b},0.18)`,
                color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600,
              }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* RGB sliders */}
        <div style={{ ...S.glass, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(['r', 'g', 'b'] as const).map((ch, i) => {
            const color = ['#ef4444', '#4ade80', '#60a5fa'][i];
            const label = ['R', 'G', 'B'][i];
            return (
              <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 14, fontWeight: 800, color, fontSize: 13 }}>{label}</span>
                <input type="range" min={0} max={255} step={1} value={illum[ch]}
                  onChange={e => changeIllum(ch, Number(e.target.value))}
                  style={{ flex: 1, accentColor: color }} />
                <span style={{ width: 30, textAlign: 'right', fontSize: 12, fontWeight: 700, color, fontFamily: 'monospace' }}>{illum[ch]}</span>
              </div>
            );
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,.06)', marginTop: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: css(illum), border: '1px solid rgba(255,255,255,.2)' }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>Fond (dalles)</span>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 22, height: 22, borderRadius: 5, background: css(entry.fg), border: '1px solid rgba(255,255,255,.2)' }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>Mot (fixe)</span>
            </div>
          </div>
        </div>

        {/* Hint */}
        {hintShown && phase === 'playing' && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(251,191,36,.10)', border: '1px solid rgba(251,191,36,.3)', fontSize: 12, color: '#fbbf24', lineHeight: 1.5 }}>
            💡{' '}
            {round.mode === 'cacher'
              ? `La couleur du mot est rgb(${entry.fg.r}, ${entry.fg.g}, ${entry.fg.b}). Amenez les dalles à cette même teinte pour le faire disparaître.`
              : `Le mot était caché car le fond correspondait à rgb(${entry.fg.r}, ${entry.fg.g}, ${entry.fg.b}). Éloignez-vous de cette couleur.`}
          </div>
        )}

        {/* Validate */}
        {phase === 'playing' && (
          <button onClick={() => validate()} style={{
            padding: '11px', borderRadius: 11, border: 'none',
            background: hasWon ? '#4ade80' : 'linear-gradient(135deg,#7c3aed,#06d6a0)',
            color: hasWon ? '#000' : '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>
            {hasWon ? '✓ Parfait — Valider !' : 'Valider ma réponse'}
          </button>
        )}

        {/* Result */}
        {phase === 'result' && (
          <div style={{
            ...S.glass,
            background: roundScore >= 700 ? 'rgba(74,222,128,.10)' : roundScore >= 400 ? 'rgba(251,191,36,.10)' : 'rgba(239,68,68,.08)',
            border: `1px solid ${roundScore >= 700 ? '#4ade8033' : roundScore >= 400 ? '#fbbf2433' : '#ef444433'}`,
            padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: roundScore >= 700 ? '#4ade80' : roundScore >= 400 ? '#fbbf24' : '#ef4444' }}>
              {roundScore >= 700 ? '🎯 Excellent !' : roundScore >= 400 ? '✅ Bien joué' : '🎨 Presque…'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', lineHeight: 1.5 }}>
              {round.mode === 'cacher'
                ? `Pour masquer « ${entry.word} », le fond devait correspondre exactement à sa couleur rgb(${entry.fg.r}, ${entry.fg.g}, ${entry.fg.b}). Les dalles auraient dû briller dans cette teinte.`
                : `Pour révéler « ${entry.word} », il fallait éloigner la couleur des dalles de rgb(${entry.fg.r}, ${entry.fg.g}, ${entry.fg.b}) pour créer un contraste suffisant.`}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>+{roundScore} pts</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>Prochain round dans {autoAdv}s…</div>
          </div>
        )}

      </div>
    </div>
  );
}
