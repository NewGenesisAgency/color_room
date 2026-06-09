/**
 * @file Moteur d'effets sonores 100% hors-ligne (Web Audio API).
 *
 * Aucun fichier audio, aucune dépendance, aucun réseau : tous les sons sont
 * synthétisés à la volée → fonctionne sans connexion. Pensé pour des jeux
 * pédagogiques (feedback bon/mauvais, score, niveau, compte à rebours…).
 *
 * Utilisation :
 *   import { playSfx, unlockAudio, SFX_LIST } from '@/lib/audio/sfx';
 *   unlockAudio();        // à appeler sur une interaction utilisateur (clic)
 *   playSfx('correct');
 */

export type SfxName =
  // UI
  | 'click' | 'select' | 'tick' | 'pop' | 'swoosh'
  // Feedback pédagogique
  | 'correct' | 'wrong' | 'success' | 'error' | 'alert'
  // Progression / récompense
  | 'win' | 'lose' | 'levelup' | 'coin' | 'powerup'
  // Rythme / lancement
  | 'countdown' | 'start' | 'score';

/** Liste lisible (id + libellé FR) pour les sélecteurs d'interface. */
export const SFX_LIST: { id: SfxName; label: string }[] = [
  { id: 'click',     label: 'Clic' },
  { id: 'select',    label: 'Sélection' },
  { id: 'tick',      label: 'Tic' },
  { id: 'pop',       label: 'Pop' },
  { id: 'swoosh',    label: 'Swoosh' },
  { id: 'correct',   label: 'Bonne réponse' },
  { id: 'wrong',     label: 'Mauvaise réponse' },
  { id: 'success',   label: 'Réussite' },
  { id: 'error',     label: 'Erreur' },
  { id: 'alert',     label: 'Alerte' },
  { id: 'win',       label: 'Victoire' },
  { id: 'lose',      label: 'Défaite' },
  { id: 'levelup',   label: 'Niveau supérieur' },
  { id: 'coin',      label: 'Pièce / point' },
  { id: 'powerup',   label: 'Bonus' },
  { id: 'countdown', label: 'Décompte' },
  { id: 'start',     label: 'Départ' },
  { id: 'score',     label: 'Score' },
];

export const SFX_NAMES: SfxName[] = SFX_LIST.map((s) => s.id);

let _ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!_ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      _ctx = new Ctor();
    }
    return _ctx;
  } catch {
    return null;
  }
}

/** À appeler sur une interaction utilisateur pour débloquer l'audio (politiques navigateurs). */
export function unlockAudio(): void {
  const c = ac();
  if (c && c.state === 'suspended') void c.resume();
}

/** Un oscillateur enveloppé (attaque rapide, déclin exponentiel), avec slide optionnel. */
function tone(
  c: AudioContext,
  freq: number,
  t0: number,
  dur: number,
  wave: OscillatorType = 'sine',
  vol = 0.16,
  slideTo?: number,
): void {
  const o = c.createOscillator();
  const g = c.createGain();
  o.connect(g);
  g.connect(c.destination);
  o.type = wave;
  o.frequency.setValueAtTime(Math.max(20, freq), t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

/** Bruit filtré (percussif / swoosh / buzz). */
function noise(c: AudioContext, t0: number, dur: number, vol = 0.12, hp = 600, lp = 4000): void {
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const hpF = c.createBiquadFilter(); hpF.type = 'highpass'; hpF.frequency.value = hp;
  const lpF = c.createBiquadFilter(); lpF.type = 'lowpass'; lpF.frequency.value = lp;
  const g = c.createGain();
  src.connect(hpF); hpF.connect(lpF); lpF.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/** Joue un effet sonore par son nom. Silencieux si l'audio est indisponible. */
export function playSfx(name: SfxName | string): void {
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const t = c.currentTime;

  switch (name) {
    case 'click':     tone(c, 520, t, 0.06, 'square', 0.12); break;
    case 'select':    tone(c, 660, t, 0.05, 'square', 0.10); tone(c, 880, t + 0.04, 0.05, 'square', 0.08); break;
    case 'tick':      tone(c, 380, t, 0.04, 'square', 0.08); break;
    case 'pop':       tone(c, 300, t, 0.10, 'sine', 0.18, 800); break;
    case 'swoosh':    noise(c, t, 0.22, 0.10, 400, 2200); break;

    case 'correct':   tone(c, 660, t, 0.09, 'sine', 0.16); tone(c, 990, t + 0.07, 0.12, 'sine', 0.16); break;
    case 'wrong':     tone(c, 220, t, 0.16, 'sawtooth', 0.14, 160); break;
    case 'success':   [523, 659, 784, 1047].forEach((f, i) => tone(c, f, t + i * 0.08, 0.16, 'triangle', 0.15)); break;
    case 'error':     tone(c, 200, t, 0.18, 'sawtooth', 0.14); tone(c, 150, t + 0.12, 0.22, 'sawtooth', 0.14); break;
    case 'alert':     tone(c, 880, t, 0.10, 'square', 0.12); tone(c, 880, t + 0.16, 0.10, 'square', 0.12); break;

    case 'win':       [660, 880, 1100, 1320].forEach((f, i) => tone(c, f, t + i * 0.09, 0.20, 'triangle', 0.15)); break;
    case 'lose':      [440, 350, 260, 180].forEach((f, i) => tone(c, f, t + i * 0.10, 0.22, 'sawtooth', 0.13)); break;
    case 'levelup':   [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, f, t + i * 0.07, 0.16, 'square', 0.12)); break;
    case 'coin':      tone(c, 988, t, 0.05, 'square', 0.14); tone(c, 1319, t + 0.05, 0.14, 'square', 0.14); break;
    case 'powerup':   tone(c, 440, t, 0.30, 'square', 0.12, 1320); break;

    case 'countdown': tone(c, 700, t, 0.12, 'sine', 0.14); break;
    case 'start':     tone(c, 500, t, 0.10, 'square', 0.12); tone(c, 1000, t + 0.10, 0.22, 'square', 0.14); break;
    case 'score':     tone(c, 660, t, 0.09, 'sine', 0.16); tone(c, 990, t + 0.06, 0.10, 'sine', 0.16); break;

    default:          tone(c, 520, t, 0.06, 'square', 0.12); break;
  }
}
