/**
 * @file app/editeur/layout.tsx
 * @brief Layout de la section « Éditeur » (route /editeur).
 *
 * Layout spécifique à l'éditeur de jeux (interface inspirée d'Unreal).
 * Importe la feuille de style editeur.css et enveloppe la page dans une
 * <section className="editeur"> contenant une coquille (.editeur-shell).
 * Exporte les métadonnées SEO propres à la section (titre « Éditeur »,
 * description, cartes OpenGraph/Twitter).
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './editeur.css';

/**
 * @brief Métadonnées SEO de la section Éditeur.
 */
export const metadata: Metadata = {
  title: 'Éditeur',
  description: 'Éditeur de jeux (style Unreal) pour ColorRoomGames.',
  openGraph: {
    title: 'Color Room Games - Éditeur',
    description: 'Éditeur de jeux (style Unreal) pour ColorRoomGames.',
    images: [{ url: '/data.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Color Room Games - Éditeur',
    description: 'Éditeur de jeux (style Unreal) pour ColorRoomGames.',
    images: ['/data.png'],
  },
};

/**
 * @brief Composant de layout de la section Éditeur.
 *
 * @param children La page /editeur rendue dans la coquille de l'éditeur.
 * @returns Une <section className="editeur"> avec sa coquille .editeur-shell.
 */
export default function EditeurLayout({ children }: { children: ReactNode }) {
  return (
    <section className="editeur">
      <div className="editeur-shell">{children}</div>
    </section>
  );
}
