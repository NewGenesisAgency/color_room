/**
 * @file lib/tileChannels.ts
 * @brief Modèle physique des 42 dalles LED : types, spectres de canaux et remappage.
 *
 * Chaque dalle possède 32 canaux LED, chacun centré sur une longueur d'onde
 * (nm) et associé à une couleur RGB approximative. Il existe DEUX câblages
 * physiques de dalles — « rouge » et « bleu » — dont l'ordre des canaux diffère.
 * Ce module fournit :
 *   - PLATE_TYPE : le type physique de chaque dalle (1..42) ;
 *   - les tables de spectres CHANNELS_ROUGE / CHANNELS_BLEU ;
 *   - le remappage d'un vecteur de 32 canaux d'un type vers l'autre, afin
 *     qu'une même couleur s'affiche identiquement quel que soit le câblage.
 */

/** @brief Type de câblage physique d'une dalle. */
export type TileType = 'rouge' | 'bleu';

/** @brief Type physique (rouge/bleu) de chacune des 42 dalles, par identifiant. */
export const PLATE_TYPE: Record<number, TileType> = {
  1: 'rouge', 2: 'rouge', 3: 'rouge',
  4: 'bleu',  5: 'bleu',  6: 'bleu',
  7: 'bleu',  8: 'bleu',  9: 'bleu',
  10: 'bleu', 11: 'rouge',12: 'bleu',
  13: 'rouge',14: 'bleu', 15: 'rouge',
  16: 'bleu', 17: 'rouge',18: 'bleu',
  19: 'rouge',20: 'bleu', 21: 'rouge',
  22: 'rouge',23: 'rouge',24: 'rouge',
  25: 'bleu', 26: 'bleu', 27: 'bleu',
  28: 'bleu', 29: 'bleu', 30: 'bleu',
  31: 'bleu', 32: 'rouge',33: 'bleu',
  34: 'rouge',35: 'bleu', 36: 'rouge',
  37: 'bleu', 38: 'rouge',39: 'bleu',
  40: 'rouge',41: 'bleu', 42: 'rouge',
};

export type ChannelProfile = {
  nm: number | null;
  label: string;
  rgb: [number, number, number];
};

export const CHANNELS_ROUGE: ChannelProfile[] = [
  { nm: 404, label: 'Violet',             rgb: [0.35, 0.00, 0.60] },
  { nm: 421, label: 'Violet clair',       rgb: [0.55, 0.00, 0.85] },
  { nm: 435, label: 'Bleu-violet',        rgb: [0.28, 0.00, 0.95] },
  { nm: 443, label: 'Bleu',               rgb: [0.10, 0.04, 0.98] },
  { nm: 479, label: 'Cyan-bleu',          rgb: [0.00, 0.45, 1.00] },
  { nm: 513, label: 'Vert',               rgb: [0.00, 0.95, 0.38] },
  { nm: 513, label: 'Vert (2)',           rgb: [0.00, 0.72, 0.18] },
  { nm: 541, label: 'Jaune-vert',         rgb: [0.50, 1.00, 0.00] },
  { nm: 593, label: 'Orange',             rgb: [1.00, 0.72, 0.00] },
  { nm: 605, label: 'Orange-rouge',       rgb: [1.00, 0.38, 0.00] },
  { nm: 629, label: 'Rouge',              rgb: [0.92, 0.06, 0.00] },
  { nm: 642, label: 'Rouge vif',          rgb: [1.00, 0.03, 0.00] },
  { nm: 658, label: 'Rouge cerise',       rgb: [0.96, 0.00, 0.05] },
  { nm: 698, label: 'Rouge profond',      rgb: [0.55, 0.00, 0.00] },
  { nm: 731, label: 'Proche IR',          rgb: [0.26, 0.00, 0.00] },
  { nm: 758, label: 'IR',                 rgb: [0.12, 0.00, 0.00] },
  { nm: 780, label: 'IR',                 rgb: [0.06, 0.00, 0.00] },
  { nm: null, label: 'Jaune-orange large',rgb: [1.00, 0.52, 0.00] },
  { nm: null, label: 'Jaune-orange clair',rgb: [1.00, 0.65, 0.06] },
  { nm: null, label: 'Jaune-orange dim',  rgb: [1.00, 0.68, 0.10] },
  { nm: null, label: 'Jaune-orange dim2', rgb: [1.00, 0.72, 0.12] },
  { nm: null, label: 'Jaune-orange dim3', rgb: [1.00, 0.75, 0.14] },
  { nm: null, label: 'Blanc chaud orangé',rgb: [1.00, 0.90, 0.62] },
  { nm: null, label: 'Blanc jaunâtre',    rgb: [1.00, 0.96, 0.85] },
  { nm: null, label: 'Blanc pur',         rgb: [1.00, 1.00, 1.00] },
  { nm: null, label: 'Blanc dim1',        rgb: [1.00, 1.00, 0.98] },
  { nm: null, label: 'Blanc dim2',        rgb: [0.98, 0.98, 0.96] },
  { nm: null, label: 'Blanc dim3',        rgb: [0.96, 0.96, 0.94] },
  { nm: null, label: 'Gris',              rgb: [0.62, 0.62, 0.62] },
  { nm: null, label: 'Gris foncé',        rgb: [0.50, 0.50, 0.50] },
  { nm: null, label: 'Blanc/Gris',        rgb: [0.82, 0.82, 0.80] },
  { nm: null, label: 'Blanc dim final',   rgb: [0.92, 0.92, 0.90] },
];

export const CHANNELS_BLEU: ChannelProfile[] = [
  { nm: 380, label: 'UV-violet',          rgb: [0.20, 0.00, 0.45] },
  { nm: 382, label: 'UV-violet 2',        rgb: [0.22, 0.00, 0.50] },
  { nm: 397, label: 'Violet',             rgb: [0.30, 0.00, 0.65] },
  { nm: 404, label: 'Violet',             rgb: [0.35, 0.00, 0.60] },
  { nm: 412, label: 'Violet-bleu',        rgb: [0.45, 0.00, 0.75] },
  { nm: 425, label: 'Bleu-violet',        rgb: [0.55, 0.00, 0.90] },
  { nm: 441, label: 'Bleu',               rgb: [0.25, 0.00, 0.98] },
  { nm: 470, label: 'Bleu',               rgb: [0.00, 0.30, 1.00] },
  { nm: 488, label: 'Cyan-bleu',          rgb: [0.00, 0.55, 1.00] },
  { nm: 499, label: 'Cyan',               rgb: [0.00, 0.75, 0.85] },
  { nm: 523, label: 'Vert',               rgb: [0.00, 0.90, 0.35] },
  { nm: 539, label: 'Vert-jaune',         rgb: [0.20, 1.00, 0.00] },
  { nm: 541, label: 'Jaune-vert',         rgb: [0.50, 1.00, 0.00] },
  { nm: 593, label: 'Orange',             rgb: [1.00, 0.72, 0.00] },
  { nm: 593, label: 'Orange 2',           rgb: [1.00, 0.68, 0.00] },
  { nm: 605, label: 'Orange-rouge',       rgb: [1.00, 0.38, 0.00] },
  { nm: 608, label: 'Rouge-orangé',       rgb: [0.98, 0.30, 0.00] },
  { nm: 617, label: 'Rouge',              rgb: [0.95, 0.18, 0.00] },
  { nm: 620, label: 'Rouge',              rgb: [0.93, 0.12, 0.00] },
  { nm: 678, label: 'Rouge profond',      rgb: [0.70, 0.00, 0.00] },
  { nm: 698, label: 'Rouge très prof',    rgb: [0.55, 0.00, 0.00] },
  { nm: 732, label: 'Proche IR',          rgb: [0.25, 0.00, 0.00] },
  { nm: 758, label: 'IR',                 rgb: [0.12, 0.00, 0.00] },
  { nm: null, label: 'Blanc chaud large', rgb: [1.00, 0.90, 0.62] },
  { nm: null, label: 'Blanc jaunâtre',    rgb: [1.00, 0.96, 0.85] },
  { nm: null, label: 'Blanc pur',         rgb: [1.00, 1.00, 1.00] },
  { nm: null, label: 'Blanc dim1',        rgb: [1.00, 1.00, 0.98] },
  { nm: null, label: 'Blanc dim2',        rgb: [0.98, 0.98, 0.96] },
  { nm: null, label: 'Gris',              rgb: [0.62, 0.62, 0.62] },
  { nm: null, label: 'Gris foncé',        rgb: [0.50, 0.50, 0.50] },
  { nm: null, label: 'Blanc/Gris',        rgb: [0.82, 0.82, 0.80] },
  { nm: null, label: 'Blanc dim final',   rgb: [0.92, 0.92, 0.90] },
];

export function getPlateType(plateId: number): TileType {
  return PLATE_TYPE[plateId] ?? 'rouge';
}

export function getChannels(plateId: number): ChannelProfile[] {
  return getPlateType(plateId) === 'bleu' ? CHANNELS_BLEU : CHANNELS_ROUGE;
}

/**
 * Retourne l'index du canal de `dstType` dont le nm est le plus proche
 * du canal `srcIdx` de `srcType`.
 *
 * Règles :
 *  - Canal spectral (nm ≠ null) → cherche le nm le plus proche dans dst.
 *  - Canal phosphore (nm = null) → conserve la position relative
 *    dans le bloc phosphore (avec clamping si dst a moins de canaux phosphores).
 */
export function mapChannelToType(
  srcIdx: number,
  srcType: TileType,
  dstType: TileType,
): number {
  if (srcType === dstType) return srcIdx;
  const src = srcType === 'rouge' ? CHANNELS_ROUGE : CHANNELS_BLEU;
  const dst = dstType === 'rouge' ? CHANNELS_ROUGE : CHANNELS_BLEU;
  const srcNm = src[srcIdx]?.nm ?? null;

  if (srcNm === null) {
    // Bloc phosphore : position relative depuis la fin des LEDs spectrales
    const srcSpec = src.filter(c => c.nm !== null).length;
    const dstSpec = dst.filter(c => c.nm !== null).length;
    const relPos = srcIdx - srcSpec;
    return Math.min(dst.length - 1, dstSpec + Math.max(0, relPos));
  }

  // Canal spectral : nm le plus proche
  let bestIdx = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < dst.length; i++) {
    const dstNm = dst[i].nm;
    if (dstNm === null) continue;
    const delta = Math.abs(dstNm - srcNm);
    if (delta < bestDelta) { bestDelta = delta; bestIdx = i; }
  }
  return bestIdx;
}

// Tableaux pré-calculés (évite les calculs répétitifs dans les boucles hot-path)
export const MAP_ROUGE_TO_BLEU: number[] = Array.from({ length: 32 }, (_, i) =>
  mapChannelToType(i, 'rouge', 'bleu'),
);
export const MAP_BLEU_TO_ROUGE: number[] = Array.from({ length: 32 }, (_, i) =>
  mapChannelToType(i, 'bleu', 'rouge'),
);

/**
 * Reméppe un tableau de 32 valeurs de canaux d'un type vers l'autre.
 * Deux canaux source qui tombent sur le même canal destination sont fusionnés
 * par le max (on garde la valeur la plus forte).
 */
export function remapChannels32(
  channels: number[],
  srcType: TileType,
  dstType: TileType,
): number[] {
  if (srcType === dstType) return channels;
  const map = srcType === 'rouge' ? MAP_ROUGE_TO_BLEU : MAP_BLEU_TO_ROUGE;
  const result = new Array(32).fill(0) as number[];
  for (let i = 0; i < 32; i++) {
    const dstIdx = map[i] ?? i;
    result[dstIdx] = Math.max(result[dstIdx], channels[i] ?? 0);
  }
  return result;
}
