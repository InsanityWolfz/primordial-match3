// ─── Power-Up Registry Bootstrap ───
// Re-exports the config types and registers all element powers.

import {
  registerPowerUps,
  getAllPowerUps,
  getPowerUpDef as getDefFromRegistry,
} from './powerUpConfig.ts';

export type {
  PowerCategory,
  PowerUpDefinition,
} from './powerUpConfig.ts';

export {
  getAllPowerUps,
  getPowerUpsByElement,
  getPowerUpsByCategory,
} from './powerUpConfig.ts';

// Register all element powers
import { FIRE_POWERS } from './powers/firePowers.ts';
import { WATER_POWERS } from './powers/waterPowers.ts';
import { AIR_POWERS } from './powers/airPowers.ts';
import { EARTH_POWERS } from './powers/earthPowers.ts';
import { LIGHTNING_POWERS } from './powers/lightningPowers.ts';

registerPowerUps(FIRE_POWERS);
registerPowerUps(WATER_POWERS);
registerPowerUps(AIR_POWERS);
registerPowerUps(EARTH_POWERS);
registerPowerUps(LIGHTNING_POWERS);

// Legacy compatibility - re-export as POWER_UPS array
export const POWER_UPS = getAllPowerUps();

export function getPowerUpDef(id: string) {
  return getDefFromRegistry(id);
}
