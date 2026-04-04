// Enemy size definitions per round.
// widthInCells × heightInCells tiles, HP = width × height.
// Soft cap: ~32 total tiles per round. No single enemy larger than 3×4.
// Enemies are placed randomly (fully contained in 8×8 grid).

export interface EnemyDef {
  widthInCells: number;
  heightInCells: number;
}

export interface RoundEnemies {
  enemies: EnemyDef[];
}

// Round definitions. For rounds not listed, the last entry is used (clamped).
const ROUND_ENEMIES: Record<number, EnemyDef[]> = {
  1:  [{ widthInCells: 1, heightInCells: 2 }],                                           // 2 tiles
  2:  [{ widthInCells: 1, heightInCells: 2 }, { widthInCells: 1, heightInCells: 2 }],   // 4 tiles
  3:  [{ widthInCells: 2, heightInCells: 2 }, { widthInCells: 1, heightInCells: 2 }],   // 6 tiles
  4:  [{ widthInCells: 2, heightInCells: 2 }, { widthInCells: 1, heightInCells: 2 }, { widthInCells: 1, heightInCells: 2 }], // 8 tiles
  5:  [{ widthInCells: 2, heightInCells: 3 }, { widthInCells: 1, heightInCells: 2 }, { widthInCells: 1, heightInCells: 2 }], // 10 tiles
  6:  [{ widthInCells: 2, heightInCells: 3 }, { widthInCells: 2, heightInCells: 2 }, { widthInCells: 1, heightInCells: 2 }], // 12 tiles
  7:  [{ widthInCells: 2, heightInCells: 3 }, { widthInCells: 2, heightInCells: 2 }, { widthInCells: 2, heightInCells: 2 }], // 14 tiles
  8:  [{ widthInCells: 3, heightInCells: 3 }, { widthInCells: 2, heightInCells: 2 }, { widthInCells: 1, heightInCells: 2 }], // 15 tiles
  9:  [{ widthInCells: 3, heightInCells: 3 }, { widthInCells: 2, heightInCells: 3 }, { widthInCells: 1, heightInCells: 2 }], // 17 tiles
  10: [{ widthInCells: 3, heightInCells: 3 }, { widthInCells: 2, heightInCells: 3 }, { widthInCells: 2, heightInCells: 2 }], // 19 tiles
  12: [{ widthInCells: 3, heightInCells: 4 }, { widthInCells: 2, heightInCells: 3 }, { widthInCells: 2, heightInCells: 2 }], // 22 tiles
  14: [{ widthInCells: 3, heightInCells: 4 }, { widthInCells: 2, heightInCells: 3 }, { widthInCells: 2, heightInCells: 3 }], // 24 tiles
  16: [{ widthInCells: 3, heightInCells: 4 }, { widthInCells: 2, heightInCells: 3 }, { widthInCells: 2, heightInCells: 3 }, { widthInCells: 1, heightInCells: 2 }], // 26 tiles
  18: [{ widthInCells: 3, heightInCells: 4 }, { widthInCells: 3, heightInCells: 3 }, { widthInCells: 2, heightInCells: 3 }, { widthInCells: 1, heightInCells: 2 }], // 29 tiles
  20: [{ widthInCells: 3, heightInCells: 4 }, { widthInCells: 3, heightInCells: 4 }, { widthInCells: 2, heightInCells: 3 }, { widthInCells: 1, heightInCells: 2 }], // 34 tiles (soft cap)
};

// Enemy colors — cycle through these per enemy index
export const ENEMY_COLORS = [
  0xcc4444, // red
  0x884488, // purple
  0x448844, // dark green
  0xcc7722, // orange
  0x226688, // teal
];

/**
 * Get the enemy definitions for a given round.
 * Interpolates by finding the largest defined round ≤ current round.
 */
export function getEnemiesForRound(round: number): EnemyDef[] {
  const definedRounds = Object.keys(ROUND_ENEMIES).map(Number).sort((a, b) => a - b);

  // Find the highest defined round ≤ current round
  let key = definedRounds[0];
  for (const r of definedRounds) {
    if (r <= round) key = r;
    else break;
  }

  return ROUND_ENEMIES[key] ?? [];
}
