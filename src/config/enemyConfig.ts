// Enemy layout per round — expressed as arrays of enemy type names.
// Each type name maps to a fixed size in ENEMY_TYPES.
// Soft cap: ~32 total tiles per round. No single enemy larger than 3×4.
// Enemies are placed randomly (fully contained in 8×8 grid).
//
// Size reference (widthInCells × heightInCells):
//   fireImp        1×2   (2 tiles)
//   iceWhelp       2×2   (4 tiles)
//   lightningWraith 2×3  (6 tiles)
//   vineMonster    3×3   (9 tiles)
//   earthGolem     3×4   (12 tiles)

import type { EnemyTypeDef } from './enemyTypes.ts';
import { ENEMY_TYPES } from './enemyTypes.ts';

export { ENEMY_TYPES };

/**
 * The round at which enemy layout hits its cap.
 * From this round onward, enemy HP is multiplied by 1.5 for each additional round.
 */
export const ENEMY_SCALE_START_ROUND = 20;

const ROUND_ENEMIES: Record<number, string[]> = {
  1:  ['fireImp'],
  2:  ['fireImp', 'fireImp'],
  3:  ['iceWhelp', 'fireImp'],
  4:  ['iceWhelp', 'fireImp', 'fireImp'],
  5:  ['lightningWraith', 'fireImp', 'fireImp'],
  6:  ['lightningWraith', 'iceWhelp', 'fireImp'],
  7:  ['lightningWraith', 'iceWhelp', 'iceWhelp'],
  8:  ['vineMonster', 'iceWhelp', 'fireImp'],
  9:  ['vineMonster', 'lightningWraith', 'fireImp'],
  10: ['vineMonster', 'lightningWraith', 'iceWhelp'],
  12: ['earthGolem', 'lightningWraith', 'iceWhelp'],
  14: ['earthGolem', 'lightningWraith', 'lightningWraith'],
  16: ['earthGolem', 'lightningWraith', 'lightningWraith', 'fireImp'],
  18: ['earthGolem', 'vineMonster', 'lightningWraith', 'fireImp'],
  20: ['earthGolem', 'earthGolem', 'lightningWraith', 'fireImp'],
};

/**
 * Get the enemy type definitions for a given round.
 * Clamps to the highest defined round ≤ current round.
 */
export function getEnemiesForRound(round: number): EnemyTypeDef[] {
  const definedRounds = Object.keys(ROUND_ENEMIES).map(Number).sort((a, b) => a - b);

  let key = definedRounds[0];
  for (const r of definedRounds) {
    if (r <= round) key = r;
    else break;
  }

  return (ROUND_ENEMIES[key] ?? []).map(type => {
    const def = ENEMY_TYPES[type];
    if (!def) {
      console.warn(`[enemyConfig] Unknown enemy type: "${type}"`);
    }
    return def;
  }).filter(Boolean) as EnemyTypeDef[];
}
