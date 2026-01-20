import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';
import 'reactflow/dist/style.css';

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
    icon: '/data.png',
    shortcut: '/data.png',
    apple: '/data.png',
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
