'use client';

/**
 * @file app/jouer/page.tsx
 * @brief Manette téléphone du mode multijoueur générique « 1 joueur = 1 plaque ».
 *
 * Page de contrôle côté joueur : on rejoint la session active, on reçoit un
 * siège (= sa plaque dans la salle) et un jeton, puis on choisit librement
 * une couleur qui s'allume en temps réel sur SA plaque. Dialogue avec l'API
 * /api/multiplayer/* : `join` (rejoindre), `submit` (envoyer la couleur
 * encodée 0xRRGGBB, avec debounce) et `state` (polling : nombre de joueurs,
 * détection de fin de session). Le jeton et le siège sont persistés en
 * localStorage pour restaurer la session après rafraîchissement.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Page de contrôle JOUEUR (téléphone) pour le multijoueur « 1 joueur = 1 plaque ».
 *
 * Le joueur rejoint la session active, reçoit un numéro de siège (= sa plaque)
 * et choisit une couleur ; celle-ci est envoyée en temps réel et s'allume sur
 * SA plaque dans la Color Room. La couleur RGB est encodée dans la valeur
 * entière soumise (0xRRGGBB) — aucun changement de schéma serveur requis.
 */

/**
 * @brief Compacte trois composantes RGB en un entier 0xRRGGBB.
 *
 * @param r Composante rouge (0–255).
 * @param g Composante verte (0–255).
 * @param b Composante bleue (0–255).
 * @returns L'entier encodant la couleur, transmissible à l'API.
 */
function packRgb(r: number, g: number, b: number): number {
  return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
}
/**
 * @brief Convertit une couleur hexadécimale (#rrggbb) en composantes RGB.
 *
 * @param hex Chaîne hexadécimale, avec ou sans '#'. Retourne du blanc si invalide.
 * @returns Un objet { r, g, b } avec des composantes 0–255.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { r: 255, g: 255, b: 255 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export default function JouerPage() {
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [seat, setSeat] = useState<number | null>(null);
  const [token, setToken] = useState('');
  const [color, setColor] = useState('#22d3ee');
  const [status, setStatus] = useState('');
  const [players, setPlayers] = useState<number>(0);
  const submitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restaure une session précédente
  useEffect(() => {
    try {
      const t = window.localStorage.getItem('crg_play_token');
      const s = window.localStorage.getItem('crg_play_seat');
      if (t && s) { setToken(t); setSeat(Number(s)); setJoined(true); }
    } catch { /* ignore */ }
  }, []);

  const join = useCallback(async () => {
    setStatus('Connexion…');
    try {
      const res = await fetch('/api/multiplayer/join', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'Joueur' }),
      });
      const d = await res.json();
      if (!d?.ok) { setStatus(d?.error || 'Impossible de rejoindre la partie.'); return; }
      setToken(d.token); setSeat(Number(d.seat)); setJoined(true); setStatus('');
      try { window.localStorage.setItem('crg_play_token', d.token); window.localStorage.setItem('crg_play_seat', String(d.seat)); } catch { /* ignore */ }
    } catch { setStatus('Erreur réseau.'); }
  }, [name]);

  // Envoi de la couleur (debounce léger pour le temps réel sans saturer).
  const sendColor = useCallback((hex: string) => {
    if (!token) return;
    if (submitTimer.current) clearTimeout(submitTimer.current);
    submitTimer.current = setTimeout(async () => {
      const { r, g, b } = hexToRgb(hex);
      try {
        await fetch('/api/multiplayer/submit', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token, value: packRgb(r, g, b) }),
        });
      } catch { /* ignore */ }
    }, 90);
  }, [token]);

  function onColor(hex: string) { setColor(hex); sendColor(hex); }

  // Garde la session vivante + nombre de joueurs
  useEffect(() => {
    if (!joined || !token) return;
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/multiplayer/state?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        if (res.status === 404) { // session terminée
          if (alive) { setJoined(false); setSeat(null); setToken(''); try { window.localStorage.removeItem('crg_play_token'); window.localStorage.removeItem('crg_play_seat'); } catch {} }
          return;
        }
        const d = await res.json();
        if (alive && d?.ok) {
          setPlayers(Array.isArray(d.players) ? d.players.length : 0);
          if (d.you?.seat) setSeat(Number(d.you.seat));
        }
      } catch { /* ignore */ }
      if (alive) setTimeout(poll, 3000);
    };
    void poll();
    return () => { alive = false; };
  }, [joined, token]);

  const presets = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06d6a0', '#22d3ee', '#3b82f6', '#7c3aed', '#ec4899', '#ffffff'];

  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(170deg,#0b0d16,#11131f)', color: '#fff', fontFamily: 'system-ui,sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 18px', boxSizing: 'border-box' }}>
      <div style={{ width: 'min(440px,100%)' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>Color Room</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 900 }}>Manette joueur</h1>
        </div>

        {!joined ? (
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 20 }}>
            <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, textAlign: 'center' }}>
              Rejoins la partie en cours. Tu pilotes <strong>une plaque</strong> de la Color Room : regarde la salle, pas l'écran.
            </p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton prénom"
              style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
            <button onClick={() => void join()} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 17, color: '#fff', background: 'linear-gradient(135deg,#06d6a0,#3b82f6)' }}>
              Rejoindre la partie
            </button>
            {status && <p style={{ marginTop: 12, fontSize: 13, color: '#fca5a5', textAlign: 'center' }}>{status}</p>}
          </div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Tu es le joueur <span style={{ color: '#22d3ee' }}>{seat ?? '?'}</span></div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{players} joueur{players > 1 ? 's' : ''}</div>
            </div>

            <div style={{ width: '100%', height: 120, borderRadius: 16, background: color, boxShadow: `0 0 50px ${color}88`, marginBottom: 16, border: '1px solid rgba(255,255,255,0.15)' }} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 14 }}>
              {presets.map((c) => (
                <button key={c} onClick={() => onColor(c)} aria-label={c}
                  style={{ aspectRatio: '1', borderRadius: 12, border: color.toLowerCase() === c.toLowerCase() ? '3px solid #fff' : '1px solid rgba(255,255,255,0.15)', background: c, cursor: 'pointer' }} />
              ))}
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              Couleur libre
              <input type="color" value={color} onChange={(e) => onColor(e.target.value)} style={{ width: 54, height: 40, border: 'none', background: 'none', cursor: 'pointer' }} />
            </label>

            <p style={{ marginTop: 16, fontSize: 12.5, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 1.5 }}>
              👁️ Ta couleur s'allume sur ta plaque dans la <strong>Color Room</strong>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
