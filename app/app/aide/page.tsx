'use client';

/**
 * @file app/aide/page.tsx
 * @brief Page d'aide / guide d'utilisation de l'application ColorRoom.
 *
 * Page statique côté client présentant un guide pédagogique sous forme de
 * cartes animées (révélées au défilement). Couvre l'introduction au projet,
 * la connexion, le déroulé d'une partie, la liste des jeux disponibles
 * (tableau GAMES), l'éditeur de jeux, le tableau de bord enseignant/admin,
 * les instruments de mesure (Mesure, Spectre, Chromaticité) et les canaux
 * LED de la salle. N'interagit pas avec les dalles ni l'API : contenu
 * purement informatif, animé via IntersectionObserver.
 */

import { useEffect, useRef } from 'react';
import {
  LogIn,
  Gamepad2,
  BookOpen,
  Settings,
  Activity,
  Zap,
  Layers,
  Info,
  PenSquare,
  type LucideIcon,
} from 'lucide-react';
import './aide.css';

// ---- Data ----------------------------------------------------------------

/**
 * @brief Catalogue des serious games présentés dans le guide.
 *
 * Chaque entrée associe le nom du jeu à une courte description affichée dans
 * le tableau « Jeux disponibles ».
 */
const GAMES = [
  { name: 'Tetris Lumière',    desc: 'Jeu de Tetris qui pilote les dalles en temps réel' },
  { name: 'Simon Lumière',     desc: 'Mémorisez et reproduisez les séquences lumineuses' },
  { name: 'Maître du Blanc',   desc: 'Trouvez la température de couleur du blanc' },
  { name: 'Color Speed',       desc: 'Reconnaissez les couleurs le plus rapidement possible' },
  { name: 'Chasseur de Gamut', desc: 'Reproduisez exactement une couleur cible sur le diagramme CIE' },
  { name: 'Spectre de Mots',   desc: 'Physique de la lumière — cachez ou révélez les mots' },
  { name: 'Mix de Canaux',     desc: 'Créez la couleur cible en mixant 3 canaux LED' },
];

// ---- Tile reveal hook ----------------------------------------------------

/**
 * @brief Hook d'animation : révèle un élément lorsqu'il entre dans le viewport.
 *
 * Met en place un IntersectionObserver qui ajoute la classe CSS 'visible' à
 * l'élément référencé dès qu'il devient visible, puis cesse de l'observer.
 *
 * @param ref Référence React vers l'élément HTML à révéler.
 */
function useRevealOnScroll(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
}

// ---- Individual card component -------------------------------------------

/**
 * @brief Carte de section du guide d'aide, avec icône, titre et contenu.
 *
 * Utilise useRevealOnScroll pour s'animer à l'apparition. Le délai permet
 * d'échelonner l'animation de plusieurs cartes.
 *
 * @param icon Icône Lucide affichée dans l'en-tête de la carte.
 * @param title Titre de la section.
 * @param children Contenu de la carte (paragraphes, listes, tableaux…).
 * @param delay Délai (ms) appliqué à la transition d'apparition (défaut 0).
 * @returns La carte JSX de la section.
 */
function AideCard({
  icon: Icon,
  title,
  children,
  delay = 0,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useRevealOnScroll(ref as React.RefObject<HTMLElement>);

  return (
    <div
      ref={ref}
      className="aide-card"
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="aide-section-heading">
        <div className="aide-section-icon">
          <Icon size={20} />
        </div>
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ---- Page ----------------------------------------------------------------

/**
 * @brief Composant de la page d'aide.
 *
 * Assemble l'en-tête de marque puis l'ensemble des cartes de sections du
 * guide (introduction, connexion, jeu, jeux disponibles, éditeur, tableau de
 * bord, instruments, canaux LED).
 *
 * @returns L'arbre JSX complet de la page d'aide.
 */
export default function AidePage() {
  return (
    <div className="aide">
      {/* Header */}
      <header className="aide-header">
        <div className="aide-header-brand">
          <div className="aide-logo-dots">
            <span className="aide-logo-dot" style={{ color: '#ef4444', background: '#ef4444' }} />
            <span className="aide-logo-dot" style={{ color: '#22c55e', background: '#22c55e' }} />
            <span className="aide-logo-dot" style={{ color: '#3b82f6', background: '#3b82f6' }} />
          </div>
          <div>
            <h1>ColorRoom</h1>
            <p>Guide d&apos;utilisation</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="aide-container">

        {/* 1. Introduction */}
        <AideCard icon={Info} title="Introduction" delay={0}>
          <p>
            <strong>ColorRoom</strong> est une salle immersive de 42 dalles LED pilotées par
            32 canaux spectraux chacune. Cette interface web permet aux élèves de jouer à des
            jeux sérieux sur la lumière et la couleur, et aux enseignants de créer leurs propres jeux.
          </p>
        </AideCard>

        {/* 2. Se connecter */}
        <AideCard icon={LogIn} title="Se connecter" delay={0}>
          <ul className="aide-list">
            <li>
              Cliquez sur <strong>Jeux</strong> dans le menu de navigation
            </li>
            <li>
              Entrez votre <strong>identifiant</strong> et <strong>mot de passe</strong>
            </li>
            <li>
              Si vous n&apos;avez pas de compte : cliquez &laquo;&nbsp;Créer un compte&nbsp;&raquo;,
              choisissez un pseudo, un mot de passe et une couleur d&apos;avatar
            </li>
            <li>
              <strong>Code de classe</strong> (optionnel) : entré lors de l&apos;inscription pour
              rejoindre une classe
            </li>
          </ul>
        </AideCard>

        {/* 3. Jouer */}
        <AideCard icon={Gamepad2} title="Jouer" delay={0}>
          <ul className="aide-list">
            <li>Choisissez un jeu dans la liste à gauche</li>
            <li>
              Cliquez <strong>Démarrer le Jeu</strong>
            </li>
            <li>
              Certains jeux pilotent les dalles en temps réel &mdash; restez dans la salle&nbsp;!
            </li>
            <li>Score et progression affichés en haut à gauche</li>
          </ul>
        </AideCard>

        {/* 4. Jeux disponibles */}
        <AideCard icon={BookOpen} title="Jeux disponibles" delay={0}>
          <div className="aide-table-wrap">
            <table className="aide-table">
              <thead>
                <tr>
                  <th>Jeu</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {GAMES.map((g) => (
                  <tr key={g.name}>
                    <td>{g.name}</td>
                    <td>{g.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AideCard>

        {/* 5. Créer un jeu */}
        <AideCard icon={PenSquare} title="Créer un jeu (éditeur)" delay={0}>
          <p>
            Réservé aux enseignants. Accessible via{' '}
            <strong>Éditeur</strong> dans le menu.
          </p>
          <ul className="aide-list">
            <li>Glissez-déposez des blocs pour créer la logique du jeu</li>
            <li>Ajoutez des éléments d&apos;interface (boutons, sliders, affichages couleur)</li>
            <li>Reliez les blocs avec des connexions</li>
            <li>Sauvegardez et testez depuis la page Jeux</li>
          </ul>
        </AideCard>

        {/* 6. Tableau de bord */}
        <AideCard icon={Settings} title="Tableau de bord" delay={0}>
          <p>
            Accessible via <strong>Tableau de bord</strong> dans le menu{' '}
            <span className="aide-badge aide-badge--enseignant">Enseignant</span>{' '}
            <span className="aide-badge aide-badge--admin">Admin</span> uniquement.
          </p>
          <ul className="aide-list">
            <li>Gérez les utilisateurs et leurs niveaux</li>
            <li>Créez des classes et partagez le code à vos élèves</li>
            <li>Consultez les scores et exportez en CSV</li>
          </ul>
        </AideCard>

        {/* 7. Instruments */}
        <AideCard icon={Activity} title="Instruments et mesures" delay={0}>
          <ul className="aide-list">
            <li>
              Page <strong>Mesure</strong> : visualisez le spectre lumineux en temps réel depuis
              la CS-160
            </li>
            <li>
              Page <strong>Spectre Chromatique</strong> : visualisez la composition spectrale des
              canaux LED
            </li>
            <li>
              Page <strong>Chromaticité CIE</strong> : diagramme CIE 1931 des canaux et des couleurs
              produites
            </li>
          </ul>
        </AideCard>

        {/* 8. Canaux LED */}
        <AideCard icon={Zap} title="Canaux LED" delay={0}>
          <p>La salle dispose de 32 canaux par dalle :</p>
          <div className="aide-channel-grid">
            <div className="aide-channel-card">
              <h4>Canaux 1 – 18</h4>
              <p>LEDs spectrales (404 nm à 780 nm)</p>
            </div>
            <div className="aide-channel-card">
              <h4>Canaux 19 – 32</h4>
              <p>LEDs phosphore blanc chaud</p>
            </div>
          </div>
          <div className="aide-note">
            <span className="aide-note-icon">
              <Layers size={16} />
            </span>
            <span>
              Chaque dalle est pilotable indépendamment. Certains jeux utilisent l&apos;ensemble
              des 42 dalles en simultané pour des effets de salle complète.
            </span>
          </div>
        </AideCard>

      </main>
    </div>
  );
}
