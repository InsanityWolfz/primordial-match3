import type { PowerUpDefinition } from '../powerUpConfig.ts';
import { generatePower20Levels, generatePassive5Levels, POWER_MILESTONES } from '../powerUpConfig.ts';

// ─── GUST (activePower) ───
// Deal damage to entire rows
// Lv1: 2 rows/1dmg → Lv5: 3 rows/5dmg → Lv10: 4 rows/10dmg → Lv15: 5 rows/15dmg → Lv20: 6 rows/20dmg
const gustLevels = generatePower20Levels(
  [
    { rowCount: 2, damage: 1 },
    { rowCount: 3, damage: 5 },
    { rowCount: 4, damage: 10 },
    { rowCount: 5, damage: 15 },
    { rowCount: 6, damage: 20 },
  ],
  [
    'Hit all gems in 2 random rows, 1 damage',
    'Hit all gems in 3 random rows, 5 damage',
    'Hit all gems in 4 random rows, 10 damage',
    'Hit all gems in 5 random rows, 15 damage',
    'Hit all gems in 6 random rows, 20 damage',
  ],
  [2, 2, 3, 3, 4],
);

export const GUST: PowerUpDefinition = {
  id: 'gust',
  name: 'Gust',
  element: 'air',
  category: 'activePower',
  maxLevel: 20,
  levels: gustLevels,
  milestones: POWER_MILESTONES,
};

// ─── WINDSLASH (passivePower) ───
// Chance after match to hit random column
// Lv1: 10%/1dmg → Lv5: 20%/5dmg → Lv10: 30%/10dmg → Lv15: 40%/15dmg → Lv20: 50%/20dmg
const windslashLevels = generatePower20Levels(
  [
    { triggerChance: 10, damage: 1 },
    { triggerChance: 20, damage: 5 },
    { triggerChance: 30, damage: 10 },
    { triggerChance: 40, damage: 15 },
    { triggerChance: 50, damage: 20 },
  ],
  [
    'After match: 10% chance to hit all gems in 1 random column, 1 damage',
    'After match: 20% chance to hit all gems in 1 random column, 5 damage',
    'After match: 30% chance to hit all gems in 1 random column, 10 damage',
    'After match: 40% chance to hit all gems in 1 random column, 15 damage',
    'After match: 50% chance to hit all gems in 1 random column, 20 damage',
  ],
);

export const WINDSLASH: PowerUpDefinition = {
  id: 'windslash',
  name: 'Windslash',
  element: 'air',
  category: 'passivePower',
  maxLevel: 20,
  levels: windslashLevels,
  milestones: POWER_MILESTONES,
};

// ─── SKYBOUND (passive) ───
// Bonus essence when air gems are destroyed
const skyboundLevels = generatePassive5Levels(
  [
    { bonusEssence: 1 },
    { bonusEssence: 2 },
    { bonusEssence: 3 },
    { bonusEssence: 5 },
    { bonusEssence: 10 },
  ],
  [
    '+1 essence per air gem destroyed',
    '+2 essence per air gem destroyed',
    '+3 essence per air gem destroyed',
    '+5 essence per air gem destroyed',
    '+10 essence per air gem destroyed',
  ],
);

export const SKYBOUND: PowerUpDefinition = {
  id: 'skybound',
  name: 'Skybound',
  element: 'air',
  category: 'passive',
  maxLevel: 5,
  levels: skyboundLevels,
};

// ─── WIND WALKER (passive) ───
// Chance for bonus turn on match
const windWalkerLevels = generatePassive5Levels(
  [
    { bonusTurnChance: 3 },
    { bonusTurnChance: 6 },
    { bonusTurnChance: 10 },
    { bonusTurnChance: 15 },
    { bonusTurnChance: 25 },
  ],
  [
    '3% chance to gain a bonus turn on match',
    '6% chance to gain a bonus turn on match',
    '10% chance to gain a bonus turn on match',
    '15% chance to gain a bonus turn on match',
    '25% chance to gain a bonus turn on match',
  ],
);

export const WIND_WALKER: PowerUpDefinition = {
  id: 'windWalker',
  name: 'Wind Walker',
  element: 'air',
  category: 'passive',
  maxLevel: 5,
  levels: windWalkerLevels,
};

// ─── WINDSTORM (passive) ───
// Chance to refund Gust charge
const windstormLevels = generatePassive5Levels(
  [
    { refundChance: 10 },
    { refundChance: 15 },
    { refundChance: 20 },
    { refundChance: 30 },
    { refundChance: 40 },
  ],
  [
    '10% chance to refund Gust charge',
    '15% chance to refund Gust charge',
    '20% chance to refund Gust charge',
    '30% chance to refund Gust charge',
    '40% chance to refund Gust charge',
  ],
);

export const WINDSTORM: PowerUpDefinition = {
  id: 'windstorm',
  name: 'Windstorm',
  element: 'air',
  category: 'passive',
  maxLevel: 5,
  requires: 'gust',
  levels: windstormLevels,
};

// ─── UPDRAFT (passivePower) ───
// Matching exactly 3 air gems has a chance to refund 1 Gust charge
// Lv1: 10% → Lv5: 20% → Lv10: 30% → Lv15: 40% → Lv20: 50%
const updraftLevels = generatePower20Levels(
  [
    { triggerChance: 10 },
    { triggerChance: 20 },
    { triggerChance: 30 },
    { triggerChance: 40 },
    { triggerChance: 50 },
  ],
  [
    'Matching 3 air gems: 10% chance to refund 1 Gust charge',
    'Matching 3 air gems: 20% chance to refund 1 Gust charge',
    'Matching 3 air gems: 30% chance to refund 1 Gust charge',
    'Matching 3 air gems: 40% chance to refund 1 Gust charge',
    'Matching 3 air gems: 50% chance to refund 1 Gust charge',
  ],
);

export const UPDRAFT: PowerUpDefinition = {
  id: 'updraft',
  name: 'Updraft',
  element: 'air',
  category: 'passive',
  maxLevel: 20,
  requires: 'gust',
  levels: updraftLevels,
  milestones: POWER_MILESTONES,
};

export const AIR_POWERS: PowerUpDefinition[] = [
  GUST, WINDSLASH, UPDRAFT, SKYBOUND, WIND_WALKER, WINDSTORM,
];
