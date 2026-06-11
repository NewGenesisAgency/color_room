'use client';

/**
 * @file app/configuration/page.tsx
 * @brief Page de configuration des APIs et de contrôle direct des canaux LED.
 *
 * Permet de modifier « à chaud » (sans redémarrer le serveur) les adresses des
 * deux APIs externes : la Supervision (pilotage des 42 dalles) et la CS-160
 * (colorimètre Konica). Les URLs sont chargées et enregistrées via /api/config,
 * puis testées via /api/health. La page propose aussi un panneau de contrôle
 * direct des 32 canaux spectraux d'une dalle (ou de toutes) : des sliders
 * envoient les valeurs (debounce 200 ms) via /api/supervision/batch. Enfin, une
 * section « Notes » donne les commandes PowerShell pour ouvrir/rediriger les
 * ports Windows nécessaires à la Supervision.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, Save, RotateCcw, Activity, CheckCircle2, XCircle, Loader2, Terminal, Copy, Check, Sliders, Zap, Moon, AlertTriangle } from 'lucide-react';
import NavigationMenu from '@/app/_components/NavigationMenu';
import { CHANNELS_ROUGE, CHANNELS_BLEU, getPlateType, type TileType } from '@/lib/tileChannels';

/**
 * @brief Convertit une couleur RGB normalisée (0..1) en chaîne hexadécimale.
 *
 * @param r Composante rouge (0..1).
 * @param g Composante verte (0..1).
 * @param b Composante bleue (0..1).
 * @returns La couleur au format '#rrggbb'.
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

/**
 * @brief Construit les métadonnées d'affichage (libellé + couleur) des canaux.
 *
 * Préfixe le libellé de la longueur d'onde (nm) si disponible et convertit la
 * couleur RGB du canal en hexadécimal pour la pastille colorée du slider.
 *
 * @param channels Table de canaux (CHANNELS_ROUGE ou CHANNELS_BLEU).
 * @returns Un tableau d'objets { label, color } parallèle aux canaux.
 */
function buildChannelMeta(channels: typeof CHANNELS_ROUGE) {
  return channels.map(ch => ({
    label: ch.nm != null ? `${ch.label} ${ch.nm}nm` : ch.label,
    color: rgbToHex(ch.rgb[0], ch.rgb[1], ch.rgb[2]),
  }));
}

/** @brief Instantané d'une URL d'API : valeur courante, source et valeur par défaut. */
type ApiSnapshot = { value: string; source: string; default: string };
/** @brief Instantané de configuration des deux APIs (supervision + cs160). */
type ConfigSnapshot = { supervision: ApiSnapshot; cs160: ApiSnapshot };

/** @brief Résultat de test de joignabilité d'une API (statut HTTP, latence, erreur). */
type HealthApi = { url: string; reachable: boolean; httpStatus?: number; ms: number; error?: string };
/** @brief Résultat global du test /health pour les deux APIs (ou null si non testé). */
type HealthResult = { supervision: HealthApi; cs160: HealthApi; allReachable: boolean } | null;

/**
 * @brief Composant de la page de configuration.
 *
 * Gère le chargement/enregistrement des URLs d'API (/api/config), le test de
 * santé (/api/health) et l'envoi des 32 canaux LED (/api/supervision/batch).
 *
 * @returns L'arbre JSX de la page de configuration.
 */
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

  // 32 canaux LED - état des sliders
  const [channels, setChannels] = useState<number[]>(Array(32).fill(0));
  const [targetPlate, setTargetPlate] = useState<number>(0); // 0 = toutes les plaques
  const [previewType, setPreviewType] = useState<TileType>('rouge');
  const [sendingChannels, setSendingChannels] = useState(false);
  const [channelMsg, setChannelMsg] = useState('');
  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** @brief Charge la configuration courante des URLs d'API depuis /api/config. */
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

  /**
   * @brief Enregistre les URLs saisies via POST /api/config, puis relance un test.
   */
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

  /** @brief Teste la joignabilité des deux APIs via GET /api/health?full=1. */
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

  /**
   * @brief Envoie les valeurs des 32 canaux via /api/supervision/batch.
   *
   * Clampe chaque valeur dans [0,255] puis cible soit toutes les dalles (1..42)
   * si plate vaut 0, soit la dalle indiquée.
   *
   * @param chans Tableau des 32 valeurs de canaux.
   * @param plate Identifiant de dalle ciblée (0 = toutes).
   */
  const sendChannels = useCallback(async (chans: number[], plate: number) => {
    setSendingChannels(true); setChannelMsg('');
    const channelArray = chans.map((v, i) => ({ index: i, value: Math.max(0, Math.min(255, Math.round(v))) }));
    const plates = plate === 0
      ? Array.from({ length: 42 }, (_, i) => ({ plateId: i + 1, channels: channelArray }))
      : [{ plateId: plate, channels: channelArray }];
    try {
      const res = await fetch('/api/supervision/batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plates, force: true }),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      setChannelMsg(res.ok ? `✓ Envoyé sur ${plate === 0 ? '42 dalles' : `dalle ${plate}`}` : `✗ Erreur (${res.status})`);
    } catch { setChannelMsg('✗ Erreur réseau'); }
    finally { setSendingChannels(false); }
  }, []);

  /**
   * @brief Met à jour un canal et planifie un envoi auto (debounce 200 ms).
   *
   * @param idx Index du canal (0..31).
   * @param val Nouvelle valeur du canal (0..255).
   */
  function setChannel(idx: number, val: number) {
    const next = channels.map((v, i) => i === idx ? val : v);
    setChannels(next);
    if (sendTimeoutRef.current) clearTimeout(sendTimeoutRef.current);
    sendTimeoutRef.current = setTimeout(() => sendChannels(next, targetPlate), 200);
  }

  /**
   * @brief Réinitialise un champ d'URL à sa valeur par défaut.
   *
   * @param which API concernée ('supervision' ou 'cs160').
   */
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

            {error && <p style={{ color: '#ef4444', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={15} /> {error}</p>}
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
                {health.allReachable ? 'Les deux APIs répondent correctement ✓' : 'Une ou plusieurs APIs sont injoignables - vérifiez les adresses et le réseau.'}
              </div>
            )}

            {/* ── Contrôle des 32 canaux LED ─────────────────────────────────── */}
            <div style={{ marginTop: 28, background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Sliders size={18} color="#4361ee" />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1a1a2e' }}>Contrôle des canaux LED (32)</h3>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(0,0,0,0.6)' }}>Dalle :</label>
                  <select value={targetPlate} onChange={e => { const p = Number(e.target.value); setTargetPlate(p); if (p > 0) setPreviewType(getPlateType(p)); }}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.15)', background: '#fff', fontSize: 13, fontFamily: 'inherit' }}>
                    <option value={0}>Toutes (1-42)</option>
                    {Array.from({ length: 42 }, (_, i) => <option key={i + 1} value={i + 1}>Dalle {i + 1}</option>)}
                  </select>
                  <button onClick={() => { const all = Array(32).fill(255); setChannels(all); void sendChannels(all, targetPlate); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#4361ee,#7c3aed)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                    <Zap size={14} /> Tout au max
                  </button>
                  <button onClick={() => { const all = Array(32).fill(0); setChannels(all); void sendChannels(all, targetPlate); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.8)', color: '#1a1a2e', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                    <Moon size={14} /> Éteindre
                  </button>
                  <button onClick={() => void sendChannels(channels, targetPlate)} disabled={sendingChannels}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, border: 'none', background: 'rgba(5,150,105,0.1)', color: '#059669', borderColor: 'rgba(5,150,105,0.2)', fontWeight: 800, fontSize: 13, cursor: sendingChannels ? 'not-allowed' : 'pointer' }}>
                    {sendingChannels ? <Loader2 size={14} className="cfg-spin" /> : <Activity size={14} />} Envoyer
                  </button>
                </div>
              </div>
              {channelMsg && <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: channelMsg.startsWith('✓') ? '#059669' : '#ef4444' }}>{channelMsg}</p>}
              <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(0,0,0,0.45)', lineHeight: 1.5 }}>
                Contrôlez chaque canal spectral (0-255). Les sliders envoient automatiquement (200 ms de debounce) sur la dalle sélectionnée.
              </p>

              {/* Sélecteur de type de dalle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(0,0,0,0.6)' }}>Type de dalle :</span>
                {(['rouge', 'bleu'] as TileType[]).map(t => (
                  <button key={t} onClick={() => setPreviewType(t)}
                    style={{ padding: '5px 14px', borderRadius: 8, border: `2px solid ${previewType === t ? (t === 'rouge' ? '#ef4444' : '#3b82f6') : 'rgba(0,0,0,0.12)'}`, background: previewType === t ? (t === 'rouge' ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)') : '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', color: previewType === t ? (t === 'rouge' ? '#ef4444' : '#3b82f6') : 'rgba(0,0,0,0.5)', transition: 'all .15s' }}>
                    {t === 'rouge' ? 'Rouge' : 'Bleu'}
                  </button>
                ))}
                {targetPlate > 0 && (
                  <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', fontStyle: 'italic' }}>
                    (dalle {targetPlate} = type {previewType} détecté automatiquement)
                  </span>
                )}
              </div>

              {/* Sliders groupés */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px 12px' }}>
                {buildChannelMeta(previewType === 'rouge' ? CHANNELS_ROUGE : CHANNELS_BLEU).map(({ label, color }, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,0,0,0.65)' }}>Ch.{idx} {label}</span>
                      </div>
                      <input type="number" min={0} max={255} value={channels[idx] ?? 0}
                        onChange={e => setChannel(idx, Math.max(0, Math.min(255, Number(e.target.value))))}
                        style={{ width: 44, padding: '1px 4px', borderRadius: 5, border: '1px solid rgba(0,0,0,0.12)', background: '#fff', fontSize: 11, textAlign: 'right', fontFamily: 'monospace' }} />
                    </div>
                    <input type="range" min={0} max={255} value={channels[idx] ?? 0}
                      onChange={e => setChannel(idx, Number(e.target.value))}
                      style={{ width: '100%', accentColor: color, height: 4, cursor: 'pointer' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Notes : ouvrir le port et faire marcher la redirection (Windows) */}
            <div style={{ marginTop: 28, background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Terminal size={18} color="#7c3aed" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1a1a2e' }}>Notes - ouvrir les ports (Windows)</h3>
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

/**
 * @brief Bloc de commande shell copiable (libellé + code + bouton « copier »).
 *
 * @param label Description de l'étape affichée au-dessus de la commande.
 * @param command La commande à afficher et à copier dans le presse-papier.
 * @returns Le bloc JSX de commande avec retour visuel de copie.
 */
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

/**
 * @brief Champ de saisie d'une URL d'API avec libellé, source, reset et état de santé.
 *
 * @param title Titre de l'API.
 * @param hint Indication courte (endpoint de test, etc.).
 * @param value Valeur courante de l'URL.
 * @param onChange Callback appelé à chaque modification du champ.
 * @param source Origine de la valeur (variable d'env, défaut, override…).
 * @param defVal Valeur par défaut, utilisée comme placeholder.
 * @param onReset Callback de réinitialisation à la valeur par défaut.
 * @param health Résultat de test de joignabilité, affiché s'il est présent.
 * @returns La carte JSX du champ d'API.
 */
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
