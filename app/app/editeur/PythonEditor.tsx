'use client';
import { useEffect, useRef, useState } from 'react';

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

const SNIPPET = `import colorroom as cr
import math

# API disponible:
# cr.send_color(plate_id, r, g, b, intensity)
# cr.set_variable('name', value)
# cr.get_variable('name')
# cr.add_score(points)
# cr.emit_event('type')
# cr.log('message')
# cr.tile_count  -> nombre de dalles (42)

# Exemple : arc-en-ciel sur toutes les dalles
for i in range(cr.tile_count):
    h = i / cr.tile_count
    r = int((0.5 + 0.5 * math.sin(h * 6.28)) * 255)
    g = int((0.5 + 0.5 * math.sin(h * 6.28 + 2.09)) * 255)
    b = int((0.5 + 0.5 * math.sin(h * 6.28 + 4.19)) * 255)
    cr.send_color(i + 1, r, g, b, 0.85)
    cr.log(f"Dalle {i+1}: rgb({r},{g},{b})")
`;

export default function PythonEditor({ code, onChange, bridge, tileCount }: Props) {
  const [pyReady, setPyReady]     = useState(false);
  const [pyLoading, setPyLoading] = useState(false);
  const [running, setRunning]     = useState(false);
  const [logs, setLogs]           = useState<string[]>([]);
  const [error, setError]         = useState('');
  const pyRef     = useRef<any>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  function addLog(msg: string) {
    setLogs(prev => [...prev.slice(-199), msg]);
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
  }

  useEffect(() => {
    if (pyRef.current || pyLoading) return;
    setPyLoading(true);
    const load = async () => {
      try {
        if (!window.loadPyodide) {
          await new Promise<void>((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/pyodide/v0.27.4/full/pyodide.js';
            s.onload = () => res();
            s.onerror = () => rej(new Error('CDN failed'));
            document.head.appendChild(s);
          });
        }
        const py = await (window as any).loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.4/full/' });
        pyRef.current = py;
        setPyReady(true);
        addLog('Python prêt (Pyodide 0.27.4)');
      } catch (e) {
        setError('Impossible de charger Pyodide: ' + String(e));
      } finally {
        setPyLoading(false);
      }
    };
    load();
  }, []);

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
      addLog('Exécution terminée');
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      setError(msg);
      addLog('' + msg);
    } finally {
      setRunning(false);
    }
  }

  const btnBase: React.CSSProperties = { padding: '7px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', transition: 'all 130ms' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.65)', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 800, fontSize: 13 }}>Python</span>
        <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: pyReady ? 'rgba(5,150,105,0.12)' : 'rgba(0,0,0,0.06)', color: pyReady ? '#059669' : '#999' }}>
          {pyLoading ? 'Chargement Pyodide…' : pyReady ? 'Prêt' : 'Non chargé'}
        </span>
        <div style={{ flex: 1 }} />
        <button style={btnBase} onClick={() => onChange(SNIPPET)}>Exemple</button>
        <button style={btnBase} onClick={() => setLogs([])}>Effacer</button>
        {!running
          ? <button style={{ ...btnBase, background: (!pyReady || !bridge) ? 'rgba(0,0,0,0.08)' : 'linear-gradient(135deg,#4361ee,#7c3aed)', color: (!pyReady || !bridge) ? '#aaa' : '#fff', border: 'none' }} onClick={runCode} disabled={!pyReady || !bridge}>Exécuter</button>
          : <button style={{ ...btnBase, background: 'rgba(220,38,38,0.08)', color: '#dc2626', borderColor: 'rgba(220,38,38,0.2)' }} onClick={() => setRunning(false)}>Arrêter</button>}
      </div>

      {/* Editor */}
      <textarea
        value={code}
        onChange={e => onChange(e.target.value)}
        spellCheck={false}
        placeholder="# Écrivez votre code Python ici…"
        style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', padding: '14px 18px', fontFamily: "'Fira Code','Cascadia Code',Consolas,monospace", fontSize: 13, lineHeight: 1.7, background: '#1a1d2e', color: '#e2e8f0', minHeight: 0, overflowY: 'auto' }}
      />

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(220,38,38,0.08)', borderTop: '1px solid rgba(220,38,38,0.2)', padding: '8px 14px', color: '#dc2626', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 80, overflowY: 'auto', flexShrink: 0 }}>
          {error}
        </div>
      )}

      {/* Console */}
      <div style={{ height: 150, background: '#0f1117', color: '#7ef9ff', fontFamily: 'monospace', fontSize: 12, padding: '8px 14px', overflowY: 'auto', flexShrink: 0, borderTop: '2px solid rgba(0,0,0,0.3)' }}>
        <div style={{ opacity: 0.4, fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Console</div>
        {logs.map((l, i) => <div key={i} style={{ lineHeight: 1.5 }}>{l}</div>)}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
