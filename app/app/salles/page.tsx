'use client';

/**
 * @file app/salles/page.tsx
 * @brief Page « Plan des salles » : vue physique des 42 dalles LED.
 *
 * Affiche les 2 salles identiques côte à côte, chacune composée de :
 *  - un PLAFOND en 3×4 (ids 10-21 / 31-42), du côté entrée (en haut de
 *    l'affichage) vers le mur du fond (en bas) ;
 *  - un MUR du fond en 3×3 (ids 1-9 / 22-30), numéroté du BAS vers le HAUT
 *    (1-2-3 en bas, 7-8-9 en haut).
 *
 * La disposition est strictement FIDÈLE au mapping physique calibré sur site
 * (cf. plateIdForIndex dans app/jeux/page.tsx) — elle n'est pas modifiable ici.
 *
 * Interactions :
 *  - clic sur une dalle → flash BLANC 2 s puis extinction (anti-spam : les
 *    clics sont ignorés tant qu'un test est en cours) ;
 *  - « Tester salle 1 / 2 » : chenillard séquentiel (0,25 s par dalle, une
 *    seule requête supervision à la fois) ;
 *  - « Tout éteindre » : PUT /api/supervision/ (reset global en 1 requête).
 */

import { useCallback, useRef, useState } from 'react';
import { Map, Moon, Play, Square, Lightbulb, Info } from 'lucide-react';
import NavigationMenu from '@/app/_components/NavigationMenu';
import { PLATE_TYPE, type TileType } from '@/lib/tileChannels';

// ─── Disposition physique (NE PAS MODIFIER — calibrée sur place) ─────────────
// Reproduit exactement plateIdForIndex de app/jeux/page.tsx :
//  • Mur du fond 3×3, numéroté du BAS vers le HAUT, gauche→droite :
//      1-2-3 (bas) / 4-5-6 (milieu) / 7-8-9 (haut)
//  • Plafond 3×4, du fond (près du mur) vers l'avant (côté entrée) :
//      10-11-12 (près du mur) / 13-14-15 / 16-17-18 / 19-20-21 (côté entrée)
//  • Salle 2 : même schéma décalé de +21 (ids 22-42).

/**
 * @brief Rangées du plafond d'une salle, dans l'ordre d'AFFICHAGE (haut→bas).
 *
 * En haut de l'affichage : le côté entrée (19-20-21), en bas : près du mur
 * (10-11-12) — ainsi le plafond affiché au-dessus du mur reste contigu à la
 * rangée haute du mur (7-8-9), comme dans la salle réelle « dépliée ».
 *
 * @param room Index de salle (0 = salle 1, 1 = salle 2).
 * @returns 4 rangées de 3 identifiants physiques.
 */
function ceilingRows(room: 0 | 1): number[][] {
  const off = room * 21;
  // rowFromWall = 3 (côté entrée) → 0 (près du mur)
  return [3, 2, 1, 0].map((rowFromWall) =>
    [0, 1, 2].map((col) => 10 + rowFromWall * 3 + col + off),
  );
}

/**
 * @brief Rangées du mur du fond d'une salle, dans l'ordre d'AFFICHAGE (haut→bas).
 *
 * Le mur est numéroté du BAS vers le HAUT : la rangée affichée en haut est
 * donc 7-8-9, et celle du bas 1-2-3.
 *
 * @param room Index de salle (0 = salle 1, 1 = salle 2).
 * @returns 3 rangées de 3 identifiants physiques.
 */
function wallRows(room: 0 | 1): number[][] {
  const off = room * 21;
  // rowFromBottom = 2 (haut) → 0 (bas)
  return [2, 1, 0].map((rowFromBottom) =>
    [0, 1, 2].map((col) => 1 + rowFromBottom * 3 + col + off),
  );
}

/** @brief Valeur envoyée sur les canaux blancs lors d'un test (≈ 80/255). */
const TEST_WHITE_VALUE = 80;
/** @brief Index des canaux « blancs » utilisés pour le flash de test. */
const TEST_WHITE_CHANNELS = [24, 25, 26, 27, 31];

/** @brief Promesse résolue après `ms` millisecondes (pause asynchrone). */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * @brief Allume une dalle en blanc (canaux blancs à TEST_WHITE_VALUE).
 *
 * Une seule requête : les 32 canaux sont envoyés (blancs à 80, le reste à 0),
 * ce qui fixe l'état complet de la dalle.
 *
 * @param plateId Identifiant physique de la dalle (1..42).
 * @returns true si la requête a réussi, false sinon.
 */
async function sendWhite(plateId: number): Promise<boolean> {
  const channels = Array.from({ length: 32 }, (_, i) => ({
    index: i,
    value: TEST_WHITE_CHANNELS.includes(i) ? TEST_WHITE_VALUE : 0,
  }));
  return fetch('/api/supervision/batch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plateId, channels, fast: true, force: true }),
    cache: 'no-store',
  }).then((r) => r.ok).catch(() => false);
}

/**
 * @brief Éteint une dalle (les 32 canaux à 0), en une seule requête.
 * @param plateId Identifiant physique de la dalle (1..42).
 * @returns true si la requête a réussi, false sinon.
 */
async function sendOff(plateId: number): Promise<boolean> {
  const channels = Array.from({ length: 32 }, (_, i) => ({ index: i, value: 0 }));
  return fetch('/api/supervision/batch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plateId, channels, fast: true, force: true }),
    cache: 'no-store',
  }).then((r) => r.ok).catch(() => false);
}

/**
 * @brief Composant de la page « Plan des salles ».
 *
 * Gère l'état « dalle(s) en cours de test » (glow visuel + anti-spam) et les
 * trois actions globales (chenillard salle 1 / salle 2, extinction générale).
 * Toutes les requêtes supervision sont strictement séquentielles (jamais plus
 * d'une en parallèle).
 *
 * @returns L'arbre JSX de la page.
 */
export default function SallesPage() {
  /** Identifiant de la dalle actuellement allumée (glow), ou null. */
  const [litPlate, setLitPlate] = useState<number | null>(null);
  /** Vrai si une séquence (clic, chenillard, extinction) est en cours. */
  const [busy, setBusy] = useState(false);
  /** Salle dont le chenillard tourne (0/1), ou null. */
  const [sweepRoom, setSweepRoom] = useState<0 | 1 | null>(null);
  /** Message d'état affiché sous les boutons. */
  const [statusMsg, setStatusMsg] = useState('');
  /** Verrou anti-flood : une seule séquence supervision à la fois. */
  const busyRef = useRef(false);
  /** Demande d'arrêt du chenillard en cours. */
  const stopRef = useRef(false);

  /**
   * @brief Teste une dalle au clic : blanc 2 s puis extinction.
   *
   * Anti-spam : ignoré si une séquence est déjà en cours (busyRef).
   *
   * @param plateId Identifiant physique de la dalle cliquée.
   */
  const testPlate = useCallback(async (plateId: number) => {
    if (busyRef.current) return; // anti-spam : un test à la fois
    busyRef.current = true;
    setBusy(true);
    setStatusMsg(`Test de la dalle ${plateId}…`);
    setLitPlate(plateId);
    try {
      await sendWhite(plateId);
      await sleep(2000);
      await sendOff(plateId);
      setStatusMsg(`✓ Dalle ${plateId} testée`);
    } catch {
      setStatusMsg('✗ Erreur réseau');
    } finally {
      setLitPlate(null);
      setBusy(false);
      busyRef.current = false;
    }
  }, []);

  /**
   * @brief Chenillard d'une salle : allume chaque dalle 0,25 s, séquentiellement.
   *
   * Une seule requête supervision à la fois (allumage → pause → extinction,
   * chaque appel attendu avant le suivant). Interruptible via stopRef.
   *
   * @param room Index de salle (0 = salle 1 → ids 1-21, 1 = salle 2 → ids 22-42).
   */
  const sweepRoomRun = useCallback(async (room: 0 | 1) => {
    if (busyRef.current) return;
    busyRef.current = true;
    stopRef.current = false;
    setBusy(true);
    setSweepRoom(room);
    setStatusMsg(`Chenillard salle ${room + 1}…`);
    const off = room * 21;
    try {
      for (let id = 1 + off; id <= 21 + off; id++) {
        if (stopRef.current) break;
        setLitPlate(id);
        await sendWhite(id);
        await sleep(250);
        await sendOff(id);
      }
      setStatusMsg(stopRef.current ? 'Chenillard interrompu' : `✓ Salle ${room + 1} testée (21 dalles)`);
    } catch {
      setStatusMsg('✗ Erreur réseau');
    } finally {
      setLitPlate(null);
      setSweepRoom(null);
      setBusy(false);
      busyRef.current = false;
      stopRef.current = false;
    }
  }, []);

  /** @brief Demande l'arrêt du chenillard en cours. */
  const stopSweep = useCallback(() => { stopRef.current = true; }, []);

  /**
   * @brief Éteint toutes les dalles via le PUT global (1 seule requête rapide).
   */
  const blackout = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setStatusMsg('Extinction de toutes les dalles…');
    try {
      const res = await fetch('/api/supervision/', { method: 'PUT', cache: 'no-store' });
      setStatusMsg(res.ok ? '✓ Toutes les dalles éteintes' : `✗ Erreur (${res.status})`);
    } catch {
      setStatusMsg('✗ Erreur réseau');
    } finally {
      setLitPlate(null);
      setBusy(false);
      busyRef.current = false;
    }
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#f0f2ff 0%,#f8f0ff 100%)', fontFamily: 'system-ui,sans-serif' }}>
      <NavigationMenu />
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '88px 20px 48px' }}>
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#4361ee,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Map size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#1a1a2e' }}>Plan des salles</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'rgba(0,0,0,0.5)' }}>
              Disposition physique des 42 dalles LED — cliquez sur une dalle pour la tester (blanc 2 s)
            </p>
          </div>
        </div>

        {/* ── Actions globales ─────────────────────────────────────────────── */}
        <section style={cardStyle}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {([0, 1] as const).map((room) => (
              sweepRoom === room ? (
                <button key={room} onClick={stopSweep}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                  <Square size={15} /> Arrêter (salle {room + 1})
                </button>
              ) : (
                <button key={room} onClick={() => void sweepRoomRun(room)} disabled={busy}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                  <Play size={15} /> Tester salle {room + 1}
                </button>
              )
            ))}
            <button onClick={() => void blackout()} disabled={busy}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.8)', color: '#1a1a2e', fontWeight: 800, fontSize: 14, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              <Moon size={15} /> Tout éteindre
            </button>
            {litPlate != null && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 800, color: '#7c3aed' }}>
                <Lightbulb size={15} /> Dalle {litPlate}
              </span>
            )}
          </div>
          {statusMsg && (
            <p style={{ margin: '12px 0 0', fontSize: 13, fontWeight: 700, color: statusMsg.startsWith('✗') ? '#ef4444' : '#059669' }}>
              {statusMsg}
            </p>
          )}
        </section>

        {/* ── Les deux salles côte à côte ──────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {([0, 1] as const).map((room) => (
            <RoomPlan key={room} room={room} litPlate={litPlate} busy={busy} onTest={testPlate} />
          ))}
        </div>

        {/* ── Légende ──────────────────────────────────────────────────────── */}
        <section style={{ ...cardStyle, marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Info size={18} color="#4361ee" />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1a1a2e' }}>Légende</h2>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'rgba(0,0,0,0.6)', lineHeight: 1.7 }}>
            <li>
              <strong>Mur du fond (3×3)</strong> : numéroté du <strong>bas vers le haut</strong> —
              la rangée 1-2-3 est au sol, la rangée 7-8-9 touche le plafond (idem 22-24 / 28-30 en salle 2).
            </li>
            <li>
              <strong>Plafond (3×4)</strong> : la rangée 10-11-12 est contre le mur du fond,
              la rangée 19-20-21 est côté entrée (idem +21 en salle 2).
            </li>
            <li>
              <span style={dotStyle('#ef4444')} /> Câblage <strong>rouge</strong>
              {' '}· <span style={dotStyle('#3b82f6')} /> Câblage <strong>bleu</strong> —
              les deux types ont un ordre de canaux LED différent (cf. lib/tileChannels.ts).
            </li>
            <li>
              <strong>Ce plan reflète le câblage physique calibré — il n&apos;est pas modifiable ici.</strong>
            </li>
          </ul>
        </section>
      </div>

      {/* Animation du glow de test */}
      <style jsx global>{`
        @keyframes salleGlow {
          0%, 100% { box-shadow: 0 0 10px 2px rgba(255, 245, 200, 0.85), 0 0 28px 8px rgba(255, 235, 160, 0.55); }
          50%      { box-shadow: 0 0 18px 6px rgba(255, 250, 220, 1),    0 0 44px 14px rgba(255, 240, 180, 0.8); }
        }
      `}</style>
    </div>
  );
}

/** @brief Style « liquid glass » blanc commun aux cartes de la page. */
const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.85)',
  border: '1px solid rgba(255,255,255,0.6)',
  borderRadius: 16,
  padding: 20,
  marginBottom: 20,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

/**
 * @brief Style du point coloré indiquant le type de câblage.
 * @param color Couleur CSS du point.
 * @returns Style inline d'une pastille ronde.
 */
function dotStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: color,
    border: '1px solid rgba(0,0,0,0.15)',
    verticalAlign: 'middle',
  };
}

/**
 * @brief Plan d'une salle : plafond (3×4) au-dessus, mur du fond (3×3) en dessous.
 *
 * @param room Index de salle (0 = salle 1, 1 = salle 2).
 * @param litPlate Dalle actuellement allumée (glow), ou null.
 * @param busy Vrai si un test est en cours (curseur/interaction désactivés).
 * @param onTest Rappel au clic sur une dalle (test blanc 2 s).
 * @returns La carte JSX de la salle.
 */
function RoomPlan({ room, litPlate, busy, onTest }: {
  room: 0 | 1;
  litPlate: number | null;
  busy: boolean;
  onTest: (plateId: number) => void;
}) {
  return (
    <section style={{ ...cardStyle, marginBottom: 0 }}>
      <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 900, color: '#1a1a2e', textAlign: 'center' }}>
        Salle {room + 1} <span style={{ fontWeight: 600, fontSize: 12.5, color: 'rgba(0,0,0,0.45)' }}>(dalles {room * 21 + 1}–{room * 21 + 21})</span>
      </h2>

      {/* Plafond 3×4 */}
      <GridBlock
        title="Plafond (3×4)"
        topHint="côté entrée"
        bottomHint="près du mur"
        rows={ceilingRows(room)}
        litPlate={litPlate}
        busy={busy}
        onTest={onTest}
      />

      <div style={{ height: 14 }} />

      {/* Mur du fond 3×3 */}
      <GridBlock
        title="Mur du fond (3×3)"
        topHint="haut"
        bottomHint="bas (sol)"
        rows={wallRows(room)}
        litPlate={litPlate}
        busy={busy}
        onTest={onTest}
      />
    </section>
  );
}

/**
 * @brief Bloc de grille (plafond ou mur) avec titre et repères haut/bas.
 *
 * @param title Titre du bloc (« Plafond (3×4) » ou « Mur du fond (3×3) »).
 * @param topHint Repère physique de la rangée affichée en haut.
 * @param bottomHint Repère physique de la rangée affichée en bas.
 * @param rows Rangées d'identifiants physiques, dans l'ordre d'affichage.
 * @param litPlate Dalle actuellement allumée (glow), ou null.
 * @param busy Vrai si un test est en cours.
 * @param onTest Rappel au clic sur une dalle.
 * @returns Le bloc JSX de grille.
 */
function GridBlock({ title, topHint, bottomHint, rows, litPlate, busy, onTest }: {
  title: string;
  topHint: string;
  bottomHint: string;
  rows: number[][];
  litPlate: number | null;
  busy: boolean;
  onTest: (plateId: number) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(0,0,0,0.55)' }}>{title}</span>
        <span style={{ fontSize: 10.5, fontStyle: 'italic', color: 'rgba(0,0,0,0.4)' }}>↑ {topHint}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {rows.flat().map((plateId) => (
          <TileCell key={plateId} plateId={plateId} type={PLATE_TYPE[plateId] ?? 'rouge'}
            lit={litPlate === plateId} busy={busy} onTest={onTest} />
        ))}
      </div>
      <div style={{ textAlign: 'right', marginTop: 5, fontSize: 10.5, fontStyle: 'italic', color: 'rgba(0,0,0,0.4)' }}>
        ↓ {bottomHint}
      </div>
    </div>
  );
}

/**
 * @brief Case cliquable d'une dalle : identifiant physique + pastille de câblage.
 *
 * Pendant le test (lit = true), la case « glow » via une boîte-ombre animée.
 *
 * @param plateId Identifiant physique de la dalle (1..42).
 * @param type Type de câblage ('rouge' ou 'bleu').
 * @param lit Vrai si la dalle est en cours de test (allumée).
 * @param busy Vrai si un test est en cours quelque part (clics ignorés).
 * @param onTest Rappel au clic.
 * @returns Le bouton JSX de la dalle.
 */
function TileCell({ plateId, type, lit, busy, onTest }: {
  plateId: number;
  type: TileType;
  lit: boolean;
  busy: boolean;
  onTest: (plateId: number) => void;
}) {
  const dotColor = type === 'rouge' ? '#ef4444' : '#3b82f6';
  return (
    <button
      onClick={() => onTest(plateId)}
      disabled={busy && !lit}
      title={`Dalle ${plateId} — câblage ${type} (cliquer pour tester)`}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '12px 4px',
        borderRadius: 12,
        border: lit ? '1px solid rgba(255,220,120,0.9)' : '1px solid rgba(255,255,255,0.7)',
        background: lit ? 'rgba(255,250,225,0.98)' : 'rgba(255,255,255,0.65)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: lit ? undefined : '0 2px 8px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)',
        animation: lit ? 'salleGlow 0.9s ease-in-out infinite' : undefined,
        cursor: busy ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s ease, border 0.2s ease',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: 15, fontWeight: 900, color: '#1a1a2e', fontVariantNumeric: 'tabular-nums' }}>
        {plateId}
      </span>
      <span style={dotStyle(dotColor)} />
    </button>
  );
}
