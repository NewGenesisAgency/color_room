'use client';

import { useState, useEffect, useRef } from 'react';
import { LogIn, UserPlus, ArrowLeft, Eye, EyeOff, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import { AVATAR_ICON_NAMES, AvatarIcon } from './avatarIcons';

type AuthUser = {
  id: string; username: string; role: string;
  niveau: string | null; avatarColor: string; avatarIcon?: string;
};

interface Props {
  sessionChecked: boolean;
  onSuccess: (user: AuthUser) => void;
  initialClassCode?: string;
}

const AVATAR_COLORS = [
  '#4361ee', '#7209b7', '#f72585', '#e63946',
  '#2ec4b6', '#06d6a0', '#ffb703', '#fb8500',
  '#264653', '#8ecae6',
];

// ── Indicateur de force du mot de passe ──────────────────────────────────────
function pwdStrength(p: string): { score: number; label: string; color: string } {
  if (!p) return { score: 0, label: '', color: 'transparent' };
  let s = 0;
  if (p.length >= 4)  s++;
  if (p.length >= 8)  s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^a-zA-Z0-9]/.test(p)) s++;
  const map = [
    { score: 0, label: '', color: 'transparent' },
    { score: 1, label: 'Faible',  color: '#ef4444' },
    { score: 2, label: 'Correct', color: '#f97316' },
    { score: 3, label: 'Bon',     color: '#eab308' },
    { score: 4, label: 'Fort',    color: '#22c55e' },
  ];
  return map[s];
}

export default function LoginScreen({ sessionChecked, onSuccess, initialClassCode }: Props) {
  const [view, setView] = useState<'login' | 'register'>('login');
  const [mounted, setMounted] = useState(false);

  // ── Login ─────────────────────────────────────────────────────────────────
  const [loginUser, setLoginUser] = useState('');
  const [loginPwd, setLoginPwd] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // ── Register — wizard 3 étapes ────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [regUser, setRegUser] = useState('');
  const [regPwd, setRegPwd] = useState('');
  const [regPwd2, setRegPwd2] = useState('');
  const [regColor, setRegColor] = useState(AVATAR_COLORS[0]);
  const [regIcon, setRegIcon] = useState('User');
  const [regCode, setRegCode] = useState('');
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (initialClassCode?.trim()) {
      setRegCode(initialClassCode.trim().toUpperCase());
      setView('register'); setStep(3);
    }
  }, [initialClassCode]);

  // Focus auto à chaque changement de vue/étape
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [view, step]);

  async function handleLogin() {
    if (!loginUser.trim()) { setLoginError('Entrez votre nom d\'utilisateur'); return; }
    setLoginLoading(true); setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: loginUser.trim(), password: loginPwd }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setLoginError(data.error ?? 'Identifiants incorrects'); return; }
      onSuccess(data.user as AuthUser);
    } catch { setLoginError('Erreur réseau'); }
    finally { setLoginLoading(false); }
  }

  async function handleRegister() {
    setRegLoading(true); setRegError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: regUser.trim(), password: regPwd, confirmPassword: regPwd2,
          avatarColor: regColor, avatarIcon: regIcon,
          classCode: regCode.trim().toUpperCase() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setRegError(data.error ?? 'Erreur lors de la création du compte'); return; }
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: regUser.trim(), password: regPwd }),
      });
      const loginData = await loginRes.json();
      if (loginRes.ok && loginData.ok) onSuccess(loginData.user as AuthUser);
      else { setView('login'); setLoginUser(regUser.trim()); }
    } catch { setRegError('Erreur réseau'); }
    finally { setRegLoading(false); }
  }

  function goToRegister() {
    setView('register'); setStep(1); setRegError('');
    setRegUser(''); setRegPwd(''); setRegPwd2(''); setRegCode('');
    setRegColor(AVATAR_COLORS[0]); setRegIcon('User');
    setLoginError('');
  }

  const str = pwdStrength(regPwd);
  const step1Valid = regUser.trim().length >= 2 && regPwd.length >= 4 && regPwd === regPwd2;

  if (!sessionChecked || !mounted) return (
    <div className="login-wrap">
      <div className="login-splash-loader"><div className="login-logo-mark" /></div>
    </div>
  );

  return (
    <div className="login-wrap">
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />

      <div className="login-shell">
        {/* Brand */}
        <div className="login-brand">
          <div className="login-brand-mark">
            <span className="login-brand-dot" style={{ background: '#ef4444' }} />
            <span className="login-brand-dot" style={{ background: '#22c55e' }} />
            <span className="login-brand-dot" style={{ background: '#3b82f6' }} />
          </div>
          <h1 className="login-title">ColorRoom</h1>
          <p className="login-tagline">Jeux Sérieux — Lumière &amp; Couleurs</p>
        </div>

        {/* ── CONNEXION ─────────────────────────────────────────────────── */}
        {view === 'login' && (
          <div className="login-form-box glass">
            <div className="login-form-header"><LogIn size={18} /> Connexion</div>

            <div className="form-group">
              <label>Nom d&apos;utilisateur</label>
              <input ref={inputRef} value={loginUser} onChange={e => setLoginUser(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="Votre identifiant" />
            </div>

            <div className="form-group">
              <label>Mot de passe</label>
              <div className="login-pwd-wrap">
                <input type={showLoginPwd ? 'text' : 'password'} value={loginPwd}
                  onChange={e => setLoginPwd(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="••••••••" />
                <button type="button" className="login-pwd-eye" onClick={() => setShowLoginPwd(p => !p)} tabIndex={-1}>
                  {showLoginPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="login-msg login-msg--error">
                <AlertCircle size={14} style={{ flexShrink: 0 }} /> {loginError}
              </div>
            )}

            <button className={`btn btn-success login-submit${loginLoading ? ' login-submit--loading' : ''}`}
              onClick={handleLogin} disabled={loginLoading}>
              {loginLoading ? <span className="login-spinner" /> : <><LogIn size={16} /> Se connecter</>}
            </button>

            <button className="login-alt-link" onClick={goToRegister}>
              <span className="login-alt-q">Pas encore de compte ?</span>
              <span className="login-alt-sep" />
              <span className="login-alt-cta">
                <UserPlus size={14} /> Créer un compte <span className="login-alt-arrow">→</span>
              </span>
            </button>
          </div>
        )}

        {/* ── INSCRIPTION ─────────────────────────────────────────────── */}
        {view === 'register' && (
          <div className="login-form-box glass" style={{ maxWidth: 480, width: '100%' }}>
            {/* Header avec stepper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <button className="login-back" onClick={() => {
                if (step > 1) setStep(s => (s - 1) as 1 | 2 | 3);
                else { setView('login'); setRegError(''); }
              }} style={{ margin: 0 }}>
                <ArrowLeft size={14} />
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {[1, 2, 3].map(s => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center',
                        fontSize: 12, fontWeight: 800, flexShrink: 0,
                        background: s < step ? 'var(--success)' : s === step ? 'var(--accent)' : 'rgba(0,0,0,0.08)',
                        color: s <= step ? '#fff' : 'var(--text-3)',
                      }}>
                        {s < step ? <CheckCircle2 size={14} /> : s}
                      </div>
                      {s < 3 && (
                        <div style={{ width: 32, height: 2, borderRadius: 1,
                          background: s < step ? 'var(--success)' : 'rgba(0,0,0,0.08)' }} />
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontWeight: 600 }}>
                  {step === 1 ? 'Identifiants' : step === 2 ? 'Personnalisation' : 'Finalisation'}
                </div>
              </div>
            </div>

            {/* ── Étape 1 : pseudo + mdp ──────────────────────────────── */}
            {step === 1 && (
              <>
                <div style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>
                    Créer votre compte
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
                    Choisissez un pseudo unique et un mot de passe sécurisé.
                  </p>
                </div>

                <div className="form-group">
                  <label>Pseudo</label>
                  <div style={{ position: 'relative' }}>
                    <input ref={inputRef} value={regUser}
                      onChange={e => setRegUser(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && step1Valid && setStep(2)}
                      placeholder="Choisissez un pseudo…"
                      style={{ paddingRight: regUser.trim().length >= 2 ? 38 : undefined }}
                    />
                    {regUser.trim().length >= 2 && (
                      <CheckCircle2 size={16} color="var(--success)"
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    )}
                  </div>
                  {regUser.trim().length > 0 && regUser.trim().length < 2 && (
                    <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={11} /> Au moins 2 caractères
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Mot de passe</label>
                  <div className="login-pwd-wrap">
                    <input type={showRegPwd ? 'text' : 'password'} value={regPwd}
                      onChange={e => setRegPwd(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && step1Valid && setStep(2)}
                      placeholder="Min. 4 caractères" />
                    <button type="button" className="login-pwd-eye" onClick={() => setShowRegPwd(p => !p)} tabIndex={-1}>
                      {showRegPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {/* Barre de force */}
                  {regPwd.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2,
                            background: i <= str.score ? str.color : 'rgba(0,0,0,0.1)' }} />
                        ))}
                      </div>
                      {str.label && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: str.color }}>{str.label}</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Confirmer le mot de passe</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showRegPwd ? 'text' : 'password'} value={regPwd2}
                      onChange={e => setRegPwd2(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && step1Valid && setStep(2)}
                      placeholder="Répétez le mot de passe"
                      style={{ paddingRight: 38 }}
                    />
                    {regPwd2.length > 0 && (
                      regPwd === regPwd2
                        ? <CheckCircle2 size={16} color="var(--success)" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        : <AlertCircle size={16} color="var(--danger)" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    )}
                  </div>
                  {regPwd2.length > 0 && regPwd !== regPwd2 && (
                    <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={11} /> Les mots de passe ne correspondent pas
                    </div>
                  )}
                </div>

                <button
                  onClick={() => step1Valid && setStep(2)}
                  disabled={!step1Valid}
                  style={{
                    marginTop: 24, width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                    cursor: step1Valid ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontWeight: 800,
                    fontSize: 15, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: step1Valid ? 'linear-gradient(135deg,var(--accent),#7c3aed)' : 'rgba(0,0,0,0.12)',
                    boxShadow: step1Valid ? '0 4px 20px var(--accent-glow)' : 'none',
                  }}>
                  Suivant <ChevronRight size={18} />
                </button>
              </>
            )}

            {/* ── Étape 2 : avatar ─────────────────────────────────────── */}
            {step === 2 && (
              <>
                <div style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>
                    Votre avatar
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
                    Choisissez une couleur et une icône pour votre profil.
                  </p>
                </div>

                {/* Prévisualisation grande */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: 24, background: regColor,
                    display: 'grid', placeItems: 'center',
                    boxShadow: `0 0 0 4px ${regColor}30, 0 8px 32px ${regColor}40`,
                  }}>
                    <AvatarIcon name={regIcon} size={40} color="#fff" />
                  </div>
                </div>

                {/* Couleurs */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Couleur</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {AVATAR_COLORS.map(c => (
                      <button key={c} type="button" onClick={() => setRegColor(c)}
                        aria-label={c}
                        style={{
                          width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
                          background: c, flexShrink: 0,
                          outline: regColor === c ? `3px solid ${c}` : 'none',
                          outlineOffset: 3,
                          boxShadow: regColor === c ? `0 0 16px ${c}80` : '0 2px 8px rgba(0,0,0,0.12)',
                          transform: regColor === c ? 'scale(1.18)' : 'scale(1)',
                        }} />
                    ))}
                  </div>
                </div>

                {/* Icônes */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Icône</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
                    {AVATAR_ICON_NAMES.map(name => (
                      <button key={name} type="button" onClick={() => setRegIcon(name)} aria-label={name}
                        style={{
                          aspectRatio: '1', borderRadius: 12, border: 'none', cursor: 'pointer',
                          display: 'grid', placeItems: 'center', padding: 8,
                          background: regIcon === name ? regColor : 'rgba(0,0,0,0.05)',
                          color: regIcon === name ? '#fff' : 'var(--text-2)',
                          boxShadow: regIcon === name ? `0 4px 12px ${regColor}60` : 'none',
                          transform: regIcon === name ? 'scale(1.1)' : 'scale(1)',
                        }}>
                        <AvatarIcon name={name} size={20} color="currentColor" />
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={() => setStep(3)}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 15,
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: `linear-gradient(135deg,${regColor},${regColor}bb)`,
                    boxShadow: `0 4px 20px ${regColor}50`,
                  }}>
                  Suivant <ChevronRight size={18} />
                </button>
              </>
            )}

            {/* ── Étape 3 : code + confirm ─────────────────────────────── */}
            {step === 3 && (
              <>
                <div style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>
                    Presque fini !
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
                    Entrez un code de classe si vous en avez un, sinon ignorez.
                  </p>
                </div>

                {/* Récap identité */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                  borderRadius: 14, background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)',
                  marginBottom: 22,
                }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: regColor,
                    display: 'grid', placeItems: 'center', flexShrink: 0,
                    boxShadow: `0 4px 14px ${regColor}50` }}>
                    <AvatarIcon name={regIcon} size={24} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{regUser}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Compte apprenant</div>
                  </div>
                  <button onClick={() => setStep(1)}
                    style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)', fontWeight: 700,
                      background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                      borderRadius: 6, fontFamily: 'inherit' }}>
                    Modifier
                  </button>
                </div>

                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Code de classe</span>
                    <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-3)' }}>optionnel</span>
                  </label>
                  <input ref={inputRef} value={regCode}
                    onChange={e => setRegCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && !regLoading && handleRegister()}
                    placeholder="Ex : ABC123"
                    maxLength={6}
                    style={{ letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: 18, fontWeight: 700, textAlign: 'center' }}
                  />
                  {regCode.length > 0 && regCode.length < 6 && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, textAlign: 'center' }}>
                      {6 - regCode.length} caractère{6 - regCode.length > 1 ? 's' : ''} restant{6 - regCode.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                {regError && (
                  <div className="login-msg login-msg--error" style={{ marginBottom: 16 }}>
                    <AlertCircle size={14} style={{ flexShrink: 0 }} /> {regError}
                  </div>
                )}

                <button
                  className={regLoading ? 'login-submit--loading' : ''}
                  onClick={handleRegister} disabled={regLoading}
                  style={{
                    width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                    cursor: regLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    fontWeight: 800, fontSize: 15, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: 'linear-gradient(135deg,#06d6a0,#4361ee)',
                    boxShadow: '0 4px 24px rgba(6,214,160,0.35)',
                    opacity: regLoading ? 0.7 : 1,
                  }}>
                  {regLoading
                    ? <><span className="login-spinner" /> Création en cours…</>
                    : <><CheckCircle2 size={18} /> Créer mon compte</>}
                </button>

                <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: 'var(--text-3)' }}>
                  En créant un compte vous acceptez les règles de la classe.
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
