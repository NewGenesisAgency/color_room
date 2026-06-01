import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './jeux.css';

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

export default function JeuxLayout({ children }: { children: ReactNode }) {
  return <section className="jeux">{children}</section>;
}
