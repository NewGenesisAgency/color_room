/**
 * @file app/jeux/layout.tsx
 * @brief Layout de la section « Jeux » (route /jeux).
 *
 * Layout spécifique au segment des serious games. Importe la feuille de
 * style jeux.css et enveloppe la page des jeux dans une <section
 * className="jeux">. Exporte les métadonnées SEO propres à la section
 * (titre « Jeux », description, cartes OpenGraph/Twitter).
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './jeux.css';

/**
 * @brief Métadonnées SEO de la section Jeux.
 */
export const metadata: Metadata = {
  title: 'Jeux',
  description: 'Serious games ColorRoom - contrôle des LEDs et défis pédagogiques.',
  openGraph: {
    title: 'Color Room Games - Jeux',
    description: 'Serious games ColorRoom - contrôle des LEDs et défis pédagogiques.',
    images: [{ url: '/data.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Color Room Games - Jeux',
    description: 'Serious games ColorRoom - contrôle des LEDs et défis pédagogiques.',
    images: ['/data.png'],
  },
};

/**
 * @brief Composant de layout de la section Jeux.
 *
 * @param children La page /jeux rendue à l'intérieur de la section.
 * @returns Une <section className="jeux"> englobant le contenu.
 */
export default function JeuxLayout({ children }: { children: ReactNode }) {
  return <section className="jeux">{children}</section>;
}
