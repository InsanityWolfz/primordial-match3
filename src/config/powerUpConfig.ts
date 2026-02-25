// ─── Power-Up Configuration v2 ───
// Three categories: activePower (20 levels), passivePower (20 levels), passive (5 levels)

export type PowerCategory = 'activePower' | 'passivePower' | 'passive';

export interface PowerUpLevelData {
  level: number;
  cost: number;
  description: string;
  charges?: number;           // charges per round (active powers only)
  params: Record<string, number>;  // power-specific values: radius, damage, targetCount, etc.
}

export interface PowerUpDefinition {
  id: string;
  name: string;
  element: string;
  category: PowerCategory;
  maxLevel: number;           // 20 for powers, 5 for stat passives
  needsTarget?: boolean;      // true for click-to-target actives (fireball, chainstrike, etc.)
  requires?: string;          // ID of active power that must be owned before this appears in shop
  levels: PowerUpLevelData[];
  milestones?: number[];      // UI markers [5, 10, 15, 20]
}

// ─── Cost Arrays ───

export const POWER_COSTS_20: number[] = [
  25, 75, 100, 125, 250,
  500, 750, 1000, 1250, 2500,
  3000, 3500, 4000, 4500, 6250,
  7500, 10000, 12500, 15000, 25000,
];

export const PASSIVE_COSTS_5: number[] = [
  25, 250, 750, 2500, 10000,
];

export const POWER_MILESTONES = [5, 10, 15, 20];

// ─── Registry ───

const registry: PowerUpDefinition[] = [];

export function registerPowerUp(def: PowerUpDefinition): void {
  registry.push(def);
}

export function registerPowerUps(defs: PowerUpDefinition[]): void {
  for (const def of defs) {
    registry.push(def);
  }
}

export function getAllPowerUps(): PowerUpDefinition[] {
  return registry;
}

export function getPowerUpDef(id: string): PowerUpDefinition | undefined {
  return registry.find(p => p.id === id);
}

export function getPowerUpsByElement(element: string): PowerUpDefinition[] {
  return registry.filter(p => p.element === element);
}

export function getPowerUpsByCategory(category: PowerCategory): PowerUpDefinition[] {
  return registry.filter(p => p.category === category);
}

// ─── Helper to generate level data ───

/**
 * Auto-generate a readable description from interpolated params.
 * Used for non-milestone levels so players never see "Level X".
 */
function formatParamsAsDescription(params: Record<string, number>, charges?: number): string {
  const parts: string[] = [];

  if ('radius' in params) {
    const size = params.radius * 2 + 1;
    parts.push(`${size}x${size} area`);
  }
  if ('targetCount' in params) parts.push(`Hit ${params.targetCount} random gems`);
  if ('rowCount' in params)    parts.push(`Hit all gems in ${params.rowCount} rows`);
  if ('chainCount' in params)  parts.push(`Chain ${params.chainCount} gems`);
  if ('triggerChance' in params) parts.push(`After match: ${params.triggerChance}% chance to hit 1 column`);
  if ('turnSaveChance' in params) parts.push(`${params.turnSaveChance}% chance a match doesn't consume a turn`);
  if ('bonusTurnChance' in params) parts.push(`${params.bonusTurnChance}% chance to gain a bonus turn on match`);
  if ('bonusEssence' in params) parts.push(`+${params.bonusEssence} essence`);
  if ('essencePerCascade' in params) parts.push(`+${params.essencePerCascade} essence per match this turn`);
  if ('damage' in params && params.damage > 0) parts.push(`${params.damage} damage`);
  if (charges !== undefined)   parts.push(`${charges} charges/round`);

  return parts.length > 0 ? parts.join(', ') : 'Passive effect';
}

/**
 * Generate 20-level power data with linear interpolation between milestones.
 * Milestones define param values at levels 1, 5, 10, 15, 20.
 * Between milestones, values interpolate linearly.
 * Non-milestone levels get auto-generated descriptions from their interpolated params.
 */
export function generatePower20Levels(
  milestoneParams: Record<string, number>[],  // 5 entries for levels 1,5,10,15,20
  milestoneDescriptions: string[],            // 5 entries for milestone descriptions
  milestoneCharges?: number[],                // 5 entries for charges (active only)
  costArray: number[] = POWER_COSTS_20,
): PowerUpLevelData[] {
  const milestoneLevels = [1, 5, 10, 15, 20];
  const levels: PowerUpLevelData[] = [];

  for (let lvl = 1; lvl <= 20; lvl++) {
    // Find which milestone segment we're in
    let segIdx = 0;
    for (let i = 0; i < milestoneLevels.length - 1; i++) {
      if (lvl >= milestoneLevels[i]) segIdx = i;
    }

    const startLvl = milestoneLevels[segIdx];
    const endLvl = milestoneLevels[segIdx + 1] || milestoneLevels[segIdx];
    const t = endLvl === startLvl ? 0 : (lvl - startLvl) / (endLvl - startLvl);

    // Interpolate each param
    const params: Record<string, number> = {};
    const startParams = milestoneParams[segIdx];
    const endParams = milestoneParams[segIdx + 1] || milestoneParams[segIdx];

    for (const key of Object.keys(startParams)) {
      const startVal = startParams[key];
      const endVal = endParams[key] ?? startVal;
      params[key] = Math.round(startVal + (endVal - startVal) * t);
    }

    // Interpolate charges if provided
    let charges: number | undefined;
    if (milestoneCharges) {
      const startC = milestoneCharges[segIdx];
      const endC = milestoneCharges[segIdx + 1] ?? milestoneCharges[segIdx];
      charges = Math.round(startC + (endC - startC) * t);
    }

    // Milestone levels use explicit descriptions; others are auto-generated from params
    const descIdx = milestoneLevels.indexOf(lvl);
    const description = descIdx >= 0
      ? milestoneDescriptions[descIdx]
      : formatParamsAsDescription(params, charges);

    levels.push({
      level: lvl,
      cost: costArray[lvl - 1],
      description,
      ...(charges !== undefined ? { charges } : {}),
      params,
    });
  }

  return levels;
}

/**
 * Generate 5-level stat passive data.
 */
export function generatePassive5Levels(
  paramsByLevel: Record<string, number>[],  // 5 entries
  descriptions: string[],                    // 5 entries
  costArray: number[] = PASSIVE_COSTS_5,
): PowerUpLevelData[] {
  return paramsByLevel.map((params, i) => ({
    level: i + 1,
    cost: costArray[i],
    description: descriptions[i],
    params,
  }));
}
