import type { PowerUpDefinition } from '../powerUpConfig.ts';
import { generatePower20Levels, generatePassive5Levels, POWER_MILESTONES } from '../powerUpConfig.ts';

// ─── WATER GUN (activePower) ───
// Hit random gems for damage
// Lv1: 9/1dmg → Lv5: 16/5dmg → Lv10: 25/10dmg → Lv15: 40/15dmg → Lv20: whole board/20dmg
const waterGunLevels = generatePower20Levels(
  [
    { targetCount: 9, damage: 1 },
    { targetCount: 16, damage: 5 },
    { targetCount: 25, damage: 10 },
    { targetCount: 40, damage: 15 },
    { targetCount: 64, damage: 20 },
  ],
  [
    'Hit 9 random gems, 1 damage',
    'Hit 16 random gems, 5 damage',
    'Hit 25 random gems, 10 damage',
    'Hit 40 random gems, 15 damage',
    'Hit entire board, 20 damage',
  ],
  [2, 2, 3, 3, 4],
);

export const WATER_GUN: PowerUpDefinition = {
  id: 'watergun',
  name: 'Water Gun',
  element: 'water',
  category: 'activePower',
  maxLevel: 20,
  levels: waterGunLevels,
  milestones: POWER_MILESTONES,
};

// ─── SPLASH (passivePower) ───
// After match, hit random gems for damage
// Lv1: 1/1dmg → Lv5: 2/5dmg → Lv10: 3/10dmg → Lv15: 4/15dmg → Lv20: 5/20dmg
const splashLevels = generatePower20Levels(
  [
    { targetCount: 1, damage: 1 },
    { targetCount: 2, damage: 5 },
    { targetCount: 3, damage: 10 },
    { targetCount: 4, damage: 15 },
    { targetCount: 5, damage: 20 },
  ],
  [
    'After match: hit 1 random gem, 1 damage',
    'After match: hit 2 random gems, 5 damage',
    'After match: hit 3 random gems, 10 damage',
    'After match: hit 4 random gems, 15 damage',
    'After match: hit 5 random gems, 20 damage',
  ],
);

export const SPLASH: PowerUpDefinition = {
  id: 'splash',
  name: 'Splash',
  element: 'water',
  category: 'passivePower',
  maxLevel: 20,
  levels: splashLevels,
  milestones: POWER_MILESTONES,
};

// ─── PIRATE (passive) ───
// Bonus essence when water gems are destroyed
const pirateLevels = generatePassive5Levels(
  [
    { bonusEssence: 1 },
    { bonusEssence: 2 },
    { bonusEssence: 3 },
    { bonusEssence: 5 },
    { bonusEssence: 10 },
  ],
  [
    '+1 essence per water gem destroyed',
    '+2 essence per water gem destroyed',
    '+3 essence per water gem destroyed',
    '+5 essence per water gem destroyed',
    '+10 essence per water gem destroyed',
  ],
);

export const PIRATE: PowerUpDefinition = {
  id: 'pirate',
  name: 'Pirate',
  element: 'water',
  category: 'passive',
  maxLevel: 5,
  levels: pirateLevels,
};

// ─── CASCADE (passive) ───
// Bonus essence per cascade level (the deeper the combo, the more essence)
const cascadeLevels = generatePassive5Levels(
  [
    { essencePerCascade: 1 },
    { essencePerCascade: 2 },
    { essencePerCascade: 4 },
    { essencePerCascade: 6 },
    { essencePerCascade: 10 },
  ],
  [
    '+1 essence per match this turn (stacks with combos)',
    '+2 essence per match this turn (stacks with combos)',
    '+4 essence per match this turn (stacks with combos)',
    '+6 essence per match this turn (stacks with combos)',
    '+10 essence per match this turn (stacks with combos)',
  ],
);

export const CASCADE: PowerUpDefinition = {
  id: 'cascade',
  name: 'Cascade',
  element: 'water',
  category: 'passive',
  maxLevel: 5,
  levels: cascadeLevels,
};

// ─── MONSOON (passive) ───
// Chance to refund Water Gun charge
const monsoonLevels = generatePassive5Levels(
  [
    { refundChance: 10 },
    { refundChance: 15 },
    { refundChance: 20 },
    { refundChance: 30 },
    { refundChance: 40 },
  ],
  [
    '10% chance to refund Water Gun charge',
    '15% chance to refund Water Gun charge',
    '20% chance to refund Water Gun charge',
    '30% chance to refund Water Gun charge',
    '40% chance to refund Water Gun charge',
  ],
);

export const MONSOON: PowerUpDefinition = {
  id: 'monsoon',
  name: 'Monsoon',
  element: 'water',
  category: 'passive',
  maxLevel: 5,
  requires: 'watergun',
  levels: monsoonLevels,
};

// ─── WELLSPRING (passivePower) ───
// Matching exactly 3 water gems has a chance to refund 1 Water Gun charge
// Lv1: 10% → Lv5: 20% → Lv10: 30% → Lv15: 40% → Lv20: 50%
const wellspringLevels = generatePower20Levels(
  [
    { triggerChance: 10 },
    { triggerChance: 20 },
    { triggerChance: 30 },
    { triggerChance: 40 },
    { triggerChance: 50 },
  ],
  [
    'Matching 3 water gems: 10% chance to refund 1 Water Gun charge',
    'Matching 3 water gems: 20% chance to refund 1 Water Gun charge',
    'Matching 3 water gems: 30% chance to refund 1 Water Gun charge',
    'Matching 3 water gems: 40% chance to refund 1 Water Gun charge',
    'Matching 3 water gems: 50% chance to refund 1 Water Gun charge',
  ],
  undefined, undefined,
  (p) => `Matching 3 water gems: ${p.triggerChance}% chance to refund 1 Water Gun charge`,
);

export const WELLSPRING: PowerUpDefinition = {
  id: 'wellspring',
  name: 'Wellspring',
  element: 'water',
  category: 'passive',
  maxLevel: 20,
  requires: 'watergun',
  levels: wellspringLevels,
  milestones: POWER_MILESTONES,
};

export const WATER_POWERS: PowerUpDefinition[] = [
  WATER_GUN, SPLASH, WELLSPRING, PIRATE, MONSOON,
  // CASCADE removed from shop — cascade essence is now a built-in mechanic
];
