// ─── Enemy Trait System ───
// Each enemy independently rolls for a trait based on the current round.
// Traits are introduced at specific rounds and their probability scales up slowly.
// High variance is intentional — you might face a rough combination or an easy one.

export type EnemyTrait = 'armored' | 'shielded' | 'regenerating' | 'warded' | 'splitting';

// Round at which each trait first appears
export const TRAIT_INTRO_ROUND: Record<EnemyTrait, number> = {
  armored:      4,
  shielded:     6,
  regenerating: 8,
  warded:       10,
  splitting:    12,
};

// Colors for the badge rendered on the enemy rectangle (top-right corner)
export const TRAIT_BADGE_COLOR: Record<EnemyTrait, number> = {
  armored:      0x888888, // grey
  shielded:     0xffdd00, // gold (active) — changes to 0x444444 when used
  regenerating: 0x44cc44, // green
  warded:       0xffffff, // overridden with element color at placement time
  splitting:    0xff8800, // orange
};

export const TRAIT_BADGE_USED_COLOR: Record<EnemyTrait, number> = {
  armored:      0x888888,
  shielded:     0x444444, // darkened when shield is spent
  regenerating: 0x44cc44,
  warded:       0x444444,
  splitting:    0xff8800,
};

// Trait descriptions for UI/tooltip use
export const TRAIT_DESCRIPTION: Record<EnemyTrait, string> = {
  armored:      'Takes 1 less damage per hit (min 1)',
  shielded:     'Absorbs the first hit entirely',
  regenerating: 'Recovers 1 HP at end of each turn',
  warded:       'Immune to damage from one element',
  splitting:    'Spawns two 1×1 enemies when killed',
};

/**
 * Returns the % chance (0–100) for an enemy to roll a given trait at a given round.
 * Rises slowly from intro round; caps at ~40%.
 */
export function getTraitProbability(trait: EnemyTrait, round: number): number {
  const introRound = TRAIT_INTRO_ROUND[trait];
  if (round < introRound) return 0;

  // Starts at 10% on intro round, +2% per round, cap at 40%
  const chance = 10 + (round - introRound) * 2;
  return Math.min(chance, 40);
}

/**
 * Roll a random trait for an enemy at a given round.
 * Returns null if no trait is rolled (most common outcome early on).
 * Only considers traits that have been introduced this round.
 */
export function rollTrait(round: number): EnemyTrait | null {
  const available = (Object.keys(TRAIT_INTRO_ROUND) as EnemyTrait[])
    .filter(t => round >= TRAIT_INTRO_ROUND[t]);

  if (available.length === 0) return null;

  // First roll: is there any trait at all? Use the highest-probability trait as a ceiling
  // to avoid excessive stacking early on.
  const maxChance = Math.max(...available.map(t => getTraitProbability(t, round)));
  if (Math.random() * 100 >= maxChance) return null;

  // Second roll: which specific trait?
  // Build weighted list (higher-probability traits are more likely)
  const weights = available.map(t => getTraitProbability(t, round));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;
  for (let i = 0; i < available.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return available[i];
  }
  return available[available.length - 1];
}
