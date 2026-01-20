import Link from 'next/link';

import HeroTiles from './_components/HeroTiles';

export const metadata = {
  title: 'Accueil',
  description: 'Color Room Games — interface web et serious games pour la ColorRoom.',
};

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
