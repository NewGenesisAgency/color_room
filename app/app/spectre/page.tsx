'use client';

/**
 * @file app/spectre/page.tsx
 * @brief Jeu multijoueur « Spectre Chromatique » (route /spectre).
 *
 * Serious game de reproduction de couleur en plusieurs manches. L'hôte crée
 * une salle (code court + QR code), les joueurs rejoignent (jusqu'à 8 sièges)
 * via /api/spectre/*. Le déroulé suit cinq phases (lobby → reveal → guess →
 * result → finished) : la couleur cible est révélée sur les 42 dalles
 * (sendColorToAllPlates), puis chaque joueur la reproduit sur un diagramme de
 * chromaticité CIE 1931 interactif (dessiné sur canvas, picking xy), avec
 * aperçu en direct sur les dalles. Le score par manche dépend de la distance
 * RGB à la cible.
 *
 * Le fichier contient : les types miroir de lib/spectre.ts, des utilitaires de
 * couleur (CIE xy ↔ RGB, longueur d'onde → RGB, encodage 32 canaux), l'envoi
 * groupé aux dalles via /api/supervision/batch, le composant principal
 * `SpectreGame` (état + polling + rendu de chaque phase) et l'export par
 * défaut `SpectrePage` (page autonome ouverte par QR code).
 *
 * Synchronisation matérielle : changements de phase pilotent les dalles ;
 * l'hôte (siège 1) fait avancer la partie et déclenche l'auto-advance quand
 * tous les joueurs ont soumis.
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Palette, CheckCircle2, Crown, Trophy, RotateCcw, LogOut } from 'lucide-react';
import QrCode from '@/app/_components/QrCode';

// ── Types (miroir de lib/spectre.ts) ────────────────────────────────────────
/** @brief Numéro de siège joueur (1 à 8). */
type SpSeat = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
/** @brief Phase courante de la partie Spectre. */
type SpPhase = 'lobby' | 'reveal' | 'guess' | 'result' | 'finished';
/** @brief État d'un joueur : siège, nom, couleur devinée, soumission et scores. */
type SpPlayer = {
  seat: SpSeat; name: string;
  guessR: number; guessG: number; guessB: number;
  submitted: boolean; roundScore: number; totalScore: number;
};
/** @brief État complet d'une partie Spectre renvoyé par le serveur. */
type SpState = {
  gameId: 'spectre'; phase: SpPhase; round: number; maxRounds: number;
  targetR: number; targetG: number; targetB: number;
  revealDurationMs: number; guessDurationMs: number; phaseEndsAtMs: number;
  players: Partial<Record<SpSeat, SpPlayer>>; createdAt: string;
};

// ── CIE 1931 helpers (diagramme chromatique) ────────────────────────────────
const CIE_HS: [number,number][] = [
  [0.1741,0.0050],[0.1740,0.0050],[0.1738,0.0049],[0.1736,0.0050],[0.1730,0.0048],
  [0.1721,0.0048],[0.1714,0.0051],[0.1689,0.0082],[0.1644,0.0139],[0.1566,0.0214],
  [0.1440,0.0297],[0.1241,0.0578],[0.0913,0.1327],[0.0454,0.2950],[0.0082,0.5384],
  [0.0139,0.7502],[0.0743,0.8338],[0.1547,0.8059],[0.2296,0.7543],[0.3016,0.6923],
  [0.3731,0.6245],[0.4441,0.5547],[0.5125,0.4866],[0.5752,0.4242],[0.6270,0.3725],
  [0.6658,0.3340],[0.7006,0.2993],[0.7301,0.2700],[0.7548,0.2452],[0.7800,0.2200],
  [0.8000,0.2000],[0.8210,0.1790],[0.8507,0.1493],
];
const CDW=380,CDH=340,CXN=0,CXX=0.85,CYN=0,CYX=0.92,CPL=26,CPR=12,CPT=8,CPB=20;
/** @brief Convertit une chromaticité CIE (x,y) en pixel SVG du diagramme. */
function cXyToSvg(x:number,y:number){return{px:CPL+(x-CXN)/(CXX-CXN)*(CDW-CPL-CPR),py:(CDH-CPB)-(y-CYN)/(CYX-CYN)*(CDH-CPT-CPB)};}
/** @brief Convertit un pixel SVG du diagramme en chromaticité CIE (x,y). */
function cSvgToXy(px:number,py:number){return{x:(px-CPL)/(CDW-CPL-CPR)*(CXX-CXN)+CXN,y:((CDH-CPB)-py)/(CDH-CPT-CPB)*(CYX-CYN)+CYN};}
/** @brief Indique si la chromaticité (cx,cy) est dans le fer à cheval CIE (ray casting). */
function cInHS(cx:number,cy:number):boolean{let inside=false;for(let i=0,j=CIE_HS.length-1;i<CIE_HS.length;j=i++){const[xi,yi]=CIE_HS[i],[xj,yj]=CIE_HS[j];if((yi>cy)!==(yj>cy)&&cx<(xj-xi)*(cy-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
/**
 * @brief Convertit une chromaticité CIE (x,y) en couleur sRGB (Y=1).
 * @returns Le triplet { r, g, b } (0..255), ou null si hors domaine valide.
 */
function cXyToRgb(x:number,y:number):{r:number,g:number,b:number}|null{if(y<1e-8||x<0||x+y>1)return null;const X=x/y,Y=1,Z=(1-x-y)/y;let r=3.2406*X-1.5372*Y-0.4986*Z,g=-0.9689*X+1.8758*Y+0.0415*Z,b=0.0557*X-0.2040*Y+1.0570*Z;const mn=Math.min(r,g,b);if(mn<0){r-=mn;g-=mn;b-=mn;}const mx=Math.max(r,g,b,1e-9);r/=mx;g/=mx;b/=mx;const gm=(c:number)=>c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055;return{r:Math.round(Math.min(1,Math.max(0,gm(r)))*255),g:Math.round(Math.min(1,Math.max(0,gm(g)))*255),b:Math.round(Math.min(1,Math.max(0,gm(b)))*255)};}

// ── Utilitaires couleur ──────────────────────────────────────────────────────
/**
 * @brief Convertit une couleur HSL en composantes RGB (0..255).
 * @param h Teinte (0..360).
 * @param s Saturation en pourcentage.
 * @param l Luminosité en pourcentage.
 * @returns Les composantes { r, g, b }.
 */
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

/**
 * @brief Convertit longueur d'onde (nm) + saturation% + luminosité% en RGB.
 * @param wl Longueur d'onde en nanomètres.
 * @param s Saturation en pourcentage.
 * @param l Luminosité en pourcentage.
 * @returns Les composantes { r, g, b } (0..255).
 */
function wlSLToRgb(wl: number, s: number, l: number): { r: number; g: number; b: number } {
  const [r01, g01, b01] = wavelengthToRgb01(wl);
  const sn = s / 100;
  const ln = l / 100;
  // Luminance-based desaturation: mix spectral color with its own luminance value
  const lum = 0.2126 * r01 + 0.7152 * g01 + 0.0722 * b01;
  const sr = r01 * sn + lum * (1 - sn);
  const sg = g01 * sn + lum * (1 - sn);
  const sb = b01 * sn + lum * (1 - sn);
  // Lightness: scale toward black (<0.5) or white (>0.5), neutral at 0.5
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  if (ln <= 0.5) {
    const f = ln * 2;
    return { r: c(sr * f), g: c(sg * f), b: c(sb * f) };
  } else {
    const f = (ln - 0.5) * 2;
    return { r: c(sr + (1 - sr) * f), g: c(sg + (1 - sg) * f), b: c(sb + (1 - sb) * f) };
  }
}

/**
 * @brief Calcule un score (0..1000) selon la distance RGB entre cible et devinette.
 * @param tR,tG,tB Couleur cible.
 * @param gR,gG,gB Couleur devinée.
 * @returns Le score arrondi (1000 = couleur exacte).
 */
function colorScore(tR: number, tG: number, tB: number, gR: number, gG: number, gB: number): number {
  const dr = tR - gR, dg = tG - gG, db = tB - gB;
  return Math.round(Math.max(0, (1 - Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3 * 255 * 255)) * 1000));
}

/** @brief Construit une chaîne CSS rgb() à partir de composantes numériques. */
function rgb(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/**
 * @brief Approxime la couleur RGB normalisée [0,1] d'une longueur d'onde visible.
 * @param wl Longueur d'onde en nanomètres (bornée 380..780).
 * @returns Le triplet [r, g, b] dans [0,1].
 */
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
/**
 * @brief Décompose une couleur RGB en 32 valeurs de canaux LED (dalle « rouge »).
 * @param r,g,b Composantes RGB (0..255).
 * @param intensity Intensité globale en pourcentage.
 * @returns Le tableau des 32 valeurs de canaux (0..255).
 */
function rgbToChannels32(r: number, g: number, b: number, intensity: number): number[] {
  const R = Math.max(0, Math.min(255, Math.round(r)));
  const G = Math.max(0, Math.min(255, Math.round(g)));
  const B = Math.max(0, Math.min(255, Math.round(b)));
  const scale = intensity / 100;
  const ch = Array(32).fill(0);
  if (scale <= 1e-6 || Math.max(R, G, B) === 0) return ch;

  // Décomposition achromatique + chromatique (alignée avec jeux/page.tsx)
  const W  = Math.min(R, G, B);           // composante blanche pure
  const Rc = R - W;                        // rouge chromatique
  const Gc = G - W;                        // vert chromatique
  const Bc = B - W;                        // bleu chromatique
  const Y  = Math.min(Rc, Gc);            // jaune (overlap R+G)
  const Ro = Rc - Y;                       // rouge résiduel pur
  const Go = Gc - Y;                       // vert résiduel pur

  const v = (x: number) => Math.min(255, Math.round(x * scale));

  // Canaux blancs / gris (24-27, 31)
  if (W > 0) {
    const wv = v(W);
    ch[25] = wv;
    ch[24] = Math.round(wv * 0.70);
    ch[26] = Math.round(wv * 0.55);
    ch[27] = Math.round(wv * 0.35);
    ch[31] = Math.round(wv * 0.45);
  }

  // Canaux rouges (10-14) — ch[11] = 642nm primaire
  if (Ro > 0) {
    const rv = v(Ro);
    ch[11] = Math.max(ch[11], rv);
    ch[12] = Math.max(ch[12], Math.round(rv * 0.90));
    ch[13] = Math.max(ch[13], Math.round(rv * 0.85));
    ch[10] = Math.max(ch[10], Math.round(rv * 0.70));
    ch[14] = Math.max(ch[14], Math.round(rv * 0.55));
  }

  // Canaux verts (5-6) — ch[5] = 513nm primaire
  if (Go > 0) {
    const gv = v(Go);
    ch[5] = Math.max(ch[5], gv);
    ch[6] = Math.max(ch[6], Math.round(gv * 0.75));
  }

  // Canaux bleus / violets (0-4) — ch[4] = 479nm primaire (cyan-bleu)
  if (Bc > 0) {
    const bv = v(Bc);
    ch[4] = Math.max(ch[4], bv);
    ch[2] = Math.max(ch[2], Math.round(bv * 0.80));
    ch[3] = Math.max(ch[3], Math.round(bv * 0.65));
    ch[1] = Math.max(ch[1], Math.round(bv * 0.60));
    ch[0] = Math.max(ch[0], Math.round(bv * 0.40));
  }

  // Canaux jaune / orange (7-9, 18-19) — ch[7] = 541nm primaire
  if (Y > 0) {
    const yv = v(Y);
    ch[7]  = Math.max(ch[7],  yv);
    ch[8]  = Math.max(ch[8],  Math.round(yv * 0.85));
    ch[18] = Math.max(ch[18], Math.round(yv * 0.90));
    ch[19] = Math.max(ch[19], Math.round(yv * 0.75));
    ch[9]  = Math.max(ch[9],  Math.round(yv * 0.70));
  }

  return ch;
}

/**
 * @brief Envoie une même couleur sur les 42 dalles en une seule requête batch.
 *
 * Anti-flood : regroupe les 42 dalles dans un seul POST /api/supervision/batch
 * (au lieu de 42 requêtes qui saturaient supervision.exe). Reméppe les canaux
 * pour les dalles de type « bleu ». force:true purge la file.
 *
 * @param r,g,b Composantes RGB de la couleur à afficher.
 * @param intensity Intensité globale en pourcentage (défaut 85).
 */
async function sendColorToAllPlates(r: number, g: number, b: number, intensity = 85) {
  // PLATE_TYPE identifie les dalles bleues — on reméppe les canaux pour chaque type
  const { PLATE_TYPE, remapChannels32 } = await import('@/lib/tileChannels');
  const chRouge = rgbToChannels32(r, g, b, intensity);
  const chBleu  = remapChannels32(chRouge, 'rouge', 'bleu');
  const plates = [];
  for (let plateId = 1; plateId <= 42; plateId++) {
    const ch = PLATE_TYPE[plateId] === 'bleu' ? chBleu : chRouge;
    plates.push({ plateId, channels: ch.map((v, i) => ({ index: i, value: v })) });
  }
  fetch('/api/supervision/batch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plates, fast: true, force: true }),
    cache: 'no-store',
  }).catch(() => {});
}

/** @brief Éteint les 42 dalles (tous canaux à 0) en une requête batch. */
async function clearAllPlates() {
  const channels = Array.from({ length: 32 }, (_, i) => ({ index: i, value: 0 }));
  const plates = [];
  for (let plateId = 1; plateId <= 42; plateId++) plates.push({ plateId, channels });
  fetch('/api/supervision/batch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plates, fast: true, force: true }),
    cache: 'no-store',
  }).catch(() => {});
}

// ── Constantes visuelles ──────────────────────────────────────────────────────
const SEAT_COLORS = ['#ff4488','#44aaff','#44ffaa','#ffaa44','#aa44ff','#ff8844','#44ffff','#ffff44'];
const PHASE_LABELS: Record<SpPhase, string> = {
  lobby: 'Salle d\'attente', reveal: 'Mémorisation', guess: 'Reproduction',
  result: 'Résultats', finished: 'Fin de partie',
};

// ── Composant principal ───────────────────────────────────────────────────────
interface SpectrePageProps {
  /** Rendu intégré dans la page Jeux (sous les dalles) plutôt qu'en plein écran. */
  embedded?: boolean;
  /** Code de salle pré-rempli (deep-link / QR code), bascule en mode « Rejoindre ». */
  initialJoinCode?: string;
  /** Quitter le jeu (utilisé en mode intégré pour revenir à la liste des jeux). */
  onExit?: () => void;
}

/**
 * @brief Composant principal du jeu Spectre Chromatique.
 *
 * Gère tout le cycle de vie : restauration de session (localStorage),
 * deep-link/QR, création/jonction de salle, polling de l'état serveur,
 * synchronisation matérielle des dalles selon la phase, rendu du diagramme CIE
 * et des écrans de chaque phase (login, lobby, reveal, guess, result, finished).
 *
 * @param embedded Si true, rendu intégré dans une carte (page Jeux) plutôt qu'en plein écran.
 * @param initialJoinCode Code de salle pré-rempli (bascule en mode « Rejoindre »).
 * @param onExit Callback appelé pour quitter (mode intégré).
 * @returns L'arbre JSX de l'écran correspondant à la phase courante.
 */
export function SpectreGame({ embedded = false, initialJoinCode, onExit }: SpectrePageProps = {}) {
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
  const [roomCode, setRoomCode] = useState(''); // code court 6 chars affiché / copié / QR
  const [gameState, setGameState] = useState<SpState | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'active' | 'finished'>('active');
  const [players, setPlayers] = useState<Array<{ seat: number; name: string }>>([]);

  const [myX, setMyX] = useState(0.3127); // CIE x (D65 default)
  const [myY, setMyY] = useState(0.3290); // CIE y
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const pollRef = useRef<number>(0);
  const lastPhaseRef = useRef<SpPhase | null>(null);
  const hardwareSentRef = useRef(false);
  const cieCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastAutoRef = useRef('');

  // ── Restauration de session depuis localStorage ───────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem('sp_session');
      if (!saved) return;
      const parsed = JSON.parse(saved) as { token: string; seat: number; sessionId: string; roomCode?: string; savedAt: number };
      if (!parsed.token || !parsed.sessionId) return;
      // Expire après 2h
      if (Date.now() - parsed.savedAt > 2 * 60 * 60 * 1000) {
        window.localStorage.removeItem('sp_session');
        return;
      }
      setToken(parsed.token);
      setSeat(parsed.seat);
      setSessionId(parsed.sessionId);
      setRoomCode(parsed.roomCode ?? parsed.sessionId);
      setView('game');
    } catch { /* ignore */ }
  }, []);

  // ── Deep-link / QR code : code de salle pré-rempli → mode « Rejoindre » ─────
  useEffect(() => {
    let code = initialJoinCode?.trim();
    // En page autonome (/spectre, ouverte par un QR code sur un téléphone),
    // on lit le code directement dans l'URL : /spectre?code=...
    if (!code && !embedded && typeof window !== 'undefined') {
      code = new URLSearchParams(window.location.search).get('code')?.trim() || undefined;
    }
    if (code) {
      setLoginMode('join');
      setJoinCodeInput(code);
    }
  }, [initialJoinCode, embedded]);

  const myRgb = useMemo(() => cXyToRgb(myX, myY) ?? { r: 200, g: 200, b: 200 }, [myX, myY]);

  // En mode intégré, on contraint chaque écran dans une carte sous les dalles
  // (au lieu d'occuper tout l'écran comme une pop-up plein écran).
  const embWrap: React.CSSProperties = embedded
    ? { minHeight: 480, maxHeight: '80vh', overflowY: 'auto', borderRadius: 18, border: '1px solid rgba(0,0,0,0.08)' }
    : { minHeight: '100vh' };

  // ── Polling state ─────────────────────────────────────────────────────────
  /** @brief Interroge l'état de la partie (/api/spectre/state) et met à jour l'UI. */
  const pollState = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/spectre/state?token=${encodeURIComponent(token)}&_=${Date.now()}`);
      const data = await res.json();
      if (!data.ok) {
        // Session disparue (serveur redémarré, partie purgée…) : on nettoie la
        // session locale et on revient à l'accueil au lieu de rester bloqué.
        if (res.status === 404 || data.error === 'no_session') {
          window.localStorage.removeItem('sp_session');
          setToken(''); setGameState(null); setSeat(null); setSessionId(''); setRoomCode(''); setView('login');
        }
        return;
      }
      const st: SpState = data.state;
      setGameState(st);
      setSessionStatus(data.status);
      setPlayers(data.players ?? []);
      if (data.roomCode) setRoomCode(data.roomCode);
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

  // ── CIE canvas draw (fires on entering guess phase) ─────────────────────
  useEffect(() => {
    if (gameState?.phase !== 'guess') return;
    const canvas = cieCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const iw = canvas.width, ih = canvas.height;
    const img = ctx.createImageData(iw, ih);
    for (let py = 0; py < ih; py++) {
      for (let px = 0; px < iw; px++) {
        const { x, y } = cSvgToXy(px * (CDW / iw), py * (CDH / ih));
        const idx = (py * iw + px) * 4;
        if (!cInHS(x, y) || x < CXN || y < CYN || x > CXX || y > CYX) {
          img.data[idx] = 240; img.data[idx + 1] = 242; img.data[idx + 2] = 255; img.data[idx + 3] = 255;
          continue;
        }
        const c = cXyToRgb(x, y);
        if (c) {
          img.data[idx] = c.r; img.data[idx + 1] = c.g; img.data[idx + 2] = c.b; img.data[idx + 3] = 255;
        } else {
          img.data[idx] = 240; img.data[idx + 1] = 242; img.data[idx + 2] = 255; img.data[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [gameState?.phase]);

  // ── Auto-advance when all players submitted (host only) ─────────────────
  useEffect(() => {
    if (!gameState || gameState.phase !== 'guess' || seat !== 1) return;
    const allP = Object.values(gameState.players).filter(Boolean) as SpPlayer[];
    const key = `guess-${gameState.round}`;
    if (allP.length > 0 && allP.every(p => p.submitted) && lastAutoRef.current !== key) {
      lastAutoRef.current = key;
      void handleAdvance();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // ── Actions ────────────────────────────────────────────────────
  /** @brief Crée une nouvelle salle (hôte) via /api/spectre/start. */
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
      if (!data.ok || !data.token) { setError(data.error ?? 'Création impossible — réessayez'); return; }
      setToken(data.token);
      setSeat(data.seat);
      setSessionId(data.sessionId);
      setRoomCode(data.roomCode ?? data.sessionId);
      window.localStorage.setItem('sp_session', JSON.stringify({ token: data.token, seat: data.seat, sessionId: data.sessionId, roomCode: data.roomCode ?? data.sessionId, savedAt: Date.now() }));
      setView('game');
    } catch { setError('Erreur réseau'); } finally { setLoading(false); }
  }

  /** @brief Rejoint une salle existante via /api/spectre/join (code requis). */
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
      setSessionId(data.sessionId ?? joinCodeInput.trim());
      setRoomCode(data.roomCode ?? joinCodeInput.trim().toUpperCase());
      window.localStorage.setItem('sp_session', JSON.stringify({ token: data.token, seat: data.seat, sessionId: data.sessionId ?? joinCodeInput.trim(), roomCode: data.roomCode ?? joinCodeInput.trim().toUpperCase(), savedAt: Date.now() }));
      setView('game');
    } catch { setError('Erreur réseau'); } finally { setLoading(false); }
  }

  /** @brief Fait avancer la partie à la phase suivante (hôte) via /api/spectre/advance. */
  async function handleAdvance() {
    await fetch('/api/spectre/advance', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    await pollState();
  }

  /** @brief Soumet la couleur devinée du joueur via /api/spectre/guess. */
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

  /** @brief Arrête la partie en cours (hôte) via /api/spectre/stop. */
  async function handleStop() {
    await fetch('/api/spectre/stop', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    await pollState();
  }

  /** @brief Relance une nouvelle partie en réinitialisant la session (hôte). */
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
      if (data.roomCode) setRoomCode(data.roomCode);
      setSubmitted(false);
      setMyX(0.3127); setMyY(0.3290);
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
      <div style={{ ...embWrap,background: 'linear-gradient(135deg,#f0f2ff 0%,#f8f0ff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif' }}>
        <div style={{ width: 420, padding: 40, borderRadius: 24, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', backdropFilter: 'blur(20px)' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ marginBottom: 8 }}><Palette size={48} color="#a78bfa" /></div>
            <h1 style={{ color: '#1a1a2e', fontSize: 28, fontWeight: 800, margin: 0 }}>Spectre Chromatique</h1>
            <p style={{ color: 'rgba(0,0,0,0.5)', marginTop: 8, fontSize: 14 }}>Reproduisez la couleur cible sur le spectre lumineux</p>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {(['create', 'join'] as const).map((m) => (
              <button key={m} onClick={() => setLoginMode(m)} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, background: loginMode === m ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'rgba(0,0,0,0.06)', color: loginMode === m ? '#fff' : 'rgba(0,0,0,0.5)', transition: 'all 0.2s' }}>
                {m === 'create' ? 'Créer une salle' : 'Rejoindre'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              value={nameInput} onChange={(e) => setNameInput(e.target.value)}
              placeholder="Votre prénom"
              style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.15)', background: '#fff', color: '#1a1a2e', fontSize: 15, outline: 'none' }}
            />
            {loginMode === 'join' && (
              <input
                value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value)}
                placeholder="Coller le code de la salle ici…"
                style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(167,139,250,0.4)', background: '#fff', color: '#a78bfa', fontSize: 13, outline: 'none', fontFamily: 'monospace' }}
              />
            )}
            {loginMode === 'create' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: 'rgba(0,0,0,0.5)', fontSize: 13, whiteSpace: 'nowrap' }}>Nombre de manches :</span>
                <input type="number" min={1} max={10} value={maxRoundsInput} onChange={(e) => setMaxRoundsInput(Number(e.target.value))}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.15)', background: '#fff', color: '#1a1a2e', fontSize: 15, outline: 'none' }} />
              </div>
            )}
            {error && <p style={{ color: '#ff6b6b', fontSize: 13, margin: 0 }}>⚠ {error}</p>}
            <button onClick={loginMode === 'create' ? handleCreate : handleJoin} disabled={loading}
              style={{ padding: '16px', borderRadius: 14, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 16, background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', opacity: loading ? 0.7 : 1, transition: 'all 0.2s' }}>
              {loading ? '…' : loginMode === 'create' ? 'Créer la salle' : 'Rejoindre'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div style={{ ...embWrap,background: '#f8f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'rgba(0,0,0,0.5)', fontSize: 18 }}>Connexion…</div>
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
      <div style={{ ...embWrap,background: 'linear-gradient(135deg,#f0f2ff,#f8f0ff)', fontFamily: 'system-ui,sans-serif', padding: 40, boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ marginBottom: 8 }}><Palette size={48} color="#a78bfa" /></div>
            <h1 style={{ color: '#1a1a2e', fontSize: 26, fontWeight: 800, margin: 0 }}>Spectre Chromatique</h1>
            <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: 14, marginTop: 8 }}>Salle d&apos;attente · Manche {gameState.maxRounds} ×</p>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: 24, marginBottom: 20 }}>
            <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px' }}>Code de la salle</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <code style={{ flex: 1, color: '#a78bfa', fontSize: 28, fontWeight: 900, background: 'rgba(167,139,250,0.1)', padding: '10px 18px', borderRadius: 12, letterSpacing: '0.18em', textAlign: 'center' }}>
                {roomCode || sessionId}
              </code>
              <button onClick={() => navigator.clipboard.writeText(roomCode || sessionId)} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.6)', cursor: 'pointer', fontSize: 13 }}>Copier</button>
            </div>
            {/* QR code : scanner avec un téléphone du même réseau pour rejoindre */}
            {(() => {
              const origin = typeof window !== 'undefined' ? window.location.origin : '';
              const joinUrl = `${origin}/spectre?code=${encodeURIComponent(roomCode || sessionId)}`;
              return (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <QrCode value={joinUrl} size={148} caption="Scanner pour rejoindre" fgColor="#5b3fb8" />
                  <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: 11, margin: 0, textAlign: 'center' }}>Les joueurs scannent ce QR code avec leur téléphone (même Wi-Fi)</p>
                </div>
              );
            })()}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: 24, marginBottom: 24 }}>
            <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 16px' }}>Joueurs connectés ({players.length})</p>
            {players.length === 0 ? (
              <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 14 }}>En attente de joueurs…</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {players.map((p) => (
                  <div key={p.seat} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: p.seat === seat ? 'rgba(102,126,234,0.1)' : 'rgba(0,0,0,0.02)', border: p.seat === seat ? '1px solid rgba(102,126,234,0.4)' : '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: SEAT_COLORS[(p.seat - 1) % 8] }} />
                    <span style={{ color: '#1a1a2e', fontWeight: 600, fontSize: 15 }}>{p.name}</span>
                    {p.seat === 1 && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#ffd700', display: 'flex', alignItems: 'center', gap: 4 }}><Crown size={13} color="#ffd700" /> Hôte</span>}
                    {p.seat === seat && p.seat !== 1 && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>← Vous</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {isHost ? (
            <button onClick={handleAdvance} disabled={players.length < 1}
              style={{ width: '100%', padding: '18px', borderRadius: 16, border: 'none', cursor: players.length < 1 ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 17, background: players.length < 1 ? 'rgba(0,0,0,0.1)' : 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', opacity: players.length < 1 ? 0.5 : 1, transition: 'all 0.2s' }}>
              Lancer la partie
            </button>
          ) : (
            <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.5)', fontSize: 14 }}>En attente que l&apos;hôte lance la partie…</div>
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
      <div style={{ ...embWrap,background: targetCss, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif', transition: 'background 0.5s', position: 'relative' }}>
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

  // ───────────────────────────────────────────────────────────────────────────
  // GUESS — Diagramme chromatique CIE 1931
  // ───────────────────────────────────────────────────────────────────────────
  if (gameState.phase === 'guess') {
    const myCss = rgb(myRgb.r, myRgb.g, myRgb.b);
    const curSvg = cXyToSvg(myX, myY);
    const isInGamut = cInHS(myX, myY);
    const horsePath = CIE_HS.map(([x, y], i) => { const { px, py } = cXyToSvg(x, y); return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`; }).join(' ') + ' Z';
    const srgbPts = [[0.64, 0.33], [0.30, 0.60], [0.15, 0.06]].map(([x, y]) => cXyToSvg(x, y));
    const srgbPath = srgbPts.map(({ px, py }, i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ') + ' Z';

    function handleDiagMove(e: React.MouseEvent<SVGSVGElement>) {
      if (submitted) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (CDW / rect.width);
      const py = (e.clientY - rect.top) * (CDH / rect.height);
      const { x, y } = cSvgToXy(px, py);
      setMyX(Math.max(CXN, Math.min(CXX, x)));
      setMyY(Math.max(CYN, Math.min(CYX, y)));
    }

    return (
      <div style={{ ...embWrap,background: '#f8f9ff', fontFamily: 'system-ui,sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box' }}>
        {/* Header */}
        <div style={{ width: '100%', maxWidth: 540, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'rgba(0,0,0,0.5)', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Manche {gameState.round}/{gameState.maxRounds} · Reproduction</span>
          <div style={{ background: timeLeft <= 10 ? 'rgba(255,70,70,0.1)' : 'rgba(0,0,0,0.06)', border: `1px solid ${timeLeft <= 10 ? 'rgba(255,70,70,0.4)' : 'rgba(0,0,0,0.12)'}`, borderRadius: 20, padding: '6px 14px', color: timeLeft <= 10 ? '#ef4444' : '#1a1a2e', fontWeight: 800, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
            {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
        </div>

        {/* Color preview */}
        <div style={{ width: '100%', maxWidth: 540, marginBottom: 10, display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, boxSizing: 'border-box' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: myCss, border: '2px solid rgba(0,0,0,0.1)', boxShadow: `0 0 20px ${myCss}55`, flexShrink: 0, transition: 'background 0.1s, box-shadow 0.1s' }} />
          <div>
            <div style={{ color: 'rgba(0,0,0,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Votre couleur</div>
            <code style={{ color: '#1a1a2e', fontSize: 12 }}>x={myX.toFixed(3)}, y={myY.toFixed(3)}</code>
          </div>
          {submitted && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: '#22c55e', fontWeight: 700, fontSize: 13 }}>
              <CheckCircle2 size={16} /> Soumis
            </div>
          )}
        </div>

        {/* CIE 1931 diagram */}
        <div style={{ width: '100%', maxWidth: 540, position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)', marginBottom: 10 }}>
          <canvas ref={cieCanvasRef} width={CDW} height={CDH} style={{ display: 'block', width: '100%', height: 'auto' }} />
          <svg
            viewBox={`0 0 ${CDW} ${CDH}`}
            width="100%"
            style={{ position: 'absolute', top: 0, left: 0, cursor: submitted ? 'default' : 'none' }}
            onMouseMove={handleDiagMove}
            onClick={() => { if (!submitted) void handleSubmitGuess(); }}
          >
            <path d={horsePath} fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="1.5" />
            <path d={srgbPath} fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="1" strokeDasharray="5,4" />
            {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].map(v => { const { px } = cXyToSvg(v, 0); return <text key={v} x={px} y={CDH - 4} fill="rgba(0,0,0,0.4)" fontSize="8" textAnchor="middle">{v.toFixed(1)}</text>; })}
            {[0.2, 0.4, 0.6, 0.8].map(v => { const { py } = cXyToSvg(0, v); return <text key={v} x={CPL - 3} y={py + 3} fill="rgba(0,0,0,0.4)" fontSize="8" textAnchor="end">{v.toFixed(1)}</text>; })}
            <text x={CDW / 2} y={CDH - 2} fill="rgba(0,0,0,0.4)" fontSize="9" textAnchor="middle" fontStyle="italic">x</text>
            <text x={7} y={CDH / 2} fill="rgba(0,0,0,0.4)" fontSize="9" textAnchor="middle" fontStyle="italic" transform={`rotate(-90 7 ${CDH / 2})`}>y</text>
            {(() => { const { px, py } = cXyToSvg(0.3127, 0.3290); return <><circle cx={px} cy={py} r={4} fill="rgba(0,0,0,0.7)" opacity={0.6} /><text x={px + 5} y={py + 3} fill="rgba(0,0,0,0.5)" fontSize="7">D65</text></>; })()}
            {!submitted && (
              <g>
                <line x1={curSvg.px - 14} y1={curSvg.py} x2={curSvg.px + 14} y2={curSvg.py} stroke="#1a1a2e" strokeWidth={1.5} />
                <line x1={curSvg.px} y1={curSvg.py - 14} x2={curSvg.px} y2={curSvg.py + 14} stroke="#1a1a2e" strokeWidth={1.5} />
                <circle cx={curSvg.px} cy={curSvg.py} r={7} fill="none" stroke="#1a1a2e" strokeWidth={1.5} />
                {isInGamut && <circle cx={curSvg.px} cy={curSvg.py} r={3} fill={myCss} />}
              </g>
            )}
            {submitted && (
              <g>
                <circle cx={curSvg.px} cy={curSvg.py} r={9} fill="none" stroke="#22c55e" strokeWidth={2} />
                <circle cx={curSvg.px} cy={curSvg.py} r={3} fill="#22c55e" />
              </g>
            )}
          </svg>
        </div>

        {/* Submit / waiting */}
        {submitted ? (
          <div style={{ width: '100%', maxWidth: 540, textAlign: 'center', padding: '14px', borderRadius: 14, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box' }}>
            <CheckCircle2 size={18} /> Réponse soumise — en attente des autres joueurs…
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: 540, textAlign: 'center', color: 'rgba(0,0,0,0.5)', fontSize: 13, boxSizing: 'border-box' }}>
            Déplacez le curseur sur le diagramme · <strong style={{ color: '#a78bfa' }}>Cliquez pour confirmer</strong>
          </div>
        )}

        {/* Player status */}
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {Object.values(gameState.players).filter(Boolean).map((p) => (
            <div key={p!.seat} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.9)', border: `1px solid ${p!.submitted ? 'rgba(34,197,94,0.4)' : 'rgba(0,0,0,0.1)'}` }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: p!.submitted ? '#22c55e' : 'rgba(0,0,0,0.3)' }} />
              <span style={{ color: p!.submitted ? '#22c55e' : 'rgba(0,0,0,0.5)', fontSize: 13, fontWeight: 600 }}>{p!.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RESULT
  // ────────────────────────────────────────────────────────────────────────────
  if (gameState.phase === 'result') {
    return (
      <div style={{ ...embWrap,background: '#f8f9ff', fontFamily: 'system-ui,sans-serif', padding: '32px 16px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 8px' }}>Manche {gameState.round} / {gameState.maxRounds} · Résultats</p>
            <h2 style={{ color: '#1a1a2e', fontSize: 26, fontWeight: 900, margin: 0 }}>Couleur cible</h2>
          </div>

          {/* Target color */}
          <div style={{ height: 80, borderRadius: 20, background: targetCss, marginBottom: 24, border: '2px solid rgba(0,0,0,0.1)', boxShadow: `0 0 60px ${targetCss}66` }} />

          {/* Player results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {sortedPlayers.map((p, i) => {
              const pCss = rgb(p.guessR, p.guessG, p.guessB);
              const accuracy = Math.round((p.roundScore / 1000) * 100);
              return (
                <div key={p.seat} style={{ background: '#fff', border: `1px solid ${i === 0 ? 'rgba(255,215,0,0.4)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 18, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, minWidth: 22, textAlign: 'center', color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7c3a' : 'rgba(0,0,0,0.4)' }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ color: '#1a1a2e', fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                      <span style={{ color: '#1a1a2e', fontWeight: 900, fontSize: 18 }}>{p.roundScore} pts</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: pCss, border: '2px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                      <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${accuracy}%`, borderRadius: 4, background: accuracy >= 80 ? '#22c55e' : accuracy >= 50 ? '#f97316' : '#ef4444', transition: 'width 0.5s' }} />
                      </div>
                      <span style={{ color: 'rgba(0,0,0,0.5)', fontSize: 12, fontWeight: 700, minWidth: 40, textAlign: 'right' }}>{accuracy}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scores cumulés */}
          <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, padding: '14px 20px', marginBottom: 20 }}>
            <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px' }}>Score total</p>
            {sortedPlayers.map((p) => (
              <div key={p.seat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ color: 'rgba(0,0,0,0.7)', fontSize: 14 }}>{p.name}</span>
                <span style={{ color: '#1a1a2e', fontWeight: 800, fontSize: 16 }}>{p.totalScore} pts</span>
              </div>
            ))}
          </div>

          {isHost && (
            <button onClick={handleAdvance} style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 16, background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff' }}>
              {gameState.round >= gameState.maxRounds ? 'Voir le classement final →' : 'Manche suivante →'}
            </button>
          )}
          {!isHost && (
            <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.35)', fontSize: 14 }}>En attente de l&apos;hôte…{timeLeft > 0 ? ` (${timeLeft}s)` : ''}</div>
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
      <div style={{ ...embWrap,background: 'linear-gradient(135deg,#f0f2ff,#f8f0ff)', fontFamily: 'system-ui,sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: 520 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ marginBottom: 12 }}><Trophy size={64} color="#ffd700" /></div>
            <h1 style={{ color: '#1a1a2e', fontSize: 30, fontWeight: 900, margin: '0 0 8px' }}>Partie terminée !</h1>
            {winner && <p style={{ color: '#ffd700', fontSize: 18, fontWeight: 700, margin: 0 }}>Vainqueur : {winner.name}</p>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {sortedPlayers.map((p, i) => (
              <div key={p.seat} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 24px', borderRadius: 18, background: i === 0 ? 'linear-gradient(135deg,rgba(255,215,0,0.12),rgba(255,165,0,0.07))' : '#fff', border: `1px solid ${i === 0 ? 'rgba(255,215,0,0.4)' : 'rgba(0,0,0,0.08)'}` }}>
                <div style={{ fontSize: 16, fontWeight: 900, minWidth: 40, textAlign: 'center', color: i === 0 ? '#ffd700' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7c3a' : 'rgba(0,0,0,0.4)' }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#1a1a2e', fontWeight: 700, fontSize: 17 }}>{p.name}</div>
                  <div style={{ color: 'rgba(0,0,0,0.4)', fontSize: 13 }}>Siège {p.seat}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: i === 0 ? '#ffd700' : '#1a1a2e', fontWeight: 900, fontSize: 24 }}>{p.totalScore}</div>
                  <div style={{ color: 'rgba(0,0,0,0.4)', fontSize: 12 }}>points</div>
                </div>
              </div>
            ))}
          </div>

          {isHost && (
            <button onClick={handleRestart} disabled={loading} style={{ width: '100%', padding: '18px', borderRadius: 16, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 17, background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', opacity: loading ? 0.7 : 1 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><RotateCcw size={17} /> Rejouer</span>
            </button>
          )}
          {!isHost && (
            <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.35)', fontSize: 14 }}>En attente de l&apos;hôte pour rejouer…</div>
          )}

          <button onClick={() => { window.localStorage.removeItem('sp_session'); setView('login'); setToken(''); setGameState(null); setSeat(null); setSessionId(''); setRoomCode(''); onExit?.(); }}
            style={{ marginTop: 12, width: '100%', padding: '14px', borderRadius: 14, border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.7)', color: 'rgba(0,0,0,0.5)', cursor: 'pointer', fontWeight: 600, fontSize: 15 }}>
            Quitter
          </button>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * @brief Composant par défaut de la route /spectre (page autonome).
 *
 * Page ouverte par QR code sur téléphone. Aucune prop personnalisée (typage
 * Next.js) ; SpectreGame lit lui-même ?code= dans l'URL en mode non intégré.
 *
 * @returns Le jeu Spectre rendu en plein écran.
 */
export default function SpectrePage() {
  return <SpectreGame />;
}
