export type Blanc = {
  id: number;
  nom: string;
  r: number;
  g: number;
  b: number;
  kelvin: number;
  description: string;
};

export const blancs: Blanc[] = [
  { id: 1, nom: 'Bougie', r: 255, g: 147, b: 41, kelvin: 1900, description: 'Lumière très chaude, comme une flamme de bougie' },
  { id: 2, nom: 'Tungstène chaud', r: 255, g: 180, b: 107, kelvin: 2700, description: 'Ampoule à incandescence classique' },
  { id: 3, nom: 'Blanc chaud', r: 255, g: 197, b: 143, kelvin: 3000, description: 'Éclairage intérieur chaleureux' },
  { id: 4, nom: 'Halogène', r: 255, g: 209, b: 163, kelvin: 3500, description: 'Lampe halogène standard' },
  { id: 5, nom: 'Blanc neutre', r: 255, g: 228, b: 206, kelvin: 4000, description: 'Éclairage neutre, ni chaud ni froid' },
  { id: 6, nom: 'Blanc pur', r: 255, g: 243, b: 239, kelvin: 4500, description: 'Blanc équilibré' },
  { id: 7, nom: 'Lumière du jour', r: 255, g: 250, b: 244, kelvin: 5000, description: 'Lumière naturelle du soleil à midi' },
  { id: 8, nom: 'Jour nuageux', r: 255, g: 254, b: 250, kelvin: 5500, description: 'Ciel couvert, lumière diffuse' },
  { id: 9, nom: 'Ciel bleu léger', r: 240, g: 245, b: 255, kelvin: 6500, description: 'Lumière froide, ciel bleu' },
  { id: 10, nom: 'Ciel bleu froid', r: 220, g: 230, b: 255, kelvin: 8000, description: 'Lumière très froide, ombre en plein jour' },
];
