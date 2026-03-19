'use client';

import { useEffect, useMemo, useState } from 'react';

import { blancs } from './data';
import { calculerDifference, calculerScore, choisirManches, genererIndice, rgbVersXyz } from './utils';

import './MaitreDuBlanc.css';

const NOMBRE_MANCHES = 5;
const MAX_ESSAIS = 3;

type EtatJeu = 'accueil' | 'jeu' | 'resultat_manche' | 'fin';

export default function MaitreDuBlanc(props: {
  onTargetColor?: (rgb: { r: number; g: number; b: number }) => void;
}) {
  const { onTargetColor } = props;

  const [etatJeu, setEtatJeu] = useState<EtatJeu>('accueil');
  const [manches, setManches] = useState(() => [] as typeof blancs);
  const [mancheActuelle, setMancheActuelle] = useState(0);
  const [essaiActuel, setEssaiActuel] = useState(1);

  const [rJoueur, setRJoueur] = useState(128);
  const [gJoueur, setGJoueur] = useState(128);
  const [bJoueur, setBJoueur] = useState(128);

  const [scoreTotal, setScoreTotal] = useState(0);
  const [scoreManche, setScoreManche] = useState<number | null>(null);
  const [differenceManche, setDifferenceManche] = useState<number | null>(null);

  const [indices, setIndices] = useState<string[]>([]);
  const [afficherIndices, setAfficherIndices] = useState(false);

  function demarrerPartie() {
    const manchesChoisies = choisirManches(blancs, NOMBRE_MANCHES);
    setManches(manchesChoisies);
    setMancheActuelle(0);
    setEssaiActuel(1);
    setScoreTotal(0);
    setRJoueur(128);
    setGJoueur(128);
    setBJoueur(128);
    setScoreManche(null);
    setDifferenceManche(null);
    setIndices([]);
    setAfficherIndices(false);
    setEtatJeu('jeu');
  }

  function validerReponse() {
    const cible = manches[mancheActuelle];
    if (!cible) return;

    const diff = calculerDifference(cible.r, cible.g, cible.b, rJoueur, gJoueur, bJoueur);
    const score = calculerScore(diff);

    if (score >= 80 || essaiActuel >= MAX_ESSAIS) {
      setScoreManche(score);
      setDifferenceManche(diff);
      setScoreTotal((prev) => prev + score);
      setEtatJeu('resultat_manche');
    } else {
      const nouveauxIndices = genererIndice(cible.r, cible.g, cible.b, rJoueur, gJoueur, bJoueur);
      setIndices(nouveauxIndices);
      setAfficherIndices(true);
      setEssaiActuel((prev) => prev + 1);
    }
  }

  function mancheSuivante() {
    if (mancheActuelle + 1 >= NOMBRE_MANCHES) {
      setEtatJeu('fin');
    } else {
      setMancheActuelle((prev) => prev + 1);
      setEssaiActuel(1);
      setRJoueur(128);
      setGJoueur(128);
      setBJoueur(128);
      setScoreManche(null);
      setDifferenceManche(null);
      setIndices([]);
      setAfficherIndices(false);
      setEtatJeu('jeu');
    }
  }

  const cible = manches[mancheActuelle] ?? null;

  useEffect(() => {
    if (!onTargetColor) return;
    if (etatJeu !== 'jeu') return;
    if (!cible) return;
    onTargetColor({ r: cible.r, g: cible.g, b: cible.b });
  }, [etatJeu, cible?.id]);

  const xyzCible = useMemo(() => {
    if (!cible) return null;
    return rgbVersXyz(cible.r, cible.g, cible.b);
  }, [cible?.id]);

  const xyzJoueur = useMemo(() => {
    return rgbVersXyz(rJoueur, gJoueur, bJoueur);
  }, [rJoueur, gJoueur, bJoueur]);

  if (etatJeu === 'accueil') {
    return (
      <div className="maitre-du-blanc">
        <div className="ecran-final">
          <h1>Le Maître du Blanc</h1>
          <p className="message">Synthèse additive & température de couleur</p>
          <br />
          <p>
            Une couleur cible s'affiche.
            <br />
            Tu dois la recréer en dosant le <strong style={{ color: '#ff4444' }}>Rouge</strong>, le{' '}
            <strong style={{ color: '#44ff44' }}>Vert</strong> et le <strong style={{ color: '#4444ff' }}>Bleu</strong>.
          </p>
          <br />
          <p>
            <strong>{NOMBRE_MANCHES} manches</strong> — {MAX_ESSAIS} essais par manche
          </p>
          <br />
          <button className="btn btn-valider" onClick={demarrerPartie}>
            Commencer
          </button>
        </div>
      </div>
    );
  }

  if (etatJeu === 'jeu') {
    if (!cible || !xyzCible) return null;

    return (
      <div className="maitre-du-blanc">
        <div className="jeu-header">
          <h1>Le Maître du Blanc</h1>
          <p>
            Manche {mancheActuelle + 1}/{NOMBRE_MANCHES} — Essai {essaiActuel}/{MAX_ESSAIS}
          </p>
        </div>

        <div className="info-manche">
          <div className="kelvin">{cible.kelvin}K</div>
          <div className="description">{cible.description}</div>
        </div>

        <div className="score-global">
          Score total : <strong>{scoreTotal}</strong>/{NOMBRE_MANCHES * 100}
        </div>

        <div className="couleurs-container">
          <div className="couleur-box">
            <h3>Couleur cible</h3>
            <div className="couleur-apercu" style={{ backgroundColor: `rgb(${cible.r}, ${cible.g}, ${cible.b})` }} />
          </div>

          <div className="couleur-box">
            <h3>Ta couleur</h3>
            <div className="couleur-apercu" style={{ backgroundColor: `rgb(${rJoueur}, ${gJoueur}, ${bJoueur})` }} />
          </div>
        </div>

        <div className="curseurs-container">
          <div className="curseur-group">
            <span className="curseur-label rouge">R</span>
            <input
              type="range"
              min={0}
              max={255}
              value={rJoueur}
              onChange={(e) => setRJoueur(Number(e.target.value))}
              className="curseur-input rouge"
            />
            <span className="curseur-valeur">{rJoueur}</span>
          </div>

          <div className="curseur-group">
            <span className="curseur-label vert">G</span>
            <input
              type="range"
              min={0}
              max={255}
              value={gJoueur}
              onChange={(e) => setGJoueur(Number(e.target.value))}
              className="curseur-input vert"
            />
            <span className="curseur-valeur">{gJoueur}</span>
          </div>

          <div className="curseur-group">
            <span className="curseur-label bleu">B</span>
            <input
              type="range"
              min={0}
              max={255}
              value={bJoueur}
              onChange={(e) => setBJoueur(Number(e.target.value))}
              className="curseur-input bleu"
            />
            <span className="curseur-valeur">{bJoueur}</span>
          </div>
        </div>

        <div className="xyz-container">
          <div className="xyz-box">
            <h4>XYZ Cible</h4>
            <p>X = {xyzCible.x.toFixed(2)}</p>
            <p>Y = {xyzCible.y.toFixed(2)}</p>
            <p>Z = {xyzCible.z.toFixed(2)}</p>
          </div>

          <div className="xyz-box">
            <h4>XYZ Joueur</h4>
            <p>X = {xyzJoueur.x.toFixed(2)}</p>
            <p>Y = {xyzJoueur.y.toFixed(2)}</p>
            <p>Z = {xyzJoueur.z.toFixed(2)}</p>
          </div>
        </div>

        {afficherIndices ? (
          <div className="indices-container">
            {indices.map((indice, i) => (
              <span key={i} className="indice-item">
                {indice}
              </span>
            ))}
          </div>
        ) : null}

        <div className="boutons-container">
          <button
            className="btn btn-indice"
            onClick={() => {
              const nouveauxIndices = genererIndice(cible.r, cible.g, cible.b, rJoueur, gJoueur, bJoueur);
              setIndices(nouveauxIndices);
              setAfficherIndices(true);
            }}
          >
            Indice
          </button>
          <button className="btn btn-valider" onClick={validerReponse}>
            Valider
          </button>
        </div>
      </div>
    );
  }

  if (etatJeu === 'resultat_manche') {
    const cible = manches[mancheActuelle];
    if (!cible) return null;

    const classeResultat = scoreManche !== null && scoreManche >= 80 ? 'excellent' : scoreManche !== null && scoreManche >= 40 ? 'bon' : 'moyen';

    return (
      <div className="maitre-du-blanc">
        <div className="jeu-header">
          <h1>Résultat — Manche {mancheActuelle + 1}</h1>
        </div>

        <div className="couleurs-container">
          <div className="couleur-box">
            <h3>Cible ({cible.nom})</h3>
            <div className="couleur-apercu" style={{ backgroundColor: `rgb(${cible.r}, ${cible.g}, ${cible.b})` }} />
            <p>
              R={cible.r} G={cible.g} B={cible.b}
            </p>
          </div>
          <div className="couleur-box">
            <h3>Ta réponse</h3>
            <div className="couleur-apercu" style={{ backgroundColor: `rgb(${rJoueur}, ${gJoueur}, ${bJoueur})` }} />
            <p>
              R={rJoueur} G={gJoueur} B={bJoueur}
            </p>
          </div>
        </div>

        <div className={`resultat ${classeResultat}`}>
          <h2>Score : {scoreManche ?? 0}/100</h2>
          <p>Différence XYZ : {differenceManche ?? 0}</p>
          {scoreManche === 100 ? <p>PARFAIT !</p> : null}
          {scoreManche !== null && scoreManche >= 80 && scoreManche < 100 ? <p>Très proche !</p> : null}
          {scoreManche !== null && scoreManche >= 40 && scoreManche < 80 ? <p>Pas mal !</p> : null}
          {scoreManche !== null && scoreManche < 40 ? <p>Continue à t'entraîner !</p> : null}
        </div>

        <div className="score-global">
          Score total : <strong>{scoreTotal}</strong>/{NOMBRE_MANCHES * 100}
        </div>

        <div className="boutons-container">
          <button className="btn btn-suivant" onClick={mancheSuivante}>
            {mancheActuelle + 1 >= NOMBRE_MANCHES ? 'Voir résultats finaux' : 'Manche suivante'}
          </button>
        </div>
      </div>
    );
  }

  if (etatJeu === 'fin') {
    const pourcentage = Math.round((scoreTotal / (NOMBRE_MANCHES * 100)) * 100);

    let message = '';
    if (pourcentage >= 90) message = 'MAÎTRE DU BLANC ! Tu maîtrises la synthèse additive !';
    else if (pourcentage >= 70) message = 'Excellent ! Tu comprends bien le mélange RGB !';
    else if (pourcentage >= 50) message = "Pas mal ! Continue à t'entraîner !";
    else message = 'Révise la synthèse additive et les températures de couleur !';

    return (
      <div className="maitre-du-blanc">
        <div className="ecran-final">
          <h2>Partie terminée !</h2>
          <div className="score-final">
            {scoreTotal}/{NOMBRE_MANCHES * 100}
          </div>
          <p>({pourcentage}%)</p>
          <p className="message">{message}</p>
          <br />
          <button className="btn btn-rejouer" onClick={demarrerPartie}>
            Rejouer
          </button>
        </div>
      </div>
    );
  }

  return null;
}
