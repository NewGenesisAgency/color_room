'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';

// ── Types (miroir de lib/spectre.ts) ────────────────────────────────────────
type SpSeat = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type SpPhase = 'lobby' | 'reveal' | 'guess' | 'result' | 'finished';
type SpPlayer = {
  seat: SpSeat; name: string;
  guessR: number; guessG: number; guessB: number;
  submitted: boolean; roundScore: number; totalScore: number;
};
type SpState = {
  gameId: 'spectre'; phase: SpPhase; round: number; maxRounds: number;
  targetR: number; targetG: number; targetB: number;
  revealDurationMs: number; guessDurationMs: number; phaseEndsAtMs: number;
  players: Partial<Record<SpSeat, SpPlayer>>; createdAt: string;
};

// ── Utilitaires couleur ──────────────────────────────────────────────────────
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sn = s / 100, ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60)       { r1 = c; g1 = x; }
  else if (h < 120) { r1 = x; g1 = c; }
  else if (h < 180) { g1 = c; b1 = x; }
  else if (h < 240) { g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; b1 = c; }
  else              { r1 = c; b1 = x; }
  return {
    r: Math.max(0, Math.min(255, Math.round((r1 + m) * 255))),
    g: Math.max(0, Math.min(255, Math.round((g1 + m) * 255))),
    b: Math.max(0, Math.min(255, Math.round((b1 + m) * 255))),
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function colorScore(tR: number, tG: number, tB: number, gR: number, gG: number, gB: number): number {
  const dr = tR - gR, dg = tG - gG, db = tB - gB;
  return Math.round(Math.max(0, (1 - Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3 * 255 * 255)) * 1000));
}

function rgb(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function wavelengthToRgb01(wl: number): [number, number, number] {
  const w = Math.max(380, Math.min(780, wl));
  let r = 0, g = 0, b = 0;
  if (w < 440)      { r = (440 - w) / 60; b = 1; }
  else if (w < 490) { g = (w - 440) / 50; b = 1; }
  else if (w < 510) { g = 1; b = (510 - w) / 20; }
  else if (w < 580) { r = (w - 510) / 70; g = 1; }
  else if (w < 645) { r = 1; g = (645 - w) / 65; }
  else              { r = 1; }
  const f = w < 420 ? 0.3 + 0.7 * (w - 380) / 40 : w > 700 ? 0.3 + 0.7 * (780 - w) / 80 : 1;
  const gm = 0.8;
  return [Math.pow(r * f, gm), Math.pow(g * f, gm), Math.pow(b * f, gm)];
}

// ── Envoyer couleur aux plaques lumineuses ──────────────────────────────────
function rgbToChannels32(r: number, g: number, b: number, intensity: number): number[] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const sc = intensity / 100;
  const y = Math.min(rn, gn), w = (rn + gn + bn) / 3;
  const ch = Array(32).fill(0);
  ch[0] = Math.round(bn * 255 * 1.0 * sc);
  ch[1] = Math.round(bn * 255 * 0.85 * sc);
  ch[4] = Math.round(bn * 255 * 0.8 * sc);
  ch[5] = Math.round(gn * 255 * 1.0 * sc);
  ch[6] = Math.round(gn * 255 * 0.75 * sc);
  ch[7] = Math.round(y * 255 * 1.0 * sc);
  ch[8] = Math.round(y * 255 * 0.85 * sc);
  ch[10] = Math.round(rn * 255 * 0.7 * sc);
  ch[11] = Math.round(rn * 255 * 1.0 * sc);
  ch[12] = Math.round(rn * 255 * 0.9 * sc);
  ch[18] = Math.round(y * 255 * 0.9 * sc);
  ch[19] = Math.round(y * 255 * 0.75 * sc);
  ch[25] = Math.round(w * 255 * 1.0 * sc);
  ch[26] = Math.round(w * 255 * 0.85 * sc);
  return ch.map((v) => Math.max(0, Math.min(255, v)));
}

async function sendColorToAllPlates(r: number, g: number, b: number, intensity = 85) {
  const channels = rgbToChannels32(r, g, b, intensity);
  const channelArray = channels
    .map((v, i) => ({ index: i, value: v }))
    .filter((c) => c.value > 0);
  for (let plateId = 1; plateId <= 42; plateId++) {
    fetch('/api/supervision/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plateId, channels: channelArray }),
      cache: 'no-store',
    }).catch(() => {});
  }
}

async function clearAllPlates() {
  const channels = Array.from({ length: 32 }, (_, i) => ({ index: i, value: 0 }));
  for (let plateId = 1; plateId <= 42; plateId++) {
    fetch('/api/supervision/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plateId, channels }),
      cache: 'no-store',
    }).catch(() => {});
  }
}

// ── Constantes visuelles ──────────────────────────────────────────────────────
const SEAT_COLORS = ['#ff4488','#44aaff','#44ffaa','#ffaa44','#aa44ff','#ff8844','#44ffff','#ffff44'];
const PHASE_LABELS: Record<SpPhase, string> = {
  lobby: 'Salle d\'attente', reveal: 'Mémorisation', guess: 'Reproduction',
  result: 'Résultats', finished: 'Fin de partie',
};

// ── Composant principal ───────────────────────────────────────────────────────
export default function SpectrePage() {
  const [view, setView] = useState<'login' | 'game'>('login');
  const [nameInput, setNameInput] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [loginMode, setLoginMode] = useState<'create' | 'join'>('create');
  const [maxRoundsInput, setMaxRoundsInput] = useState(5);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [token, setToken] = useState('');
  const [seat, setSeat] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [gameState, setGameState] = useState<SpState | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'active' | 'finished'>('active');
  const [players, setPlayers] = useState<Array<{ seat: number; name: string }>>([]);

  const [myH, setMyH] = useState(200);
  const [myS, setMyS] = useState(70);
  const [myL, setMyL] = useState(45);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const pollRef = useRef<number>(0);
  const lastPhaseRef = useRef<SpPhase | null>(null);
  const hardwareSentRef = useRef(false);

  // ── Restauration de session depuis localStorage ───────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem('sp_session');
      if (!saved) return;
      const parsed = JSON.parse(saved) as { token: string; seat: number; sessionId: string; savedAt: number };
      if (!parsed.token || !parsed.sessionId) return;
      // Expire après 2h
      if (Date.now() - parsed.savedAt > 2 * 60 * 60 * 1000) {
        window.localStorage.removeItem('sp_session');
        return;
      }
      setToken(parsed.token);
      setSeat(parsed.seat);
      setSessionId(parsed.sessionId);
      setView('game');
    } catch { /* ignore */ }
  }, []);

  const myRgb = useMemo(() => hslToRgb(myH, myS, myL), [myH, myS, myL]);

  // ── Polling state ─────────────────────────────────────────────────────────
  const pollState = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/spectre/state?token=${encodeURIComponent(token)}&_=${Date.now()}`);
      const data = await res.json();
      if (!data.ok) return;
      const st: SpState = data.state;
      setGameState(st);
      setSessionStatus(data.status);
      setPlayers(data.players ?? []);
      if (seat && st.players?.[seat as SpSeat]) {
        setSubmitted(st.players[seat as SpSeat]!.submitted);
      }
      if (st.phaseEndsAtMs > 0) {
        setTimeLeft(Math.max(0, Math.round((st.phaseEndsAtMs - Date.now()) / 1000)));
      } else {
        setTimeLeft(0);
      }
    } catch { /* ignore */ }
  }, [token, seat]);

  useEffect(() => {
    if (!token) return;
    pollState();
    pollRef.current = window.setInterval(pollState, 1500);
    return () => window.clearInterval(pollRef.current);
  }, [token, pollState]);

  // ── Countdown ticker ──────────────────────────────────────────────────────
  useEffect(() => {
    const id = window.setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // ── Hardware sync on phase change ─────────────────────────────────────────
  useEffect(() => {
    if (!gameState) return;
    const phase = gameState.phase;
    if (phase === lastPhaseRef.current) return;
    lastPhaseRef.current = phase;
    hardwareSentRef.current = false;

    if (phase === 'reveal') {
      sendColorToAllPlates(gameState.targetR, gameState.targetG, gameState.targetB);
      hardwareSentRef.current = true;
    } else if (phase === 'guess' || phase === 'lobby') {
      clearAllPlates();
    } else if (phase === 'result') {
      clearAllPlates();
    }
  }, [gameState]);

  // ── Live preview color on plates during guess ─────────────────────────────
  const liveHwTimerRef = useRef<number>(0);
  useEffect(() => {
    if (gameState?.phase !== 'guess' || submitted) return;
    window.clearTimeout(liveHwTimerRef.current);
    liveHwTimerRef.current = window.setTimeout(() => {
      sendColorToAllPlates(myRgb.r, myRgb.g, myRgb.b, 60);
    }, 120);
    return () => window.clearTimeout(liveHwTimerRef.current);
  }, [myRgb, gameState?.phase, submitted]);

  // ── Actions ──────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!nameInput.trim()) { setError('Entrez votre prénom'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/spectre/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim(), maxRounds: maxRoundsInput }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? 'Erreur création'); return; }
      setToken(data.token);
      setSeat(data.seat);
      setSessionId(data.sessionId);
      window.localStorage.setItem('sp_session', JSON.stringify({ token: data.token, seat: data.seat, sessionId: data.sessionId, savedAt: Date.now() }));
      setView('game');
    } catch { setError('Erreur réseau'); } finally { setLoading(false); }
  }

  async function handleJoin() {
    if (!nameInput.trim()) { setError('Entrez votre prénom'); return; }
    if (!joinCodeInput.trim()) { setError('Entrez le code de la salle'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/spectre/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: joinCodeInput.trim(), name: nameInput.trim() }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error === 'join_failed' ? 'Salle introuvable ou jeu déjà commencé' : data.error ?? 'Erreur'); return; }
      setToken(data.token);
      setSeat(data.seat);
      setSessionId(joinCodeInput.trim());
      window.localStorage.setItem('sp_session', JSON.stringify({ token: data.token, seat: data.seat, sessionId: joinCodeInput.trim(), savedAt: Date.now() }));
      setView('game');
    } catch { setError('Erreur réseau'); } finally { setLoading(false); }
  }

  async function handleAdvance() {
    await fetch('/api/spectre/advance', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    await pollState();
  }

  async function handleSubmitGuess() {
    if (submitted) return;
    await fetch('/api/spectre/guess', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, r: myRgb.r, g: myRgb.g, b: myRgb.b }),
    });
    setSubmitted(true);
    await pollState();
  }

  async function handleStop() {
    await fetch('/api/spectre/stop', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    await pollState();
  }

  async function handleRestart() {
    setLoading(true);
    const res = await fetch('/api/spectre/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, name: nameInput.trim(), reset: true, maxRounds: maxRoundsInput }),
    });
    const data = await res.json();
    if (data.ok) {
      setSessionId(data.sessionId);
      setSubmitted(false);
      setMyH(200); setMyS(70); setMyL(45);
    }
    setLoading(false);
    await pollState();
  }

  const isHost = seat === 1;

  // ────────────────────────────────────────────────────────────────────────────
  // LOGIN SCREEN
  // ────────────────────────────────────────────────────────────────────────────
  if (view === 'login') {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0a0a1a 0%,#111133 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif' }}>
        <div style={{ width: 420, padding: 40, borderRadius: 24, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🌈</div>
            <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, margin: 0 }}>Spectre Chromatique</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 8, fontSize: 14 }}>Reproduisez la couleur cible sur le spectre lumineux</p>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {(['create', 'join'] as const).map((m) => (
              <button key={m} onClick={() => setLoginMode(m)} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, background: loginMode === m ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'rgba(255,255,255,0.08)', color: loginMode === m ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'all 0.2s' }}>
                {m === 'create' ? '✦ Créer une salle' : '→ Rejoindre'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              value={nameInput} onChange={(e) => setNameInput(e.target.value)}
              placeholder="Votre prénom"
              style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 15, outline: 'none' }}
            />
            {loginMode === 'join' && (
              <input
                value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value)}
                placeholder="Code de la salle (ID session)"
                style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'monospace' }}
              />
            )}
            {loginMode === 'create' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, whiteSpace: 'nowrap' }}>Nombre de manches :</span>
                <input type="number" min={1} max={10} value={maxRoundsInput} onChange={(e) => setMaxRoundsInput(Number(e.target.value))}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 15, outline: 'none' }} />
              </div>
            )}
            {error && <p style={{ color: '#ff6b6b', fontSize: 13, margin: 0 }}>⚠ {error}</p>}
            <button onClick={loginMode === 'create' ? handleCreate : handleJoin} disabled={loading}
              style={{ padding: '16px', borderRadius: 14, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 16, background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', opacity: loading ? 0.7 : 1, transition: 'all 0.2s' }}>
              {loading ? '…' : loginMode === 'create' ? '✦ Créer la salle' : '→ Rejoindre'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18 }}>Connexion…</div>
      </div>
    );
  }

  const sortedPlayers = Object.values(gameState.players).filter(Boolean) as SpPlayer[];
  sortedPlayers.sort((a, b) => b.totalScore - a.totalScore);
  const myPlayerState = seat ? gameState.players[seat as SpSeat] : null;
  const targetCss = rgb(gameState.targetR, gameState.targetG, gameState.targetB);

  // ────────────────────────────────────────────────────────────────────────────
  // LOBBY
  // ────────────────────────────────────────────────────────────────────────────
  if (gameState.phase === 'lobby') {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0a0a1a,#111133)', fontFamily: 'system-ui,sans-serif', padding: 40, boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🌈</div>
            <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: 0 }}>Spectre Chromatique</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 8 }}>Salle d&apos;attente · Manche {gameState.maxRounds} ×</p>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 24, marginBottom: 20 }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px' }}>Code de la salle</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <code style={{ flex: 1, color: '#a78bfa', fontSize: 12, background: 'rgba(167,139,250,0.1)', padding: '10px 14px', borderRadius: 10, wordBreak: 'break-all' }}>{sessionId}</code>
              <button onClick={() => navigator.clipboard.writeText(sessionId)} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 13 }}>Copier</button>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 24, marginBottom: 24 }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 16px' }}>Joueurs connectés ({players.length})</p>
            {players.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>En attente de joueurs…</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {players.map((p) => (
                  <div key={p.seat} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: p.seat === seat ? 'rgba(102,126,234,0.15)' : 'rgba(255,255,255,0.04)', border: p.seat === seat ? '1px solid rgba(102,126,234,0.4)' : '1px solid transparent' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: SEAT_COLORS[(p.seat - 1) % 8] }} />
                    <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{p.name}</span>
                    {p.seat === 1 && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#ffd700' }}>👑 Hôte</span>}
                    {p.seat === seat && p.seat !== 1 && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>← Vous</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {isHost ? (
            <button onClick={handleAdvance} disabled={players.length < 1}
              style={{ width: '100%', padding: '18px', borderRadius: 16, border: 'none', cursor: players.length < 1 ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 17, background: players.length < 1 ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', opacity: players.length < 1 ? 0.5 : 1, transition: 'all 0.2s' }}>
              🚀 Lancer la partie
            </button>
          ) : (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>En attente que l&apos;hôte lance la partie…</div>
          )}
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // REVEAL
  // ────────────────────────────────────────────────────────────────────────────
  if (gameState.phase === 'reveal') {
    return (
      <div style={{ minHeight: '100vh', background: targetCss, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif', transition: 'background 0.5s', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)' }} />
        <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
          <div style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', borderRadius: 24, padding: '32px 48px', border: '1px solid rgba(255,255,255,0.15)' }}>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 12px' }}>Manche {gameState.round} / {gameState.maxRounds}</p>
            <h1 style={{ color: '#fff', fontSize: 36, fontWeight: 900, margin: '0 0 8px' }}>Mémorisez cette couleur</h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, margin: '0 0 24px' }}>La couleur disparaît dans…</p>
            <div style={{ fontSize: 72, fontWeight: 900, color: '#fff', lineHeight: 1, textShadow: '0 0 40px rgba(255,255,255,0.5)' }}>{timeLeft}</div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 12 }}>secondes</p>
          </div>
          {isHost && (
            <button onClick={handleAdvance} style={{ marginTop: 20, padding: '12px 28px', borderRadius: 12, border: 'none', background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 14, backdropFilter: 'blur(10px)' }}>
              Passer →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // GUESS — Chromographe spectral
  // ────────────────────────────────────────────────────────────────────────────
  if (gameState.phase === 'guess') {
    const myCss = rgb(myRgb.r, myRgb.g, myRgb.b);
    const liveScore = colorScore(gameState.targetR, gameState.targetG, gameState.targetB, myRgb.r, myRgb.g, myRgb.b);
    const spectrumBars = Array.from({ length: 36 }, (_, i) => {
      const wl = 380 + i * 11;
      const [r01, g01, b01] = wavelengthToRgb01(wl);
      return `rgb(${Math.round(r01 * 255)},${Math.round(g01 * 255)},${Math.round(b01 * 255)})`;
    });
    const hueFraction = myH / 360;
    const markerX = Math.round(hueFraction * 100);

    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#07070f,#0d0d1e)', fontFamily: 'system-ui,sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', boxSizing: 'border-box' }}>
        {/* Header */}
        <div style={{ width: '100%', maxWidth: 540, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Manche {gameState.round}/{gameState.maxRounds} · Reproduction</span>
          </div>
          <div style={{ background: timeLeft <= 10 ? 'rgba(255,70,70,0.2)' : 'rgba(255,255,255,0.08)', border: `1px solid ${timeLeft <= 10 ? 'rgba(255,70,70,0.5)' : 'rgba(255,255,255,0.15)'}`, borderRadius: 20, padding: '6px 16px', color: timeLeft <= 10 ? '#ff6b6b' : '#fff', fontWeight: 800, fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>
            {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
        </div>

        {/* Main card */}
        <div style={{ width: '100%', maxWidth: 540, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 28, boxSizing: 'border-box' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '0 0 20px', textAlign: 'center' }}>
            Reproduisez la couleur que vous venez de voir
          </p>

          {/* Color preview */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'stretch' }}>
            <div style={{ flex: 1, minHeight: 100, borderRadius: 16, background: myCss, border: '2px solid rgba(255,255,255,0.15)', boxShadow: `0 0 40px ${myCss}44`, transition: 'background 0.15s, box-shadow 0.15s' }} />
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, minWidth: 100 }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Votre couleur</div>
              <code style={{ color: '#fff', fontSize: 12, background: 'rgba(255,255,255,0.08)', padding: '4px 8px', borderRadius: 6 }}>
                rgb({myRgb.r},{myRgb.g},{myRgb.b})
              </code>
              {!submitted && (
                <div style={{ color: liveScore >= 800 ? '#44ffaa' : liveScore >= 500 ? '#ffaa44' : '#ff6b6b', fontSize: 12, fontWeight: 700 }}>
                  ≈ {liveScore} pts
                </div>
              )}
            </div>
          </div>

          {/* Spectrum chromograph */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px' }}>Chromographe spectral — Teinte</p>
            <div style={{ position: 'relative', height: 36, borderRadius: 12, overflow: 'visible', marginBottom: 8 }}>
              <div style={{ height: '100%', borderRadius: 12, background: `linear-gradient(to right, ${spectrumBars.join(',')})`, border: '1px solid rgba(255,255,255,0.1)' }} />
              <div style={{ position: 'absolute', top: -4, left: `${markerX}%`, transform: 'translateX(-50%)', width: 4, height: 44, background: '#fff', borderRadius: 4, boxShadow: '0 0 8px rgba(255,255,255,0.8)', pointerEvents: 'none' }} />
              <input type="range" min={0} max={360} value={myH}
                onChange={(e) => !submitted && setMyH(Number(e.target.value))}
                disabled={submitted}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: submitted ? 'not-allowed' : 'pointer', margin: 0 }} />
            </div>
          </div>

          {/* Saturation slider */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Saturation</p>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 700 }}>{myS}%</span>
            </div>
            <div style={{ position: 'relative', height: 24, borderRadius: 12 }}>
              <div style={{ height: '100%', borderRadius: 12, background: `linear-gradient(to right, hsl(${myH},0%,${myL}%), hsl(${myH},100%,${myL}%))`, border: '1px solid rgba(255,255,255,0.1)' }} />
              <input type="range" min={0} max={100} value={myS}
                onChange={(e) => !submitted && setMyS(Number(e.target.value))}
                disabled={submitted}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: submitted ? 'not-allowed' : 'pointer', margin: 0 }} />
            </div>
          </div>

          {/* Lightness slider */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Luminosité</p>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 700 }}>{myL}%</span>
            </div>
            <div style={{ position: 'relative', height: 24, borderRadius: 12 }}>
              <div style={{ height: '100%', borderRadius: 12, background: `linear-gradient(to right, #000, hsl(${myH},${myS}%,50%), #fff)`, border: '1px solid rgba(255,255,255,0.1)' }} />
              <input type="range" min={5} max={95} value={myL}
                onChange={(e) => !submitted && setMyL(Number(e.target.value))}
                disabled={submitted}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: submitted ? 'not-allowed' : 'pointer', margin: 0 }} />
            </div>
          </div>

          {/* Submit */}
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '16px', borderRadius: 14, background: 'rgba(68,255,170,0.1)', border: '1px solid rgba(68,255,170,0.3)', color: '#44ffaa', fontWeight: 700, fontSize: 15 }}>
              ✓ Réponse soumise — En attente des autres joueurs…
            </div>
          ) : (
            <button onClick={handleSubmitGuess} style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 16, background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', boxShadow: `0 8px 30px ${myCss}55`, transition: 'all 0.2s' }}>
              ✓ Soumettre ma couleur
            </button>
          )}
        </div>

        {/* Player status strip */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {Object.values(gameState.players).filter(Boolean).map((p) => (
            <div key={p!.seat} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: `1px solid ${p!.submitted ? 'rgba(68,255,170,0.4)' : 'rgba(255,255,255,0.1)'}` }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: p!.submitted ? '#44ffaa' : 'rgba(255,255,255,0.3)' }} />
              <span style={{ color: p!.submitted ? '#44ffaa' : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600 }}>{p!.name}</span>
            </div>
          ))}
        </div>

        {isHost && (
          <button onClick={handleAdvance} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13 }}>
            Forcer la correction →
          </button>
        )}
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RESULT
  // ────────────────────────────────────────────────────────────────────────────
  if (gameState.phase === 'result') {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#07070f,#0d0d1e)', fontFamily: 'system-ui,sans-serif', padding: '32px 16px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 8px' }}>Manche {gameState.round} / {gameState.maxRounds} · Résultats</p>
            <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: 0 }}>Couleur cible</h2>
          </div>

          {/* Target color */}
          <div style={{ height: 80, borderRadius: 20, background: targetCss, marginBottom: 24, border: '2px solid rgba(255,255,255,0.15)', boxShadow: `0 0 60px ${targetCss}66` }} />

          {/* Player results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {sortedPlayers.map((p, i) => {
              const pCss = rgb(p.guessR, p.guessG, p.guessB);
              const accuracy = Math.round((p.roundScore / 1000) * 100);
              return (
                <div key={p.seat} style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${i === 0 ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 18, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: 20 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                      <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{p.roundScore} pts</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: pCss, border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                      <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${accuracy}%`, borderRadius: 4, background: accuracy >= 80 ? '#44ffaa' : accuracy >= 50 ? '#ffaa44' : '#ff6b6b', transition: 'width 0.5s' }} />
                      </div>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, minWidth: 40, textAlign: 'right' }}>{accuracy}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scores cumulés */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 20px', marginBottom: 20 }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px' }}>Score total</p>
            {sortedPlayers.map((p) => (
              <div key={p.seat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>{p.name}</span>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>{p.totalScore} pts</span>
              </div>
            ))}
          </div>

          {isHost && (
            <button onClick={handleAdvance} style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 16, background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff' }}>
              {gameState.round >= gameState.maxRounds ? '🏆 Voir le classement final →' : `Manche suivante →`}
            </button>
          )}
          {!isHost && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>En attente de l&apos;hôte…{timeLeft > 0 ? ` (${timeLeft}s)` : ''}</div>
          )}
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // FINISHED — Classement final
  // ────────────────────────────────────────────────────────────────────────────
  if (gameState.phase === 'finished' || sessionStatus === 'finished') {
    const winner = sortedPlayers[0];
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#07070f,#0d0d1e)', fontFamily: 'system-ui,sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: 520 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>🏆</div>
            <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 900, margin: '0 0 8px' }}>Partie terminée !</h1>
            {winner && <p style={{ color: '#ffd700', fontSize: 18, fontWeight: 700, margin: 0 }}>Vainqueur : {winner.name}</p>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {sortedPlayers.map((p, i) => (
              <div key={p.seat} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 24px', borderRadius: 18, background: i === 0 ? 'linear-gradient(135deg,rgba(255,215,0,0.15),rgba(255,165,0,0.1))' : 'rgba(255,255,255,0.05)', border: `1px solid ${i === 0 ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.08)'}` }}>
                <div style={{ fontSize: 28, minWidth: 40, textAlign: 'center' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>{p.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Siège {p.seat}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: i === 0 ? '#ffd700' : '#fff', fontWeight: 900, fontSize: 24 }}>{p.totalScore}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>points</div>
                </div>
              </div>
            ))}
          </div>

          {isHost && (
            <button onClick={handleRestart} disabled={loading} style={{ width: '100%', padding: '18px', borderRadius: 16, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 17, background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', opacity: loading ? 0.7 : 1 }}>
              🔄 Rejouer
            </button>
          )}
          {!isHost && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>En attente de l&apos;hôte pour rejouer…</div>
          )}

          <button onClick={() => { window.localStorage.removeItem('sp_session'); setView('login'); setToken(''); setGameState(null); setSeat(null); setSessionId(''); }}
            style={{ marginTop: 12, width: '100%', padding: '14px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontWeight: 600, fontSize: 15 }}>
            Quitter
          </button>
        </div>
      </div>
    );
  }

  return null;
}
