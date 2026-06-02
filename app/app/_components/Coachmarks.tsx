'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, ArrowRight, ArrowLeft, Check } from 'lucide-react';

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
  const spotlight = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;

  // Position de la bulle.
  const TIP_W = 340;
  let tipStyle: React.CSSProperties;
  if (spotlight) {
    const below = spotlight.top + spotlight.height + 14;
    const placeBelow = below + 180 < window.innerHeight || spotlight.top < 200;
    const top = placeBelow ? spotlight.top + spotlight.height + 14 : Math.max(14, spotlight.top - 14 - 180);
    let left = spotlight.left + spotlight.width / 2 - TIP_W / 2;
    left = Math.max(14, Math.min(left, window.innerWidth - TIP_W - 14));
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
            borderRadius: 12,
            boxShadow: '0 0 0 9999px rgba(10,12,24,0.62)',
            border: '2px solid #4361ee',
            transition: 'all 0.25s ease',
            pointerEvents: 'auto',
          }}
        />
      ) : (
        <div onClick={next} style={{ position: 'fixed', inset: 0, background: 'rgba(10,12,24,0.62)' }} />
      )}

      {/* Bulle d'explication */}
      <div
        ref={tipRef}
        style={{
          ...tipStyle,
          background: '#fff',
          borderRadius: 16,
          padding: 18,
          boxShadow: '0 18px 50px rgba(0,0,0,0.35)',
          fontFamily: 'system-ui,sans-serif',
          animation: 'coachIn 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7c3aed' }}>
            Étape {index + 1} / {steps.length}
          </span>
          <button onClick={onClose} title="Fermer le tutoriel" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(0,0,0,0.4)', display: 'flex', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#1a1a2e' }}>{step.title}</h3>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'rgba(0,0,0,0.65)' }}>{step.text}</p>

        {/* Progression */}
        <div style={{ display: 'flex', gap: 4, margin: '14px 0' }}>
          {steps.map((_, i) => (
            <span key={i} style={{ height: 4, flex: 1, borderRadius: 2, background: i <= index ? '#4361ee' : 'rgba(0,0,0,0.1)', transition: 'background 0.2s' }} />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <button onClick={onClose} style={{ height: 38, padding: '0 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(0,0,0,0.03)', color: 'rgba(0,0,0,0.55)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Passer le tuto
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {index > 0 && (
              <button onClick={prev} style={{ height: 38, padding: '0 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', background: '#fff', color: '#1a1a2e', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
                <ArrowLeft size={15} /> Précédent
              </button>
            )}
            <button onClick={next} style={{ height: 38, padding: '0 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#4361ee,#7c3aed)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
              {last ? <><Check size={15} /> {finishLabel}</> : <>Suivant <ArrowRight size={15} /></>}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes coachIn { from { opacity: 0; transform: ${spotlight ? 'translateY(6px)' : 'translate(-50%,-46%)'}; } to { opacity: 1; transform: ${spotlight ? 'translateY(0)' : 'translate(-50%,-50%)'}; } }
      `}</style>
    </div>
  );
}
