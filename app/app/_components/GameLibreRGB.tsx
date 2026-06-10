'use client';

/**
 * @file app/_components/GameLibreRGB.tsx
 * @brief Mode Libre RGB : exploration libre des couleurs sur les dalles (sans score).
 *
 * Bac à sable sans manche ni score. Le joueur règle une couleur via 3 sliders
 * R/G/B (0-255) ou un champ hexadécimal, choisit la zone à éclairer (toutes les
 * dalles / salle gauche / salle droite) et voit la couleur projetée en temps réel
 * (debounce) sur les dalles. Le point correspondant se déplace sur le diagramme
 * {@link CieDiagramCanvas} (CIE 1931) et un historique des 8 dernières couleurs
 * permet de rappeler ses favoris. Reçoit `onSendColor`, `onTurnOffAll` et `onQuit`
 * via {@link GameTileProps}.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { GameTileProps } from './GameColorSpeed';
import CieDiagramCanvas, { type CieMarker } from './CieDiagramCanvas';

// ── Mode Libre RGB ─────────────────────────────────────────────────────────────
// Pas de manche, pas de score. Exploration libre :
//   • 3 sliders R / G / B (0-255)
//   • Sélecteur de zone (toutes les dalles / salle gauche / salle droite)
//   • Diagramme CIE 1931 : le point se déplace en temps réel
//   • Pastille de prévisualisation + valeurs hex / CIE
//   • Historique des 8 dernières couleurs

const LEFT_IDX  = [0,1,2,6,7,8,12,13,14,18,19,20,24,25,26,30,31,32,36,37,38];
const RIGHT_IDX = [3,4,5,9,10,11,15,16,17,21,22,23,27,28,29,33,34,35,39,40,41];
const ALL_IDX   = Array.from({ length: 42 }, (_, i) => i);

type Zone = 'all' | 'left' | 'right';
type HistEntry = { r: number; g: number; b: number };

// ── Conversions couleur ────────────────────────────────────────────────────────
function toLinear(c: number) {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}
function rgbToXy(r: number, g: number, b: number): { x: number; y: number } | null {
  const rl = toLinear(r), gl = toLinear(g), bl = toLinear(b);
  const X = 0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl;
  const Y = 0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl;
  const Z = 0.0193339 * rl + 0.1192000 * gl + 0.9503041 * bl;
  const s = X + Y + Z;
  if (s < 1e-9) return null;
  return { x: X / s, y: Y / s };
}
function toHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  wrap: {
    background: 'linear-gradient(160deg,#0b0f1c,#0d1226)',
    border: '1px solid rgba(255,255,255,.07)', borderRadius: 20,
    color: '#e8eaf0', fontFamily: 'system-ui,sans-serif', overflow: 'hidden',
  },
  glass: {
    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14,
    padding: '12px 16px',
  },
  label: {
    fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,.38)',
    textTransform: 'uppercase' as const, letterSpacing: '.1em', marginBottom: 6,
  },
};
const zonBtnStyle = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
  fontFamily: 'inherit', fontWeight: 700, fontSize: 12,
  background: active ? 'rgba(6,214,160,.2)' : 'rgba(255,255,255,.05)',
  color: active ? '#06d6a0' : 'rgba(255,255,255,.5)',
  outline: active ? '1px solid rgba(6,214,160,.4)' : 'none',
});

// ── Composant ─────────────────────────────────────────────────────────────────
/**
 * Composant du Mode Libre RGB.
 *
 * @param props Props communes des jeux de dalles (voir {@link GameTileProps}) ;
 *              seuls `onSendColor`, `onTurnOffAll` et `onQuit` sont utilisés.
 * @returns L'interface d'exploration libre (sliders, zone, diagramme CIE, historique).
 */
export default function GameLibreRGB({ onSendColor, onTurnOffAll, onQuit }: GameTileProps) {
  const [r, setR] = useState(128);
  const [g, setG] = useState(80);
  const [b, setB] = useState(220);
  const [zone, setZone] = useState<Zone>('all');
  const [hexInput, setHexInput] = useState('');
  const [hexFocus, setHexFocus] = useState(false);
  const [history, setHistory] = useState<HistEntry[]>([]);
  const debounce    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diagContRef = useRef<HTMLDivElement>(null);
  const [diagSize, setDiagSize] = useState(300);
  useLayoutEffect(() => {
    const el = diagContRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => {
      setDiagSize(Math.min(Math.floor(e.contentRect.width), 460));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Envoie la couleur aux dalles (debounce 25ms pour sliders)
  const sendToTiles = useCallback((rv: number, gv: number, bv: number, z: Zone) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const tiles = z === 'left' ? LEFT_IDX : z === 'right' ? RIGHT_IDX : ALL_IDX;
      for (const i of tiles) onSendColor(i, rv, gv, bv, 90);
    }, 25);
  }, [onSendColor]);

  // Déclenche à chaque changement r/g/b/zone
  useEffect(() => {
    sendToTiles(r, g, b, zone);
  }, [r, g, b, zone, sendToTiles]);

  useEffect(() => () => { onTurnOffAll(); }, []); // eslint-disable-line

  function changeColor(rv: number, gv: number, bv: number) {
    setR(rv); setG(gv); setB(bv);
    if (!hexFocus) setHexInput('');
  }

  function applyHex(hex: string) {
    const parsed = hexToRgb(hex);
    if (parsed) { setR(parsed.r); setG(parsed.g); setB(parsed.b); }
  }

  function saveToHistory() {
    setHistory(h => {
      const entry = { r, g, b };
      const filtered = h.filter(e => !(e.r === r && e.g === g && e.b === b));
      return [entry, ...filtered].slice(0, 8);
    });
  }

  const xy = rgbToXy(r, g, b);
  const hex = toHex(r, g, b);

  const markers: CieMarker[] = xy
    ? [{ x: xy.x, y: xy.y, color: hex, crosshair: true, radius: 8, label: hex }]
    : [];

  const ZONE_LABELS: Record<Zone, string> = {
    all:   '42 dalles',
    left:  'Salle gauche (21)',
    right: 'Salle droite (21)',
  };

  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#e8eaf0', letterSpacing: '-0.01em' }}>
            Mode Libre — Couleur RGB
          </div>
          <button
            onClick={() => { onTurnOffAll(); onQuit?.(); }}
            style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,.5)' }}
          >
            <X size={13} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* Colonne gauche : sliders + infos */}
          <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Pastille + hex */}
            <div style={{ ...S.glass, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 14, flexShrink: 0,
                background: hex, border: '2px solid rgba(255,255,255,.2)',
                boxShadow: `0 0 24px ${hex}80`,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ ...S.label, marginBottom: 4 }}>Couleur</div>
                <input
                  value={hexFocus ? hexInput : hex}
                  onFocus={() => { setHexFocus(true); setHexInput(hex); }}
                  onBlur={() => { setHexFocus(false); applyHex(hexInput); }}
                  onChange={e => { setHexInput(e.target.value); applyHex(e.target.value); }}
                  style={{ width: '100%', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, padding: '6px 10px', color: '#e8eaf0', fontFamily: 'monospace', fontSize: 15, fontWeight: 700, letterSpacing: '0.06em' }}
                />
                {xy && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.38)', marginTop: 4, fontFamily: 'monospace' }}>
                    CIE x={xy.x.toFixed(4)} y={xy.y.toFixed(4)}
                  </div>
                )}
              </div>
            </div>

            {/* Sliders R / G / B */}
            {([
              { label: 'Rouge (R)', val: r, set: (v: number) => changeColor(v, g, b), color: '#ef4444', accent: '#ef4444' },
              { label: 'Vert (G)',  val: g, set: (v: number) => changeColor(r, v, b), color: '#22c55e', accent: '#22c55e' },
              { label: 'Bleu (B)', val: b, set: (v: number) => changeColor(r, g, v), color: '#3b82f6', accent: '#3b82f6' },
            ] as const).map(({ label, val, set, color, accent }) => (
              <div key={label} style={S.glass}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number" min={0} max={255} value={val}
                      onChange={e => set(Math.max(0, Math.min(255, Number(e.target.value))))}
                      style={{ width: 52, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 6, padding: '3px 6px', color: '#e8eaf0', fontSize: 13, fontWeight: 800, textAlign: 'right', fontFamily: 'monospace' }}
                    />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', fontFamily: 'monospace' }}>
                      {Math.round(val / 255 * 100)}%
                    </span>
                  </div>
                </div>
                <input
                  type="range" min={0} max={255} value={val}
                  onChange={e => set(Number(e.target.value))}
                  style={{ width: '100%', accentColor: accent, cursor: 'pointer', height: 4 }}
                />
              </div>
            ))}

            {/* Zone selector */}
            <div style={S.glass}>
              <div style={S.label}>Zone d&apos;éclairage</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['all', 'left', 'right'] as Zone[]).map(z => (
                  <button key={z} onClick={() => setZone(z)} style={zonBtnStyle(zone === z)}>
                    {z === 'all' ? '⬛ Tout' : z === 'left' ? '◀ Gauche' : 'Droite ▶'}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 6, textAlign: 'center' }}>
                {ZONE_LABELS[zone]}
              </div>
            </div>

            {/* Éteindre */}
            <button
              onClick={() => onTurnOffAll()}
              style={{ padding: '10px', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13 }}
            >
              ⬛ Éteindre les dalles
            </button>

            {/* Sauvegarde + historique */}
            <div style={S.glass}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={S.label}>Historique</div>
                <button
                  onClick={saveToHistory}
                  style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(6,214,160,.3)', background: 'rgba(6,214,160,.1)', color: '#06d6a0', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  + Sauvegarder
                </button>
              </div>
              {history.length === 0 ? (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textAlign: 'center', padding: '8px 0' }}>
                  Sauvegardez vos couleurs favorites
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {history.map((e, i) => {
                    const eh = toHex(e.r, e.g, e.b);
                    return (
                      <button
                        key={i}
                        title={eh}
                        onClick={() => changeColor(e.r, e.g, e.b)}
                        style={{ width: 32, height: 32, borderRadius: 8, background: eh, border: '2px solid rgba(255,255,255,.15)', cursor: 'pointer', flexShrink: 0, boxShadow: `0 0 10px ${eh}60` }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Colonne droite : diagramme CIE */}
          <div ref={diagContRef} style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ ...S.label, textAlign: 'center' }}>Chromaticité CIE 1931</div>
            <CieDiagramCanvas size={diagSize} markers={markers} />
            {xy && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textAlign: 'center', fontFamily: 'monospace' }}>
                x = {xy.x.toFixed(4)} · y = {xy.y.toFixed(4)} · z = {(1 - xy.x - xy.y).toFixed(4)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
