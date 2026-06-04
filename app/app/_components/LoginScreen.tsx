'use client';

import { useState, useEffect } from 'react';
import { LogIn, UserPlus, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { AVATAR_ICON_NAMES, AvatarIcon } from './avatarIcons';

type AuthUser = {
  id: string;
  username: string;
  role: string;
  niveau: string | null;
  avatarColor: string;
  avatarIcon?: string;
};

interface Props {
  sessionChecked: boolean;
  onSuccess: (user: AuthUser) => void;
  /** Code de classe pré-rempli (deep-link / QR code) : bascule sur l'inscription. */
  initialClassCode?: string;
}

const AVATAR_COLORS = [
  '#4361ee', '#7209b7', '#f72585', '#e63946',
  '#2ec4b6', '#06d6a0', '#ffb703', '#fb8500',
  '#264653', '#8ecae6',
];

export default function LoginScreen({ sessionChecked, onSuccess, initialClassCode }: Props) {
  const [view, setView] = useState<'login' | 'register'>('login');
  const [mounted, setMounted] = useState(false);

  // Login form
  const [loginUser, setLoginUser] = useState('');
  const [loginPwd, setLoginPwd] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register form
  const [regUser, setRegUser] = useState('');
  const [regPwd, setRegPwd] = useState('');
  const [regPwd2, setRegPwd2] = useState('');
  const [regColor, setRegColor] = useState(AVATAR_COLORS[0]);
  const [regIcon, setRegIcon] = useState('User');
  const [regCode, setRegCode] = useState('');
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  useEffect(() => { setMounted(true); }, []);

  // Deep-link / QR code de classe : pré-remplir le code et ouvrir l'inscription.
  useEffect(() => {
    if (initialClassCode && initialClassCode.trim()) {
      setRegCode(initialClassCode.trim().toUpperCase());
      setView('register');
    }
  }, [initialClassCode]);

  async function handleLogin() {
    if (!loginUser.trim()) { setLoginError('Entrez votre nom d\'utilisateur'); return; }
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: loginUser.trim(), password: loginPwd }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setLoginError(data.error ?? 'Identifiants incorrects');
        return;
      }
      onSuccess(data.user as AuthUser);
    } catch {
      setLoginError('Erreur réseau');
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister() {
    if (!regUser.trim()) { setRegError('Choisissez un nom d\'utilisateur'); return; }
    if (regPwd.length < 4) { setRegError('Mot de passe trop court (min. 4 caractères)'); return; }
    if (regPwd !== regPwd2) { setRegError('Les mots de passe ne correspondent pas'); return; }
    setRegLoading(true);
    setRegError('');
    setRegSuccess('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: regUser.trim(),
          password: regPwd,
          confirmPassword: regPwd2,
          avatarColor: regColor,
          avatarIcon: regIcon,
          classCode: regCode.trim().toUpperCase() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setRegError(data.error ?? 'Erreur lors de la création du compte');
        return;
      }
      setRegSuccess('Compte créé ! Connexion en cours…');
      // Auto-login
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: regUser.trim(), password: regPwd }),
      });
      const loginData = await loginRes.json();
      if (loginRes.ok && loginData.ok) {
        onSuccess(loginData.user as AuthUser);
      } else {
        setView('login');
        setLoginUser(regUser.trim());
      }
    } catch {
      setRegError('Erreur réseau');
    } finally {
      setRegLoading(false);
    }
  }

  if (!sessionChecked || !mounted) {
    return (
      <div className="login-wrap">
        <div className="login-splash-loader">
          <div className="login-logo-mark" />
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />

      <div className="login-shell">
        <div className="login-brand">
          <div className="login-brand-mark">
            <span className="login-brand-dot" style={{ background: '#ef4444' }} />
            <span className="login-brand-dot" style={{ background: '#22c55e' }} />
            <span className="login-brand-dot" style={{ background: '#3b82f6' }} />
          </div>
          <h1 className="login-title">ColorRoom</h1>
          <p className="login-tagline">Jeux Sérieux — Lumière &amp; Couleurs</p>
        </div>

        {view === 'login' && (
          <div className="login-form-box glass">
            <div className="login-form-header">
              <LogIn size={18} /> Connexion
            </div>

            <div className="form-group">
              <label>Nom d&apos;utilisateur</label>
              <input
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Votre identifiant"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Mot de passe</label>
              <div className="login-pwd-wrap">
                <input
                  type={showLoginPwd ? 'text' : 'password'}
                  value={loginPwd}
                  onChange={(e) => setLoginPwd(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="••••••••"
                />
                <button type="button" className="login-pwd-eye" onClick={() => setShowLoginPwd(p => !p)} tabIndex={-1}>
                  {showLoginPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {loginError && <div className="login-msg login-msg--error">{loginError}</div>}

            <button
              className={`btn btn-success login-submit${loginLoading ? ' login-submit--loading' : ''}`}
              onClick={handleLogin}
              disabled={loginLoading}
            >
              {loginLoading ? <span className="login-spinner" /> : <><LogIn size={16} /> Se connecter</>}
            </button>

            <button
              className="login-alt-link"
              onClick={() => { setView('register'); setLoginError(''); }}
            >
              <span className="login-alt-q">Pas encore de compte ?</span>
              <span className="login-alt-sep" />
              <span className="login-alt-cta">
                <UserPlus size={14} />
                Créer un compte
                <span className="login-alt-arrow">→</span>
              </span>
            </button>
          </div>
        )}

        {view === 'register' && (
          <div className="login-form-box glass">
            <button className="login-back" onClick={() => { setView('login'); setRegError(''); setRegSuccess(''); }}>
              <ArrowLeft size={14} /> Retour
            </button>

            <div className="login-form-header">
              <UserPlus size={18} /> Créer un compte
            </div>

            <div className="form-group">
              <label>Nom d&apos;utilisateur</label>
              <input
                value={regUser}
                onChange={(e) => setRegUser(e.target.value)}
                placeholder="Choisissez un pseudo"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Mot de passe</label>
              <div className="login-pwd-wrap">
                <input
                  type={showRegPwd ? 'text' : 'password'}
                  value={regPwd}
                  onChange={(e) => setRegPwd(e.target.value)}
                  placeholder="Min. 4 caractères"
                />
                <button type="button" className="login-pwd-eye" onClick={() => setShowRegPwd(p => !p)} tabIndex={-1}>
                  {showRegPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Confirmer le mot de passe</label>
              <input
                type={showRegPwd ? 'text' : 'password'}
                value={regPwd2}
                onChange={(e) => setRegPwd2(e.target.value)}
                placeholder="Répétez le mot de passe"
              />
              {regPwd2.length > 0 && regPwd !== regPwd2 && (
                <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                  Les mots de passe ne correspondent pas
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Avatar</label>
              <div className="login-avatar-row">
                <div className="login-avatar-preview" style={{ background: regColor }}>
                  <AvatarIcon name={regIcon} size={24} color="#fff" />
                </div>
                <div className="login-avatar-grid">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`login-avatar-dot${regColor === c ? ' login-avatar-dot--active' : ''}`}
                      style={{ background: c }}
                      onClick={() => setRegColor(c)}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Icône de profil</label>
              <div className="login-icon-grid">
                {AVATAR_ICON_NAMES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`login-icon-btn${regIcon === name ? ' login-icon-btn--active' : ''}`}
                    onClick={() => setRegIcon(name)}
                    aria-label={name}
                    style={regIcon === name ? { borderColor: regColor, color: regColor } : undefined}
                  >
                    <AvatarIcon name={name} size={18} color="currentColor" />
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Code de classe <span style={{ fontWeight: 400, opacity: 0.6 }}>(optionnel)</span></label>
              <input
                value={regCode}
                onChange={(e) => setRegCode(e.target.value.toUpperCase())}
                placeholder="Ex : ABC123"
                maxLength={6}
                style={{ letterSpacing: '0.15em', textTransform: 'uppercase' }}
              />
            </div>

            {regError && <div className="login-msg login-msg--error">{regError}</div>}
            {regSuccess && <div className="login-msg login-msg--success">{regSuccess}</div>}

            <button
              className={`btn btn-success login-submit${regLoading ? ' login-submit--loading' : ''}`}
              onClick={handleRegister}
              disabled={regLoading || regPwd.length < 4 || regPwd !== regPwd2 || !regUser.trim()}
            >
              {regLoading ? <span className="login-spinner" /> : <><UserPlus size={16} /> Créer le compte</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
