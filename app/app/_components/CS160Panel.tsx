'use client';

/**
 * @file app/_components/CS160Panel.tsx
 * @brief Panneau de pilotage du colorimètre CS-160 (connexion, mesure, calibration).
 *
 * Composant React "dark glass" qui expose toute l'interface utilisateur du
 * colorimètre CS-160 via le service `cs160Service` : connexion / déconnexion,
 * mesure One-Shot (affichage Lvxy et XYZ), commande du rétroéclairage, choix du
 * canal de calibration actif et lancement des calibrations RGB (3 références XYZ)
 * ou Single Point (référence blanc Lv,x,y). Tous les retours sont affichés dans
 * une zone de log. La seule prop est `className` pour styliser le conteneur ; le
 * composant gère lui-même son état (connexion, valeurs de référence, etc.).
 */

import { useState, useCallback } from 'react';
import {
  cs160Service,
  type XYZ,
  type Lvxy,
  type CS160Status,
  type CalibType
} from '@/app/_services/cs160';
import {
  Plug,
  Unplug,
  Play,
  Lightbulb,
  Target,
  Palette,
  Save,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// ── Tokens dark glass (identiques aux jeux) ────────────────────────────────────
const D: Record<string, React.CSSProperties> = {
  wrap: {
    background: 'linear-gradient(160deg,#0b0f1c,#0d1226)',
    border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 18,
    color: '#e8eaf0',
    fontFamily: 'system-ui,-apple-system,sans-serif',
    overflow: 'hidden',
  },
  section: {
    background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 12,
    padding: '12px 14px',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 800,
    color: 'rgba(255,255,255,.38)',
    textTransform: 'uppercase' as const,
    letterSpacing: '.1em',
    marginBottom: 10,
  },
  btnPrimary: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '10px 16px', borderRadius: 10, border: 'none',
    background: 'linear-gradient(135deg,#06d6a0,#4361ee)',
    boxShadow: '0 4px 14px rgba(6,214,160,.25)',
    color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnGhost: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 10,
    border: '1px solid rgba(255,255,255,.12)',
    background: 'rgba(255,255,255,.05)',
    color: 'rgba(255,255,255,.7)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  input: {
    width: '100%', padding: '7px 10px', borderRadius: 8,
    background: 'rgba(255,255,255,.07)',
    border: '1px solid rgba(255,255,255,.12)',
    color: '#e8eaf0', fontSize: 12, fontFamily: 'monospace',
    boxSizing: 'border-box' as const,
  },
  select: {
    width: '100%', padding: '7px 8px', borderRadius: 8,
    background: 'rgba(255,255,255,.07)',
    border: '1px solid rgba(255,255,255,.12)',
    color: '#e8eaf0', fontSize: 12,
    boxSizing: 'border-box' as const,
  },
  label: {
    fontSize: 10, color: 'rgba(255,255,255,.38)', fontWeight: 700,
    textTransform: 'uppercase' as const, letterSpacing: '.06em',
    display: 'block', marginBottom: 4,
  },
};

/** Props du panneau CS-160. */
interface CS160PanelProps {
  /** Classe CSS appliquée au conteneur racine (pour positionnement/largeur). */
  className?: string;
}

/**
 * Panneau de contrôle complet du colorimètre CS-160.
 *
 * @param className Classe CSS optionnelle ajoutée au conteneur racine.
 * @returns L'interface de connexion, de mesure et de calibration du CS-160.
 */
export default function CS160Panel({ className = '' }: CS160PanelProps) {
  const [isConnected, setIsConnected]     = useState(false);
  const [isConnecting, setIsConnecting]   = useState(false);
  const [deviceInfo, setDeviceInfo]       = useState<string>('');
  const [isMeasuring, setIsMeasuring]     = useState(false);
  const [lastMeasurement, setLastMeasurement] = useState<{ xyz: XYZ | null; lvxy: Lvxy | null } | null>(null);
  const [activeCalibCh, setActiveCalibCh] = useState(0);
  const [showCalibPanel, setShowCalibPanel] = useState(false);
  const [calibType, setCalibType]         = useState<CalibType>('RGB');
  const [trueRed, setTrueRed]             = useState<XYZ>({ X: 800, Y: 400, Z: 300 });
  const [trueGreen, setTrueGreen]         = useState<XYZ>({ X: 600, Y: 1000, Z: 400 });
  const [trueBlue, setTrueBlue]           = useState<XYZ>({ X: 500, Y: 600, Z: 1000 });
  const [trueWhite, setTrueWhite]         = useState<Lvxy>({ Lv: 11.0, x: 0.4, y: 0.4 });
  const [calibId, setCalibId]             = useState('calib_001');
  const [targetChannel, setTargetChannel] = useState(1);
  const [message, setMessage]             = useState('');

  const log = useCallback((msg: string) => { setMessage(msg); }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    if (isConnected) {
      const ok = await cs160Service.disconnect();
      if (ok) { setIsConnected(false); setDeviceInfo(''); log('Déconnecté'); }
    } else {
      const ok = await cs160Service.connect();
      if (ok) {
        setIsConnected(true);
        const status = await cs160Service.getStatus();
        setDeviceInfo(status.deviceInfo || 'CS-160');
        setActiveCalibCh(status.calibChannel);
        log('Connecté — ' + (status.deviceInfo || 'CS-160'));
      } else {
        log('Erreur de connexion');
      }
    }
    setIsConnecting(false);
  };

  const handleMeasure = async () => {
    if (!isConnected) { log('Non connecté'); return; }
    setIsMeasuring(true);
    log('Mesure en cours…');
    const result = await cs160Service.oneShotMeasurement();
    if (result.xyz || result.lvxy) {
      setLastMeasurement(result);
      log(`Lv: ${result.lvxy?.Lv.toFixed(2)} cd/m²  x: ${result.lvxy?.x.toFixed(4)}  y: ${result.lvxy?.y.toFixed(4)}`);
    } else {
      log('Erreur de mesure');
    }
    setIsMeasuring(false);
  };

  const handleBacklight = async (on: boolean) => {
    if (!isConnected) { log('Non connecté'); return; }
    const ok = await cs160Service.setBacklight(on ? 'on' : 'off');
    log(ok ? `Rétroéclairage ${on ? 'ON' : 'OFF'}` : 'Erreur rétroéclairage');
  };

  const handleSetCalibCh = async (ch: number) => {
    if (!isConnected) { log('Non connecté'); return; }
    const ok = await cs160Service.setCalibrationCh(ch);
    if (ok) { setActiveCalibCh(ch); log(`Canal ${ch} actif`); }
  };

  const handleRGBCalibration = async () => {
    if (!isConnected) { log('Non connecté'); return; }
    setIsMeasuring(true);
    log('Calibration RGB…');
    const ok = await cs160Service.performRGBCalibration(trueRed, trueGreen, trueBlue, calibId, targetChannel);
    if (ok) { setActiveCalibCh(targetChannel); log(`Calibration RGB terminée — canal ${targetChannel}`); }
    else log('Erreur calibration RGB');
    setIsMeasuring(false);
  };

  const handleSinglePointCalibration = async () => {
    if (!isConnected) { log('Non connecté'); return; }
    setIsMeasuring(true);
    log('Calibration Single Point…');
    const ok = await cs160Service.performSinglePointCalibration(trueWhite, calibId, targetChannel);
    if (ok) { setActiveCalibCh(targetChannel); log(`Calibration terminée — canal ${targetChannel}`); }
    else log('Erreur calibration');
    setIsMeasuring(false);
  };

  const connectedColor = isConnected ? '#06d6a0' : '#ef4444';

  return (
    <div className={`cs160-panel ${className}`} style={D.wrap}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 14px' }}>

        {/* ── Header connexion ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: connectedColor, flexShrink: 0, boxShadow: `0 0 8px ${connectedColor}` }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>CS-160 Colorimètre</div>
            {deviceInfo && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 1 }}>{deviceInfo}</div>}
          </div>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            style={{
              ...D.btnGhost,
              color: isConnected ? '#ef9999' : '#06d6a0',
              borderColor: isConnected ? 'rgba(239,68,68,.3)' : 'rgba(6,214,160,.3)',
              opacity: isConnecting ? 0.6 : 1,
              cursor: isConnecting ? 'wait' : 'pointer',
              flexShrink: 0,
            }}
          >
            {isConnected ? <Unplug size={13} /> : <Plug size={13} />}
            {isConnecting ? '…' : (isConnected ? 'Déconnecter' : 'Connecter')}
          </button>
        </div>

        {/* ── Message log ── */}
        {message && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', padding: '7px 10px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, fontFamily: 'monospace' }}>
            {message}
          </div>
        )}

        {/* ── Mesure ── */}
        <div style={D.section}>
          <div style={D.sectionTitle}>Mesure</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleMeasure}
              disabled={!isConnected || isMeasuring}
              style={{ ...D.btnPrimary, flex: 1, opacity: (!isConnected || isMeasuring) ? 0.5 : 1, cursor: (!isConnected || isMeasuring) ? 'not-allowed' : 'pointer' }}
            >
              <Play size={14} />
              {isMeasuring ? 'Mesure…' : 'One-Shot'}
            </button>
            <button
              onClick={() => handleBacklight(true)}
              disabled={!isConnected}
              style={{ ...D.btnGhost, opacity: isConnected ? 1 : 0.4, cursor: isConnected ? 'pointer' : 'not-allowed', flexShrink: 0 }}
              title="Rétroéclairage ON"
            >
              <Lightbulb size={14} />
            </button>
          </div>

          {lastMeasurement && (lastMeasurement.lvxy || lastMeasurement.xyz) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
              {lastMeasurement.lvxy && (
                <div style={{ padding: '8px 10px', background: 'rgba(6,214,160,.08)', border: '1px solid rgba(6,214,160,.2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#06d6a0', letterSpacing: '.06em', marginBottom: 4 }}>Lvxy</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6, color: '#e8eaf0' }}>
                    Lv: {lastMeasurement.lvxy.Lv.toFixed(2)}<br />
                    x: {lastMeasurement.lvxy.x.toFixed(4)}<br />
                    y: {lastMeasurement.lvxy.y.toFixed(4)}
                  </div>
                </div>
              )}
              {lastMeasurement.xyz && (
                <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,.38)', letterSpacing: '.06em', marginBottom: 4 }}>XYZ</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6, color: '#e8eaf0' }}>
                    X: {lastMeasurement.xyz.X.toFixed(2)}<br />
                    Y: {lastMeasurement.xyz.Y.toFixed(2)}<br />
                    Z: {lastMeasurement.xyz.Z.toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Calibration ── */}
        <div style={D.section}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showCalibPanel ? 10 : 0 }}>
            <div style={D.sectionTitle}>Calibration — <span style={{ color: '#a78bfa' }}>Ch {activeCalibCh}</span></div>
            <button
              onClick={() => setShowCalibPanel(v => !v)}
              style={{ ...D.btnGhost, padding: '4px 8px', fontSize: 11 }}
            >
              {showCalibPanel ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>

          {/* Sélection rapide canal */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[0, 1, 2, 3, 4, 5].map(ch => (
              <button
                key={ch}
                onClick={() => handleSetCalibCh(ch)}
                disabled={!isConnected}
                style={{
                  padding: '4px 10px', borderRadius: 7,
                  border: `1px solid ${activeCalibCh === ch ? 'rgba(139,92,246,.5)' : 'rgba(255,255,255,.1)'}`,
                  background: activeCalibCh === ch ? 'rgba(139,92,246,.2)' : 'rgba(255,255,255,.04)',
                  color: activeCalibCh === ch ? '#a78bfa' : 'rgba(255,255,255,.45)',
                  fontSize: 11, fontWeight: 700, cursor: isConnected ? 'pointer' : 'not-allowed',
                  opacity: isConnected ? 1 : 0.4, fontFamily: 'inherit',
                }}
              >
                Ch{ch}
              </button>
            ))}
          </div>

          {showCalibPanel && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>

              {/* Type de calibration */}
              <div style={{ display: 'flex', gap: 6 }}>
                {(['RGB', 'OnePoint'] as CalibType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setCalibType(t)}
                    style={{
                      flex: 1, padding: '7px 10px', borderRadius: 8,
                      border: `1px solid ${calibType === t ? 'rgba(139,92,246,.5)' : 'rgba(255,255,255,.1)'}`,
                      background: calibType === t ? 'rgba(139,92,246,.15)' : 'rgba(255,255,255,.04)',
                      color: calibType === t ? '#a78bfa' : 'rgba(255,255,255,.55)',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      fontFamily: 'inherit',
                    }}
                  >
                    {t === 'RGB' ? <Palette size={12} /> : <Target size={12} />}
                    {t === 'RGB' ? 'RGB' : '1 Point'}
                  </button>
                ))}
              </div>

              {/* ID + canal cible */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                <div>
                  <label style={D.label}>ID Calib</label>
                  <input type="text" value={calibId} onChange={e => setCalibId(e.target.value)} style={D.input} />
                </div>
                <div>
                  <label style={D.label}>Canal</label>
                  <select value={targetChannel} onChange={e => setTargetChannel(Number(e.target.value))} style={D.select}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(ch => <option key={ch} value={ch}>{ch}</option>)}
                  </select>
                </div>
              </div>

              {calibType === 'RGB' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={D.sectionTitle}>Valeurs de référence XYZ</div>
                  {([
                    { label: 'R', color: '#ef4444', val: trueRed,   set: setTrueRed   },
                    { label: 'G', color: '#22c55e', val: trueGreen, set: setTrueGreen },
                    { label: 'B', color: '#3b82f6', val: trueBlue,  set: setTrueBlue  },
                  ] as { label: string; color: string; val: XYZ; set: (v: XYZ) => void }[]).map(({ label, color, val, set }) => (
                    <div key={label} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 4, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color, width: 14, textAlign: 'center' }}>{label}</span>
                      {(['X', 'Y', 'Z'] as (keyof XYZ)[]).map(k => (
                        <input key={k} type="number" value={val[k]} onChange={e => set({ ...val, [k]: Number(e.target.value) })}
                          placeholder={k}
                          style={{ ...D.input, textAlign: 'center' as const }} />
                      ))}
                    </div>
                  ))}
                  <button
                    onClick={handleRGBCalibration}
                    disabled={!isConnected || isMeasuring}
                    style={{ ...D.btnPrimary, background: 'linear-gradient(135deg,#8b5cf6,#4361ee)', opacity: (!isConnected || isMeasuring) ? 0.5 : 1, cursor: (!isConnected || isMeasuring) ? 'not-allowed' : 'pointer' }}
                  >
                    <Save size={13} />
                    {isMeasuring ? 'Calibration…' : 'Calibrer RGB'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={D.sectionTitle}>Référence blanc (Lv, x, y)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {[
                      { k: 'Lv', label: 'Lv (cd/m²)', step: '0.1' },
                      { k: 'x',  label: 'x',           step: '0.001' },
                      { k: 'y',  label: 'y',           step: '0.001' },
                    ].map(({ k, label, step }) => (
                      <div key={k}>
                        <label style={D.label}>{label}</label>
                        <input type="number" step={step} value={trueWhite[k as keyof Lvxy]}
                          onChange={e => setTrueWhite({ ...trueWhite, [k]: Number(e.target.value) })}
                          style={D.input} />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleSinglePointCalibration}
                    disabled={!isConnected || isMeasuring}
                    style={{ ...D.btnPrimary, background: 'linear-gradient(135deg,#8b5cf6,#4361ee)', opacity: (!isConnected || isMeasuring) ? 0.5 : 1, cursor: (!isConnected || isMeasuring) ? 'not-allowed' : 'pointer' }}
                  >
                    <Save size={13} />
                    {isMeasuring ? 'Calibration…' : 'Calibrer Single Point'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
