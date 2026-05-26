'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, Home, Gamepad2, Palette, Ruler, LogIn, LogOut, User, Sparkles } from 'lucide-react';

interface UserInfo {
  name: string;
  role: string;
}

export default function NavigationMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Load user from localStorage on mount with expiration check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = window.localStorage.getItem('crg_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          // Check if user session has expired
          if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
            // Session expired, clear storage
            window.localStorage.removeItem('crg_user');
            window.localStorage.removeItem('crg_user_type');
          } else {
            setCurrentUser({ name: parsed.name, role: parsed.role });
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  }, []);

  // Close menu when navigating to a different page
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('crg_user');
      window.localStorage.removeItem('crg_user_type');
    }
    setCurrentUser(null);
    setIsOpen(false);
    // Redirect to home or login page
    router.push('/');
  };

  const handleLogin = () => {
    // For now, simulate login - in real app this would open a login modal or redirect
    const demoUser: UserInfo = { name: 'Utilisateur', role: 'player' };
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('crg_user', JSON.stringify(demoUser));
    }
    setCurrentUser(demoUser);
    setIsOpen(false);
  };

  const navItems = [
    { href: '/', label: 'Accueil', icon: Home },
    { href: '/jeux', label: 'Jeux', icon: Gamepad2 },
    { href: '/spectre', label: 'Spectre Chromatique', icon: Sparkles },
    { href: '/chromaticite', label: 'Chromaticité CIE', icon: Palette },
    { href: '/mesure', label: 'Mesure', icon: Ruler },
    { href: '/editeur', label: 'Éditeur', icon: Palette },
    { href: '/creer', label: 'Créer', icon: User },
  ];

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

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
          boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(22,28,52,0.95)';
          e.currentTarget.style.transform = 'scale(1.06)';
          e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,0,0,0.45), 0 1px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.10)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(14,18,32,0.88)';
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)';
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
            minWidth: '220px',
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
          {/* User Info */}
          {currentUser ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                marginBottom: '16px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.3)',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <User size={18} color="white" />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>
                  {currentUser.name}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>{currentUser.role}</div>
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
              }}
            >
              Non connecté
            </div>
          )}

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
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
                    color: active ? '#667eea' : '#333',
                    background: active ? 'rgba(102,126,234,0.15)' : 'transparent',
                    transition: 'all 0.2s ease',
                    fontSize: '14px',
                    fontWeight: active ? 600 : 500,
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
          {currentUser ? (
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
                background: 'rgba(239,68,68,0.1)',
                color: '#ef4444',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
              }}
            >
              <LogOut size={18} />
              Se déconnecter
            </button>
          ) : (
            <button
              onClick={handleLogin}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid rgba(102,126,234,0.3)',
                background: 'rgba(102,126,234,0.1)',
                color: '#667eea',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(102,126,234,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(102,126,234,0.1)';
              }}
            >
              <LogIn size={18} />
              Se connecter
            </button>
          )}
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
      `}</style>
    </>
  );
}
