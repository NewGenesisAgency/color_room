import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './editeur.css';

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

export default function EditeurLayout({ children }: { children: ReactNode }) {
  return (
    <section className="editeur">
      <div className="editeur-shell">{children}</div>
    </section>
  );
}
