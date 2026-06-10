'use client';
/**
 * @file app/editeur/PythonEditor.tsx
 * @brief Éditeur de code Python intégré (Pyodide) pour piloter les dalles.
 *
 * Onglet « Python » de l'éditeur : zone de code avec coloration légère,
 * autocomplétion de l'API `colorroom` et exécution via Pyodide (Python
 * compilé en WebAssembly). Le code communique avec le jeu/les dalles à travers
 * un pont (PyBridge) : envoi de couleurs, lecture/écriture de variables, score,
 * émission d'événements. Pyodide est chargé hors-ligne en priorité (fichiers
 * embarqués au build, cf. lib/pyodide.ts), avec repli CDN en développement.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, X, Play, Square, Trash2, FileCode, Lightbulb, Check } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type PyBridge = {
  sendColor: (plateId: number, r: number, g: number, b: number, intensity: number) => void;
  setTile:   (idx: number, r: number, g: number, b: number, intensity: number) => void;
  flush:     () => void;
  getKey:    () => string;
  setVariable: (name: string, value: number | string) => void;
  getVariable: (name: string) => number | string;
  addScore: (points: number) => void;
  emitEvent: (type: string) => void;
  getScore: () => number;
};

type Props = {
  code: string;
  onChange: (code: string) => void;
  bridge: PyBridge | null;
  tileCount: number;
};

declare global { interface Window { loadPyodide?: (opts: { indexURL: string }) => Promise<any>; } }

// ─── Exemple de code (bouton "Exemple") ────────────────────────────────────────
const SNIPPET = `import colorroom as cr
import math

# ─── Arc-en-ciel animé ────────────────────────────────────────────────────────
offset = cr.get_variable('offset')
for i in range(cr.tile_count):
    h = (i / cr.tile_count + offset) % 1.0
    r = int((0.5 + 0.5 * math.sin(h * 6.28)) * 255)
    g = int((0.5 + 0.5 * math.sin(h * 6.28 + 2.09)) * 255)
    b = int((0.5 + 0.5 * math.sin(h * 6.28 + 4.19)) * 255)
    cr.send_color(i + 1, r, g, b, 0.85)

cr.set_variable('offset', offset + 0.02)

# ─── Réagir aux touches ────────────────────────────────────────────────────────
touche = cr.get_key()
if touche == ' ':
    cr.add_score(1)
    cr.emit_event('action')
    cr.log(f"Action ! Score : {cr.get_score()}")
`;

// ─── Fonctions de l'API colorroom ──────────────────────────────────────────────
const CR_API = [
  { name: 'send_color', sig: '(plate_id, r, g, b, intensity)', desc: 'Allume la dalle plate_id (1-42) · r,g,b: 0-255 · intensity: 0.0-1.0', example: 'cr.send_color(1, 255, 0, 0, 0.8)' },
  { name: 'set_tile',   sig: '(idx, r, g, b, intensity)',      desc: 'Dalle par index 0-based (0-41)', example: 'cr.set_tile(0, 0, 255, 0, 0.7)' },
  { name: 'flush',      sig: '()',                              desc: 'Applique tous les set_tile en un seul rendu', example: 'cr.flush()' },
  { name: 'get_key',    sig: '()',                              desc: "Dernière touche pressée puis reset : 'ArrowLeft' 'ArrowRight' 'ArrowUp' 'ArrowDown' ' ' 'Enter'", example: "touche = cr.get_key()" },
  { name: 'set_variable', sig: "('nom', valeur)",               desc: 'Stocke une variable persistante (int, float, str)', example: "cr.set_variable('score', 0)" },
  { name: 'get_variable', sig: "('nom')",                       desc: 'Lit une variable (retourne 0 si absente)', example: "n = cr.get_variable('compteur')" },
  { name: 'add_score',  sig: '(points)',                        desc: 'Ajoute des points au score total du jeu', example: 'cr.add_score(10)' },
  { name: 'get_score',  sig: '()',                              desc: 'Retourne le score courant (int)', example: "score = cr.get_score()" },
  { name: 'emit_event', sig: "('type')",                        desc: "Émet un événement vers les blocs : déclenche les nœuds on_ui_click liés", example: "cr.emit_event('niveau_suivant')" },
  { name: 'log',        sig: "('message')",                     desc: 'Affiche un message dans la console ci-dessous (debug)', example: "cr.log(f'Dalle {i}: {r},{g},{b}')" },
  { name: 'tile_count', sig: '',                                desc: 'Constante : nombre de dalles disponibles (42)', example: "for i in range(cr.tile_count):" },
];

// ─── Étapes du tutoriel guidé (A à Z) ──────────────────────────────────────────
const TUTORIAL_STEPS = [
  {
    title: '1. Importer le module',
    desc: 'Toujours commencer par importer `colorroom`. Ça donne accès à toutes les fonctions `cr.*`.',
    code: 'import colorroom as cr\nimport math\n',
    mode: 'prepend' as const,
  },
  {
    title: '2. Allumer une dalle',
    desc: '`cr.send_color(plate_id, r, g, b, intensity)` — plate_id de 1 à 42, r/g/b de 0 à 255, intensity de 0.0 à 1.0.',
    code: '\n# Allume la dalle 1 en rouge à 80%\ncr.send_color(1, 255, 0, 0, 0.8)\n',
    mode: 'append' as const,
  },
  {
    title: '3. Boucle sur toutes les dalles',
    desc: '`cr.tile_count` vaut 42. Itère avec `for i in range(cr.tile_count)` et utilise `i + 1` comme plate_id.',
    code: '\n# Toutes les dalles en bleu\nfor i in range(cr.tile_count):\n    cr.send_color(i + 1, 0, 100, 255, 0.75)\n',
    mode: 'append' as const,
  },
  {
    title: '4. Variables persistantes',
    desc: 'Les variables survivent entre plusieurs exécutions du script. Utilisez-les pour stocker un état (position, compteur…).',
    code: '\n# Compteur d\'exécutions\ncompteur = int(cr.get_variable(\'exec\')) + 1\ncr.set_variable(\'exec\', compteur)\ncr.log(f"Exécution n°{compteur}")\n',
    mode: 'append' as const,
  },
  {
    title: '5. Réagir aux touches clavier',
    desc: '`cr.get_key()` retourne la dernière touche pressée (puis la réinitialise). Utilisez-le pour des jeux interactifs.',
    code: "\n# Réagir au clavier\ntouche = cr.get_key()\nif touche == 'ArrowLeft':\n    cr.send_color(1, 0, 0, 255, 0.9)   # bleu = gauche\nelif touche == 'ArrowRight':\n    cr.send_color(1, 255, 100, 0, 0.9)  # orange = droite\nelif touche == ' ':\n    cr.add_score(1)\n    cr.log(f'Score : {cr.get_score()}')\n",
    mode: 'append' as const,
  },
  {
    title: '6. Arc-en-ciel + animation',
    desc: 'Combine `math.sin`, la boucle et une variable d\'offset pour créer une animation fluide relancée à chaque exécution.',
    code: '\nimport math\noffset = float(cr.get_variable(\'hue\'))\nfor i in range(cr.tile_count):\n    h = (i / cr.tile_count + offset) % 1.0\n    r = int((0.5 + 0.5 * math.sin(h * 6.28)) * 255)\n    g = int((0.5 + 0.5 * math.sin(h * 6.28 + 2.09)) * 255)\n    b = int((0.5 + 0.5 * math.sin(h * 6.28 + 4.19)) * 255)\n    cr.send_color(i + 1, r, g, b, 0.85)\ncr.set_variable(\'hue\', offset + 0.03)\n',
    mode: 'append' as const,
  },
  {
    title: '7. Jeu complet — tout ensemble',
    desc: 'Un mini-jeu complet : animation, score, évènements, logs. Remplace tout le code actuel.',
    code: SNIPPET,
    mode: 'replace' as const,
  },
];

// ─── Système d'autocomplétion intelligente ─────────────────────────────────────
type Suggestion = { text: string; desc: string; insert: string };

function computeSuggestion(line: string, prefix: string): Suggestion | null {
  const trimmed = line.trimStart();

  // cr. → complétion des fonctions
  const crMatch = /cr\.(\w*)$/.exec(prefix);
  if (crMatch) {
    const partial = crMatch[1].toLowerCase();
    const match = CR_API.find(f => f.name.startsWith(partial) && f.name !== partial);
    if (match) {
      const remaining = match.name.slice(partial.length) + (match.sig || '');
      return { text: remaining, desc: match.desc, insert: remaining };
    }
  }

  // Début de ligne : suggestions contextuelles
  if (!prefix.trim()) {
    if (!trimmed) return { text: 'import colorroom as cr', desc: 'Importer le module colorroom', insert: 'import colorroom as cr' };
    return null;
  }

  // Patterns de début de ligne
  if (/^import\s*$/.test(prefix.trim())) return { text: 'colorroom as cr', desc: 'Module principal ColorRoom', insert: 'colorroom as cr' };
  if (/^for\s+\w+\s+in\s*$/.test(prefix.trim())) return { text: 'range(cr.tile_count):', desc: 'Itérer sur toutes les dalles', insert: 'range(cr.tile_count):' };
  if (/^for\s*$/.test(prefix.trim())) return { text: ' i in range(cr.tile_count):', desc: 'Boucle sur toutes les dalles', insert: ' i in range(cr.tile_count):' };
  if (/^\s+cr\.send_color\(i\s*\+/.test(prefix) && prefix.endsWith(', ')) return { text: '255, 0, 0, 0.8)', desc: 'r, g, b, intensité', insert: '255, 0, 0, 0.8)' };
  if (/^if\s*$/.test(prefix.trim())) return { text: " cr.get_key() == ' ':", desc: 'Tester la touche Espace', insert: " cr.get_key() == ' ':" };
  if (/^if\s+cr\.$/.test(prefix.trim())) return { text: "get_key() == ' ':", desc: 'Récupérer la dernière touche', insert: "get_key() == ' ':" };
  if (/^touche\s*=\s*$/.test(prefix.trim())) return { text: 'cr.get_key()', desc: 'Récupérer la dernière touche pressée', insert: 'cr.get_key()' };
  if (/^cr\.log\($/.test(prefix.trim())) return { text: "f'info : {variable}')", desc: 'F-string avec variable', insert: "f'info : {variable}')" };

  return null;
}

// Suggestion de ligne suivante (après avoir appuyé Entrée)
function computeNextLine(currentLine: string): string | null {
  const t = currentLine.trim();
  if (/^for\s+\w+\s+in\s+range\(.*\):$/.test(t)) return '    cr.send_color(i + 1, 255, 0, 0, 0.8)';
  if (/^import colorroom as cr$/.test(t)) return 'import math';
  if (/^import math$/.test(t)) return '';
  if (/^if .+:$/.test(t)) return '    ';
  if (/^else:$/.test(t)) return '    ';
  if (/^elif .+:$/.test(t)) return '    ';
  return null;
}

// ─── Composant principal ───────────────────────────────────────────────────────
export default function PythonEditor({ code, onChange, bridge, tileCount }: Props) {
  const [pyReady, setPyReady]     = useState(false);
  const [pyLoading, setPyLoading] = useState(false);
  const [running, setRunning]     = useState(false);
  const [logs, setLogs]           = useState<string[]>([]);
  const [error, setError]         = useState('');

  // Tutoriel
  const [tutorialOpen, setTutorialOpen] = useState(true);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [appliedSteps, setAppliedSteps] = useState<Set<number>>(new Set());

  // Autocomplétion
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [nextLineSug, setNextLineSug] = useState<string | null>(null);
  const [showCrDropdown, setShowCrDropdown] = useState(false);
  const [crDropdownItems, setCrDropdownItems] = useState<typeof CR_API>([]);
  const [crDropdownSel, setCrDropdownSel] = useState(0);

  const pyRef      = useRef<any>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const taRef      = useRef<HTMLTextAreaElement>(null);
  const runRef     = useRef(running);
  runRef.current   = running;

  function addLog(msg: string) {
    setLogs(prev => [...prev.slice(-299), msg]);
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
  }

  // ── Chargement Pyodide ───────────────────────────────────────────────────────
  useEffect(() => {
    if (pyRef.current || pyLoading) return;
    setPyLoading(true);
    (async () => {
      // Hors-ligne d'abord : Pyodide est embarqué dans /pyodide/ (téléchargé au
      // build Docker). En dev local sans ces fichiers, on retombe sur le CDN.
      const LOCAL = '/pyodide/';
      const CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.4/full/';
      const loadScript = (src: string) => new Promise<void>((res, rej) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => res();
        s.onerror = () => rej(new Error('script KO: ' + src));
        document.head.appendChild(s);
      });
      // Vérifie la présence de la copie locale (HEAD) avant de tenter le CDN.
      const hasLocal = async () => {
        try { const r = await fetch(LOCAL + 'pyodide.js', { method: 'HEAD' }); return r.ok; } catch { return false; }
      };
      try {
        const base = (await hasLocal()) ? LOCAL : CDN;
        if (!window.loadPyodide) {
          try { await loadScript(base + 'pyodide.js'); }
          catch { if (base !== CDN) await loadScript(CDN + 'pyodide.js'); else throw new Error('CDN inaccessible'); }
        }
        const indexURL = window.location.origin + LOCAL;
        let py;
        try { py = await (window as any).loadPyodide({ indexURL: base === LOCAL ? indexURL : CDN }); }
        catch { py = await (window as any).loadPyodide({ indexURL: CDN }); }
        pyRef.current = py;
        setPyReady(true);
        addLog('✓ Python prêt (Pyodide 0.27.4' + (base === LOCAL ? ', hors-ligne' : ', CDN') + ')');
      } catch (e) {
        setError('Impossible de charger Pyodide: ' + String(e));
      } finally {
        setPyLoading(false);
      }
    })();
  }, []);

  // ── Exécution ────────────────────────────────────────────────────────────────
  async function runCode() {
    if (!pyRef.current || !bridge) return;
    const py = pyRef.current;
    setRunning(true); setError(''); setLogs([]);
    const cr = {
      send_color:   bridge.sendColor,
      set_tile:     bridge.setTile,
      flush:        bridge.flush,
      get_key:      bridge.getKey,
      set_variable: bridge.setVariable,
      get_variable: bridge.getVariable,
      add_score:    bridge.addScore,
      get_score:    bridge.getScore,
      emit_event:   bridge.emitEvent,
      log:          (msg: string) => addLog(String(msg)),
      tile_count:   tileCount,
    };
    py.registerJsModule('colorroom', cr);
    py.setStdout({ batched: (s: string) => addLog(s) });
    py.setStderr({ batched: (s: string) => addLog('⚠ ' + s) });
    try {
      await py.runPythonAsync(code);
      addLog('✓ Exécution terminée');
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      setError(msg);
      addLog('✗ ' + msg);
    } finally {
      setRunning(false);
    }
  }

  // ── Analyse du code pour l'autocomplétion ────────────────────────────────────
  const analyzeCode = useCallback((newCode: string, selStart: number) => {
    // Ligne courante jusqu'au curseur
    const before = newCode.slice(0, selStart);
    const lineStart = before.lastIndexOf('\n') + 1;
    const prefix = before.slice(lineStart);
    const currentLine = prefix;

    // Dropdown cr.* (liste déroulante complète)
    const crDropMatch = /cr\.(\w*)$/.exec(prefix);
    if (crDropMatch) {
      const partial = crDropMatch[1].toLowerCase();
      const items = CR_API.filter(f => f.name.startsWith(partial));
      if (items.length > 0 && items.length < CR_API.length) {
        setShowCrDropdown(true);
        setCrDropdownItems(items);
        setCrDropdownSel(0);
        setSuggestion(null);
        return;
      }
    }
    setShowCrDropdown(false);

    // Ghost text (suggestion de complétion de la ligne courante)
    const sug = computeSuggestion(currentLine, prefix);
    setSuggestion(sug);
    setNextLineSug(null);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    onChange(newCode);
    analyzeCode(newCode, e.target.selectionStart ?? 0);
  }, [onChange, analyzeCode]);

  // ── Gestion des touches spéciales ────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = taRef.current;
    if (!ta) return;

    // Exécuter avec Ctrl+Entrée
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (pyReady && bridge && !running) runCode();
      return;
    }

    // Dropdown cr.* : navigation et acceptation
    if (showCrDropdown && crDropdownItems.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setCrDropdownSel(s => Math.min(s + 1, crDropdownItems.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setCrDropdownSel(s => Math.max(s - 1, 0)); return; }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const item = crDropdownItems[crDropdownSel];
        if (!item) return;
        const pos = ta.selectionStart;
        const before = code.slice(0, pos);
        const crDotIdx = before.lastIndexOf('cr.');
        const partial = before.slice(crDotIdx + 3);
        const remaining = item.name.slice(partial.length) + item.sig;
        const newCode = code.slice(0, pos) + remaining + code.slice(pos);
        onChange(newCode);
        setShowCrDropdown(false);
        // Repositionner le curseur
        setTimeout(() => {
          ta.selectionStart = ta.selectionEnd = pos + remaining.length;
          ta.focus();
        }, 0);
        return;
      }
      if (e.key === 'Escape') { setShowCrDropdown(false); return; }
    }

    // Tab → accepter la suggestion ghost
    if (e.key === 'Tab' && suggestion && !showCrDropdown) {
      e.preventDefault();
      const pos = ta.selectionStart;
      const newCode = code.slice(0, pos) + suggestion.insert + code.slice(pos);
      onChange(newCode);
      setSuggestion(null);
      setTimeout(() => {
        const newPos = pos + suggestion.insert.length;
        ta.selectionStart = ta.selectionEnd = newPos;
        ta.focus();
        analyzeCode(newCode, newPos);
      }, 0);
      return;
    }

    // Echap → fermer les suggestions
    if (e.key === 'Escape') { setSuggestion(null); setShowCrDropdown(false); return; }

    // Entrée → suggestion de ligne suivante
    if (e.key === 'Enter') {
      const pos = ta.selectionStart;
      const before = code.slice(0, pos);
      const lineStart = before.lastIndexOf('\n') + 1;
      const currentLine = before.slice(lineStart);
      const nextSug = computeNextLine(currentLine.trim() ? currentLine : '');
      setNextLineSug(nextSug);
      setSuggestion(null);
    }

    // Tab dans l'éditeur sans suggestion → indentation normale (2 espaces)
    if (e.key === 'Tab' && !suggestion && !showCrDropdown) {
      e.preventDefault();
      const pos = ta.selectionStart;
      const newCode = code.slice(0, pos) + '    ' + code.slice(pos);
      onChange(newCode);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = pos + 4; ta.focus(); }, 0);
    }
  }, [showCrDropdown, crDropdownItems, crDropdownSel, suggestion, code, onChange, analyzeCode, pyReady, bridge, running]);

  // ── Appliquer une étape du tutoriel ──────────────────────────────────────────
  function applyStep(idx: number, mode: 'append' | 'prepend' | 'replace') {
    const step = TUTORIAL_STEPS[idx];
    if (!step) return;
    let newCode: string;
    if (mode === 'replace') newCode = step.code;
    else if (mode === 'prepend') newCode = step.code + (code.startsWith(step.code) ? '' : '\n' + code.trimStart());
    else newCode = (code.trimEnd() || '') + step.code;
    onChange(newCode.replace(/^\n/, ''));
    setAppliedSteps(prev => new Set([...prev, idx]));
    setTutorialStep(Math.min(idx + 1, TUTORIAL_STEPS.length - 1));
    taRef.current?.focus();
  }

  // ── Styles ───────────────────────────────────────────────────────────────────
  const btnSm: React.CSSProperties = { padding: '5px 11px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.75)', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', transition: 'all 120ms', display: 'flex', alignItems: 'center', gap: 4 };

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, fontFamily: 'inherit' }}>

      {/* ── Éditeur (colonne gauche) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderBottom: '1px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.65)', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: 13, color: '#1a1d2e' }}>Python</span>
          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
            background: pyReady ? 'rgba(5,150,105,0.12)' : pyLoading ? 'rgba(234,179,8,0.12)' : 'rgba(0,0,0,0.06)',
            color: pyReady ? '#059669' : pyLoading ? '#ca8a04' : '#999' }}>
            {pyLoading ? 'Chargement…' : pyReady ? 'Prêt' : 'Non chargé'}
          </span>
          <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.35)', fontWeight: 600 }}>Ctrl+Entrée = Exécuter · Tab = Compléter</span>
          <div style={{ flex: 1 }} />
          <button style={btnSm} onClick={() => onChange(SNIPPET)}><FileCode size={12} /> Exemple</button>
          <button style={btnSm} onClick={() => setLogs([])}><Trash2 size={12} /> Console</button>
          <button style={{ ...btnSm, background: tutorialOpen ? 'rgba(67,97,238,0.1)' : 'rgba(255,255,255,0.75)', color: tutorialOpen ? '#4361ee' : undefined, borderColor: tutorialOpen ? 'rgba(67,97,238,0.3)' : undefined }}
            onClick={() => setTutorialOpen(v => !v)}>
            <BookOpen size={12} /> Guide {tutorialOpen ? '✕' : '→'}
          </button>
          {!running
            ? <button disabled={!pyReady || !bridge}
                style={{ ...btnSm, background: (!pyReady || !bridge) ? 'rgba(0,0,0,0.08)' : 'linear-gradient(135deg,#4361ee,#7c3aed)', color: (!pyReady || !bridge) ? '#aaa' : '#fff', border: 'none', gap: 5 }}
                onClick={runCode}><Play size={12} /> Exécuter</button>
            : <button style={{ ...btnSm, background: 'rgba(220,38,38,0.08)', color: '#dc2626', borderColor: 'rgba(220,38,38,0.2)' }}
                onClick={() => setRunning(false)}><Square size={12} /> Arrêter</button>}
        </div>

        {/* Zone de code + dropdown cr.* */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <textarea
            ref={taRef}
            value={code}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onSelect={(e) => { const ta = e.currentTarget; analyzeCode(code, ta.selectionStart ?? 0); }}
            spellCheck={false}
            placeholder="# Écrivez votre code Python ici…&#10;# Commencez par : import colorroom as cr&#10;# Ou cliquez « Exemple » pour partir d'un template."
            style={{ position: 'absolute', inset: 0, resize: 'none', border: 'none', outline: 'none',
              padding: '14px 18px', fontFamily: "'Fira Code','Cascadia Code',Consolas,monospace",
              fontSize: 13, lineHeight: 1.7, background: '#1a1d2e', color: '#e2e8f0',
              width: '100%', height: '100%', boxSizing: 'border-box' }}
          />
          {/* Dropdown cr.* */}
          {showCrDropdown && crDropdownItems.length > 0 && (
            <div style={{ position: 'absolute', top: 8, left: 18, zIndex: 50, background: '#1e2235', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 10, minWidth: 320, boxShadow: '0 8px 28px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
              <div style={{ padding: '5px 10px', background: 'rgba(99,102,241,0.12)', borderBottom: '1px solid rgba(99,102,241,0.2)', fontSize: 10, color: 'rgba(199,210,254,0.7)', fontWeight: 700, letterSpacing: '0.06em' }}>
                API colorroom · ↑↓ naviguer · Tab/↵ insérer · Échap fermer
              </div>
              {crDropdownItems.map((f, i) => (
                <div key={f.name}
                  onClick={() => { setCrDropdownSel(i); }}
                  onDoubleClick={() => { /* accept */ }}
                  style={{ padding: '7px 12px', cursor: 'pointer', background: i === crDropdownSel ? 'rgba(99,102,241,0.18)' : 'transparent',
                    borderLeft: `2px solid ${i === crDropdownSel ? '#818cf8' : 'transparent'}` }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ color: '#a5b4fc', fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>cr.{f.name}</span>
                    <span style={{ color: 'rgba(199,210,254,0.55)', fontFamily: 'monospace', fontSize: 11 }}>{f.sig}</span>
                  </div>
                  <div style={{ color: 'rgba(199,210,254,0.45)', fontSize: 10, marginTop: 2 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bandeau de suggestion (ghost text) */}
        {suggestion && !showCrDropdown && (
          <div style={{ background: '#0f1723', borderTop: '1px solid rgba(67,97,238,0.2)', padding: '5px 18px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <Lightbulb size={13} color="#818cf8" />
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(165,180,252,0.7)' }}>{suggestion.insert}</span>
            <span style={{ fontSize: 11, color: 'rgba(165,180,252,0.4)' }}>— {suggestion.desc}</span>
            <kbd style={{ marginLeft: 'auto', padding: '1px 7px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 5, fontSize: 10, color: '#a5b4fc', fontFamily: 'inherit' }}>Tab</kbd>
            <button onClick={() => setSuggestion(null)} style={{ background: 'transparent', border: 'none', color: 'rgba(165,180,252,0.4)', cursor: 'pointer', padding: 2 }}><X size={12} /></button>
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div style={{ background: 'rgba(220,38,38,0.08)', borderTop: '1px solid rgba(220,38,38,0.2)', padding: '6px 14px', color: '#f87171', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 80, overflowY: 'auto', flexShrink: 0 }}>
            {error}
          </div>
        )}

        {/* Console */}
        <div style={{ height: 130, background: '#0f1117', color: '#7ef9ff', fontFamily: 'monospace', fontSize: 12, padding: '6px 14px', overflowY: 'auto', flexShrink: 0, borderTop: '2px solid rgba(0,0,0,0.3)' }}>
          <div style={{ opacity: 0.4, fontSize: 9, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Console</div>
          {logs.map((l, i) => <div key={i} style={{ lineHeight: 1.5, color: l.startsWith('⚠') || l.startsWith('✗') ? '#fca5a5' : l.startsWith('✓') ? '#86efac' : '#7ef9ff' }}>{l}</div>)}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* ── Panneau tutoriel (colonne droite, collapsible) ── */}
      {tutorialOpen && (
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(0,0,0,0.08)', background: 'rgba(248,249,255,0.97)', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,rgba(67,97,238,0.08),rgba(124,58,237,0.06))' }}>
            <BookOpen size={15} color="#4361ee" />
            <span style={{ fontWeight: 800, fontSize: 13, color: '#1a1d2e', flex: 1 }}>Guide Python A → Z</span>
            <button onClick={() => setTutorialOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)', padding: 2 }}><X size={14} /></button>
          </div>

          {/* Référence API rapide */}
          <details style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            <summary style={{ padding: '8px 14px', fontSize: 11, fontWeight: 800, cursor: 'pointer', color: '#4361ee', letterSpacing: '0.04em', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⌨ Référence API</span>
            </summary>
            <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {CR_API.map(f => (
                <div key={f.name} style={{ background: '#f0f2ff', borderRadius: 7, padding: '5px 8px' }}>
                  <code style={{ fontSize: 10, color: '#4361ee', fontWeight: 700 }}>cr.{f.name}{f.sig}</code>
                  <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.5)', marginTop: 2 }}>{f.desc}</div>
                  <button onClick={() => { const ta = taRef.current; if (!ta) return; const pos = ta.selectionStart; const newCode = code.slice(0, pos) + f.example + code.slice(pos); onChange(newCode); setTimeout(() => { ta.selectionStart = ta.selectionEnd = pos + f.example.length; ta.focus(); }, 0); }}
                    style={{ marginTop: 3, fontSize: 9, padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(67,97,238,0.25)', background: 'rgba(67,97,238,0.06)', color: '#4361ee', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                    Insérer exemple
                  </button>
                </div>
              ))}
            </div>
          </details>

          {/* Étapes du tutoriel */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(0,0,0,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
              Étapes ({tutorialStep + 1}/{TUTORIAL_STEPS.length})
            </div>
            {/* Barre de progression */}
            <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
              {TUTORIAL_STEPS.map((_, i) => (
                <div key={i} onClick={() => setTutorialStep(i)} style={{ flex: 1, height: 4, borderRadius: 2, cursor: 'pointer',
                  background: appliedSteps.has(i) ? '#4361ee' : i === tutorialStep ? 'rgba(67,97,238,0.4)' : 'rgba(0,0,0,0.1)' }} />
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {TUTORIAL_STEPS.map((step, i) => {
              const isCurrent = i === tutorialStep;
              const isDone = appliedSteps.has(i);
              return (
                <div key={i}
                  onClick={() => setTutorialStep(i)}
                  style={{ borderRadius: 10, border: `1px solid ${isCurrent ? 'rgba(67,97,238,0.4)' : isDone ? 'rgba(5,150,105,0.25)' : 'rgba(0,0,0,0.07)'}`,
                    background: isCurrent ? 'rgba(67,97,238,0.05)' : isDone ? 'rgba(5,150,105,0.04)' : 'rgba(255,255,255,0.7)',
                    padding: '8px 10px', cursor: 'pointer', transition: 'all 150ms' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: isCurrent ? 6 : 0 }}>
                    {isDone
                      ? <Check size={12} color="#059669" style={{ flexShrink: 0 }} />
                      : <span style={{ width: 12, height: 12, borderRadius: '50%', background: isCurrent ? '#4361ee' : 'rgba(0,0,0,0.15)', flexShrink: 0, display: 'inline-block' }} />}
                    <span style={{ fontSize: 12, fontWeight: 700, color: isCurrent ? '#4361ee' : isDone ? '#059669' : '#1a1d2e' }}>{step.title}</span>
                  </div>
                  {isCurrent && (
                    <>
                      <p style={{ margin: '0 0 8px', fontSize: 11, color: 'rgba(0,0,0,0.6)', lineHeight: 1.5 }}>{step.desc}</p>
                      <pre style={{ margin: '0 0 8px', fontSize: 10, background: '#1a1d2e', color: '#a5b4fc', padding: '8px 10px', borderRadius: 7, overflow: 'auto', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{step.code.trim()}</pre>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={(e) => { e.stopPropagation(); applyStep(i, step.mode); }}
                          style={{ flex: 1, padding: '5px 8px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg,#4361ee,#7c3aed)', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {step.mode === 'replace' ? '↺ Remplacer' : step.mode === 'prepend' ? '⬆ Ajouter en début' : '+ Ajouter'}
                        </button>
                        {i < TUTORIAL_STEPS.length - 1 && (
                          <button onClick={(e) => { e.stopPropagation(); setTutorialStep(i + 1); }}
                            style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.8)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Suivant →
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
