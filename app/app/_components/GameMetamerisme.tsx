'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameTileProps } from './GameColorSpeed';

// ── Colour helpers ────────────────────────────────────────────────────────────

type RGB = { r: number; g: number; b: number };

function apparent(surface: RGB, illum: RGB): RGB {
  return {
    r: Math.round(surface.r * illum.r / 255),
    g: Math.round(surface.g * illum.g / 255),
    b: Math.round(surface.b * illum.b / 255),
  };
}

function colorDist(a: RGB, b: RGB): number {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3 * 255 * 255);
}

function css(c: RGB): string {
  return `rgb(${c.r},${c.g},${c.b})`;
}

function brightness(c: RGB): number {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

// ── Fiche definitions ─────────────────────────────────────────────────────────
//
// Each pair has one equal channel.  Under the pure illumination of that
// channel the two apparent colours become identical (metamerism).
// CACHER rounds: find that illumination → text disappears.
// RÉVÉLER rounds: start with tiles already showing the HIDE illumination
//   (text invisible on physical card) → find a different illumination to
//   restore maximum contrast.

type Mode = 'cacher' | 'révéler';

interface Fiche {
  id: string;
  title: string;
  bg: RGB;
  fg: RGB;
  text: string;
  mode: Mode;
  startIllum: RGB;   // illumination displayed when round begins
  targetIllum: RGB;  // illumination that wins the round
  equalChannel: 'R' | 'G' | 'B';
  hint: string;
}

const FICHES: Fiche[] = [
  // ── Pair 1 : G=80 ─────────────────────────────────────────────────────────
  {
    id: 'c1', title: 'Bleu & Orangé',
    bg: { r: 20, g: 80, b: 210 }, fg: { r: 210, g: 80, b: 25 },
    text: 'LUMIÈRE', mode: 'cacher',
    startIllum: { r: 255, g: 255, b: 255 },
    targetIllum: { r: 0, g: 255, b: 0 },
    equalChannel: 'G',
    hint: 'Ces deux couleurs ont la même valeur verte (G = 80).',
  },
  {
    id: 'r1', title: 'Révèle le secret',
    bg: { r: 20, g: 80, b: 210 }, fg: { r: 210, g: 80, b: 25 },
    text: 'LUMIÈRE', mode: 'révéler',
    startIllum: { r: 0, g: 255, b: 0 },   // start hidden
    targetIllum: { r: 255, g: 0, b: 0 },  // red maximises R difference
    equalChannel: 'G',
    hint: 'Le vert les cache — essayez le rouge ou le bleu.',
  },
  // ── Pair 2 : B=110 ────────────────────────────────────────────────────────
  {
    id: 'c2', title: 'Cramoisi & Émeraude',
    bg: { r: 200, g: 45, b: 110 }, fg: { r: 40, g: 200, b: 110 },
    text: 'SECRET', mode: 'cacher',
    startIllum: { r: 255, g: 255, b: 255 },
    targetIllum: { r: 0, g: 0, b: 255 },
    equalChannel: 'B',
    hint: 'Les deux couleurs partagent la même composante bleue (B = 110).',
  },
  {
    id: 'r2', title: 'La révélation bleue',
    bg: { r: 200, g: 45, b: 110 }, fg: { r: 40, g: 200, b: 110 },
    text: 'SECRET', mode: 'révéler',
    startIllum: { r: 0, g: 0, b: 255 },
    targetIllum: { r: 255, g: 0, b: 0 },
    equalChannel: 'B',
    hint: 'Le bleu les unifie — essayez le rouge ou le vert.',
  },
  // ── Pair 3 : R=135 ────────────────────────────────────────────────────────
  {
    id: 'c3', title: 'Chartreuse & Violet',
    bg: { r: 135, g: 210, b: 30 }, fg: { r: 135, g: 20, b: 210 },
    text: 'MÉTAMÈRE', mode: 'cacher',
    startIllum: { r: 255, g: 255, b: 255 },
    targetIllum: { r: 255, g: 0, b: 0 },
    equalChannel: 'R',
    hint: 'Rouge identique des deux côtés (R = 135).',
  },
  {
    id: 'r3', title: 'Révèle le vert caché',
    bg: { r: 135, g: 210, b: 30 }, fg: { r: 135, g: 20, b: 210 },
    text: 'MÉTAMÈRE', mode: 'révéler',
    startIllum: { r: 255, g: 0, b: 0 },
    targetIllum: { r: 0, g: 255, b: 0 },
    equalChannel: 'R',
    hint: 'Le rouge les fond — le vert ou le bleu les sépare.',
  },
  // ── Pair 4 : G=115 ────────────────────────────────────────────────────────
  {
    id: 'c4', title: 'Ambre & Azur',
    bg: { r: 220, g: 115, b: 20 }, fg: { r: 20, g: 115, b: 220 },
    text: 'INVISIBLE', mode: 'cacher',
    startIllum: { r: 255, g: 255, b: 255 },
    targetIllum: { r: 0, g: 255, b: 0 },
    equalChannel: 'G',
    hint: 'Canal vert commun (G = 115) — la lumière verte est la clé.',
  },
  {
    id: 'r4', title: 'L\'Ambre contre l\'Azur',
    bg: { r: 220, g: 115, b: 20 }, fg: { r: 20, g: 115, b: 220 },
    text: 'INVISIBLE', mode: 'révéler',
    startIllum: { r: 0, g: 255, b: 0 },
    targetIllum: { r: 255, g: 0, b: 0 },
    equalChannel: 'G',
    hint: 'Sous lumière verte tout se fond — essayez le rouge.',
  },
];

// Shuffled order for 8 rounds
function shuffleOrder(): number[] {
  const arr = FICHES.map((_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_ROUNDS = FICHES.length;
const HIDE_WIN_THRESHOLD  = 0.06;  // similarity ≥ 94 %  → text invisible
const REVEAL_WIN_THRESHOLD = 0.50; // distance  ≥ 50 %  → text clearly visible
const ROUND_TIME = 90;

// ── Component ─────────────────────────────────────────────────────────────────

export default function GameMetamerisme({
  onSendColor, onTurnOffAll, onQuit, tileCount = 42,
}: GameTileProps) {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'result' | 'finished'>('ready');
  const [order,     setOrder]     = useState<number[]>([]);
  const [roundIdx,  setRoundIdx]  = useState(0);
  const [illum,     setIllum]     = useState<RGB>({ r: 255, g: 255, b: 255 });
  const [timeLeft,  setTimeLeft]  = useState(ROUND_TIME);
  const [hintShown, setHintShown] = useState(false);
  const [roundScore, setRoundScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [validated,  setValidated]  = useState(false);
  const [autoAdv,    setAutoAdv]    = useState(5);

  const numTiles   = Math.min(tileCount, 42);
  const timerRef   = useRef<number>(0);
  const hwRef      = useRef<number>(0);
  const lastSendMs = useRef(0);

  // ── Hardware sync (debounced 40 ms) ──────────────────────────────────────
  const sendIllumToTiles = useCallback((il: RGB) => {
    window.clearTimeout(hwRef.current);
    hwRef.current = window.setTimeout(() => {
      for (let i = 0; i < numTiles; i++) onSendColor(i, il.r, il.g, il.b, 80);
    }, 40);
  }, [numTiles, onSendColor]);

  useEffect(() => () => {
    window.clearTimeout(hwRef.current);
    window.clearTimeout(timerRef.current);
    onTurnOffAll();
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────
  const fiche: Fiche | null = order.length > 0 ? FICHES[order[roundIdx]] : null;

  const appBg = fiche ? apparent(fiche.bg, illum) : { r: 0, g: 0, b: 0 };
  const appFg = fiche ? apparent(fiche.fg, illum) : { r: 0, g: 0, b: 0 };
  const dist  = colorDist(appBg, appFg);

  // Similarity (0 = very different, 1 = identical)
  const similarity = 1 - dist;

  const hasWon = fiche
    ? fiche.mode === 'cacher'
      ? dist   <= HIDE_WIN_THRESHOLD
      : dist   >= REVEAL_WIN_THRESHOLD
    : false;

  // ── Start / restart ───────────────────────────────────────────────────────
  function startGame() {
    const ord = shuffleOrder();
    setOrder(ord);
    setRoundIdx(0);
    setTotalScore(0);
    setPhase('playing');
    setValidated(false);
    setHintShown(false);
    setTimeLeft(ROUND_TIME);
    const startIl = FICHES[ord[0]].startIllum;
    setIllum(startIl);
    sendIllumToTiles(startIl);
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
      if (t <= 0) {
        window.clearInterval(timerRef.current);
        validate(0); // time out → 0 pts
      }
    }, 1000) as unknown as number;
  }

  // ── Slider change ─────────────────────────────────────────────────────────
  function changeIllum(channel: 'r' | 'g' | 'b', val: number) {
    const next = { ...illum, [channel]: val };
    setIllum(next);
    sendIllumToTiles(next);
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  function validate(forcePts?: number) {
    if (validated) return;
    window.clearInterval(timerRef.current);
    setValidated(true);

    const pts = forcePts !== undefined
      ? forcePts
      : computeScore();
    setRoundScore(pts);
    setPhase('result');

    // Reveal target on tiles briefly
    if (fiche) {
      const tgt = fiche.targetIllum;
      for (let i = 0; i < numTiles; i++) onSendColor(i, tgt.r, tgt.g, tgt.b, 80);
    }

    // Auto-advance counter
    let n = 5;
    setAutoAdv(n);
    const id = window.setInterval(() => {
      n--;
      setAutoAdv(n);
      if (n <= 0) { window.clearInterval(id); advanceRound(pts); }
    }, 1000);
  }

  function computeScore(): number {
    if (!fiche) return 0;
    const bonus_time = Math.max(0, timeLeft) / ROUND_TIME; // 0‥1
    let accuracy = 0;

    if (fiche.mode === 'cacher') {
      // Full marks when dist=0, 0 pts when dist≥0.5
      accuracy = Math.max(0, 1 - dist / 0.5);
    } else {
      // Full marks when dist=1, 0 pts when dist<0.3
      accuracy = Math.max(0, (dist - 0.3) / 0.7);
    }
    return Math.round(700 * accuracy + 300 * bonus_time);
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
    const startIl = FICHES[order[next]].startIllum;
    setIllum(startIl);
    sendIllumToTiles(startIl);
    setPhase('playing');
    launchTimer();
  }

  // ── Preset illumination buttons ───────────────────────────────────────────
  const PRESETS: { label: string; col: RGB }[] = [
    { label: 'Blanc',  col: { r: 255, g: 255, b: 255 } },
    { label: 'Rouge',  col: { r: 255, g: 0,   b: 0   } },
    { label: 'Vert',   col: { r: 0,   g: 255, b: 0   } },
    { label: 'Bleu',   col: { r: 0,   g: 0,   b: 255 } },
    { label: 'Jaune',  col: { r: 255, g: 255, b: 0   } },
    { label: 'Cyan',   col: { r: 0,   g: 255, b: 255 } },
    { label: 'Magenta',col: { r: 255, g: 0,   b: 255 } },
  ];

  // ── Render: ready ─────────────────────────────────────────────────────────
  if (phase === 'ready') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 36 }}>
      <div style={{ fontSize: 52 }}>🃏</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#fff' }}>Métamérie</h2>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', maxWidth: 440, lineHeight: 1.65, margin: 0 }}>
        Une fiche avec un fond coloré et un texte d'une autre couleur est posée sur les dalles.<br /><br />
        <strong style={{ color: '#fff' }}>Mode CACHER :</strong> trouvez l'éclairage qui rend le texte invisible — les deux couleurs se fondent.<br />
        <strong style={{ color: '#f59e0b' }}>Mode RÉVÉLER :</strong> les dalles cachent déjà le texte — trouvez l'éclairage qui le fait réapparaître.<br /><br />
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
          {TOTAL_ROUNDS} manches — {ROUND_TIME}s par manche — {TOTAL_ROUNDS * 1000} points max
        </span>
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={startGame}
          style={{ padding: '13px 36px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#06d6a0)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          Jouer
        </button>
        <button onClick={onQuit}
          style={{ padding: '13px 22px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
          Quitter
        </button>
      </div>
    </div>
  );

  // ── Render: finished ──────────────────────────────────────────────────────
  if (phase === 'finished') {
    const pct = Math.round(totalScore / (TOTAL_ROUNDS * 1000) * 100);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: 36 }}>
        <div style={{ fontSize: 52 }}>{pct >= 80 ? '🏆' : pct >= 50 ? '🥈' : '🥉'}</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Terminé !</h2>
        <div style={{ fontSize: 52, fontWeight: 900, color: '#06d6a0' }}>{totalScore}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>/{TOTAL_ROUNDS * 1000} points ({pct}%)</div>
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 13, maxWidth: 380 }}>
          {pct >= 80
            ? 'Excellent ! Vous maîtrisez la métamérie chromatique.'
            : pct >= 50
            ? 'Bien ! Continuez à entraîner votre œil aux effets d\'illumination.'
            : 'La métamérie est subtile — chaque couleur de lumière révèle quelque chose de différent.'}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={startGame}
            style={{ padding: '11px 26px', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#06d6a0)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Rejouer
          </button>
          <button onClick={onQuit}
            style={{ padding: '11px 18px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Menu
          </button>
        </div>
      </div>
    );
  }

  if (!fiche) return null;

  const appBgUnder255  = apparent(fiche.bg, { r: 255, g: 255, b: 255 }); // = original
  const appFgUnder255  = apparent(fiche.fg, { r: 255, g: 255, b: 255 }); // = original

  const textContrastDark = brightness(appBg) > 100;
  const simPct = Math.round(similarity * 100);
  const timerPct = timeLeft / ROUND_TIME * 100;
  const timerColor = timeLeft > 30 ? '#4ade80' : timeLeft > 15 ? '#fbbf24' : '#ef4444';

  const modeLabel = fiche.mode === 'cacher' ? 'CACHER' : 'RÉVÉLER';
  const modeColor = fiche.mode === 'cacher' ? '#7c3aed' : '#f59e0b';

  // ── Render: playing / result ──────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 18px', color: '#e8eaf0' }}>

      {/* ── HUD ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: modeColor, padding: '3px 9px', borderRadius: 6 }}>
          {modeLabel}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
          Manche <strong style={{ color: '#fff' }}>{roundIdx + 1}</strong>/{TOTAL_ROUNDS}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${timerPct}%`, background: timerColor, transition: 'width 1s linear' }} />
          </div>
          <div style={{ fontSize: 10, color: timerColor, marginTop: 2, textAlign: 'right', fontWeight: 700 }}>{timeLeft}s</div>
        </div>
        <div style={{ fontWeight: 900, fontSize: 16, color: '#06d6a0' }}>{totalScore} pts</div>
        <button onClick={() => validate()}
          style={{ padding: '4px 11px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', fontSize: 11, cursor: 'pointer' }}>
          ⏹
        </button>
      </div>

      {/* ── Card title ── */}
      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', opacity: 0.85 }}>{fiche.title}</div>

      {/* ── Two card previews ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

        {/* White light reference */}
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.06)', padding: '4px 10px', letterSpacing: 0.5 }}>
            LUMIÈRE BLANCHE
          </div>
          <div style={{
            padding: '18px 12px',
            background: css(appBgUnder255),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 72,
          }}>
            <span style={{
              color: css(appFgUnder255),
              fontWeight: 900, fontSize: 20, letterSpacing: 2,
              textShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}>{fiche.text}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: 6, background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ flex: 1, height: 14, borderRadius: 3, background: css(appBgUnder255), border: '1px solid rgba(255,255,255,0.15)' }} />
            <div style={{ flex: 1, height: 14, borderRadius: 3, background: css(appFgUnder255), border: '1px solid rgba(255,255,255,0.15)' }} />
          </div>
        </div>

        {/* Under player illumination */}
        <div style={{ borderRadius: 10, overflow: 'hidden', border: `2px solid ${hasWon ? '#4ade80' : 'rgba(255,255,255,0.12)'}`, transition: 'border-color 0.2s' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.06)', padding: '4px 10px', letterSpacing: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>VOTRE ÉCLAIRAGE</span>
            <span style={{ color: css(illum), fontWeight: 800 }}>■</span>
          </div>
          <div style={{
            padding: '18px 12px',
            background: css(appBg),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 72,
            transition: 'background 0.08s',
          }}>
            <span style={{
              color: css(appFg),
              fontWeight: 900, fontSize: 20, letterSpacing: 2,
              transition: 'color 0.08s',
              textShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}>{fiche.text}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: 6, background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ flex: 1, height: 14, borderRadius: 3, background: css(appBg), border: '1px solid rgba(255,255,255,0.15)', transition: 'background 0.08s' }} />
            <div style={{ flex: 1, height: 14, borderRadius: 3, background: css(appFg), border: '1px solid rgba(255,255,255,0.15)', transition: 'background 0.08s' }} />
          </div>
        </div>
      </div>

      {/* ── Similarity gauge ── */}
      <div style={{ padding: '8px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>
          <span>{fiche.mode === 'cacher' ? 'Similarité des couleurs apparentes' : 'Contraste des couleurs apparentes'}</span>
          <span style={{ fontWeight: 700, color: hasWon ? '#4ade80' : '#fff' }}>
            {fiche.mode === 'cacher' ? `${simPct}%` : `${Math.round(dist * 100)}%`}
            {hasWon && ' ✓'}
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: fiche.mode === 'cacher' ? `${simPct}%` : `${Math.round(dist * 100)}%`,
            background: hasWon
              ? '#4ade80'
              : fiche.mode === 'cacher'
              ? `hsl(${simPct * 1.2},80%,55%)`
              : `hsl(${Math.round(dist * 120)},80%,55%)`,
            transition: 'width 0.1s, background 0.1s',
            borderRadius: 4,
          }} />
        </div>
        {fiche.mode === 'cacher'
          ? <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>100% = couleurs identiques (texte invisible)</div>
          : <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>100% = contraste maximal (texte très lisible)</div>}
      </div>

      {/* ── Preset buttons ── */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => { setIllum(p.col); sendIllumToTiles(p.col); }}
            style={{
              padding: '4px 10px', borderRadius: 6, border: `1px solid rgba(255,255,255,0.12)`,
              background: `rgba(${p.col.r},${p.col.g},${p.col.b},0.18)`,
              color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600,
            }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* ── RGB sliders ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {([['r', '#ef4444', 'R'], ['g', '#4ade80', 'G'], ['b', '#60a5fa', 'B']] as const).map(([ch, color, label]) => (
          <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 14, fontWeight: 800, color, fontSize: 13 }}>{label}</span>
            <input type="range" min={0} max={255} step={1} value={illum[ch]}
              onChange={e => changeIllum(ch, Number(e.target.value))}
              style={{ flex: 1, accentColor: color }} />
            <span style={{ width: 30, textAlign: 'right', fontSize: 12, fontWeight: 700, color, fontFamily: 'monospace' }}>{illum[ch]}</span>
          </div>
        ))}
      </div>

      {/* ── Illumination swatch ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: css(illum), border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
          Éclairage actuel — les dalles reflètent cette teinte sur la fiche physique
        </div>
      </div>

      {/* ── Hint ── */}
      {hintShown && phase === 'playing' && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', fontSize: 12, color: '#fbbf24' }}>
          💡 {fiche.hint}
        </div>
      )}

      {/* ── Validate button ── */}
      {phase === 'playing' && (
        <button onClick={() => validate()}
          style={{
            padding: '11px', borderRadius: 11, border: 'none',
            background: hasWon ? '#4ade80' : 'linear-gradient(135deg,#7c3aed,#06d6a0)',
            color: hasWon ? '#000' : '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>
          {hasWon ? '✓ Parfait — Valider !' : 'Valider ma réponse'}
        </button>
      )}

      {/* ── Result panel ── */}
      {phase === 'result' && (
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: roundScore >= 700 ? 'rgba(74,222,128,0.1)' : roundScore >= 400 ? 'rgba(251,191,36,0.1)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${roundScore >= 700 ? '#4ade8033' : roundScore >= 400 ? '#fbbf2433' : '#ef444433'}`,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: roundScore >= 700 ? '#4ade80' : roundScore >= 400 ? '#fbbf24' : '#ef4444' }}>
            {roundScore >= 700 ? '🎯 Excellent !' : roundScore >= 400 ? '✅ Bien joué' : '🎨 Presque…'}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
            La solution : éclairage <strong style={{ color: '#fff' }}>
              {fiche.equalChannel === 'R' && fiche.mode === 'cacher' ? 'rouge pur' :
               fiche.equalChannel === 'G' && fiche.mode === 'cacher' ? 'vert pur' :
               fiche.equalChannel === 'B' && fiche.mode === 'cacher' ? 'bleu pur' :
               fiche.mode === 'révéler' ? 'canal opposé au canal commun' : '—'}
            </strong><br />
            {fiche.mode === 'cacher'
              ? `Canal commun ${fiche.equalChannel} = ${(fiche.bg as any)[fiche.equalChannel.toLowerCase()]} — sous lumière pure ${fiche.equalChannel}, les deux couleurs deviennent identiques.`
              : `Sous l'éclairage du canal ${fiche.equalChannel}, les couleurs se fondaient. Un autre canal les sépare à nouveau.`}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>+{roundScore} pts</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Prochain round dans {autoAdv}s…</div>
        </div>
      )}
    </div>
  );
}
