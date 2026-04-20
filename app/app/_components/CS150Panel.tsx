'use client';

import { useState, useCallback } from 'react';
import { 
  cs150Service, 
  type XYZ, 
  type Lvxy, 
  type CS150Status,
  type CalibType 
} from '@/app/_services/cs150';
import { 
  Plug, 
  Unplug, 
  Play, 
  Settings2, 
  Lightbulb,
  Target,
  Palette,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface CS150PanelProps {
  className?: string;
}

export default function CS150Panel({ className = '' }: CS150PanelProps) {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<string>('');
  
  // Measurement state
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [lastMeasurement, setLastMeasurement] = useState<{ xyz: XYZ | null; lvxy: Lvxy | null } | null>(null);
  
  // Calibration state
  const [activeCalibCh, setActiveCalibCh] = useState(0);
  const [showCalibPanel, setShowCalibPanel] = useState(false);
  
  // Calibration inputs
  const [calibType, setCalibType] = useState<CalibType>('RGB');
  const [trueRed, setTrueRed] = useState<XYZ>({ X: 800, Y: 400, Z: 300 });
  const [trueGreen, setTrueGreen] = useState<XYZ>({ X: 600, Y: 1000, Z: 400 });
  const [trueBlue, setTrueBlue] = useState<XYZ>({ X: 500, Y: 600, Z: 1000 });
  const [trueWhite, setTrueWhite] = useState<Lvxy>({ Lv: 11.0, x: 0.4, y: 0.4 });
  const [calibId, setCalibId] = useState('calib_001');
  const [targetChannel, setTargetChannel] = useState(1);
  
  // Message/Log
  const [message, setMessage] = useState('');

  const log = useCallback((msg: string) => {
    setMessage(msg);
    console.log('[CS150]', msg);
  }, []);

  // Connect/Disconnect
  const handleConnect = async () => {
    if (isConnected) {
      setIsConnecting(true);
      const success = await cs150Service.disconnect();
      if (success) {
        setIsConnected(false);
        setDeviceInfo('');
        log('Déconnecté du CS150');
      }
      setIsConnecting(false);
    } else {
      setIsConnecting(true);
      const success = await cs150Service.connect();
      if (success) {
        setIsConnected(true);
        const status = await cs150Service.getStatus();
        setDeviceInfo(status.deviceInfo || 'CS150');
        setActiveCalibCh(status.calibChannel);
        log('Connecté au CS150');
      } else {
        log('Erreur de connexion');
      }
      setIsConnecting(false);
    }
  };

  // One-shot measurement
  const handleMeasure = async () => {
    if (!isConnected) {
      log('Non connecté');
      return;
    }
    
    setIsMeasuring(true);
    log('Mesure en cours...');
    
    const result = await cs150Service.oneShotMeasurement();
    
    if (result.xyz || result.lvxy) {
      setLastMeasurement(result);
      log(`Mesure OK - Lv: ${result.lvxy?.Lv.toFixed(2)} cd/m²`);
    } else {
      log('Erreur de mesure');
    }
    
    setIsMeasuring(false);
  };

  // Set backlight
  const handleBacklight = async (on: boolean) => {
    if (!isConnected) {
      log('Non connecté');
      return;
    }
    
    const success = await cs150Service.setBacklight(on ? 'on' : 'off');
    log(success ? `Rétroéclairage ${on ? 'ON' : 'OFF'}` : 'Erreur rétroéclairage');
  };

  // Set calibration channel
  const handleSetCalibCh = async (ch: number) => {
    if (!isConnected) {
      log('Non connecté');
      return;
    }
    
    const success = await cs150Service.setCalibrationCh(ch);
    if (success) {
      setActiveCalibCh(ch);
      log(`Canal de calibration ${ch} activé`);
    }
  };

  // RGB Calibration
  const handleRGBCalibration = async () => {
    if (!isConnected) {
      log('Non connecté');
      return;
    }
    
    setIsMeasuring(true);
    log('Calibration RGB démarrée... Mesurez R, puis G, puis B');
    
    const success = await cs150Service.performRGBCalibration(
      trueRed,
      trueGreen,
      trueBlue,
      calibId,
      targetChannel
    );
    
    if (success) {
      setActiveCalibCh(targetChannel);
      log(`Calibration RGB terminée - Canal ${targetChannel} actif`);
    } else {
      log('Erreur calibration RGB');
    }
    
    setIsMeasuring(false);
  };

  // Single Point Calibration
  const handleSinglePointCalibration = async () => {
    if (!isConnected) {
      log('Non connecté');
      return;
    }
    
    setIsMeasuring(true);
    log('Calibration Single Point démarrée...');
    
    const success = await cs150Service.performSinglePointCalibration(
      trueWhite,
      calibId,
      targetChannel
    );
    
    if (success) {
      setActiveCalibCh(targetChannel);
      log(`Calibration Single Point terminée - Canal ${targetChannel} actif`);
    } else {
      log('Erreur calibration');
    }
    
    setIsMeasuring(false);
  };

  return (
    <div className={`cs150-panel ${className}`} style={{ 
      padding: 16, 
      background: '#fff', 
      borderRadius: 12,
      border: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: '1px solid rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ 
            width: 10, 
            height: 10, 
            borderRadius: '50%', 
            background: isConnected ? '#22c55e' : '#ef4444',
            transition: 'background 0.2s'
          }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>CS150 Colorimètre</span>
          {deviceInfo && (
            <span style={{ fontSize: 12, color: '#666' }}>({deviceInfo})</span>
          )}
        </div>
        
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 6,
            border: 'none',
            background: isConnected ? '#fee2e2' : '#dcfce7',
            color: isConnected ? '#dc2626' : '#16a34a',
            fontSize: 12,
            fontWeight: 500,
            cursor: isConnecting ? 'wait' : 'pointer',
            opacity: isConnecting ? 0.7 : 1
          }}
        >
          {isConnected ? <Unplug size={14} /> : <Plug size={14} />}
          {isConnecting ? '...' : (isConnected ? 'Déconnecter' : 'Connecter')}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div style={{ 
          padding: '8px 12px', 
          background: '#f0f9ff', 
          borderRadius: 6,
          fontSize: 12,
          color: '#0369a1',
          marginBottom: 12
        }}>
          {message}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'grid', gap: 12 }}>
        
        {/* Measurement Section */}
        <div style={{ 
          padding: 12, 
          background: '#f8fafc', 
          borderRadius: 8,
          display: 'grid',
          gap: 10
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
            Mesure
          </div>
          
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleMeasure}
              disabled={!isConnected || isMeasuring}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '10px 16px',
                borderRadius: 8,
                border: 'none',
                background: isConnected ? '#3b82f6' : '#94a3b8',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: (!isConnected || isMeasuring) ? 'not-allowed' : 'pointer',
                opacity: (!isConnected || isMeasuring) ? 0.6 : 1
              }}
            >
              <Play size={16} />
              {isMeasuring ? 'Mesure...' : 'One-Shot'}
            </button>
            
            <button
              onClick={() => handleBacklight(true)}
              disabled={!isConnected}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#fff',
                color: '#475569',
                cursor: isConnected ? 'pointer' : 'not-allowed',
                opacity: isConnected ? 1 : 0.5
              }}
            >
              <Lightbulb size={16} />
            </button>
          </div>

          {/* Last Measurement Display */}
          {lastMeasurement && (lastMeasurement.xyz || lastMeasurement.lvxy) && (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              padding: 10,
              background: '#fff',
              borderRadius: 6,
              border: '1px solid #e2e8f0'
            }}>
              {lastMeasurement.xyz && (
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>XYZ</div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace' }}>
                    X: {lastMeasurement.xyz.X.toFixed(2)}<br/>
                    Y: {lastMeasurement.xyz.Y.toFixed(2)}<br/>
                    Z: {lastMeasurement.xyz.Z.toFixed(2)}
                  </div>
                </div>
              )}
              {lastMeasurement.lvxy && (
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Lvxy</div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace' }}>
                    Lv: {lastMeasurement.lvxy.Lv.toFixed(2)}<br/>
                    x: {lastMeasurement.lvxy.x.toFixed(4)}<br/>
                    y: {lastMeasurement.lvxy.y.toFixed(4)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Calibration Section */}
        <div style={{ 
          padding: 12, 
          background: '#f8fafc', 
          borderRadius: 8,
          display: 'grid',
          gap: 10
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between'
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
              Calibration (Ch: {activeCalibCh})
            </div>
            <button
              onClick={() => setShowCalibPanel(!showCalibPanel)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
                borderRadius: 4,
                border: 'none',
                background: 'transparent',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: 11
              }}
            >
              {showCalibPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {showCalibPanel && (
            <div style={{ display: 'grid', gap: 12 }}>
              {/* Calibration Type */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setCalibType('RGB')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid',
                    borderColor: calibType === 'RGB' ? '#3b82f6' : '#e2e8f0',
                    background: calibType === 'RGB' ? '#eff6ff' : '#fff',
                    color: calibType === 'RGB' ? '#3b82f6' : '#475569',
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  <Palette size={12} style={{ display: 'inline', marginRight: 4 }} />
                  RGB
                </button>
                <button
                  onClick={() => setCalibType('OnePoint')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid',
                    borderColor: calibType === 'OnePoint' ? '#3b82f6' : '#e2e8f0',
                    background: calibType === 'OnePoint' ? '#eff6ff' : '#fff',
                    color: calibType === 'OnePoint' ? '#3b82f6' : '#475569',
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  <Target size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Single Point
                </button>
              </div>

              {/* Calibration ID & Target Channel */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: '#64748b' }}>ID Calibration</label>
                  <input
                    type="text"
                    value={calibId}
                    onChange={(e) => setCalibId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: 4,
                      border: '1px solid #e2e8f0',
                      fontSize: 11
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#64748b' }}>Canal Cible</label>
                  <select
                    value={targetChannel}
                    onChange={(e) => setTargetChannel(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: 4,
                      border: '1px solid #e2e8f0',
                      fontSize: 11
                    }}
                  >
                    {[1,2,3,4,5,6,7,8,9,10].map(ch => (
                      <option key={ch} value={ch}>{ch}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reference Values */}
              {calibType === 'RGB' ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Valeurs de référence XYZ</div>
                  
                  {/* Red */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'auto 1fr 1fr 1fr',
                    gap: 4,
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: 10, color: '#ef4444' }}>R</span>
                    <input type="number" value={trueRed.X} onChange={e => setTrueRed({...trueRed, X: Number(e.target.value)})} style={{ padding: 4, fontSize: 10, borderRadius: 4, border: '1px solid #e2e8f0' }} placeholder="X" />
                    <input type="number" value={trueRed.Y} onChange={e => setTrueRed({...trueRed, Y: Number(e.target.value)})} style={{ padding: 4, fontSize: 10, borderRadius: 4, border: '1px solid #e2e8f0' }} placeholder="Y" />
                    <input type="number" value={trueRed.Z} onChange={e => setTrueRed({...trueRed, Z: Number(e.target.value)})} style={{ padding: 4, fontSize: 10, borderRadius: 4, border: '1px solid #e2e8f0' }} placeholder="Z" />
                  </div>
                  
                  {/* Green */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'auto 1fr 1fr 1fr',
                    gap: 4,
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: 10, color: '#22c55e' }}>G</span>
                    <input type="number" value={trueGreen.X} onChange={e => setTrueGreen({...trueGreen, X: Number(e.target.value)})} style={{ padding: 4, fontSize: 10, borderRadius: 4, border: '1px solid #e2e8f0' }} placeholder="X" />
                    <input type="number" value={trueGreen.Y} onChange={e => setTrueGreen({...trueGreen, Y: Number(e.target.value)})} style={{ padding: 4, fontSize: 10, borderRadius: 4, border: '1px solid #e2e8f0' }} placeholder="Y" />
                    <input type="number" value={trueGreen.Z} onChange={e => setTrueGreen({...trueGreen, Z: Number(e.target.value)})} style={{ padding: 4, fontSize: 10, borderRadius: 4, border: '1px solid #e2e8f0' }} placeholder="Z" />
                  </div>
                  
                  {/* Blue */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'auto 1fr 1fr 1fr',
                    gap: 4,
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: 10, color: '#3b82f6' }}>B</span>
                    <input type="number" value={trueBlue.X} onChange={e => setTrueBlue({...trueBlue, X: Number(e.target.value)})} style={{ padding: 4, fontSize: 10, borderRadius: 4, border: '1px solid #e2e8f0' }} placeholder="X" />
                    <input type="number" value={trueBlue.Y} onChange={e => setTrueBlue({...trueBlue, Y: Number(e.target.value)})} style={{ padding: 4, fontSize: 10, borderRadius: 4, border: '1px solid #e2e8f0' }} placeholder="Y" />
                    <input type="number" value={trueBlue.Z} onChange={e => setTrueBlue({...trueBlue, Z: Number(e.target.value)})} style={{ padding: 4, fontSize: 10, borderRadius: 4, border: '1px solid #e2e8f0' }} placeholder="Z" />
                  </div>

                  <button
                    onClick={handleRGBCalibration}
                    disabled={!isConnected || isMeasuring}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: isConnected ? '#8b5cf6' : '#94a3b8',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: (!isConnected || isMeasuring) ? 'not-allowed' : 'pointer',
                      opacity: (!isConnected || isMeasuring) ? 0.6 : 1,
                      marginTop: 4
                    }}
                  >
                    <Save size={14} />
                    {isMeasuring ? 'Calibration...' : 'Calibrer RGB'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Valeur de référence blanc (Lv, x, y)</div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                    <div>
                      <label style={{ fontSize: 9, color: '#94a3b8' }}>Lv (cd/m²)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={trueWhite.Lv} 
                        onChange={e => setTrueWhite({...trueWhite, Lv: Number(e.target.value)})} 
                        style={{ width: '100%', padding: 4, fontSize: 10, borderRadius: 4, border: '1px solid #e2e8f0' }} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 9, color: '#94a3b8' }}>x</label>
                      <input 
                        type="number" 
                        step="0.001"
                        value={trueWhite.x} 
                        onChange={e => setTrueWhite({...trueWhite, x: Number(e.target.value)})} 
                        style={{ width: '100%', padding: 4, fontSize: 10, borderRadius: 4, border: '1px solid #e2e8f0' }} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 9, color: '#94a3b8' }}>y</label>
                      <input 
                        type="number" 
                        step="0.001"
                        value={trueWhite.y} 
                        onChange={e => setTrueWhite({...trueWhite, y: Number(e.target.value)})} 
                        style={{ width: '100%', padding: 4, fontSize: 10, borderRadius: 4, border: '1px solid #e2e8f0' }} 
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSinglePointCalibration}
                    disabled={!isConnected || isMeasuring}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: isConnected ? '#8b5cf6' : '#94a3b8',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: (!isConnected || isMeasuring) ? 'not-allowed' : 'pointer',
                      opacity: (!isConnected || isMeasuring) ? 0.6 : 1,
                      marginTop: 4
                    }}
                  >
                    <Save size={14} />
                    {isMeasuring ? 'Calibration...' : 'Calibrer Single Point'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick Channel Select */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[0,1,2,3,4,5].map(ch => (
              <button
                key={ch}
                onClick={() => handleSetCalibCh(ch)}
                disabled={!isConnected}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: '1px solid',
                  borderColor: activeCalibCh === ch ? '#3b82f6' : '#e2e8f0',
                  background: activeCalibCh === ch ? '#eff6ff' : '#fff',
                  color: activeCalibCh === ch ? '#3b82f6' : '#475569',
                  fontSize: 10,
                  cursor: isConnected ? 'pointer' : 'not-allowed',
                  opacity: isConnected ? 1 : 0.5
                }}
              >
                Ch{ch}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
