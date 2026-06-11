'use client';

/**
 * @file app/_components/Coachmarks.tsx
 * @brief Tour guidé en "coachmarks" : surbrillance d'éléments réels + bulles d'explication.
 *
 * Surcouche modale qui met en valeur des éléments existants de l'interface (via
 * un sélecteur CSS) avec un spotlight, et affiche une bulle de texte positionnée
 * automatiquement au-dessus/en dessous de la cible. Gère la navigation
 * Précédent/Suivant/Passer, le clavier (flèches, Entrée, Échap), le défilement
 * vers la cible et le repositionnement au resize/scroll. Props principales :
 * `open`, `steps` (liste d'étapes {@link CoachStep}), `onClose`, `finishLabel`.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, ArrowRight, ArrowLeft, Check } from 'lucide-react';

/** Une étape du tour guidé. */
export interface CoachStep {
  /** Sélecteur CSS de l'élément à mettre en surbrillance (ex. '[data-tour="tabs"]'). Absent = bulle centrée. */
  selector?: string;
  title: string;
  text: string;
  /** Action à exécuter AVANT d'afficher l'étape (ex. changer d'onglet pour révéler la cible). */
  before?: () => void;
}

interface Props {
  open: boolean;
  steps: CoachStep[];
  onClose: () => void;
  /** Libellé du bouton final. */
  finishLabel?: string;
}

type Rect = { top: number; left: number; width: number; height: number } | null;

/**
 * Tour guidé en « coachmarks » : surbrillance d'éléments réels + bulle d'explication.
 * Boutons Passer / Précédent / Suivant. Si la cible est introuvable, la bulle se centre.
 */
export default function Coachmarks({ open, steps, onClose, finishLabel = 'Terminer' }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  // Réinitialise au début à chaque ouverture.
  useEffect(() => { if (open) setIndex(0); }, [open]);

  const step = steps[Math.min(index, steps.length - 1)];

  const measure = useCallback(() => {
    if (!step?.selector) { setRect(null); return; }
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    // Amène la cible dans le viewport si besoin.
    if (r.top < 0 || r.bottom > window.innerHeight) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [step]);

  // À chaque étape : exécuter `before` (ex. changer d'onglet) puis mesurer (avec délai pour le montage).
  useLayoutEffect(() => {
    if (!open || !step) return;
    step.before?.();
    const t1 = setTimeout(measure, 90);
    const t2 = setTimeout(measure, 320); // re-mesure après animation/montage
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [open, index, step, measure]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, measure]);

  // Navigation clavier.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  if (!open || !step) return null;

  const last = index >= steps.length - 1;
  const next = () => { if (last) onClose(); else setIndex((i) => Math.min(steps.length - 1, i + 1)); };
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  const PAD = 8;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 720;

  // Si la cible couvre + de 65% du viewport, on traite comme "pas de cible"
  // (spotlight inutile + place pour la bulle qui devient pénible).
  const targetTooBig = !!rect && (rect.width * rect.height) / (vw * vh) > 0.65;
  const spotlight = rect && !targetTooBig
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;

  // Position de la bulle (clamp dans le viewport).
  const TIP_W = 460;
  const TIP_H_EST = 280; // estimation pour décider au-dessus / en dessous
  const MARGIN = 18;
  let tipStyle: React.CSSProperties;
  if (spotlight) {
    const roomBelow = vh - (spotlight.top + spotlight.height);
    const placeBelow = roomBelow > TIP_H_EST + MARGIN;
    const top = placeBelow
      ? Math.min(vh - TIP_H_EST - MARGIN, spotlight.top + spotlight.height + 14)
      : Math.max(MARGIN, spotlight.top - 14 - TIP_H_EST);
    let left = spotlight.left + spotlight.width / 2 - TIP_W / 2;
    left = Math.max(MARGIN, Math.min(left, vw - TIP_W - MARGIN));
    tipStyle = { position: 'fixed', top, left, width: TIP_W };
  } else {
    tipStyle = { position: 'fixed', top: '50%', left: '50%', width: TIP_W, transform: 'translate(-50%,-50%)' };
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100000 }}>
      {/* Voile + spotlight (box-shadow géant) ou voile plein si pas de cible */}
      {spotlight ? (
        <div
          onClick={next}
          style={{
            position: 'fixed',
            top: spotlight.top, left: spotlight.left, width: spotlight.width, height: spotlight.height,
            borderRadius: 14,
            boxShadow: '0 0 0 9999px rgba(8,10,22,0.66)',
            outline: '2px solid rgba(124,58,237,0.95)',
            outlineOffset: 0,
            transition: 'all 0.25s ease',
            pointerEvents: 'auto',
          }}
        />
      ) : (
        <div onClick={next} style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,22,0.66)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }} />
      )}

      {/* Bulle d'explication (carte premium liquid glass blanc) */}
      <div
        ref={tipRef}
        style={{
          ...tipStyle,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,255,0.96))',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderRadius: 22,
          padding: 22,
          border: '1px solid rgba(255,255,255,0.85)',
          boxShadow: '0 30px 80px rgba(15,23,42,0.45), 0 4px 14px rgba(67,97,238,0.15), inset 0 1px 0 rgba(255,255,255,0.9)',
          fontFamily: 'system-ui,-apple-system,Segoe UI,sans-serif',
          animation: 'coachIn 0.28s cubic-bezier(0.22,1,0.36,1)',
          maxHeight: `calc(100vh - ${MARGIN * 2}px)`,
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête : pastille étape + bouton fermer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: '#7c3aed',
            padding: '6px 12px',
            borderRadius: 999,
            background: 'linear-gradient(135deg, rgba(67,97,238,0.10), rgba(124,58,237,0.12))',
            border: '1px solid rgba(124,58,237,0.18)',
          }}>
            Étape {index + 1} / {steps.length}
          </span>
          <button
            onClick={onClose}
            title="Fermer le tutoriel"
            style={{
              border: '1px solid rgba(0,0,0,0.08)',
              background: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              color: 'rgba(0,0,0,0.55)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 10,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = '#1a1a2e'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.7)'; e.currentTarget.style.color = 'rgba(0,0,0,0.55)'; }}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <h3 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em', lineHeight: 1.25 }}>
          {step.title}
        </h3>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'rgba(15,23,42,0.72)' }}>
          {step.text}
        </p>

        {/* Progression : barre fine continue + segments lumineux */}
        <div style={{ display: 'flex', gap: 4, margin: '18px 0 4px' }}>
          {steps.map((_, i) => (
            <span
              key={i}
              style={{
                height: 5,
                flex: 1,
                borderRadius: 3,
                background: i <= index
                  ? 'linear-gradient(90deg, #4361ee, #7c3aed)'
                  : 'rgba(15,23,42,0.10)',
                boxShadow: i === index ? '0 0 12px rgba(124,58,237,0.55)' : 'none',
                transition: 'background 0.3s, box-shadow 0.3s',
              }}
            />
          ))}
        </div>

        {/* Pied : passer (lien discret) + précédent / suivant (boutons larges) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'rgba(15,23,42,0.55)',
              fontWeight: 600,
              fontSize: 13.5,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              padding: '4px 2px',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(15,23,42,0.55)'; }}
          >
            Passer le tuto
          </button>

          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            {index > 0 && (
              <button
                onClick={prev}
                style={{
                  height: 50,
                  padding: '0 18px',
                  borderRadius: 14,
                  border: '1px solid rgba(15,23,42,0.12)',
                  background: 'rgba(255,255,255,0.85)',
                  color: '#0f172a',
                  fontWeight: 700,
                  fontSize: 14.5,
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  fontFamily: 'inherit',
                  transition: 'transform 0.12s, box-shadow 0.15s, background 0.15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(15,23,42,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.85)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <ArrowLeft size={16} strokeWidth={2.4} /> Précédent
              </button>
            )}
            <button
              onClick={next}
              style={{
                height: 50,
                padding: '0 24px',
                borderRadius: 14,
                border: 'none',
                background: 'linear-gradient(135deg,#4361ee 0%, #7c3aed 100%)',
                color: '#fff',
                fontWeight: 800,
                fontSize: 15,
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontFamily: 'inherit',
                boxShadow: '0 8px 22px rgba(67,97,238,0.35), inset 0 1px 0 rgba(255,255,255,0.35)',
                transition: 'transform 0.12s, box-shadow 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(67,97,238,0.45), inset 0 1px 0 rgba(255,255,255,0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 22px rgba(67,97,238,0.35), inset 0 1px 0 rgba(255,255,255,0.35)'; }}
            >
              {last ? <><Check size={16} strokeWidth={2.6} /> {finishLabel}</> : <>Suivant <ArrowRight size={16} strokeWidth={2.6} /></>}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes coachIn {
          from { opacity: 0; transform: ${spotlight ? 'translateY(8px) scale(0.97)' : 'translate(-50%,-46%) scale(0.97)'}; }
          to   { opacity: 1; transform: ${spotlight ? 'translateY(0) scale(1)'   : 'translate(-50%,-50%) scale(1)'}; }
        }
      `}</style>
    </div>
  );
}
