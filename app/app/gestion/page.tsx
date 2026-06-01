'use client';

import { useEffect, useState } from 'react';
import {
  Users, BookOpen, Trophy, Settings, Plus, Trash2, RefreshCw,
  Download, Eye, EyeOff, ArrowLeft, ChevronDown, ChevronUp,
  Shield, GraduationCap, UserCheck, Copy, Check,
} from 'lucide-react';
import Link from 'next/link';
import { AvatarIcon } from '@/app/_components/avatarIcons';
import './gestion.css';

type Role = 'admin' | 'enseignant' | 'apprenant';

type SessionUser = {
  id: string;
  username: string;
  role: Role;
  niveau: string | null;
  avatarColor: string;
  avatarIcon?: string;
};

type UserRow = {
  id: string;
  username: string;
  user_type: Role;
  niveau: string | null;
  avatar_color: string;
  avatar_icon?: string;
  created_at: string;
};

type ClassRow = {
  id: string;
  name: string;
  code: string;
  niveau: string | null;
  created_at: string;
  member_count?: number;
};

type Member = {
  id: string;
  username: string;
  niveau: string | null;
  avatar_color: string;
};

type ScoreRow = {
  id: string;
  username: string;
  game_name: string;
  score: number;
  played_at: string;
};

const NIVEAUX = ['college', 'lycee', 'universite', 'grand-public'];
const NIVEAU_LABELS: Record<string, string> = {
  college: 'Collège', lycee: 'Lycée', universite: 'Université', 'grand-public': 'Grand Public',
};

function avatarBg(color: string) {
  return color || '#4361ee';
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function roleIcon(role: Role) {
  if (role === 'admin') return <Shield size={14} />;
  if (role === 'enseignant') return <GraduationCap size={14} />;
  return <UserCheck size={14} />;
}

function roleBadgeClass(role: Role) {
  if (role === 'admin') return 'gest-badge gest-badge--admin';
  if (role === 'enseignant') return 'gest-badge gest-badge--prof';
  return 'gest-badge gest-badge--student';
}

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrateur',
  enseignant: 'Enseignant',
  apprenant: 'Apprenant',
};

export default function GestionPage() {
  const [me, setMe] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<'users' | 'classes' | 'scores'>('users');

  // Users
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Create user (admin only)
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'enseignant' | 'admin'>('enseignant');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserError, setCreateUserError] = useState('');

  // Reset password
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [showResetPwd, setShowResetPwd] = useState(false);

  // Niveau assign
  const [niveauTarget, setNiveauTarget] = useState<string | null>(null);
  const [niveauValue, setNiveauValue] = useState('lycee');
  const [niveauLoading, setNiveauLoading] = useState(false);

  // Classes
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassNiveau, setNewClassNiveau] = useState('lycee');
  const [createClassLoading, setCreateClassLoading] = useState(false);
  const [createClassError, setCreateClassError] = useState('');
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [classMembers, setClassMembers] = useState<Record<string, Member[]>>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Scores
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [scoresFilter, setScoresFilter] = useState('');

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (data.user && (data.user.role === 'admin' || data.user.role === 'enseignant')) {
          setMe(data.user as SessionUser);
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!me) return;
    if (tab === 'users') loadUsers();
    if (tab === 'classes') loadClasses();
    if (tab === 'scores') loadScores();
  }, [tab, me]);

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const r = await fetch('/api/admin/users');
      const d = await r.json();
      if (d.ok) setUsers(d.users ?? []);
    } finally { setUsersLoading(false); }
  }

  async function loadClasses() {
    setClassesLoading(true);
    try {
      const r = await fetch('/api/classes');
      const d = await r.json();
      if (d.ok) setClasses(d.classes ?? []);
    } finally { setClassesLoading(false); }
  }

  async function loadClassMembers(classId: string) {
    if (classMembers[classId]) return;
    const r = await fetch(`/api/classes/${classId}`);
    const d = await r.json();
    if (d.ok) setClassMembers(prev => ({ ...prev, [classId]: d.members ?? [] }));
  }

  async function loadScores() {
    setScoresLoading(true);
    try {
      const r = await fetch('/api/scores?all=1&limit=200');
      const d = await r.json();
      if (d.ok) setScores(d.scores ?? []);
    } finally { setScoresLoading(false); }
  }

  async function createUser() {
    if (!newUsername.trim() || newPassword.length < 4) return;
    setCreateUserLoading(true);
    setCreateUserError('');
    try {
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newRole }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { setCreateUserError(d.error ?? 'Erreur'); return; }
      setShowCreateUser(false);
      setNewUsername('');
      setNewPassword('');
      loadUsers();
    } finally { setCreateUserLoading(false); }
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Supprimer le compte "${name}" ? Cette action est irréversible.`)) return;
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    loadUsers();
  }

  async function resetPassword() {
    if (!resetTarget || resetPwd.length < 4) return;
    setResetLoading(true);
    setResetError('');
    try {
      const r = await fetch(`/api/admin/users/${resetTarget}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'reset_password', password: resetPwd }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { setResetError(d.error ?? 'Erreur'); return; }
      setResetTarget(null);
      setResetPwd('');
    } finally { setResetLoading(false); }
  }

  async function assignNiveau() {
    if (!niveauTarget) return;
    setNiveauLoading(true);
    try {
      await fetch(`/api/admin/users/${niveauTarget}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'set_niveau', niveau: niveauValue }),
      });
      setNiveauTarget(null);
      loadUsers();
    } finally { setNiveauLoading(false); }
  }

  async function createClass() {
    if (!newClassName.trim()) return;
    setCreateClassLoading(true);
    setCreateClassError('');
    try {
      const r = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: newClassName.trim(), niveau: newClassNiveau }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { setCreateClassError(d.error ?? 'Erreur'); return; }
      setShowCreateClass(false);
      setNewClassName('');
      loadClasses();
    } finally { setCreateClassLoading(false); }
  }

  async function deleteClass(id: string, name: string) {
    if (!confirm(`Supprimer la classe "${name}" ?`)) return;
    await fetch(`/api/classes/${id}`, { method: 'DELETE' });
    loadClasses();
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  function exportClassCSV(classId: string, className: string) {
    const members = classMembers[classId] ?? [];
    const classScores = scores.filter(s => members.some(m => m.username === s.username));
    const rows = [
      ['Élève', 'Niveau', 'Jeu', 'Score', 'Date'],
      ...classScores.map(s => {
        const m = members.find(m => m.username === s.username);
        return [s.username, m?.niveau ?? '', s.game_name, String(s.score), new Date(s.played_at).toLocaleString('fr-FR')];
      }),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scores_${className.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportAllScoresCSV() {
    const rows = [
      ['Élève', 'Jeu', 'Score', 'Date'],
      ...scores.map(s => [s.username, s.game_name, String(s.score), new Date(s.played_at).toLocaleString('fr-FR')]),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scores_colorroom_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (checking) {
    return (
      <div className="gest">
        <div className="gest-loading">
          <div className="gest-spinner" />
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="gest">
        <div className="gest-access-denied">
          <Shield size={40} />
          <h2>Accès refusé</h2>
          <p>Cette page est réservée aux administrateurs et enseignants.</p>
          <Link href="/jeux" className="gest-btn gest-btn--primary">
            <ArrowLeft size={16} /> Retour aux jeux
          </Link>
        </div>
      </div>
    );
  }

  const filteredScores = scoresFilter
    ? scores.filter(s => s.username.toLowerCase().includes(scoresFilter.toLowerCase()) || s.game_name.toLowerCase().includes(scoresFilter.toLowerCase()))
    : scores;

  return (
    <div className="gest">
      {/* Header */}
      <div className="gest-header">
        <div className="gest-header-inner">
          <div className="gest-header-left">
            <Link href="/jeux" className="gest-back-link">
              <ArrowLeft size={16} /> Jeux
            </Link>
            <div className="gest-title">
              <div className="gest-brand-dots">
                <span style={{ background: '#ef4444' }} />
                <span style={{ background: '#22c55e' }} />
                <span style={{ background: '#3b82f6' }} />
              </div>
              <div>
                <h1>{me.role === 'admin' ? 'Administration' : 'Espace enseignant'}</h1>
                <div className="gest-subtitle">
                  {me.role === 'admin'
                    ? 'Tous les comptes, toutes les classes et tous les scores'
                    : 'Vos classes, vos élèves et leurs scores'}
                </div>
              </div>
            </div>
          </div>
          <div className="gest-me">
            <div className="gest-avatar" style={{ background: avatarBg(me.avatarColor) }}>
              <AvatarIcon name={me.avatarIcon} size={18} color="#fff" />
            </div>
            <div>
              <div className="gest-me-name">{me.username}</div>
              <div className={roleBadgeClass(me.role)}>
                {roleIcon(me.role)} {ROLE_LABELS[me.role]}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="gest-tabs">
          <button className={`gest-tab${tab === 'users' ? ' gest-tab--active' : ''}`} onClick={() => setTab('users')}>
            <Users size={16} /> {me.role === 'admin' ? 'Utilisateurs' : 'Mes élèves'}
          </button>
          <button className={`gest-tab${tab === 'classes' ? ' gest-tab--active' : ''}`} onClick={() => setTab('classes')}>
            <BookOpen size={16} /> {me.role === 'admin' ? 'Classes' : 'Mes classes'}
          </button>
          <button className={`gest-tab${tab === 'scores' ? ' gest-tab--active' : ''}`} onClick={() => setTab('scores')}>
            <Trophy size={16} /> Scores
          </button>
        </div>
      </div>

      <div className="gest-content">

        {/* ===== USERS TAB ===== */}
        {tab === 'users' && (
          <div className="gest-section">
            <div className="gest-section-header">
              <h2><Users size={18} /> {me.role === 'admin' ? 'Utilisateurs' : 'Mes élèves'}</h2>
              <div className="gest-actions">
                <button className="gest-icon-btn" onClick={loadUsers} title="Rafraîchir">
                  <RefreshCw size={15} />
                </button>
                {me.role === 'admin' && (
                  <button className="gest-btn gest-btn--primary" onClick={() => { setShowCreateUser(v => !v); setCreateUserError(''); }}>
                    <Plus size={15} /> Créer un compte
                  </button>
                )}
              </div>
            </div>

            <div className="gest-info-banner">
              {me.role === 'admin'
                ? 'En tant qu\'administrateur, vous voyez tous les comptes. Vous pouvez créer des comptes enseignants ou administrateurs, réinitialiser les mots de passe, assigner les niveaux et supprimer des comptes.'
                : 'En tant qu\'enseignant, vous voyez uniquement les élèves de vos classes. Vous pouvez réinitialiser leur mot de passe et leur assigner un niveau. La création et la suppression de comptes sont réservées à l\'administrateur.'}
            </div>

            {/* Create user form */}
            {showCreateUser && me.role === 'admin' && (
              <div className="gest-form-card">
                <h3>Nouveau compte</h3>
                <div className="gest-form-row">
                  <div className="gest-field">
                    <label>Identifiant</label>
                    <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="prof_dupont" autoFocus />
                  </div>
                  <div className="gest-field">
                    <label>Mot de passe</label>
                    <div className="gest-pwd-wrap">
                      <input type={showNewPwd ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 4 chars" />
                      <button type="button" className="gest-pwd-eye" onClick={() => setShowNewPwd(p => !p)}>
                        {showNewPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="gest-field">
                    <label>Rôle</label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value as 'enseignant' | 'admin')}>
                      <option value="enseignant">Enseignant</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="gest-field gest-field--action">
                    <label>&nbsp;</label>
                    <button
                      className="gest-btn gest-btn--primary"
                      onClick={createUser}
                      disabled={createUserLoading || !newUsername.trim() || newPassword.length < 4}
                    >
                      {createUserLoading ? <span className="gest-spin" /> : <><Plus size={14} /> Créer</>}
                    </button>
                  </div>
                </div>
                {createUserError && <div className="gest-error">{createUserError}</div>}
              </div>
            )}

            {usersLoading ? (
              <div className="gest-spinner-center"><div className="gest-spinner" /></div>
            ) : (
              <div className="gest-table-wrap">
                <table className="gest-table">
                  <thead>
                    <tr>
                      <th>Utilisateur</th>
                      <th>Rôle</th>
                      <th>Niveau</th>
                      <th>Créé le</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div className="gest-user-cell">
                            <div className="gest-avatar gest-avatar--sm" style={{ background: avatarBg(u.avatar_color) }}>
                              <AvatarIcon name={u.avatar_icon} size={15} color="#fff" />
                            </div>
                            <span>{u.username}</span>
                          </div>
                        </td>
                        <td>
                          <span className={roleBadgeClass(u.user_type)}>
                            {roleIcon(u.user_type)} {u.user_type}
                          </span>
                        </td>
                        <td>
                          {niveauTarget === u.id ? (
                            <div className="gest-inline-form">
                              <select value={niveauValue} onChange={e => setNiveauValue(e.target.value)}>
                                {NIVEAUX.map(n => <option key={n} value={n}>{NIVEAU_LABELS[n]}</option>)}
                              </select>
                              <button className="gest-btn-xs gest-btn-xs--ok" onClick={assignNiveau} disabled={niveauLoading}>
                                {niveauLoading ? '…' : <Check size={13} />}
                              </button>
                              <button className="gest-btn-xs" onClick={() => setNiveauTarget(null)}>✕</button>
                            </div>
                          ) : (
                            <button
                              className="gest-niveau-pill"
                              onClick={() => { setNiveauTarget(u.id); setNiveauValue(u.niveau ?? 'lycee'); }}
                              title="Modifier le niveau"
                            >
                              {u.niveau ? NIVEAU_LABELS[u.niveau] ?? u.niveau : <span style={{ opacity: 0.4 }}>—</span>}
                            </button>
                          )}
                        </td>
                        <td style={{ fontSize: 12, opacity: 0.6 }}>
                          {new Date(u.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td>
                          <div className="gest-row-actions">
                            {resetTarget === u.id ? (
                              <div className="gest-inline-form">
                                <div className="gest-pwd-wrap">
                                  <input
                                    type={showResetPwd ? 'text' : 'password'}
                                    value={resetPwd}
                                    onChange={e => setResetPwd(e.target.value)}
                                    placeholder="Nouveau mdp"
                                    style={{ width: 130 }}
                                    autoFocus
                                  />
                                  <button type="button" className="gest-pwd-eye" onClick={() => setShowResetPwd(p => !p)}>
                                    {showResetPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                                  </button>
                                </div>
                                <button className="gest-btn-xs gest-btn-xs--ok" onClick={resetPassword} disabled={resetLoading || resetPwd.length < 4}>
                                  {resetLoading ? '…' : <Check size={13} />}
                                </button>
                                <button className="gest-btn-xs" onClick={() => { setResetTarget(null); setResetPwd(''); setResetError(''); }}>✕</button>
                                {resetError && <span className="gest-error-inline">{resetError}</span>}
                              </div>
                            ) : (
                              <button
                                className="gest-btn-xs"
                                onClick={() => { setResetTarget(u.id); setResetPwd(''); setResetError(''); }}
                                title="Réinitialiser le mot de passe"
                              >
                                <RefreshCw size={13} /> Mdp
                              </button>
                            )}
                            {me.role === 'admin' && u.id !== me.id && (
                              <button
                                className="gest-btn-xs gest-btn-xs--danger"
                                onClick={() => deleteUser(u.id, u.username)}
                                title="Supprimer"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', opacity: 0.5, padding: 32 }}>Aucun utilisateur</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ===== CLASSES TAB ===== */}
        {tab === 'classes' && (
          <div className="gest-section">
            <div className="gest-section-header">
              <h2><BookOpen size={18} /> {me.role === 'admin' ? 'Classes' : 'Mes classes'}</h2>
              <div className="gest-actions">
                <button className="gest-icon-btn" onClick={loadClasses}><RefreshCw size={15} /></button>
                <button className="gest-btn gest-btn--primary" onClick={() => { setShowCreateClass(v => !v); setCreateClassError(''); }}>
                  <Plus size={15} /> Créer une classe
                </button>
              </div>
            </div>

            <div className="gest-info-banner">
              {me.role === 'admin'
                ? 'Vous voyez toutes les classes de l\'établissement. Chaque classe possède un code à communiquer aux élèves pour qu\'ils la rejoignent.'
                : 'Vous voyez uniquement les classes que vous avez créées. Communiquez le code d\'une classe à vos élèves pour qu\'ils la rejoignent.'}
            </div>

            {showCreateClass && (
              <div className="gest-form-card">
                <h3>Nouvelle classe</h3>
                <div className="gest-form-row">
                  <div className="gest-field">
                    <label>Nom de la classe</label>
                    <input value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="Ex : 3ème A" autoFocus />
                  </div>
                  <div className="gest-field">
                    <label>Niveau</label>
                    <select value={newClassNiveau} onChange={e => setNewClassNiveau(e.target.value)}>
                      {NIVEAUX.map(n => <option key={n} value={n}>{NIVEAU_LABELS[n]}</option>)}
                    </select>
                  </div>
                  <div className="gest-field gest-field--action">
                    <label>&nbsp;</label>
                    <button
                      className="gest-btn gest-btn--primary"
                      onClick={createClass}
                      disabled={createClassLoading || !newClassName.trim()}
                    >
                      {createClassLoading ? <span className="gest-spin" /> : <><Plus size={14} /> Créer</>}
                    </button>
                  </div>
                </div>
                {createClassError && <div className="gest-error">{createClassError}</div>}
              </div>
            )}

            {classesLoading ? (
              <div className="gest-spinner-center"><div className="gest-spinner" /></div>
            ) : (
              <div className="gest-class-list">
                {classes.map(cls => (
                  <div key={cls.id} className="gest-class-card">
                    <div className="gest-class-card-header">
                      <div className="gest-class-info">
                        <div className="gest-class-name">{cls.name}</div>
                        <div className="gest-class-meta">
                          {cls.niveau ? NIVEAU_LABELS[cls.niveau] ?? cls.niveau : ''}
                          {cls.member_count != null && ` · ${cls.member_count} élève(s)`}
                        </div>
                      </div>
                      <div className="gest-class-code-wrap">
                        <span className="gest-class-code">{cls.code}</span>
                        <button
                          className="gest-icon-btn"
                          onClick={() => copyCode(cls.code)}
                          title="Copier le code"
                        >
                          {copiedCode === cls.code ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                      <div className="gest-class-card-actions">
                        <button
                          className="gest-btn-xs"
                          onClick={() => {
                            if (expandedClass === cls.id) { setExpandedClass(null); return; }
                            setExpandedClass(cls.id);
                            loadClassMembers(cls.id);
                            if (scores.length === 0) loadScores();
                          }}
                        >
                          {expandedClass === cls.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          {expandedClass === cls.id ? 'Fermer' : 'Voir les élèves'}
                        </button>
                        <button
                          className="gest-btn-xs"
                          onClick={() => { loadClassMembers(cls.id); if (scores.length === 0) loadScores().then(() => exportClassCSV(cls.id, cls.name)); else exportClassCSV(cls.id, cls.name); }}
                          title="Exporter les scores CSV"
                        >
                          <Download size={13} /> CSV
                        </button>
                        <button
                          className="gest-btn-xs gest-btn-xs--danger"
                          onClick={() => deleteClass(cls.id, cls.name)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {expandedClass === cls.id && (
                      <div className="gest-class-members">
                        {!classMembers[cls.id] ? (
                          <div className="gest-spinner-center" style={{ padding: 16 }}><div className="gest-spinner" /></div>
                        ) : classMembers[cls.id].length === 0 ? (
                          <p style={{ opacity: 0.5, padding: '12px 0', fontSize: 13 }}>Aucun élève inscrit dans cette classe.</p>
                        ) : (
                          <table className="gest-table gest-table--compact">
                            <thead>
                              <tr><th>Élève</th><th>Niveau</th><th>Scores</th></tr>
                            </thead>
                            <tbody>
                              {classMembers[cls.id].map(m => {
                                const memberScores = scores.filter(s => s.username === m.username);
                                const best = memberScores.reduce((acc, s) => acc + s.score, 0);
                                return (
                                  <tr key={m.id}>
                                    <td>
                                      <div className="gest-user-cell">
                                        <div className="gest-avatar gest-avatar--sm" style={{ background: avatarBg(m.avatar_color) }}>
                                          {initials(m.username)}
                                        </div>
                                        {m.username}
                                      </div>
                                    </td>
                                    <td style={{ fontSize: 12 }}>{m.niveau ? NIVEAU_LABELS[m.niveau] ?? m.niveau : '—'}</td>
                                    <td style={{ fontSize: 12 }}>{memberScores.length > 0 ? `${memberScores.length} partie(s) · total ${best} pts` : '—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {classes.length === 0 && (
                  <div style={{ textAlign: 'center', opacity: 0.5, padding: 48 }}>Aucune classe créée</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== SCORES TAB ===== */}
        {tab === 'scores' && (
          <div className="gest-section">
            <div className="gest-section-header">
              <h2><Trophy size={18} /> Scores</h2>
              <div className="gest-actions">
                <input
                  className="gest-search"
                  value={scoresFilter}
                  onChange={e => setScoresFilter(e.target.value)}
                  placeholder="Filtrer par élève ou jeu…"
                />
                <button className="gest-icon-btn" onClick={loadScores}><RefreshCw size={15} /></button>
                <button className="gest-btn gest-btn--primary" onClick={exportAllScoresCSV} disabled={scores.length === 0}>
                  <Download size={15} /> Export CSV
                </button>
              </div>
            </div>

            {scoresLoading ? (
              <div className="gest-spinner-center"><div className="gest-spinner" /></div>
            ) : (
              <div className="gest-table-wrap">
                <table className="gest-table">
                  <thead>
                    <tr>
                      <th>Élève</th>
                      <th>Jeu</th>
                      <th>Score</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredScores.map(s => (
                      <tr key={s.id}>
                        <td>
                          <div className="gest-user-cell">
                            <div className="gest-avatar gest-avatar--sm" style={{ background: '#4361ee' }}>
                              {initials(s.username)}
                            </div>
                            {s.username}
                          </div>
                        </td>
                        <td>{s.game_name}</td>
                        <td>
                          <span className="gest-score-badge">{s.score.toLocaleString('fr-FR')} pts</span>
                        </td>
                        <td style={{ fontSize: 12, opacity: 0.6 }}>
                          {new Date(s.played_at).toLocaleString('fr-FR')}
                        </td>
                      </tr>
                    ))}
                    {filteredScores.length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', opacity: 0.5, padding: 32 }}>Aucun score enregistré</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
