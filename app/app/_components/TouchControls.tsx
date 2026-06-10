'use client';

/**
 * @file app/_components/TouchControls.tsx
 * @brief Pavé tactile (croix directionnelle + boutons d'action) qui émule le clavier.
 *
 * Affiche, sur appareils tactiles (ou si `forceShow`), une croix directionnelle et
 * jusqu'à 3 boutons d'action. Chaque bouton dispatche un vrai `KeyboardEvent` sur
 * `window`, si bien que tous les jeux écoutant déjà `keydown`/`keyup` (Snake,
 * Tetris, Puissance 4…) fonctionnent sans modification. Gère l'auto-répétition au
 * maintien (déplacements). Exporte aussi le hook {@link useIsTouchDevice} et les
 * types {@link TouchKey}/{@link TouchSlot}. Prop principale : `keys` (liste des touches).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ── Conversion clavier → contrôles tactiles ───────────────────────────────────
// Chaque bouton tactile dispatche un vrai KeyboardEvent sur `window`, donc tous
// les jeux qui écoutent déjà `window.addEventListener('keydown', ...)` réagissent
// sans la moindre modification de leur logique.

export type TouchSlot = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'c';

export type TouchKey = {
  /** Valeur de KeyboardEvent.key à émettre (ex: 'ArrowLeft', ' ', 'Enter'). */
  key: string;
  /** Emplacement sur le pavé (croix directionnelle ou boutons d'action). */
  slot: TouchSlot;
  /** Contenu affiché sur le bouton (icône ou texte). */
  label: React.ReactNode;
  /** Répétition automatique tant que le bouton est maintenu (déplacements). */
  repeat?: boolean;
  /** Couleur d'accent du bouton (pour les actions). */
  accent?: string;
};

function dispatchKey(type: 'keydown' | 'keyup', key: string) {
  try {
    window.dispatchEvent(new KeyboardEvent(type, { key, code: key, bubbles: true, cancelable: true }));
  } catch {
    /* environnements sans constructeur KeyboardEvent */
  }
}

/** Détecte un appareil tactile (tablette / mobile) côté client uniquement. */
export function useIsTouchDevice(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const isTouch =
      'ontouchstart' in window ||
      (navigator.maxTouchPoints ?? 0) > 0 ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);
    setTouch(Boolean(isTouch));
  }, []);
  return touch;
}

const DPAD_SLOTS: TouchSlot[] = ['up', 'down', 'left', 'right'];

/**
 * Pavé de contrôles tactiles émulant le clavier.
 *
 * @param keys Touches à afficher ; chaque {@link TouchKey} définit la touche émise et son emplacement.
 * @param forceShow Affiche le pavé même sur desktop (défaut : false).
 * @param compact Réduit la taille des boutons (défaut : false).
 * @returns Le pavé tactile, ou `null` si l'appareil n'est pas tactile et `forceShow` est faux.
 */
export default function TouchControls({
  keys,
  forceShow = false,
  compact = false,
}: {
  keys: TouchKey[];
  /** Affiche le pavé même sur desktop (utile pour les composants placés dans l'éditeur). */
  forceShow?: boolean;
  compact?: boolean;
}) {
  const isTouch = useIsTouchDevice();
  const timers = useRef<Record<string, { to?: number; iv?: number }>>({});
  const [active, setActive] = useState<Record<string, boolean>>({});

  const release = useCallback((k: TouchKey) => {
    dispatchKey('keyup', k.key);
    const t = timers.current[k.key];
    if (t) {
      if (t.to) window.clearTimeout(t.to);
      if (t.iv) window.clearInterval(t.iv);
      delete timers.current[k.key];
    }
    setActive((a) => ({ ...a, [k.key]: false }));
  }, []);

  const press = useCallback((k: TouchKey) => {
    dispatchKey('keydown', k.key);
    setActive((a) => ({ ...a, [k.key]: true }));
    if (k.repeat) {
      const to = window.setTimeout(() => {
        const iv = window.setInterval(() => dispatchKey('keydown', k.key), 85);
        timers.current[k.key] = { ...timers.current[k.key], iv };
      }, 260);
      timers.current[k.key] = { to };
    }
  }, []);

  // Nettoyage des timers de répétition au démontage
  useEffect(() => {
    const map = timers.current;
    return () => {
      Object.values(map).forEach((t) => {
        if (t.to) window.clearTimeout(t.to);
        if (t.iv) window.clearInterval(t.iv);
      });
    };
  }, []);

  if (!isTouch && !forceShow) return null;

  const bySlot = (s: TouchSlot) => keys.find((k) => k.slot === s);
  const hasDpad = DPAD_SLOTS.some((s) => bySlot(s));
  const actions = (['a', 'b', 'c'] as TouchSlot[]).map(bySlot).filter(Boolean) as TouchKey[];
  if (!hasDpad && actions.length === 0) return null;

  const SIZE = compact ? 46 : 56;
  const baseBtn: React.CSSProperties = {
    width: SIZE, height: SIZE, borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    fontFamily: 'inherit', fontWeight: 800, fontSize: 13, color: '#eaf0ff', userSelect: 'none',
    WebkitUserSelect: 'none', touchAction: 'none', transition: 'transform 80ms, background 80ms',
    background: 'rgba(28,33,46,0.92)', boxShadow: '0 3px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
  };

  const renderBtn = (k: TouchKey | undefined, opts: { wide?: boolean } = {}) => {
    if (!k) return <div style={{ width: SIZE, height: SIZE }} />;
    const isOn = active[k.key];
    const accent = k.accent;
    return (
      <button
        aria-label={typeof k.label === 'string' ? k.label : k.key}
        onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); press(k); }}
        onPointerUp={(e) => { e.preventDefault(); release(k); }}
        onPointerCancel={() => release(k)}
        onPointerLeave={() => { if (active[k.key]) release(k); }}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          ...baseBtn,
          width: opts.wide ? SIZE * 2 + 8 : SIZE,
          background: isOn
            ? (accent ?? '#4361ee')
            : accent ? `${accent}cc` : baseBtn.background as string,
          borderColor: accent ? `${accent}` : baseBtn.border as string,
          transform: isOn ? 'scale(0.94)' : 'scale(1)',
          color: accent || isOn ? '#fff' : '#eaf0ff',
        }}
      >
        {k.label}
      </button>
    );
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: hasDpad && actions.length ? 'space-between' : 'center',
      gap: 18, width: '100%', maxWidth: 460, margin: '14px auto 4px', padding: '0 6px', boxSizing: 'border-box',
    }}>
      {/* Croix directionnelle */}
      {hasDpad && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${SIZE}px)`, gridTemplateRows: `repeat(3, ${SIZE}px)`, gap: 6 }}>
          <div />              {renderBtn(bySlot('up'))}     <div />
          {renderBtn(bySlot('left'))} <div /> {renderBtn(bySlot('right'))}
          <div />              {renderBtn(bySlot('down'))}   <div />
        </div>
      )}

      {/* Boutons d'action */}
      {actions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          {actions.map((k) => (
            <span key={k.key}>{renderBtn(k, { wide: true })}</span>
          ))}
        </div>
      )}
    </div>
  );
}
