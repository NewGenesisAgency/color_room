'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const COLS = 6;
const ROWS = 7;
// Couleurs classiques Puissance 4 — identiques à celles affichées sur les dalles.
const COLOR_R = '#ff1818';   // rouge
const COLOR_J = '#ffc400';   // jaune

type Cell = '' | 'R' | 'J';

export default function P4PhonePage() {
  const [roomId, setRoomId] = useState('');
  const [token, setToken] = useState('');
  const [disc, setDisc] = useState<'R' | 'J' | null>(null);
  const [board, setBoard] = useState<Cell[]>(Array(COLS * ROWS).fill(''));
  const [turn, setTurn] = useState<'R' | 'J'>('R');
  const [winner, setWinner] = useState<'R' | 'J' | 'draw' | null>(null);
  const [status, setStatus] = useState<'waiting' | 'playing' | 'finished'>('waiting');
  const [msg, setMsg] = useState('');
  const tokenRef = useRef('');

  // Récupère la salle depuis l'URL puis rejoint (ou restaure le siège au refresh).
  useEffect(() => {
    const rid = new URLSearchParams(window.location.search).get('room') || '';
    if (!rid) { setMsg('Lien invalide : scanne le QR affiché dans la Color Room.'); return; }
    setRoomId(rid);
    // Restauration : si on a déjà rejoint cette salle, on ne re-rejoint pas (sinon double-join).
    try {
      const saved = window.localStorage.getItem(`crg_p4_${rid}`);
      if (saved) { const o = JSON.parse(saved); if (o?.token && o?.disc) { setToken(o.token); tokenRef.current = o.token; setDisc(o.disc); return; } }
    } catch { /* ignore */ }
    (async () => {
      try {
        const res = await fetch('/api/p4/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ roomId: rid }) });
        const d = await res.json();
        if (!d?.ok) { setMsg(d?.error === 'room_full' ? 'La partie est déjà complète (2 joueurs).' : 'Impossible de rejoindre.'); return; }
        setToken(d.token); tokenRef.current = d.token; setDisc(d.disc);
        try { window.localStorage.setItem(`crg_p4_${rid}`, JSON.stringify({ token: d.token, disc: d.disc })); } catch { /* ignore */ }
      } catch { setMsg('Erreur réseau.'); }
    })();
  }, []);

  // Poll de l'état.
  useEffect(() => {
    if (!roomId) return;
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/p4/state?roomId=${encodeURIComponent(roomId)}${tokenRef.current ? `&token=${tokenRef.current}` : ''}`, { cache: 'no-store' });
        const d = await res.json();
        if (alive && d?.ok) { setBoard(d.board); setTurn(d.turn); setWinner(d.winner); setStatus(d.status); }
      } catch { /* ignore */ }
      if (alive) setTimeout(poll, 1000);
    };
    void poll();
    return () => { alive = false; };
  }, [roomId]);

  const play = useCallback(async (col: number) => {
    if (!token || winner || status !== 'playing' || turn !== disc) return;
    try {
      const res = await fetch('/api/p4/move', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ roomId, token, col }) });
      const d = await res.json();
      if (d?.ok) { setBoard(d.board); setTurn(d.turn); setWinner(d.winner); setStatus(d.status); }
    } catch { /* ignore */ }
  }, [token, winner, status, turn, disc, roomId]);

  const myColor = disc === 'R' ? COLOR_R : COLOR_J;
  const myTurn = status === 'playing' && !winner && turn === disc;
  const columnFull = (c: number) => board[c] !== '';

  let banner = '';
  if (msg) banner = msg;
  else if (status === 'waiting') banner = 'En attente du 2e joueur…';
  else if (winner === 'draw') banner = 'Match nul !';
  else if (winner) banner = winner === disc ? '🏆 Tu as gagné !' : 'Perdu… 😅';
  else if (myTurn) banner = '👉 À toi de jouer';
  else banner = "Au tour de l'adversaire…";

  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(170deg,#0b0d16,#11131f)', color: '#fff', fontFamily: 'system-ui,sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '22px 16px', boxSizing: 'border-box' }}>
      <div style={{ width: 'min(440px,100%)' }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>Color Room · Puissance 4</div>
          {disc && <div style={{ marginTop: 6, fontSize: 15, fontWeight: 800 }}>Tu joues <span style={{ color: myColor }}>{disc === 'R' ? 'Rouge' : 'Jaune'}</span></div>}
        </div>

        <div style={{ padding: '12px 14px', borderRadius: 14, textAlign: 'center', fontWeight: 800, fontSize: 16, marginBottom: 14,
          background: myTurn ? 'rgba(34,197,94,0.16)' : 'rgba(255,255,255,0.05)', border: `1px solid ${myTurn ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`, color: myTurn ? '#86efac' : '#fff' }}>
          {banner}
        </div>

        {/* Pas de plateau à l'écran : on regarde la Color Room.
            On garde seulement les 6 colonnes pour déposer un jeton. */}
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
          Choisis une colonne :
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS},1fr)`, gap: 7 }}>
          {Array.from({ length: COLS }, (_, c) => (
            <button key={c} onClick={() => void play(c)} disabled={!myTurn || columnFull(c)}
              style={{ aspectRatio: '0.62', borderRadius: 12, border: 'none', cursor: myTurn && !columnFull(c) ? 'pointer' : 'not-allowed',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                fontSize: 26, fontWeight: 900, color: '#fff',
                background: myTurn && !columnFull(c) ? `linear-gradient(160deg,${myColor},${myColor}aa)` : 'rgba(255,255,255,0.06)',
                boxShadow: myTurn && !columnFull(c) ? `0 6px 20px ${myColor}66` : 'none',
                opacity: myTurn && !columnFull(c) ? 1 : 0.45, transition: 'opacity .15s' }}>
              <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>{c + 1}</span>
              ↓
            </button>
          ))}
        </div>

        <p style={{ marginTop: 18, fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.55 }}>
          👁️ Lève les yeux : le plateau est sur les dalles de la <strong>Color Room</strong>.
        </p>
      </div>
    </div>
  );
}
