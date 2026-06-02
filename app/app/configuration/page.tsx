'use client';

import { useCallback, useEffect, useState } from 'react';
import { SlidersHorizontal, Save, RotateCcw, Activity, CheckCircle2, XCircle, Loader2, Terminal, Copy, Check } from 'lucide-react';
import NavigationMenu from '@/app/_components/NavigationMenu';

type ApiSnapshot = { value: string; source: string; default: string };
type ConfigSnapshot = { supervision: ApiSnapshot; cs160: ApiSnapshot };

type HealthApi = { url: string; reachable: boolean; httpStatus?: number; ms: number; error?: string };
type HealthResult = { supervision: HealthApi; cs160: HealthApi; allReachable: boolean } | null;

export default function ConfigurationPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const [supervisionUrl, setSupervisionUrl] = useState('');
  const [cs160Url, setCs160Url] = useState('');
  const [snapshot, setSnapshot] = useState<ConfigSnapshot | null>(null);
  const [health, setHealth] = useState<HealthResult>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/config', { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) {
        setSnapshot(data.config);
        setSupervisionUrl(data.config.supervision.value);
        setCs160Url(data.config.cs160.value);
      } else {
        setError(data.error ?? 'Erreur de chargement');
      }
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadConfig(); }, [loadConfig]);

  async function handleSave() {
    setSaving(true); setError(''); setSavedMsg('');
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ supervisionUrl: supervisionUrl.trim(), cs160Url: cs160Url.trim() }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? 'Échec de l\'enregistrement'); return; }
      setSnapshot(data.config);
      setSupervisionUrl(data.config.supervision.value);
      setCs160Url(data.config.cs160.value);
      setSavedMsg('Configuration enregistrée. Les requêtes utilisent désormais ces adresses.');
      void handleTest();
    } catch {
      setError('Erreur réseau');
    } finally {
      setSaving(false);
    }
  }

  const handleTest = useCallback(async () => {
    setTesting(true); setHealth(null);
    try {
      const res = await fetch('/api/health?full=1', { cache: 'no-store' });
      const data = await res.json();
      setHealth({ supervision: data.apis.supervision, cs160: data.apis.cs160, allReachable: data.allReachable });
    } catch {
      setError('Test impossible (serveur injoignable)');
    } finally {
      setTesting(false);
    }
  }, []);

  function resetField(which: 'supervision' | 'cs160') {
    if (!snapshot) return;
    if (which === 'supervision') setSupervisionUrl(snapshot.supervision.default);
    else setCs160Url(snapshot.cs160.default);
  }

  return (
    <div className="config-page" style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#f0f2ff 0%,#f8f0ff 100%)', fontFamily: 'system-ui,sans-serif' }}>
      <NavigationMenu />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '88px 20px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#4361ee,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <SlidersHorizontal size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#1a1a2e' }}>Configuration</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'rgba(0,0,0,0.5)' }}>Adresses des APIs (modifiables à chaud, sans redémarrer le serveur)</p>
          </div>
        </div>

        <div style={{ background: 'rgba(67,97,238,0.06)', border: '1px solid rgba(67,97,238,0.18)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: 'rgba(0,0,0,0.65)', margin: '16px 0 24px' }}>
          Indiquez l'URL complète <strong>avec le port</strong> (ex. <code>http://172.17.50.136:18080</code>). Laissez un champ vide pour revenir à la valeur par défaut / variable d'environnement.
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'rgba(0,0,0,0.5)' }}>
            <Loader2 size={28} className="cfg-spin" /> <div style={{ marginTop: 8 }}>Chargement…</div>
          </div>
        ) : (
          <>
            {/* Supervision */}
            <ApiField
              title="API Supervision (dalles LED)"
              hint="Pilote les 42 dalles. Test : GET /state"
              value={supervisionUrl}
              onChange={setSupervisionUrl}
              source={snapshot?.supervision.source}
              defVal={snapshot?.supervision.default}
              onReset={() => resetField('supervision')}
              health={health?.supervision}
            />

            {/* CS-160 */}
            <ApiField
              title="API CS-160 (colorimètre Konica)"
              hint="Bridge de mesure spectrale. Test : GET /api/health"
              value={cs160Url}
              onChange={setCs160Url}
              source={snapshot?.cs160.source}
              defVal={snapshot?.cs160.default}
              onReset={() => resetField('cs160')}
              health={health?.cs160}
            />

            {error && <p style={{ color: '#ef4444', fontSize: 14, fontWeight: 600 }}>⚠ {error}</p>}
            {savedMsg && <p style={{ color: '#22c55e', fontSize: 14, fontWeight: 600 }}>✓ {savedMsg}</p>}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 12, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 15, background: 'linear-gradient(135deg,#4361ee,#7c3aed)', color: '#fff', opacity: saving ? 0.7 : 1 }}>
                {saving ? <Loader2 size={18} className="cfg-spin" /> : <Save size={18} />} Enregistrer
              </button>
              <button onClick={handleTest} disabled={testing}
                style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.12)', cursor: testing ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 15, background: 'rgba(255,255,255,0.8)', color: '#1a1a2e' }}>
                {testing ? <Loader2 size={18} className="cfg-spin" /> : <Activity size={18} />} Tester (/health)
              </button>
            </div>

            {health && (
              <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, fontSize: 14, fontWeight: 700, textAlign: 'center',
                background: health.allReachable ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${health.allReachable ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.3)'}`,
                color: health.allReachable ? '#16a34a' : '#ef4444' }}>
                {health.allReachable ? 'Les deux APIs répondent correctement ✓' : 'Une ou plusieurs APIs sont injoignables — vérifiez les adresses et le réseau.'}
              </div>
            )}

            {/* Notes : ouvrir le port et faire marcher la redirection (Windows) */}
            <div style={{ marginTop: 28, background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Terminal size={18} color="#7c3aed" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1a1a2e' }}>Notes — ouvrir les ports (Windows)</h3>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(0,0,0,0.55)', lineHeight: 1.5 }}>
                Pour que la Supervision soit joignable depuis le réseau, exécuter ces commandes dans
                {' '}<strong>PowerShell en administrateur</strong> sur le poste qui héberge l'API.
              </p>

              <CommandLine
                label="1. Autoriser le port 18080 dans le pare-feu"
                command={`New-NetFirewallRule -DisplayName "ColorRoom-Supervision" -Direction Inbound -Protocol TCP -LocalPort 18080 -Action Allow`}
              />
              <CommandLine
                label="2. Rediriger le port 18080 (réseau) vers 8080 (local)"
                command={`netsh interface portproxy add v4tov4 listenport=18080 listenaddress=0.0.0.0 connectport=8080 connectaddress=127.0.0.1`}
              />

              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(0,0,0,0.45)', lineHeight: 1.5 }}>
                Astuce : l'API Supervision écoute en local sur le port <code>8080</code> ; la redirection l'expose sur le port <code>18080</code> utilisé ci-dessus.
              </p>
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        .cfg-spin { animation: cfgspin 0.9s linear infinite; }
        @keyframes cfgspin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function CommandLine({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* ignore */ }
  };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(0,0,0,0.6)', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
        <code style={{ flex: 1, padding: '11px 14px', borderRadius: 10, background: '#0e1220', color: '#c7d2fe', fontSize: 12.5, fontFamily: 'ui-monospace,Menlo,Consolas,monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5 }}>
          {command}
        </code>
        <button onClick={copy} title="Copier la commande"
          style={{ flexShrink: 0, width: 44, borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(0,0,0,0.04)', color: copied ? '#16a34a' : 'rgba(0,0,0,0.55)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
    </div>
  );
}

function ApiField({ title, hint, value, onChange, source, defVal, onReset, health }: {
  title: string; hint: string; value: string; onChange: (v: string) => void;
  source?: string; defVal?: string; onReset: () => void; health?: HealthApi;
}) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1a1a2e' }}>{title}</h3>
        {source && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8, background: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>
            source : {source}
          </span>
        )}
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>{hint}</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={defVal}
          spellCheck={false}
          style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.15)', background: '#fff', color: '#1a1a2e', fontSize: 14, fontFamily: 'monospace', outline: 'none' }}
        />
        <button onClick={onReset} title="Réinitialiser à la valeur par défaut"
          style={{ padding: '11px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(0,0,0,0.03)', color: 'rgba(0,0,0,0.55)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <RotateCcw size={16} />
        </button>
      </div>
      {health && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600,
          color: health.reachable ? '#16a34a' : '#ef4444' }}>
          {health.reachable ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {health.reachable
            ? `Joignable (HTTP ${health.httpStatus ?? '?'} · ${health.ms} ms)`
            : `Injoignable (${health.error ?? 'erreur'} · ${health.ms} ms)`}
        </div>
      )}
    </div>
  );
}
