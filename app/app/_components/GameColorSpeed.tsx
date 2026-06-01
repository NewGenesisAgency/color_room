'use client';

import { useEffect, useRef, useState } from 'react';

export interface GameTileProps {
  onSendColor: (tileIdx: number, r: number, g: number, b: number, intensity?: number) => void;
  /** Envoie directement 32 valeurs de canaux (0-100) à une dalle, sans conversion RGB. */
  onSendRawChannels?: (tileIdx: number, channels: number[]) => void;
  onTurnOff:   (tileIdx: number) => void;
  onTurnOffAll: () => void;
  onQuit:      () => void;
  tileCount?:  number;
  onRegisterClickHandler?: (fn: ((idx: number) => void) | null) => void;
  /** Appelé une fois à la fin d'une partie : met à jour le score universel
   *  (points ajoutés) et incrémente le compteur de jeux réussis. */
  onComplete?: (points: number) => void;
}

/* ── Constants ──────────────────────────────────────────────────────── */
const GAME_DURATION = 60;
const COLORS: { r: number; g: number; b: number }[] = [
  { r: 255, g: 30,  b: 30  },   // rouge
  { r: 30,  g: 220, b: 80  },   // vert
  { r: 40,  g: 80,  b: 255 },   // bleu
  { r: 255, g: 200, b: 0   },   // jaune
  { r: 200, g: 0,   b: 255 },   // violet
  { r: 255, g: 110, b: 0   },   // orange
  { r: 0,   g: 210, b: 220 },   // cyan
];

type SpeedTier = { label: string; bonus: number; color: string; glow: string };
function speedTier(ms: number): SpeedTier {
  if (ms <  350) return { label: '⚡ ÉCLAIR',  bonus: 15, color: '#fff176', glow: 'rgba(255,241,118,0.55)' };
  if (ms <  650) return { label: '🔥 RAPIDE',  bonus: 10, color: '#ffa040', glow: 'rgba(255,160,64,0.50)'  };
  if (ms < 1100) return { label: '✓ BIEN',     bonus:  5, color: '#4ade80', glow: 'rgba(74,222,128,0.45)' };
  return               { label: '🐢 LENT',     bonus:  0, color: '#94a3b8', glow: 'rgba(148,163,184,0.35)' };
}

type Bubble = { id: number; text: string; color: string; glow: string };
let _bid = 0;

/* ── CSS animations ─────────────────────────────────────────────────── */
const ANIM = `
  @keyframes cs-rise {
    0%   { opacity:0; transform:translateX(-50%) translateY(2px) scale(.75); }
    14%  { opacity:1; transform:translateX(-50%) translateY(-10px) scale(1.06); }
    78%  { opacity:1; transform:translateX(-50%) translateY(-82px) scale(1); }
    100% { opacity:0; transform:translateX(-50%) translateY(-100px) scale(.9); }
  }
  @keyframes cs-pop {
    0%   { transform:scale(1); }
    35%  { transform:scale(1.22); }
    65%  { transform:scale(.93); }
    100% { transform:scale(1); }
  }
  @keyframes cs-combo {
    0%   { transform:scale(.4) rotate(-8deg); opacity:0; }
    55%  { transform:scale(1.12) rotate(2deg); opacity:1; }
    100% { transform:scale(1) rotate(0deg); opacity:1; }
  }
  @keyframes cs-count {
    0%   { transform:scale(2.2); opacity:0; }
    18%  { transform:scale(1.0); opacity:1; }
    80%  { transform:scale(.96); opacity:1; }
    100% { transform:scale(.75); opacity:0; }
  }
  @keyframes cs-go {
    0%   { transform:scale(.6) translateY(10px); opacity:0; }
    25%  { transform:scale(1.1) translateY(-4px); opacity:1; }
    70%  { transform:scale(1.0) translateY(0); opacity:1; }
    100% { transform:scale(.85) translateY(-6px); opacity:0; }
  }
  @keyframes cs-speed {
    0%   { transform:translateX(-50%) translateY(4px); opacity:0; }
    20%  { transform:translateX(-50%) translateY(0); opacity:1; }
    75%  { transform:translateX(-50%) translateY(0); opacity:1; }
    100% { transform:translateX(-50%) translateY(-4px); opacity:0; }
  }
  @keyframes cs-pulse {
    0%,100% { opacity:1; }
    50% { opacity:.45; }
  }
  .cs-pop   { animation: cs-pop   .28s cubic-bezier(.34,1.56,.64,1) both; }
  .cs-combo { animation: cs-combo .30s cubic-bezier(.34,1.56,.64,1) both; }
  .cs-count { animation: cs-count .85s ease-in-out both; }
  .cs-go    { animation: cs-go    .9s ease-in-out both; }
  .cs-speed { animation: cs-speed .95s ease-in-out both; }
  .cs-rise  { animation: cs-rise  1.25s cubic-bezier(.25,.46,.45,.94) both; }
`;

/* ══════════════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════════════ */
export default function GameColorSpeed({
  onSendColor, onTurnOff, onTurnOffAll, onQuit,
  tileCount = 42, onRegisterClickHandler, onComplete,
}: GameTileProps) {

  type Phase = 'ready' | 'countdown' | 'playing' | 'finished';

  const [phase,      setPhase]      = useState<Phase>('ready');
  const [timeLeft,   setTimeLeft]   = useState(GAME_DURATION);
  const [score,      setScore]      = useState(0);
  useEffect(() => { if (phase === 'finished') onComplete?.(score); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const [missed,     setMissed]     = useState(0);
  const [combo,      setCombo]      = useState(0);
  const [lightnings, setLightnings] = useState(0);
  const [cdNum,      setCdNum]      = useState<number | 'GO!'>(3);
  const [speedLbl,   setSpeedLbl]   = useState<SpeedTier | null>(null);
  const [bubbles,    setBubbles]    = useState<Bubble[]>([]);
  const [popKey,     setPopKey]     = useState(0);
  const [best, setBest] = useState(() => {
    try { return Number(localStorage.getItem('cs_best') ?? 0); } catch { return 0; }
  });

  /* refs — never stale in callbacks */
  const phaseRef      = useRef<Phase>('ready');
  const activeTileRef = useRef<number | null>(null);
  const activeColRef  = useRef<{ r: number; g: number; b: number } | null>(null);
  const tileStartRef  = useRef(0);
  const speedRef      = useRef(1800);   // miss-window ms
  const comboRef      = useRef(0);
  const lightRef      = useRef(0);
  const tileTimerRef  = useRef(0);
  const gameTimerRef  = useRef(0);
  const lblTimerRef   = useRef(0);
  const numTiles      = Math.min(tileCount, 42);

  /* ── helpers ─────────────────────────────────────────────────────── */
  function bubble(text: string, { color, glow }: Pick<SpeedTier, 'color' | 'glow'>) {
    const id = ++_bid;
    setBubbles(p => [...p, { id, text, color, glow }]);
    window.setTimeout(() => setBubbles(p => p.filter(b => b.id !== id)), 1400);
  }

  function showSpeed(t: SpeedTier) {
    window.clearTimeout(lblTimerRef.current);
    setSpeedLbl(t);
    lblTimerRef.current = window.setTimeout(() => setSpeedLbl(null), 950);
  }

  /* ── light one tile ───────────────────────────────────────────────── */
  function lightNextTile() {
    if (phaseRef.current !== 'playing') return;

    // Turn off previous
    if (activeTileRef.current !== null) onTurnOff(activeTileRef.current);

    const idx = Math.floor(Math.random() * numTiles);
    const col = COLORS[Math.floor(Math.random() * COLORS.length)];
    activeTileRef.current = idx;
    activeColRef.current  = col;
    tileStartRef.current  = Date.now();
    onSendColor(idx, col.r, col.g, col.b, 92);

    window.clearTimeout(tileTimerRef.current);
    tileTimerRef.current = window.setTimeout(() => {
      if (phaseRef.current !== 'playing') return;
      // ── Miss ──
      comboRef.current = 0;
      setCombo(0);
      setMissed(m => m + 1);
      const missIdx = activeTileRef.current!;
      const missCol = activeColRef.current!;
      // Single-tile red flash → restore → next tile
      onSendColor(missIdx, 230, 20, 20, 95);
      window.setTimeout(() => {
        if (phaseRef.current !== 'playing') return;
        onSendColor(missIdx, missCol.r, missCol.g, missCol.b, 92);
        activeTileRef.current  = missIdx;
        tileStartRef.current   = Date.now();
        // Give one more chance at the same tile (pressure!)
        window.clearTimeout(tileTimerRef.current);
        tileTimerRef.current = window.setTimeout(() => {
          if (phaseRef.current !== 'playing') return;
          onTurnOff(missIdx);
          activeTileRef.current = null;
          window.setTimeout(() => lightNextTile(), 60);
        }, Math.max(speedRef.current, 500));
      }, 220);
    }, speedRef.current);
  }

  /* ── countdown → start ───────────────────────────────────────────── */
  function beginCountdown() {
    phaseRef.current = 'countdown';
    setPhase('countdown');
    setCdNum(3);
    let n = 2;
    const tick = () => {
      if (n > 0) { setCdNum(n--); window.setTimeout(tick, 880); }
      else { setCdNum('GO!'); window.setTimeout(startGame, 700); }
    };
    window.setTimeout(tick, 880);
  }

  /* ── start game ──────────────────────────────────────────────────── */
  function startGame() {
    phaseRef.current = 'playing';
    setPhase('playing');
    setTimeLeft(GAME_DURATION);
    setScore(0); setMissed(0); setCombo(0); setLightnings(0);
    setBubbles([]); setSpeedLbl(null);
    comboRef.current = 0; lightRef.current = 0; speedRef.current = 1800;

    let elapsed = 0;
    window.clearInterval(gameTimerRef.current);
    gameTimerRef.current = window.setInterval(() => {
      elapsed++;
      setTimeLeft(GAME_DURATION - elapsed);
      // Accelerate every 8 s, floor at 380 ms
      if (elapsed % 8 === 0)
        speedRef.current = Math.max(380, Math.round(speedRef.current * 0.84));
      if (elapsed >= GAME_DURATION) {
        window.clearInterval(gameTimerRef.current);
        window.clearTimeout(tileTimerRef.current);
        if (activeTileRef.current !== null) { onTurnOff(activeTileRef.current); activeTileRef.current = null; }
        phaseRef.current = 'finished';
        setPhase('finished');
        setScore(s => {
          setBest(b => { const nx = Math.max(b, s); try { localStorage.setItem('cs_best', String(nx)); } catch {} return nx; });
          return s;
        });
      }
    }, 1000);
    lightNextTile();
  }

  /* ── tile click handler — registered ONCE (useEffect []) ─────────── */
  function handleTileClick(idx: number) {
    if (phaseRef.current !== 'playing' || activeTileRef.current === null) return;

    if (idx === activeTileRef.current) {
      /* ✅ CORRECT HIT */
      const reaction = Date.now() - tileStartRef.current;
      const tier = speedTier(reaction);

      comboRef.current++;
      setCombo(comboRef.current);
      const comboBonus = Math.min(comboRef.current - 1, 9);
      const delta = 10 + tier.bonus + comboBonus;

      if (tier.bonus === 15) { lightRef.current++; setLightnings(lightRef.current); }

      setScore(s => s + delta);
      setPopKey(k => k + 1);
      bubble(`+${delta}`, tier);
      showSpeed(tier);

      window.clearTimeout(tileTimerRef.current);

      // ─ Single-tile white flash → off → next ─
      const hitIdx = activeTileRef.current;
      activeTileRef.current = null;           // consumed
      onSendColor(hitIdx, 255, 255, 255, 100); // white burst
      window.setTimeout(() => {
        onTurnOff(hitIdx);
        window.setTimeout(() => { if (phaseRef.current === 'playing') lightNextTile(); }, 35);
      }, 120);

    } else {
      /* ❌ WRONG TILE */
      comboRef.current = 0;
      setCombo(0);
      setMissed(m => m + 1);
      bubble('−2', { color: '#ef4444', glow: 'rgba(239,68,68,0.5)' });
      setScore(s => Math.max(0, s - 2));

      // Flash only the wrong tile red
      onSendColor(idx, 230, 20, 20, 88);
      window.setTimeout(() => onTurnOff(idx), 160);

      // Pulse the CORRECT tile brighter as hint
      const correctIdx = activeTileRef.current!;
      const correctCol = activeColRef.current!;
      onSendColor(correctIdx, correctCol.r, correctCol.g, correctCol.b, 100);
      window.setTimeout(() => {
        if (activeTileRef.current === correctIdx)
          onSendColor(correctIdx, correctCol.r, correctCol.g, correctCol.b, 92);
      }, 280);
    }
  }

  /* ── register / cleanup ───────────────────────────────────────────── */
  useEffect(() => {
    onRegisterClickHandler?.(handleTileClick);
    return () => {
      onRegisterClickHandler?.(null);
      window.clearInterval(gameTimerRef.current);
      window.clearTimeout(tileTimerRef.current);
      window.clearTimeout(lblTimerRef.current);
      onTurnOffAll();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── derived ──────────────────────────────────────────────────────── */
  const pct        = (timeLeft / GAME_DURATION) * 100;
  const tColor     = timeLeft > 20 ? '#4ade80' : timeLeft > 10 ? '#fbbf24' : '#ef4444';
  const urgentAnim = timeLeft <= 10 ? 'cs-pulse .7s ease-in-out infinite' : 'none';

  /* ════════════════════════════════════════════════════════════════════
     READY
  ════════════════════════════════════════════════════════════════════ */
  if (phase === 'ready') return (
    <div style={P.wrap}>
      <style>{ANIM}</style>
      <div style={P.readyRow}>
        <div style={{ flex: 1 }}>
          <span style={P.tag}>⚡ Color Speed</span>
          <p style={P.rules}>
            Une dalle s'allume dans la salle 3D — cliquez-la <em>le plus vite possible</em>.
            La vitesse augmente toutes les 8 s. Réagissez vite pour des bonus.
            Combos = points en plus.
            <span style={P.aside}>&nbsp;60 secondes</span>
          </p>
          <div style={P.tiers}>
            {([
              ['⚡ Éclair',  '< 350 ms', '+15', '#fff176'],
              ['🔥 Rapide',  '< 650 ms', '+10', '#ffa040'],
              ['✓ Bien',     '< 1.1 s',  '+5',  '#4ade80'],
              ['🐢 Lent',    '≥ 1.1 s',  '+0',  '#94a3b8'],
            ] as [string, string, string, string][]).map(([lbl, time, pts, c]) => (
              <div key={lbl} style={{ ...P.tierChip, borderColor: c + '44', color: c }}>
                <span style={{ fontWeight: 800 }}>{lbl}</span>
                <span style={{ opacity: .65, fontSize: 10 }}>{time}</span>
                <span style={{ fontWeight: 900 }}>{pts}</span>
              </div>
            ))}
          </div>
          {best > 0 && <div style={P.best}>🏆 Record : <strong>{best}</strong></div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <button onClick={beginCountdown} style={P.playBtn}>Jouer</button>
          <button onClick={onQuit}         style={P.quitBtn}>Quitter</button>
        </div>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════════════════
     COUNTDOWN
  ════════════════════════════════════════════════════════════════════ */
  if (phase === 'countdown') return (
    <div style={P.wrap}>
      <style>{ANIM}</style>
      <div style={P.cdRow}>
        <span
          key={String(cdNum)}
          className={cdNum === 'GO!' ? 'cs-go' : 'cs-count'}
          style={{ ...P.cdNum, color: cdNum === 'GO!' ? '#4ade80' : '#fff' }}
        >
          {cdNum}
        </span>
        {cdNum !== 'GO!' && <span style={P.cdSub}>préparez-vous…</span>}
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════════════════
     FINISHED
  ════════════════════════════════════════════════════════════════════ */
  if (phase === 'finished') return (
    <div style={P.wrap}>
      <style>{ANIM}</style>
      <div style={P.finRow}>
        <div style={P.statGrid}>
          {([
            ['Score',    score,      '#fff'    ],
            ['Manqués',  missed,     '#ef4444' ],
            ['Éclairs',  lightnings, '#fff176' ],
            ['Record',   best,       '#fbbf24' ],
          ] as [string, number, string][]).map(([k, v, c]) => (
            <div key={k} style={P.statCard}>
              <div style={P.statLbl}>{k}</div>
              <div style={{ ...P.statVal, color: c }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <button onClick={beginCountdown} style={P.playBtn}>Rejouer</button>
          <button onClick={onQuit}         style={P.quitBtn}>Menu</button>
        </div>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════════════════
     PLAYING — barre glass ultra-minimale
  ════════════════════════════════════════════════════════════════════ */
  return (
    <div style={P.wrap}>
      <style>{ANIM}</style>

      {/* ── Timer bar ── */}
      <div style={P.timerTrack}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 3,
          background: `linear-gradient(90deg, ${tColor}55, ${tColor})`,
          boxShadow: `0 0 8px ${tColor}55`,
          transition: 'width 1s linear, background .5s',
          animation: urgentAnim,
        }} />
      </div>

      <div style={P.row}>
        {/* Time */}
        <div style={{ ...P.timeDig, color: tColor, animation: urgentAnim }}>{timeLeft}s</div>

        {/* Score + bubbles + speed label */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div key={popKey} className="cs-pop" style={P.scoreNum}>{score}</div>
          <div style={P.ptsLbl}>pts</div>

          {/* Speed label */}
          {speedLbl && (
            <div key={speedLbl.label} className="cs-speed" style={{
              position: 'absolute', bottom: -22, left: '50%',
              whiteSpace: 'nowrap', fontSize: 11, fontWeight: 800,
              color: speedLbl.color, letterSpacing: '.04em',
              textShadow: `0 0 10px ${speedLbl.glow}`,
            }}>
              {speedLbl.label}
            </div>
          )}

          {/* Floating score bubbles */}
          <div style={{ position: 'absolute', top: 0, left: '50%', pointerEvents: 'none', width: 0 }}>
            {bubbles.map(b => (
              <div key={b.id} className="cs-rise" style={{
                position: 'absolute', top: 0, left: 0,
                background: `linear-gradient(135deg,${b.color}28,${b.color}0c)`,
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                border: `1px solid ${b.color}50`,
                borderRadius: 12, padding: '5px 12px',
                fontSize: 16, fontWeight: 900, color: b.color,
                boxShadow: `0 4px 18px ${b.glow}, inset 0 1px 0 rgba(255,255,255,.12)`,
                whiteSpace: 'nowrap',
              }}>
                {b.text}
              </div>
            ))}
          </div>
        </div>

        {/* Right — combo + stop */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {combo > 1 && (
            <div key={combo} className="cs-combo" style={P.comboBadge}>×{combo}</div>
          )}
          <button onClick={() => {
            window.clearInterval(gameTimerRef.current);
            window.clearTimeout(tileTimerRef.current);
            if (activeTileRef.current !== null) onTurnOff(activeTileRef.current);
            onTurnOffAll();
            onQuit();
          }} style={P.stopBtn}>⏹</button>
        </div>
      </div>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────── */
const P: Record<string, React.CSSProperties> = {
  wrap: {
    background: 'linear-gradient(160deg,rgba(8,12,24,.94) 0%,rgba(10,14,32,.90) 100%)',
    backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
    border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 20, overflow: 'hidden',
    fontFamily: 'system-ui,-apple-system,sans-serif', color: '#e8eaf0',
  },

  /* Timer bar */
  timerTrack: {
    height: 3, background: 'rgba(255,255,255,.07)',
    borderRadius: '20px 20px 0 0', overflow: 'hidden',
  },

  /* Playing row */
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 22px 20px', gap: 16,
  },
  timeDig: {
    fontSize: 14, fontWeight: 800, minWidth: 38, letterSpacing: '.03em', transition: 'color .3s',
  },
  scoreNum: {
    fontSize: 46, fontWeight: 900, lineHeight: 1, letterSpacing: '-.02em', color: '#fff',
    textShadow: '0 0 24px rgba(255,255,255,.2)',
  },
  ptsLbl: {
    fontSize: 10, color: 'rgba(255,255,255,.32)', fontWeight: 700,
    letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 2,
  },
  comboBadge: {
    background: 'linear-gradient(135deg,rgba(251,191,36,.28),rgba(251,191,36,.10))',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(251,191,36,.55)', borderRadius: 10,
    padding: '4px 12px', fontSize: 13, fontWeight: 900, color: '#fbbf24',
    boxShadow: '0 0 14px rgba(251,191,36,.35), inset 0 1px 0 rgba(255,255,255,.10)',
    letterSpacing: '.03em',
  },
  stopBtn: {
    padding: '6px 12px', borderRadius: 10,
    border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.05)',
    color: 'rgba(255,255,255,.5)', fontSize: 13, cursor: 'pointer',
  },

  /* Countdown */
  cdRow: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '18px 22px', gap: 6,
  },
  cdNum: {
    fontSize: 52, fontWeight: 900, lineHeight: 1,
    textShadow: '0 0 40px rgba(255,255,255,.4)',
  },
  cdSub: {
    fontSize: 12, color: 'rgba(255,255,255,.4)', fontWeight: 600, letterSpacing: '.06em',
  },

  /* Ready */
  readyRow: {
    display: 'flex', alignItems: 'flex-start', gap: 20, padding: '18px 22px',
  },
  tag: {
    display: 'inline-block',
    background: 'linear-gradient(135deg,rgba(99,102,241,.3),rgba(139,92,246,.18))',
    border: '1px solid rgba(139,92,246,.4)', borderRadius: 8,
    padding: '3px 10px', fontSize: 12, fontWeight: 800, color: '#a78bfa',
    marginBottom: 8, letterSpacing: '.04em',
  },
  rules: {
    fontSize: 13, color: 'rgba(255,255,255,.62)', lineHeight: 1.65, margin: '0 0 10px',
  },
  aside: { color: 'rgba(255,255,255,.35)', marginLeft: 6 },
  tiers: {
    display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 10,
  },
  tierChip: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'rgba(255,255,255,.04)', border: '1px solid',
    borderRadius: 8, padding: '4px 10px', fontSize: 12,
  },
  best: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: 'rgba(251,191,36,.10)', border: '1px solid rgba(251,191,36,.3)',
    borderRadius: 8, padding: '3px 10px', fontSize: 12, color: '#fbbf24',
  },
  playBtn: {
    padding: '11px 26px', borderRadius: 14, border: 'none',
    background: 'linear-gradient(135deg,#4361ee,#7c3aed)',
    boxShadow: '0 4px 20px rgba(99,102,241,.45), inset 0 1px 0 rgba(255,255,255,.15)',
    color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', letterSpacing: '.02em',
  },
  quitBtn: {
    padding: '10px 20px', borderRadius: 14,
    border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    color: 'rgba(255,255,255,.7)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
  },

  /* Finished */
  finRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 20, padding: '16px 22px', flexWrap: 'wrap' as const,
  },
  statGrid: { display: 'flex', gap: 10, flexWrap: 'wrap' as const },
  statCard: {
    background: 'rgba(255,255,255,.05)', backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 12, padding: '8px 16px', textAlign: 'center' as const, minWidth: 72,
  },
  statLbl: {
    fontSize: 10, color: 'rgba(255,255,255,.38)', fontWeight: 700,
    textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 3,
  },
  statVal: { fontSize: 22, fontWeight: 900 },
};
