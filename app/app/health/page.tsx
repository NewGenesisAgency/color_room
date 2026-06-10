'use client';

/**
 * @file app/health/page.tsx
 * @brief Page de santé & diagnostic des APIs et de test physique des plaques.
 *
 * Trois sections principales :
 *  - État de connexion : interroge /api/health?full=1 (manuellement ou en
 *    auto-refresh 5 s) et affiche l'état du serveur Next.js, de l'API
 *    Supervision (plaques LED) et de l'API CS-160 (colorimètre), avec latence
 *    et statut HTTP.
 *  - Test des plaques : balayage séquentiel des 42 plaques (1 → 42) pour
 *    vérifier câblage et numérotation, plus « tout allumer / tout éteindre » —
 *    via /api/supervision/batch.
 *  - Contrôle des canaux : 32 sliders (regroupés par bande spectrale) qui
 *    pilotent une plaque (ou toutes) avec envoi auto debouncé (200 ms).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity, RefreshCw, Loader2, CheckCircle2, XCircle, Server, Cpu, Lightbulb,
  Play, Square, Zap, Moon, Sliders, Wifi, Map,
} from 'lucide-react';
import NavigationMenu from '@/app/_components/NavigationMenu';

// ─── Métadonnées des 32 canaux LED (alignées sur /configuration) ──────────────
const CHANNEL_META: { label: string; color: string; group: string }[] = [
  { label: 'Violet 404nm',   color: '#8b5cf6', group: 'Violet/Bleu' },
  { label: 'Bleu 420nm',     color: '#7c3aed', group: 'Violet/Bleu' },
  { label: 'Bleu 450nm',     color: '#4361ee', group: 'Violet/Bleu' },
  { label: 'Cyan-bleu 470nm',color: '#2563eb', group: 'Violet/Bleu' },
  { label: 'Cyan 490nm',     color: '#0891b2', group: 'Violet/Bleu' },
  { label: 'Vert 520nm',     color: '#059669', group: 'Vert' },
  { label: 'Vert 550nm',     color: '#16a34a', group: 'Vert' },
  { label: 'Jaune-vert 570nm',color:'#ca8a04', group: 'Jaune' },
  { label: 'Jaune 585nm',    color: '#d97706', group: 'Jaune' },
  { label: 'Ambre 600nm',    color: '#ea580c', group: 'Jaune' },
  { label: 'Orange 620nm',   color: '#dc2626', group: 'Rouge' },
  { label: 'Rouge 640nm',    color: '#b91c1c', group: 'Rouge' },
  { label: 'Rouge 660nm',    color: '#991b1b', group: 'Rouge' },
  { label: 'Rouge 680nm',    color: '#7f1d1d', group: 'Rouge' },
  { label: 'Rouge profond 700nm', color: '#6b1919', group: 'Rouge' },
  { label: 'IR 720nm',       color: '#4a1515', group: 'Réservé' },
  { label: 'IR 740nm',       color: '#3a1010', group: 'Réservé' },
  { label: 'IR 760nm',       color: '#2a0a0a', group: 'Réservé' },
  { label: 'Jaune-blanc',    color: '#fbbf24', group: 'Blanc' },
  { label: 'Blanc chaud',    color: '#f59e0b', group: 'Blanc' },
  { label: 'Réservé 20',     color: '#94a3b8', group: 'Réservé' },
  { label: 'Réservé 21',     color: '#94a3b8', group: 'Réservé' },
  { label: 'Réservé 22',     color: '#94a3b8', group: 'Réservé' },
  { label: 'Réservé 23',     color: '#94a3b8', group: 'Réservé' },
  { label: 'Blanc jaunâtre', color: '#fef08a', group: 'Blanc' },
  { label: 'Blanc pur',      color: '#ffffff', group: 'Blanc' },
  { label: 'Blanc neutre',   color: '#f1f5f9', group: 'Blanc' },
  { label: 'Blanc froid',    color: '#e0f2fe', group: 'Blanc' },
  { label: 'Réservé 28',     color: '#94a3b8', group: 'Réservé' },
  { label: 'Réservé 29',     color: '#94a3b8', group: 'Réservé' },
  { label: 'Réservé 30',     color: '#94a3b8', group: 'Réservé' },
  { label: 'Gris clair',     color: '#cbd5e1', group: 'Blanc' },
];
const CH_GROUPS = ['Violet/Bleu', 'Vert', 'Jaune', 'Rouge', 'Blanc', 'Réservé'] as const;

const PLATE_COUNT = 42;

/** @brief Résultat de test de joignabilité d'une API (URL, statut, latence, erreur). */
type HealthApi = { url: string; reachable: boolean; httpStatus?: number; ms: number; error?: string };
/** @brief État global de santé (serveur web + deux APIs + horodatage du test). */
type HealthState = {
  serverOk: boolean;
  supervision: HealthApi | null;
  cs160: HealthApi | null;
  allReachable: boolean;
  checkedAt: number;
} | null;

/** @brief Promesse résolue après `ms` millisecondes (pause asynchrone). */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * @brief Envoie une même valeur sur tous les canaux d'une plaque (test on/off).
 *
 * @param plateId Identifiant de la plaque ciblée.
 * @param value Valeur appliquée à chacun des 32 canaux (0..255).
 * @param fast Mode rapide d'envoi (défaut true).
 * @returns true si la requête a réussi, false sinon.
 */
async function sendUniform(plateId: number, value: number, fast = true) {
  const channels = Array.from({ length: 32 }, (_, i) => ({ index: i, value }));
  return fetch('/api/supervision/batch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plateId, channels, fast, force: true }),
    cache: 'no-store',
  }).then((r) => r.ok).catch(() => false);
}

/**
 * @brief Composant de la page Santé & Diagnostic.
 *
 * Gère le test de santé des APIs (manuel/auto), le balayage et l'allumage
 * global des plaques, et le contrôle direct des 32 canaux.
 *
 * @returns L'arbre JSX de la page de diagnostic.
 */
export default function HealthPage() {
  // ── Connexion / santé ───────────────────────────────────────────────────────
  const [health, setHealth] = useState<HealthState>(null);
  const [checking, setChecking] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  /** @brief Interroge /api/health?full=1 et met à jour l'état de santé. */
  const runHealth = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/health?full=1', { cache: 'no-store' });
      const data = await res.json();
      setHealth({
        serverOk: res.ok && data?.status === 'ok',
        supervision: data?.apis?.supervision ?? null,
        cs160: data?.apis?.cs160 ?? null,
        allReachable: Boolean(data?.allReachable),
        checkedAt: Date.now(),
      });
    } catch {
      setHealth({ serverOk: false, supervision: null, cs160: null, allReachable: false, checkedAt: Date.now() });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { void runHealth(); }, [runHealth]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => { void runHealth(); }, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, runHealth]);

  // ── Test des plaques (balayage) ──────────────────────────────────────────────
  const [sweepRunning, setSweepRunning] = useState(false);
  const [sweepPlate, setSweepPlate] = useState<number | null>(null);
  const [sweepDelay, setSweepDelay] = useState(500);
  const [busyMsg, setBusyMsg] = useState('');
  const sweepStop = useRef(false);

  /** @brief Demande l'arrêt du balayage en cours. */
  const stopSweep = useCallback(() => { sweepStop.current = true; }, []);

  /**
   * @brief Lance le balayage séquentiel des 42 plaques (allume puis éteint chacune).
   *
   * Parcourt les plaques de 1 à PLATE_COUNT, attend `sweepDelay` ms par plaque,
   * et s'interrompt proprement si stopSweep est demandé.
   */
  const startSweep = useCallback(async () => {
    if (sweepRunning) return;
    sweepStop.current = false;
    setSweepRunning(true);
    setBusyMsg('');
    try {
      for (let id = 1; id <= PLATE_COUNT; id++) {
        if (sweepStop.current) break;
        setSweepPlate(id);
        await sendUniform(id, 200);
        await sleep(Math.max(120, sweepDelay));
        if (sweepStop.current) { await sendUniform(id, 0); break; }
        await sendUniform(id, 0);
      }
    } finally {
      setSweepPlate(null);
      setSweepRunning(false);
      sweepStop.current = false;
    }
  }, [sweepRunning, sweepDelay]);

  /** @brief Allume toutes les plaques (valeur 200 sur tous les canaux). */
  const allOn = useCallback(async () => {
    setBusyMsg('Allumage de toutes les plaques…');
    const plates = Array.from({ length: PLATE_COUNT }, (_, i) => ({
      plateId: i + 1,
      channels: Array.from({ length: 32 }, (_, c) => ({ index: c, value: 200 })),
    }));
    try {
      const res = await fetch('/api/supervision/batch', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plates, force: true }), cache: 'no-store',
      });
      setBusyMsg(res.ok ? '✓ Toutes les plaques allumées' : `✗ Erreur (${res.status})`);
    } catch { setBusyMsg('✗ Erreur réseau'); }
  }, []);

  /** @brief Éteint toutes les plaques (valeur 0 sur tous les canaux). */
  const allOff = useCallback(async () => {
    setBusyMsg('Extinction de toutes les plaques…');
    const plates = Array.from({ length: PLATE_COUNT }, (_, i) => ({
      plateId: i + 1,
      channels: Array.from({ length: 32 }, (_, c) => ({ index: c, value: 0 })),
    }));
    try {
      const res = await fetch('/api/supervision/batch', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plates, force: true }), cache: 'no-store',
      });
      setBusyMsg(res.ok ? '✓ Toutes les plaques éteintes' : `✗ Erreur (${res.status})`);
    } catch { setBusyMsg('✗ Erreur réseau'); }
  }, []);

  // ── Contrôle des 32 canaux ───────────────────────────────────────────────────
  const [channels, setChannels] = useState<number[]>(Array(32).fill(0));
  const [targetPlate, setTargetPlate] = useState<number>(0); // 0 = toutes
  const [sending, setSending] = useState(false);
  const [channelMsg, setChannelMsg] = useState('');
  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * @brief Envoie les 32 valeurs de canaux sur une plaque (ou toutes si plate=0).
   * @param chans Tableau des 32 valeurs de canaux.
   * @param plate Plaque ciblée (0 = toutes les plaques).
   */
  const sendChannels = useCallback(async (chans: number[], plate: number) => {
    setSending(true); setChannelMsg('');
    const channelArray = chans.map((v, i) => ({ index: i, value: Math.max(0, Math.min(255, Math.round(v))) }));
    const plates = plate === 0
      ? Array.from({ length: PLATE_COUNT }, (_, i) => ({ plateId: i + 1, channels: channelArray }))
      : [{ plateId: plate, channels: channelArray }];
    try {
      const res = await fetch('/api/supervision/batch', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plates, force: true }), cache: 'no-store',
      });
      setChannelMsg(res.ok ? `✓ Envoyé sur ${plate === 0 ? '42 plaques' : `plaque ${plate}`}` : `✗ Erreur (${res.status})`);
    } catch { setChannelMsg('✗ Erreur réseau'); }
    finally { setSending(false); }
  }, []);

  /**
   * @brief Met à jour un canal et planifie un envoi auto (debounce 200 ms).
   * @param idx Index du canal (0..31).
   * @param val Nouvelle valeur (0..255).
   */
  function setChannel(idx: number, val: number) {
    const next = channels.map((v, i) => (i === idx ? val : v));
    setChannels(next);
    if (sendTimeoutRef.current) clearTimeout(sendTimeoutRef.current);
    sendTimeoutRef.current = setTimeout(() => sendChannels(next, targetPlate), 200);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#f0f2ff 0%,#f8f0ff 100%)', fontFamily: 'system-ui,sans-serif' }}>
      <NavigationMenu />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '88px 20px 48px' }}>
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#059669,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Activity size={22} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#1a1a2e' }}>Santé & Diagnostic</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'rgba(0,0,0,0.5)' }}>Vérifiez la connexion aux APIs et testez les plaques / canaux</p>
          </div>
          <Link href="/salles"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9, border: '1px solid rgba(67,97,238,0.28)', background: 'rgba(67,97,238,0.08)', color: '#4361ee', fontWeight: 800, fontSize: 13, textDecoration: 'none', flexShrink: 0 }}>
            <Map size={15} /> Plan des salles
          </Link>
        </div>

        {/* ── État de connexion ─────────────────────────────────────────────── */}
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Wifi size={18} color="#059669" />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1a1a2e' }}>État de connexion</h2>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'rgba(0,0,0,0.6)', cursor: 'pointer' }}>
                <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
                Auto (5 s)
              </label>
              <button onClick={() => void runHealth()} disabled={checking}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#059669,#10b981)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: checking ? 'not-allowed' : 'pointer' }}>
                {checking ? <Loader2 size={14} className="hp-spin" /> : <RefreshCw size={14} />} Tester
              </button>
            </div>
          </div>

          <StatusRow icon={Server} label="Serveur web (Next.js)" ok={health?.serverOk ?? null}
            detail={health ? (health.serverOk ? 'En ligne' : 'Injoignable') : '—'} />
          <StatusRow icon={Lightbulb} label="API Supervision (plaques LED)" ok={health?.supervision?.reachable ?? null}
            detail={health?.supervision
              ? (health.supervision.reachable
                ? `Joignable · HTTP ${health.supervision.httpStatus ?? '?'} · ${health.supervision.ms} ms`
                : `Injoignable · ${health.supervision.error ?? 'erreur'} · ${health.supervision.ms} ms`)
              : '—'}
            sub={health?.supervision?.url} />
          <StatusRow icon={Cpu} label="API CS-160 (colorimètre)" ok={health?.cs160?.reachable ?? null}
            detail={health?.cs160
              ? (health.cs160.reachable
                ? `Joignable · HTTP ${health.cs160.httpStatus ?? '?'} · ${health.cs160.ms} ms`
                : `Injoignable · ${health.cs160.error ?? 'erreur'} · ${health.cs160.ms} ms`)
              : '—'}
            sub={health?.cs160?.url} last />

          {health && (
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, fontSize: 13.5, fontWeight: 700, textAlign: 'center',
              background: health.allReachable ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${health.allReachable ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.3)'}`,
              color: health.allReachable ? '#16a34a' : '#ef4444' }}>
              {health.allReachable ? 'Tout est connecté ✓' : 'Une ou plusieurs APIs sont injoignables — vérifiez les adresses dans Configuration et le réseau.'}
              <span style={{ display: 'block', fontWeight: 500, fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                Dernier test : {new Date(health.checkedAt).toLocaleTimeString()}
              </span>
            </div>
          )}
        </section>

        {/* ── Test des plaques ──────────────────────────────────────────────── */}
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Lightbulb size={18} color="#7c3aed" />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1a1a2e' }}>Test des plaques</h2>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'rgba(0,0,0,0.5)', lineHeight: 1.5 }}>
            Le <strong>balayage</strong> allume chaque plaque physique l'une après l'autre (1 → 42) pour vérifier le câblage et la numérotation.
          </p>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            {!sweepRunning ? (
              <button onClick={() => void startSweep()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                <Play size={16} /> Lancer le balayage
              </button>
            ) : (
              <button onClick={stopSweep}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                <Square size={16} /> Arrêter
              </button>
            )}
            <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', gap: 6 }}>
              Durée / plaque :
              <select value={sweepDelay} onChange={(e) => setSweepDelay(Number(e.target.value))} disabled={sweepRunning}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.15)', background: '#fff', fontSize: 13 }}>
                <option value={300}>0,3 s</option>
                <option value={500}>0,5 s</option>
                <option value={800}>0,8 s</option>
                <option value={1500}>1,5 s</option>
              </select>
            </label>
            {sweepRunning && sweepPlate != null && (
              <span style={{ fontSize: 14, fontWeight: 800, color: '#7c3aed' }}>
                Plaque {sweepPlate} / {PLATE_COUNT}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => void allOn()} disabled={sweepRunning}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#4361ee,#7c3aed)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: sweepRunning ? 'not-allowed' : 'pointer' }}>
              <Zap size={14} /> Tout allumer
            </button>
            <button onClick={() => void allOff()} disabled={sweepRunning}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9, border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.8)', color: '#1a1a2e', fontWeight: 800, fontSize: 13, cursor: sweepRunning ? 'not-allowed' : 'pointer' }}>
              <Moon size={14} /> Tout éteindre
            </button>
          </div>
          {busyMsg && <p style={{ margin: '12px 0 0', fontSize: 13, fontWeight: 700, color: busyMsg.startsWith('✗') ? '#ef4444' : '#059669' }}>{busyMsg}</p>}
        </section>

        {/* ── Contrôle des canaux ───────────────────────────────────────────── */}
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sliders size={18} color="#4361ee" />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1a1a2e' }}>Contrôle des canaux (32)</h2>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(0,0,0,0.6)' }}>Plaque :</label>
              <select value={targetPlate} onChange={(e) => setTargetPlate(Number(e.target.value))}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.15)', background: '#fff', fontSize: 13 }}>
                <option value={0}>Toutes (1-42)</option>
                {Array.from({ length: PLATE_COUNT }, (_, i) => <option key={i + 1} value={i + 1}>Plaque {i + 1}</option>)}
              </select>
              <button onClick={() => { const all = Array(32).fill(255); setChannels(all); void sendChannels(all, targetPlate); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#4361ee,#7c3aed)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                <Zap size={14} /> Max
              </button>
              <button onClick={() => { const all = Array(32).fill(0); setChannels(all); void sendChannels(all, targetPlate); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.8)', color: '#1a1a2e', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                <Moon size={14} /> 0
              </button>
              <button onClick={() => void sendChannels(channels, targetPlate)} disabled={sending}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, border: 'none', background: 'rgba(5,150,105,0.12)', color: '#059669', fontWeight: 800, fontSize: 13, cursor: sending ? 'not-allowed' : 'pointer' }}>
                {sending ? <Loader2 size={14} className="hp-spin" /> : <Activity size={14} />} Envoyer
              </button>
            </div>
          </div>
          {channelMsg && <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: channelMsg.startsWith('✓') ? '#059669' : '#ef4444' }}>{channelMsg}</p>}
          <p style={{ margin: '0 0 16px', fontSize: 12, color: 'rgba(0,0,0,0.45)', lineHeight: 1.5 }}>
            Chaque canal spectral (0-255). Les sliders envoient automatiquement (200 ms de debounce) sur la plaque sélectionnée.
          </p>

          {CH_GROUPS.map((group) => {
            const items = CHANNEL_META.map((m, i) => ({ ...m, idx: i })).filter((m) => m.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(0,0,0,0.45)', marginBottom: 8 }}>{group}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px 12px' }}>
                  {items.map(({ idx, label, color }) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0, display: 'inline-block' }} />
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,0,0,0.65)' }}>Ch.{idx} {label}</span>
                        </div>
                        <input type="number" min={0} max={255} value={channels[idx] ?? 0}
                          onChange={(e) => setChannel(idx, Math.max(0, Math.min(255, Number(e.target.value))))}
                          style={{ width: 44, padding: '1px 4px', borderRadius: 5, border: '1px solid rgba(0,0,0,0.12)', background: '#fff', fontSize: 11, textAlign: 'right', fontFamily: 'monospace' }} />
                      </div>
                      <input type="range" min={0} max={255} value={channels[idx] ?? 0}
                        onChange={(e) => setChannel(idx, Number(e.target.value))}
                        style={{ width: '100%', accentColor: color, height: 4, cursor: 'pointer' }} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      </div>

      <style jsx global>{`
        .hp-spin { animation: hpspin 0.9s linear infinite; }
        @keyframes hpspin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.85)',
  border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: 16,
  padding: 20,
  marginBottom: 20,
};

/**
 * @brief Ligne d'état d'un service dans la section « État de connexion ».
 *
 * @param icon Icône du service.
 * @param label Nom du service.
 * @param ok État : true (ok), false (erreur), null (en cours/inconnu).
 * @param detail Texte de détail (latence, statut HTTP, message d'erreur).
 * @param sub Sous-texte facultatif (typiquement l'URL testée).
 * @param last Si true, supprime la bordure inférieure (dernière ligne).
 * @returns La ligne JSX d'état avec icône et indicateur.
 */
function StatusRow({ icon: Icon, label, ok, detail, sub, last }: {
  icon: React.ElementType;
  label: string; ok: boolean | null; detail: string; sub?: string; last?: boolean;
}) {
  const color = ok == null ? 'rgba(0,0,0,0.35)' : ok ? '#16a34a' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: last ? 'none' : '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={17} color="rgba(0,0,0,0.5)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{label}</div>
        <div style={{ fontSize: 12, color, fontWeight: 600 }}>{detail}</div>
        {sub && <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
      </div>
      {ok == null
        ? <Loader2 size={20} className="hp-spin" color="rgba(0,0,0,0.3)" />
        : ok ? <CheckCircle2 size={20} color="#16a34a" /> : <XCircle size={20} color="#ef4444" />}
    </div>
  );
}
