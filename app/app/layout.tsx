/**
 * @file app/layout.tsx
 * @brief Layout racine de l'application Next.js (App Router).
 *
 * Enveloppe toutes les pages du site. Définit la structure HTML de base
 * (<html lang="fr"> / <body>), importe les styles globaux (globals.css) et
 * ceux de ReactFlow (utilisés par l'éditeur), et affiche le menu de
 * navigation (NavigationMenu) commun à toutes les routes. Exporte aussi
 * les métadonnées SEO globales (titre par défaut/template, description,
 * auteurs, icônes, OpenGraph et Twitter) du projet académique ColorRoom.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';
import 'reactflow/dist/style.css';
import NavigationMenu from './_components/NavigationMenu';

/**
 * @brief Métadonnées SEO globales appliquées à l'ensemble du site.
 *
 * Contient le titre par défaut et son template, la description du projet,
 * la liste des auteurs, les icônes et les cartes OpenGraph/Twitter.
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'Color Room Games',
    template: 'Color Room Games - %s',
  },
  description:
    "Projet académique (Académie de Lyon) — BTS CIEL Cybersécurité (Option A IR) — 'ColorRoom, serious games'. Partenaires: LUMEN Campus Lumière, ENTPE/LTDS/BPMNP.",
  applicationName: 'ColorRoomGames',
  authors: [
    { name: 'Étudiants (E1…E8) — Lycée Édouard Branly' },
    { name: 'M. DELBOSC Serge (enseignant)' },
    { name: 'M. LABAYRADE Raphaël (contact)' },
    { name: 'M. VELLA Andéol (contact)' },
    { name: 'NewGenesis' },
  ],
  creator: 'Lycée Édouard Branly — BTS CIEL',
  publisher: 'Académie de Lyon',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  openGraph: {
    title: 'Color Room Games',
    description:
      "Projet 'ColorRoom, serious games' — application web (Node-RED/JS + Docker) pour piloter et mesurer la lumière (ColorRoom / plaques lumineuses).",
    type: 'website',
    images: [{ url: '/data.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Color Room Games',
    description:
      "Projet 'ColorRoom, serious games' — application web (Node-RED/JS + Docker) pour piloter et mesurer la lumière (ColorRoom / plaques lumineuses).",
    images: ['/data.png'],
  },
};

/**
 * @brief Composant de layout racine.
 *
 * @param children Le contenu de la page courante rendu à l'intérieur du body,
 *   sous le menu de navigation.
 * @returns L'arbre JSX <html>/<body> englobant le menu et la page.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0 }}>
        <NavigationMenu />
        {children}
      </body>
    </html>
  );
}
