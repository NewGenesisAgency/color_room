'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu, X, Home, Gamepad2, Sparkles, Palette, Ruler,
  LogIn, LogOut, Settings, HelpCircle, PenSquare,
} from 'lucide-react';
import { AvatarIcon } from './avatarIcons';

interface UserInfo {
  id: string;
  username: string;
  role: 'admin' | 'enseignant' | 'apprenant';
  niveau: string;
  avatarColor: string;
  avatarIcon?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  enseignant: 'Enseignant',
  apprenant: 'Apprenant',
};

export default function NavigationMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const refreshUser = () => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { user: UserInfo | null }) => setCurrentUser(data.user ?? null))
      .catch(() => setCurrentUser(null));
  };

  // Synchronisation de l'état de connexion :
  // - au montage
  // - sur l'événement global 'auth-changed' (login/logout depuis n'importe où)
  useEffect(() => {
    refreshUser();
    const onAuthChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      // Si le payload contient l'utilisateur (ou null explicite), on l'applique
      // directement pour éviter toute course avec le cookie ; sinon on re-fetch.
      if (detail !== undefined) setCurrentUser((detail as UserInfo | null) ?? null);
      else refreshUser();
    };
    window.addEventListener('auth-changed', onAuthChanged);
    return () => window.removeEventListener('auth-changed', onAuthChanged);
  }, []);

  // Fermer le menu + revérifier l'auth à chaque navigation (filet de sécurité)
  useEffect(() => {
    setIsOpen(false);
    refreshUser();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setCurrentUser(null);
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: null }));
    router.push('/');
  };

  const isAdmin = currentUser?.role === 'admin';
  const isEnseignant = currentUser?.role === 'enseignant';

  const navItems = [
    { href: '/',             label: 'Accueil',        icon: Home },
    { href: '/jeux',         label: 'Jeux',            icon: Gamepad2 },
    { href: '/spectre',      label: 'Spectre',         icon: Sparkles },
    { href: '/chromaticite', label: 'Chromaticité',    icon: Palette },
    { href: '/mesure',       label: 'Mesure',          icon: Ruler },
    { href: '/editeur',      label: 'Éditeur',         icon: PenSquare },
    { href: '/aide',         label: 'Aide',            icon: HelpCircle },
    ...(isAdmin || isEnseignant
      ? [{ href: '/gestion', label: 'Tableau de bord', icon: Settings }]
      : []),
  ];

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname?.startsWith(href + '/'));

  // Tile reveal animation index:
  // 0 = user card, 1..N = nav links, N+1 = auth button
  let tileIndex = 0;
  const nextTile = () => tileIndex++;

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1001,
          width: '48px',
          height: '48px',
          borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.14)',
          background: 'rgba(14,18,32,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow:
            '0 4px 24px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(22,28,52,0.95)';
          e.currentTarget.style.transform = 'scale(1.06)';
          e.currentTarget.style.boxShadow =
            '0 6px 28px rgba(0,0,0,0.45), 0 1px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.10)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(14,18,32,0.88)';
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow =
            '0 4px 24px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)';
        }}
        aria-label={isOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
      >
        {isOpen ? (
          <X size={20} style={{ color: 'rgba(255,255,255,0.92)' }} />
        ) : (
          <Menu size={20} style={{ color: 'rgba(255,255,255,0.92)' }} />
        )}
      </button>

      {/* Menu Panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            right: '20px',
            zIndex: 1000,
            minWidth: '230px',
            padding: '16px',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.4)',
            background: 'rgba(255,255,255,0.25)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            animation: 'slideDown 0.3s ease',
          }}
        >
          {/* User card */}
          {(() => {
            const idx = nextTile();
            return currentUser ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  marginBottom: '16px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.3)',
                  animation: 'tileReveal 0.3s ease both',
                  animationDelay: `${idx * 40}ms`,
                }}
              >
                {/* Avatar circle with avatarColor */}
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: currentUser.avatarColor || '#667eea',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `0 0 0 2px rgba(255,255,255,0.6), 0 2px 8px rgba(0,0,0,0.15)`,
                  }}
                >
                  <AvatarIcon name={currentUser.avatarIcon} size={18} color="#fff" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#1a1d2e',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {currentUser.username}
                  </div>
                  <div style={{ fontSize: '12px', color: '#555', marginTop: '1px' }}>
                    {ROLE_LABELS[currentUser.role] ?? currentUser.role}
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '12px',
                  marginBottom: '16px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.3)',
                  fontSize: '14px',
                  color: '#666',
                  animation: 'tileReveal 0.3s ease both',
                  animationDelay: `${idx * 40}ms`,
                }}
              >
                Non connecté
              </div>
            );
          })()}

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const idx = nextTile();
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    color: active ? '#4361ee' : '#1a1d2e',
                    background: active ? 'rgba(67,97,238,0.12)' : 'transparent',
                    transition: 'all 0.2s ease',
                    fontSize: '14px',
                    fontWeight: active ? 700 : 500,
                    animation: 'tileReveal 0.3s ease both',
                    animationDelay: `${idx * 40}ms`,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Divider */}
          <div
            style={{
              height: '1px',
              background: 'rgba(0,0,0,0.1)',
              margin: '16px 0',
            }}
          />

          {/* Auth Button */}
          {(() => {
            const idx = nextTile();
            return currentUser ? (
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(239,68,68,0.08)',
                  color: '#ef4444',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                  animation: 'tileReveal 0.3s ease both',
                  animationDelay: `${idx * 40}ms`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.16)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
                }}
              >
                <LogOut size={18} />
                Se déconnecter
              </button>
            ) : (
              <Link
                href="/jeux"
                onClick={() => setIsOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid rgba(67,97,238,0.28)',
                  background: 'rgba(67,97,238,0.08)',
                  color: '#4361ee',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textDecoration: 'none',
                  textAlign: 'center',
                  animation: 'tileReveal 0.3s ease both',
                  animationDelay: `${idx * 40}ms`,
                }}
              >
                <LogIn size={18} />
                Se connecter
              </Link>
            );
          })()}
        </div>
      )}

      {/* Animation Styles */}
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes tileReveal {
          from {
            opacity: 0;
            transform: translateY(8px);
            filter: blur(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }
      `}</style>
    </>
  );
}
