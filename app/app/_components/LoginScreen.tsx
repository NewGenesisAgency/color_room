'use client';

/**
 * @file app/_components/LoginScreen.tsx
 * @brief Écran d'authentification : connexion et inscription multi-étapes.
 *
 * Gère les deux vues « login » et « register » (inscription en plusieurs étapes :
 * identifiants, choix d'avatar couleur/icône, code de classe). Affiche un
 * indicateur de robustesse du mot de passe, sélectionne un avatar parmi
 * {@link AVATAR_ICON_NAMES} et une couleur, puis notifie le parent via `onSuccess`
 * avec l'utilisateur authentifié. Props : `sessionChecked` (la session a-t-elle
 * été vérifiée), `onSuccess` (callback de réussite), `initialClassCode`
 * (pré-remplissage du code de classe, ex. depuis un QR code).
 */

import { useState, useEffect, useRef } from 'react';
import { LogIn, UserPlus, ArrowLeft, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { AVATAR_ICON_NAMES, AvatarIcon } from './avatarIcons';

/** Utilisateur authentifié renvoyé par l'écran de connexion. */
type AuthUser = {
  id: string; username: string; role: string;
  niveau: string | null; avatarColor: string; avatarIcon?: string;
};

/** Props de l'écran de connexion. */
interface Props {
  /** Vrai une fois la vérification de session initiale terminée. */
  sessionChecked: boolean;
  /** Appelé avec l'utilisateur authentifié après connexion/inscription réussie. */
  onSuccess: (user: AuthUser) => void;
  /** Code de classe pré-rempli (ex. fourni par un QR code). */
  initialClassCode?: string;
}

const AVATAR_COLORS = [
  '#4361ee', '#7209b7', '#f72585', '#e63946',
  '#2ec4b6', '#06d6a0', '#ffb703', '#fb8500',
  '#264653', '#8ecae6',
];

function pwdStrength(p: string) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 4) s++;
  if (p.length >= 8) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^a-zA-Z0-9]/.test(p)) s++;
  return s;
}
const STR_COLORS = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];
const STR_LABELS = ['', 'Faible', 'Correct', 'Bon', 'Fort ✓'];

/**
 * Écran d'authentification (connexion / inscription).
 *
 * @param props Voir {@link Props}.
 * @returns L'interface de connexion ou d'inscription multi-étapes.
 */
export default function LoginScreen({ sessionChecked, onSuccess, initialClassCode }: Props) {
  const [view, setView] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mounted, setMounted] = useState(false);

  // Login
  const [loginUser, setLoginUser] = useState('');
  const [loginPwd, setLoginPwd]   = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError]     = useState('');

  // Register
  const [regUser,    setRegUser]    = useState('');
  const [regPwd,     setRegPwd]     = useState('');
  const [regPwd2,    setRegPwd2]    = useState('');
  const [regColor,   setRegColor]   = useState(AVATAR_COLORS[0]);
  const [regIcon,    setRegIcon]    = useState('User');
  const [regCode,    setRegCode]    = useState('');
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError,   setRegError]   = useState('');

  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (initialClassCode?.trim()) {
      setRegCode(initialClassCode.trim().toUpperCase());
      setView('register'); setStep(3);
    }
  }, [initialClassCode]);
  useEffect(() => {
    const t = setTimeout(() => firstInput.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [view, step]);

  async function handleLogin() {
    if (!loginUser.trim()) { setLoginError('Entrez votre identifiant'); return; }
    setLoginLoading(true); setLoginError('');
    try {
      const res  = await fetch('/api/auth/login', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ username: loginUser.trim(), password: loginPwd }) });
      const data = await res.json();
      if (!res.ok || !data.ok) { setLoginError(data.error ?? 'Identifiants incorrects'); return; }
      onSuccess(data.user as AuthUser);
    } catch { setLoginError('Erreur réseau'); }
    finally   { setLoginLoading(false); }
  }

  async function handleRegister() {
    setRegLoading(true); setRegError('');
    try {
      const res  = await fetch('/api/auth/register', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ username: regUser.trim(), password: regPwd, confirmPassword: regPwd2, avatarColor: regColor, avatarIcon: regIcon, classCode: regCode.trim().toUpperCase() || undefined }) });
      const data = await res.json();
      if (!res.ok || !data.ok) { setRegError(data.error ?? 'Erreur lors de la création'); return; }
      const lr   = await fetch('/api/auth/login', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ username: regUser.trim(), password: regPwd }) });
      const ld   = await lr.json();
      if (lr.ok && ld.ok) onSuccess(ld.user as AuthUser);
      else { setView('login'); setLoginUser(regUser.trim()); }
    } catch { setRegError('Erreur réseau'); }
    finally   { setRegLoading(false); }
  }

  function goRegister() {
    setView('register'); setStep(1); setRegError('');
    setRegUser(''); setRegPwd(''); setRegPwd2('');
    setRegCode(''); setRegColor(AVATAR_COLORS[0]); setRegIcon('User');
    setLoginError('');
  }

  const str        = pwdStrength(regPwd);
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

      <div className="login-shell" style={{ gap: 24 }}>

        {/* ── Brand ────────────────────────────────────────────────────── */}
        <div className="login-brand" style={{ marginBottom: -8 }}>
          <div className="login-brand-mark">
            <span className="login-brand-dot" style={{ background:'#ef4444' }} />
            <span className="login-brand-dot" style={{ background:'#22c55e' }} />
            <span className="login-brand-dot" style={{ background:'#3b82f6' }} />
          </div>
          <h1 className="login-title">ColorRoom</h1>
          <p className="login-tagline">Jeux Sérieux — Lumière &amp; Couleurs</p>
        </div>

        {/* ═══════════════════════════════════ LOGIN ══════════════════════ */}
        {view === 'login' && (
          <div className="login-form-box glass">

            <div className="login-form-header" style={{ marginBottom: 20 }}>
              <LogIn size={17} strokeWidth={2.2} style={{ color:'var(--accent)' }} />
              Connexion
            </div>

            <div className="form-group">
              <label>Identifiant</label>
              <input ref={firstInput} value={loginUser}
                onChange={e => setLoginUser(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Votre pseudo" autoComplete="username" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Mot de passe</label>
              <div className="login-pwd-wrap">
                <input type={showPwd ? 'text' : 'password'} value={loginPwd}
                  onChange={e => setLoginPwd(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="••••••••" autoComplete="current-password" />
                <button type="button" className="login-pwd-eye" onClick={() => setShowPwd(p => !p)} tabIndex={-1}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="login-msg login-msg--error" style={{ marginTop:14, display:'flex', alignItems:'center', gap:6 }}>
                <AlertCircle size={13} style={{ flexShrink:0 }} /> {loginError}
              </div>
            )}

            <button
              className={`btn btn-success login-submit${loginLoading ? ' login-submit--loading' : ''}`}
              style={{ marginTop:20 }} onClick={handleLogin} disabled={loginLoading}>
              {loginLoading ? <span className="login-spinner" /> : <><LogIn size={15} /> Se connecter</>}
            </button>

            <button className="login-alt-link" onClick={goRegister}>
              <span className="login-alt-q">Pas encore de compte ?</span>
              <span className="login-alt-sep" />
              <span className="login-alt-cta">
                <UserPlus size={13} /> Créer un compte
                <span className="login-alt-arrow">→</span>
              </span>
            </button>
          </div>
        )}

        {/* ═════════════════════════════════ REGISTER ══════════════════════ */}
        {view === 'register' && (
          <div className="login-form-box glass" style={{ padding:'32px 28px' }}>

            {/* Retour + stepper */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
              <button className="login-back" style={{ margin:0 }}
                onClick={() => step > 1 ? setStep(s => (s-1) as 1|2|3) : (setView('login'), setRegError(''))}>
                <ArrowLeft size={14} />
              </button>

              {/* Stepper minimaliste */}
              <div style={{ flex:1, display:'flex', alignItems:'center', gap:0 }}>
                {([1,2,3] as const).map((s,i) => (
                  <div key={s} style={{ display:'flex', alignItems:'center', flex: i<2 ? 1 : 0 }}>
                    <div style={{
                      width:26, height:26, borderRadius:'50%',
                      display:'grid', placeItems:'center', flexShrink:0,
                      fontSize:11, fontWeight:800,
                      background: s < step ? 'var(--success)' : s === step ? 'var(--accent)' : 'rgba(0,0,0,0.07)',
                      color: s <= step ? '#fff' : 'var(--text-3)',
                      boxShadow: s === step ? '0 0 0 3px rgba(67,97,238,0.18)' : 'none',
                    }}>
                      {s < step ? <Check size={12} strokeWidth={3} /> : s}
                    </div>
                    {i < 2 && (
                      <div style={{ flex:1, height:2, borderRadius:1, margin:'0 4px',
                        background: s < step ? 'var(--success)' : 'rgba(0,0,0,0.08)' }} />
                    )}
                  </div>
                ))}
              </div>

              <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:600, whiteSpace:'nowrap' }}>
                {step === 1 ? 'Compte' : step === 2 ? 'Avatar' : 'Classe'}
              </span>
            </div>

            {/* ── Étape 1 : identifiants ─────────────────────────────────── */}
            {step === 1 && (
              <>
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:17, fontWeight:900, color:'var(--text)', letterSpacing:'-0.02em' }}>
                    Créer votre compte
                  </div>
                  <p style={{ fontSize:12.5, color:'var(--text-2)', margin:'4px 0 0', lineHeight:1.5 }}>
                    Un pseudo unique et un mot de passe sécurisé.
                  </p>
                </div>

                <div className="form-group">
                  <label>Pseudo</label>
                  <div style={{ position:'relative' }}>
                    <input ref={firstInput} value={regUser}
                      onChange={e => setRegUser(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && step1Valid && setStep(2)}
                      placeholder="Choisissez un pseudo…"
                      autoComplete="username"
                      style={{ paddingRight: regUser.trim().length >= 2 ? 38 : undefined }} />
                    {regUser.trim().length >= 2 && (
                      <Check size={14} strokeWidth={2.5} color="var(--success)"
                        style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>Mot de passe</label>
                  <div className="login-pwd-wrap">
                    <input type={showRegPwd ? 'text' : 'password'} value={regPwd}
                      onChange={e => setRegPwd(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && step1Valid && setStep(2)}
                      placeholder="Min. 4 caractères" autoComplete="new-password" />
                    <button type="button" className="login-pwd-eye" onClick={() => setShowRegPwd(p => !p)} tabIndex={-1}>
                      {showRegPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {/* Force */}
                  {regPwd.length > 0 && (
                    <div style={{ marginTop:7, display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ flex:1, display:'flex', gap:3 }}>
                        {[1,2,3,4].map(i => (
                          <div key={i} style={{ flex:1, height:3, borderRadius:2,
                            background: i <= str ? STR_COLORS[str] : 'rgba(0,0,0,0.08)' }} />
                        ))}
                      </div>
                      <span style={{ fontSize:10.5, fontWeight:700, color:STR_COLORS[str], flexShrink:0 }}>
                        {STR_LABELS[str]}
                      </span>
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom:0 }}>
                  <label>Confirmer</label>
                  <div style={{ position:'relative' }}>
                    <input type={showRegPwd ? 'text' : 'password'} value={regPwd2}
                      onChange={e => setRegPwd2(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && step1Valid && setStep(2)}
                      placeholder="Répéter le mot de passe"
                      autoComplete="new-password"
                      style={{ paddingRight:38 }} />
                    {regPwd2.length > 0 && (
                      regPwd === regPwd2
                        ? <Check size={14} strokeWidth={2.5} color="var(--success)" style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                        : <AlertCircle size={14} color="var(--danger)" style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                    )}
                  </div>
                </div>

                <button onClick={() => step1Valid && setStep(2)} disabled={!step1Valid}
                  style={{
                    marginTop:22, width:'100%', padding:'13px',
                    borderRadius:14, border:'none', cursor: step1Valid ? 'pointer' : 'not-allowed',
                    fontFamily:'inherit', fontWeight:800, fontSize:14, color:'#fff',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                    background: step1Valid
                      ? 'linear-gradient(135deg, var(--accent), #7c3aed)'
                      : 'rgba(0,0,0,0.08)',
                    boxShadow: step1Valid ? '0 4px 18px var(--accent-glow)' : 'none',
                  }}>
                  Continuer →
                </button>
              </>
            )}

            {/* ── Étape 2 : avatar ──────────────────────────────────────── */}
            {step === 2 && (
              <>
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:17, fontWeight:900, color:'var(--text)', letterSpacing:'-0.02em' }}>
                    Votre avatar
                  </div>
                  <p style={{ fontSize:12.5, color:'var(--text-2)', margin:'4px 0 0', lineHeight:1.5 }}>
                    Couleur et icône — c&apos;est votre identité dans ColorRoom.
                  </p>
                </div>

                {/* Preview */}
                <div style={{ display:'flex', justifyContent:'center', marginBottom:22 }}>
                  <div style={{
                    width:72, height:72, borderRadius:22, background:regColor,
                    display:'grid', placeItems:'center', flexShrink:0,
                    boxShadow:`0 0 0 5px ${regColor}22, 0 8px 28px ${regColor}44`,
                  }}>
                    <AvatarIcon name={regIcon} size={34} color="#fff" />
                  </div>
                </div>

                {/* Couleurs */}
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10.5, fontWeight:800, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.09em', marginBottom:10 }}>
                    Couleur
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {AVATAR_COLORS.map(c => (
                      <button key={c} type="button" onClick={() => setRegColor(c)}
                        style={{
                          width:34, height:34, borderRadius:'50%', border:'none',
                          background:c, cursor:'pointer', flexShrink:0,
                          outline: regColor === c ? `3px solid ${c}` : '2px solid transparent',
                          outlineOffset: regColor === c ? 3 : 0,
                          boxShadow: regColor === c ? `0 0 12px ${c}70` : '0 1px 4px rgba(0,0,0,0.12)',
                          transform: regColor === c ? 'scale(1.15)' : 'scale(1)',
                        }} />
                    ))}
                  </div>
                </div>

                {/* Icônes */}
                <div style={{ marginBottom:22 }}>
                  <div style={{ fontSize:10.5, fontWeight:800, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.09em', marginBottom:10 }}>
                    Icône
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:7 }}>
                    {AVATAR_ICON_NAMES.map(name => (
                      <button key={name} type="button" onClick={() => setRegIcon(name)}
                        style={{
                          aspectRatio:'1', borderRadius:11, border:'none', cursor:'pointer',
                          display:'grid', placeItems:'center', padding:7,
                          background: regIcon === name ? regColor : 'rgba(0,0,0,0.05)',
                          color:       regIcon === name ? '#fff' : 'var(--text-2)',
                          boxShadow:   regIcon === name ? `0 3px 10px ${regColor}50` : 'none',
                          transform:   regIcon === name ? 'scale(1.1)' : 'scale(1)',
                        }}>
                        <AvatarIcon name={name} size={18} color="currentColor" />
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={() => setStep(3)}
                  style={{
                    width:'100%', padding:'13px', borderRadius:14, border:'none',
                    cursor:'pointer', fontFamily:'inherit', fontWeight:800, fontSize:14,
                    color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                    background:`linear-gradient(135deg,${regColor},${regColor}aa)`,
                    boxShadow:`0 4px 18px ${regColor}44`,
                  }}>
                  Continuer →
                </button>
              </>
            )}

            {/* ── Étape 3 : code classe + confirm ───────────────────────── */}
            {step === 3 && (
              <>
                {/* Récap */}
                <div style={{
                  display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
                  borderRadius:14, background:'rgba(0,0,0,0.04)',
                  border:'1px solid rgba(0,0,0,0.07)', marginBottom:22,
                }}>
                  <div style={{ width:44, height:44, borderRadius:13, background:regColor,
                    display:'grid', placeItems:'center', flexShrink:0,
                    boxShadow:`0 3px 12px ${regColor}44` }}>
                    <AvatarIcon name={regIcon} size={22} color="#fff" />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:800, fontSize:14, color:'var(--text)' }}>{regUser}</div>
                    <div style={{ fontSize:11, color:'var(--text-3)', marginTop:1 }}>Compte apprenant</div>
                  </div>
                  <button onClick={() => setStep(1)}
                    style={{ fontSize:11, color:'var(--accent)', fontWeight:700, background:'none',
                      border:'none', cursor:'pointer', padding:'4px 6px', borderRadius:6,
                      fontFamily:'inherit' }}>
                    Modifier
                  </button>
                </div>

                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:17, fontWeight:900, color:'var(--text)', letterSpacing:'-0.02em' }}>
                    Code de classe
                  </div>
                  <p style={{ fontSize:12.5, color:'var(--text-2)', margin:'4px 0 0', lineHeight:1.5 }}>
                    Facultatif — demandez-le à votre enseignant.
                  </p>
                </div>

                <div className="form-group" style={{ marginBottom:0 }}>
                  <div style={{ position:'relative' }}>
                    <input ref={firstInput} value={regCode}
                      onChange={e => setRegCode(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && !regLoading && handleRegister()}
                      placeholder="— — — — — —"
                      maxLength={6}
                      style={{
                        letterSpacing:'0.28em', textTransform:'uppercase',
                        fontSize:22, fontWeight:800, textAlign:'center',
                        paddingLeft:0, paddingRight:0,
                      }} />
                    {regCode.length > 0 && regCode.length < 6 && (
                      <div style={{ position:'absolute', bottom:-18, left:0, right:0,
                        textAlign:'center', fontSize:10.5, color:'var(--text-3)', fontWeight:600 }}>
                        {6-regCode.length} caractère{6-regCode.length>1?'s':''} restant{6-regCode.length>1?'s':''}
                      </div>
                    )}
                  </div>
                </div>

                {regError && (
                  <div className="login-msg login-msg--error"
                    style={{ marginTop:26, display:'flex', alignItems:'center', gap:6 }}>
                    <AlertCircle size={13} style={{ flexShrink:0 }} /> {regError}
                  </div>
                )}

                <button onClick={handleRegister} disabled={regLoading}
                  style={{
                    marginTop:28, width:'100%', padding:'14px',
                    borderRadius:14, border:'none',
                    cursor: regLoading ? 'not-allowed' : 'pointer',
                    fontFamily:'inherit', fontWeight:800, fontSize:15,
                    color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    background:'linear-gradient(135deg,#06d6a0,#4361ee)',
                    boxShadow:'0 4px 22px rgba(6,214,160,0.32)',
                    opacity: regLoading ? 0.75 : 1,
                  }}>
                  {regLoading
                    ? <><span className="login-spinner" /> Création…</>
                    : <><Check size={17} strokeWidth={2.5} /> Créer mon compte</>}
                </button>

                <p style={{ textAlign:'center', marginTop:12, fontSize:11, color:'var(--text-3)' }}>
                  En créant un compte, vous acceptez les règles de la classe.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
