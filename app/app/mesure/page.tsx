'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Power, Lightbulb, Gauge, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function MesurePage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [measurement, setMeasurement] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [measurementTime, setMeasurementTime] = useState(0.5);
  const [backlight, setBacklight] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  // Check connection status on load
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/cs150?action=status', { cache: 'no-store' });
      const data = await res.json();
      setIsConnected(data.success && data.connected);
      setStatus(data.success ? 'Connecté' : 'Déconnecté');
    } catch (err) {
      setIsConnected(false);
      setStatus('Erreur de connexion');
    }
  };

  const connect = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/cs150', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'connect' })
      });
      const data = await res.json();
      if (data.success) {
        setIsConnected(true);
        setStatus('Connecté au CS150');
      } else {
        setError(data.error || 'Échec de connexion');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    }
    setIsLoading(false);
  };

  const disconnect = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/cs150', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' })
      });
      setIsConnected(false);
      setStatus('Déconnecté');
      setMeasurement(null);
    } catch (err: any) {
      setError(err.message);
    }
    setIsLoading(false);
  };

  const measure = async () => {
    setIsLoading(true);
    setError('');
    setMeasurement(null);
    
    try {
      // First trigger measurement
      const measureRes = await fetch('/api/cs150', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'measure' })
      });
      const measureData = await measureRes.json();
      
      if (!measureData.success) {
        setError(measureData.error || 'Échec de la mesure');
        setIsLoading(false);
        return;
      }

      // Wait a bit for measurement to complete
      await new Promise(r => setTimeout(r, 1000));

      // Get XYZ values
      const xyzRes = await fetch('/api/cs150?action=readXYZ', { cache: 'no-store' });
      const xyzData = await xyzRes.json();

      // Get Lvxy values
      const lvxyRes = await fetch('/api/cs150?action=readLvxy', { cache: 'no-store' });
      const lvxyData = await lvxyRes.json();

      const result = {
        timestamp: new Date().toLocaleTimeString(),
        xyz: xyzData.success ? { X: xyzData.X, Y: xyzData.Y, Z: xyzData.Z } : null,
        lvxy: lvxyData.success ? { Lv: lvxyData.Lv, x: lvxyData.x, y: lvxyData.y } : null,
        error: !xyzData.success && !lvxyData.success ? 'Données non disponibles' : null
      };

      setMeasurement(result);
      setHistory(prev => [result, ...prev].slice(0, 10));
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mesure');
    }
    setIsLoading(false);
  };

  const setBacklightMode = async (mode: boolean) => {
    try {
      await fetch('/api/cs150', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'setBacklight', params: { mode: mode ? 1 : 0 } })
      });
      setBacklight(mode);
    } catch (err: any) {
      setError('Erreur rétroéclairage: ' + err.message);
    }
  };

  const setMeasTime = async (time: number) => {
    try {
      await fetch('/api/cs150', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'setMeasurementTime', params: { time } })
      });
      setMeasurementTime(time);
    } catch (err: any) {
      setError('Erreur temps de mesure: ' + err.message);
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ 
          width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #667eea, #764ba2)', 
          display: 'grid', placeItems: 'center' 
        }}>
          <Gauge size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Test Colorimètre CS150</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#666' }}>Konica Minolta - Mesure de luminance et chromaticité</p>
        </div>
      </div>

      {/* Status Card */}
      <div style={{ 
        padding: 20, borderRadius: 16, background: isConnected ? '#f0fdf4' : '#fef2f2',
        border: `2px solid ${isConnected ? '#86efac' : '#fecaca'}`,
        marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16
      }}>
        <div style={{ 
          width: 44, height: 44, borderRadius: 12, 
          background: isConnected ? '#22c55e' : '#ef4444',
          display: 'grid', placeItems: 'center'
        }}>
          {isConnected ? <CheckCircle size={22} color="#fff" /> : <XCircle size={22} color="#fff" />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: isConnected ? '#166534' : '#991b1b' }}>
            {isConnected ? 'Appareil connecté' : 'Appareil déconnecté'}
          </div>
          <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
            {status}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isConnected ? (
            <button 
              onClick={connect} 
              disabled={isLoading}
              style={{
                padding: '10px 20px', borderRadius: 8, border: 'none',
                background: '#22c55e', color: '#fff', fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              <Power size={16} />
              {isLoading ? 'Connexion...' : 'Connecter'}
            </button>
          ) : (
            <button 
              onClick={disconnect}
              disabled={isLoading}
              style={{
                padding: '10px 20px', borderRadius: 8, border: 'none',
                background: '#ef4444', color: '#fff', fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              <Power size={16} />
              Déconnecter
            </button>
          )}
          <button 
            onClick={checkStatus}
            disabled={isLoading}
            style={{
              padding: '10px 16px', borderRadius: 8, border: '1px solid #ddd',
              background: '#fff', color: '#333', fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={16} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ 
          padding: 16, borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca',
          color: '#991b1b', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12
        }}>
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
        <div style={{ padding: 20, borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} />
            Configuration
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6 }}>Temps de mesure (s)</label>
              <select 
                value={measurementTime} 
                onChange={(e) => setMeasTime(parseFloat(e.target.value))}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd' }}
              >
                <option value={0.1}>0.1s (rapide)</option>
                <option value={0.5}>0.5s (normal)</option>
                <option value={1.0}>1.0s (précis)</option>
                <option value={2.0}>2.0s (très précis)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6 }}>Rétroéclairage</label>
              <button
                onClick={() => setBacklightMode(!backlight)}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid #ddd',
                  background: backlight ? '#fef3c7' : '#fff',
                  color: backlight ? '#92400e' : '#333',
                  display: 'flex', alignItems: 'center', gap: 8,
                  cursor: 'pointer'
                }}
              >
                <Lightbulb size={16} />
                {backlight ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* Measure Button */}
        <button
          onClick={measure}
          disabled={!isConnected || isLoading}
          style={{
            padding: '20px 40px', borderRadius: 16, border: 'none',
            background: isConnected ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#cbd5e1',
            color: '#fff', fontSize: 18, fontWeight: 700,
            cursor: (!isConnected || isLoading) ? 'not-allowed' : 'pointer',
            opacity: (!isConnected || isLoading) ? 0.6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12
          }}
        >
          <Activity size={24} />
          {isLoading ? 'Mesure en cours...' : 'Lancer une mesure'}
        </button>
      </div>

      {/* Results */}
      {measurement && (
        <div style={{ padding: 24, borderRadius: 16, background: '#f0f9ff', border: '2px solid #7dd3fc', marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#0369a1' }}>
            Résultats de la mesure ({measurement.timestamp})
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {measurement.lvxy && (
              <div style={{ padding: 16, borderRadius: 12, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>Luminance & Chromaticité</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#0c4a6e' }}>
                  {measurement.lvxy.Lv?.toFixed(2) || '--'} <span style={{ fontSize: 14 }}>cd/m²</span>
                </div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 8 }}>
                  x: {measurement.lvxy.x?.toFixed(4) || '--'}<br/>
                  y: {measurement.lvxy.y?.toFixed(4) || '--'}
                </div>
              </div>
            )}
            
            {measurement.xyz && (
              <div style={{ padding: 16, borderRadius: 12, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>Valeurs XYZ</div>
                <div style={{ fontSize: 14, color: '#0c4a6e', lineHeight: 1.6 }}>
                  X: {measurement.xyz.X?.toFixed(2) || '--'}<br/>
                  Y: {measurement.xyz.Y?.toFixed(2) || '--'}<br/>
                  Z: {measurement.xyz.Z?.toFixed(2) || '--'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div style={{ padding: 20, borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Historique (10 dernières mesures)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((h, i) => (
              <div key={i} style={{ 
                padding: 12, borderRadius: 8, background: '#fff', fontSize: 13,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span style={{ color: '#666' }}>{h.timestamp}</span>
                <span style={{ fontWeight: 600, color: '#0369a1' }}>
                  {h.lvxy ? `${h.lvxy.Lv?.toFixed(2)} cd/m²` : 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
