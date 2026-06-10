/**
 * @file app/page.tsx
 * @brief Page d'accueil de l'application Color Room Games.
 *
 * Point d'entrée de l'interface web ColorRoom. Affiche la bannière animée
 * (HeroTiles) avec le titre du projet, puis deux boutons de navigation
 * principaux : « Jeux » (vers /jeux) et « Éditeur » (vers /editeur).
 * Composant serveur Next.js (pas de 'use client') : il exporte également
 * les métadonnées SEO (titre/description) de la route racine.
 */
import Link from 'next/link';

import HeroTiles from './_components/HeroTiles';

/**
 * @brief Métadonnées Next.js de la page d'accueil (titre d'onglet + description SEO).
 */
export const metadata = {
  title: 'Accueil',
  description: 'Color Room Games — interface web et serious games pour la ColorRoom.',
};

/**
 * @brief Composant de la page d'accueil.
 *
 * Rend la section principale : bannière HeroTiles, titre du projet et les
 * boutons de navigation vers les sections Jeux et Éditeur.
 *
 * @returns L'arbre JSX de la page d'accueil.
 */
export default function HomePage() {
  return (
    <main className="home">
      <div className="home__hero">
        <HeroTiles />
      </div>

      <div className="home__content">
        <div className="home__title">Color Room Games</div>

        <div className="home__actions">
          <Link className="home__button" href="/jeux">
            Jeux
          </Link>
          <Link className="home__button" href="/editeur">
            Éditeur
          </Link>
        </div>
      </div>
    </main>
  );
}
