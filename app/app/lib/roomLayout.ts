// Indices visuels (0-41, row-major, 6 col × 7 row) par salle physique
// Colonnes 0-2 = salle GAUCHE (plaques 1-21)
// Colonnes 3-5 = salle DROITE (plaques 22-42)

export const LEFT_ROOM_IDX: number[] = [];
export const RIGHT_ROOM_IDX: number[] = [];

for (let row = 0; row < 7; row++) {
  for (let col = 0; col < 6; col++) {
    const idx = row * 6 + col;
    if (col < 3) LEFT_ROOM_IDX.push(idx);
    else         RIGHT_ROOM_IDX.push(idx);
  }
}

// Helper : envoyer une couleur uniforme sur une liste d'indices
export function sendColorToIndices(
  indices: number[],
  r: number, g: number, b: number,
  intensity: number,
  onSendColor: (i: number, r: number, g: number, b: number, intensity: number) => void,
) {
  for (const i of indices) onSendColor(i, r, g, b, intensity);
}

// Helper : éteindre une liste d'indices
export function turnOffIndices(
  indices: number[],
  onTurnOff: (i: number) => void,
) {
  for (const i of indices) onTurnOff(i);
}
