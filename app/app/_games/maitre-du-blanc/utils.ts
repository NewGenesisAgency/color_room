export function rgbVersXyz(r: number, g: number, b: number): { x: number; y: number; z: number } {
  let rNorm = r / 255;
  let gNorm = g / 255;
  let bNorm = b / 255;

  rNorm = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
  gNorm = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
  bNorm = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;

  rNorm *= 100;
  gNorm *= 100;
  bNorm *= 100;

  const x = rNorm * 0.4124 + gNorm * 0.3576 + bNorm * 0.1805;
  const y = rNorm * 0.2126 + gNorm * 0.7152 + bNorm * 0.0722;
  const z = rNorm * 0.0193 + gNorm * 0.1192 + bNorm * 0.9505;

  return { x, y, z };
}

export function calculerDifference(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const cible = rgbVersXyz(r1, g1, b1);
  const joueur = rgbVersXyz(r2, g2, b2);

  const distance = Math.sqrt(
    Math.pow(cible.x - joueur.x, 2) + Math.pow(cible.y - joueur.y, 2) + Math.pow(cible.z - joueur.z, 2),
  );

  return Math.round(distance * 100) / 100;
}

export function calculerScore(difference: number): number {
  if (difference < 2) return 100;
  if (difference < 5) return 80;
  if (difference < 10) return 60;
  if (difference < 20) return 40;
  if (difference < 35) return 20;
  return 0;
}

export function genererIndice(
  rCible: number,
  gCible: number,
  bCible: number,
  rJoueur: number,
  gJoueur: number,
  bJoueur: number,
): string[] {
  const indices: string[] = [];

  if (rJoueur < rCible - 10) indices.push('Monte le Rouge ↑');
  else if (rJoueur > rCible + 10) indices.push('Baisse le Rouge ↓');
  else indices.push('Rouge OK');

  if (gJoueur < gCible - 10) indices.push('Monte le Vert ↑');
  else if (gJoueur > gCible + 10) indices.push('Baisse le Vert ↓');
  else indices.push('Vert OK');

  if (bJoueur < bCible - 10) indices.push('Monte le Bleu ↑');
  else if (bJoueur > bCible + 10) indices.push('Baisse le Bleu ↓');
  else indices.push('Bleu OK');

  return indices;
}

export function choisirManches<T>(items: T[], nombre: number): T[] {
  const copie = [...items];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie.slice(0, nombre);
}
