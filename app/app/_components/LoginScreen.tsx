'use client';

import { useState, useEffect } from 'react';
import { LogIn, GraduationCap, BookOpen, ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';

type UserType = 'apprenant' | 'enseignant';
type Niveau = 'college' | 'lycee' | 'universite' | 'grand-public';

interface Props {
  loginStep: 'role' | 'form' | 'setup';
  setLoginStep: (s: 'role' | 'form' | 'setup') => void;
  userType: UserType;
  setUserType: (t: UserType) => void;
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  niveau: Niveau;
  setNiveau: (n: Niveau) => void;
  message: string;
  loginLoading: boolean;
  hasTeacher: boolean;
  sessionChecked: boolean;
  onLogin: () => void;
  onSetup: (username: string, password: string) => void;
}

export default function LoginScreen({
  loginStep, setLoginStep,
  userType, setUserType,
  username, setUsername,
  password, setPassword,
  niveau, setNiveau,
  message, loginLoading, hasTeacher, sessionChecked,
  onLogin, onSetup,
}: Props) {
  const [showPwd, setShowPwd] = useState(false);
  const [setupUser, setSetupUser] = useState('');
  const [setupPwd, setSetupPwd] = useState('');
  const [setupPwd2, setSetupPwd2] = useState('');
  const [setupShowPwd, setSetupShowPwd] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  function handleRoleSelect(role: UserType) {
    setUserType(role);
    if (role === 'enseignant' && !hasTeacher) {
      setLoginStep('setup');
    } else {
      setLoginStep('form');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') onLogin();
  }

  function handleSetupSubmit() {
    if (setupPwd !== setupPwd2) return;
    onSetup(setupUser, setupPwd);
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
      {/* Orbs décoratifs */}
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />

      <div className="login-shell">
        {/* Logo / titre */}
        <div className="login-brand">
          <div className="login-brand-mark">
            <span className="login-brand-dot" style={{ background: '#ef4444' }} />
            <span className="login-brand-dot" style={{ background: '#22c55e' }} />
            <span className="login-brand-dot" style={{ background: '#3b82f6' }} />
          </div>
          <h1 className="login-title">ColorRoom</h1>
          <p className="login-tagline">Jeux Sérieux — Lumière & Couleurs</p>
        </div>

        {/* Étape 1 : sélection du rôle */}
        {loginStep === 'role' && (
          <div className="login-card-area">
            <p className="login-step-hint">Qui êtes-vous ?</p>
            <div className="login-role-grid">
              <button
                className="login-role-card"
                onClick={() => handleRoleSelect('apprenant')}
              >
                <div className="login-role-icon login-role-icon--student">
                  <BookOpen size={28} />
                </div>
                <div className="login-role-label">Apprenant</div>
                <div className="login-role-sub">Collège · Lycée · Université</div>
              </button>

              <button
                className="login-role-card"
                onClick={() => handleRoleSelect('enseignant')}
              >
                <div className="login-role-icon login-role-icon--teacher">
                  <GraduationCap size={28} />
                </div>
                <div className="login-role-label">Enseignant</div>
                <div className="login-role-sub">
                  {hasTeacher ? 'Connexion avec mot de passe' : 'Créer le premier compte'}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Étape 2 : formulaire de connexion */}
        {loginStep === 'form' && (
          <div className="login-form-box glass">
            <button className="login-back" onClick={() => { setLoginStep('role'); setUsername(''); setPassword(''); }}>
              <ArrowLeft size={14} /> Retour
            </button>

            <div className="login-form-header">
              {userType === 'apprenant'
                ? <><BookOpen size={20} className="login-form-icon-student" /> Apprenant</>
                : <><GraduationCap size={20} className="login-form-icon-teacher" /> Enseignant</>
              }
            </div>

            <div className="form-group">
              <label>Nom d'utilisateur</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={userType === 'apprenant' ? 'Votre prénom ou pseudo' : 'Identifiant enseignant'}
                autoFocus
              />
            </div>

            {userType === 'apprenant' && (
              <div className="form-group">
                <label>Niveau</label>
                <select value={niveau} onChange={(e) => setNiveau(e.target.value as Niveau)}>
                  <option value="college">Collège</option>
                  <option value="lycee">Lycée</option>
                  <option value="universite">Université</option>
                  <option value="grand-public">Grand Public</option>
                </select>
              </div>
            )}

            {userType === 'enseignant' && (
              <div className="form-group">
                <label>Mot de passe</label>
                <div className="login-pwd-wrap">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="••••••••"
                  />
                  <button type="button" className="login-pwd-eye" onClick={() => setShowPwd(p => !p)} tabIndex={-1}>
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {message && (
              <div className="login-msg">{message}</div>
            )}

            <button
              className={`btn btn-success login-submit${loginLoading ? ' login-submit--loading' : ''}`}
              onClick={onLogin}
              disabled={loginLoading}
            >
              {loginLoading
                ? <span className="login-spinner" />
                : <><LogIn size={16} /> Se connecter</>
              }
            </button>
          </div>
        )}

        {/* Étape setup : création du premier compte enseignant */}
        {loginStep === 'setup' && (
          <div className="login-form-box glass">
            <button className="login-back" onClick={() => setLoginStep('role')}>
              <ArrowLeft size={14} /> Retour
            </button>

            <div className="login-form-header login-form-header--setup">
              <ShieldCheck size={20} /> Créer le compte enseignant
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.5 }}>
              Aucun enseignant enregistré. Créez le premier compte administrateur.
            </p>

            <div className="form-group">
              <label>Identifiant</label>
              <input value={setupUser} onChange={(e) => setSetupUser(e.target.value)} placeholder="Ex: prof_dupont" autoFocus />
            </div>

            <div className="form-group">
              <label>Mot de passe</label>
              <div className="login-pwd-wrap">
                <input
                  type={setupShowPwd ? 'text' : 'password'}
                  value={setupPwd}
                  onChange={(e) => setSetupPwd(e.target.value)}
                  placeholder="Min. 4 caractères"
                />
                <button type="button" className="login-pwd-eye" onClick={() => setSetupShowPwd(p => !p)} tabIndex={-1}>
                  {setupShowPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Confirmer le mot de passe</label>
              <input
                type={setupShowPwd ? 'text' : 'password'}
                value={setupPwd2}
                onChange={(e) => setSetupPwd2(e.target.value)}
                placeholder="Répétez le mot de passe"
              />
              {setupPwd2.length > 0 && setupPwd !== setupPwd2 && (
                <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Les mots de passe ne correspondent pas</div>
              )}
            </div>

            {message && <div className="login-msg">{message}</div>}

            <button
              className={`btn btn-success login-submit${loginLoading ? ' login-submit--loading' : ''}`}
              onClick={handleSetupSubmit}
              disabled={loginLoading || !setupUser || setupPwd.length < 4 || setupPwd !== setupPwd2}
            >
              {loginLoading ? <span className="login-spinner" /> : <><ShieldCheck size={16} /> Créer le compte</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
