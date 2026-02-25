import type { PowerUpDefinition } from '../powerUpConfig.ts';
import { generatePower20Levels, generatePassive5Levels, POWER_MILESTONES } from '../powerUpConfig.ts';

// ─── FIREBALL (activePower) ───
// Area blast around target. Radius and damage scale with level.
// Lv1: 3x3/1dmg → Lv5: 4x4/5dmg → Lv10: 5x5/10dmg → Lv15: 6x6/15dmg → Lv20: whole board/20dmg
const fireballLevels = generatePower20Levels(
  [
    { radius: 1, damage: 1 },    // Lv1: 3x3
    { radius: 2, damage: 5 },    // Lv5: 5x5
    { radius: 2, damage: 10 },   // Lv10: 5x5
    { radius: 3, damage: 15 },   // Lv15: 7x7
    { radius: 4, damage: 20 },   // Lv20: whole board
  ],
  [
    '3x3 area, 1 damage',
    '5x5 area, 5 damage',
    '5x5 area, 10 damage',
    '7x7 area, 15 damage',
    'Whole board, 20 damage',
  ],
  [2, 2, 3, 3, 4],  // charges
);

export const FIREBALL: PowerUpDefinition = {
  id: 'fireball',
  name: 'Fireball',
  element: 'fire',
  category: 'activePower',
  maxLevel: 20,
  needsTarget: true,
  levels: fireballLevels,
  milestones: POWER_MILESTONES,
};

// ─── COMBUSTION (passivePower) ───
// On hazard destroy → spawn random explosions
// Lv1: 3x 1x1/1dmg → Lv5: 6x 1x1/5dmg → Lv10: 6x 2x2/10dmg → Lv15: 9x 2x2/15dmg → Lv20: 9x 3x3/20dmg
const combustionLevels = generatePower20Levels(
  [
    { explosionCount: 3, explosionRadius: 0, damage: 1 },
    { explosionCount: 6, explosionRadius: 0, damage: 5 },
    { explosionCount: 6, explosionRadius: 1, damage: 10 },
    { explosionCount: 9, explosionRadius: 1, damage: 15 },
    { explosionCount: 9, explosionRadius: 1, damage: 20 },
  ],
  [
    'On hazard destroy: 3 explosions nearby, 1 damage each',
    'On hazard destroy: 6 explosions nearby, 5 damage each',
    'On hazard destroy: 6 area explosions (3x3), 10 damage each',
    'On hazard destroy: 9 area explosions (3x3), 15 damage each',
    'On hazard destroy: 9 area explosions (3x3), 20 damage each',
  ],
);

export const COMBUSTION: PowerUpDefinition = {
  id: 'combustion',
  name: 'Combustion',
  element: 'fire',
  category: 'passivePower',
  maxLevel: 20,
  levels: combustionLevels,
  milestones: POWER_MILESTONES,
};

// ─── ARSONIST (passive) ───
// Bonus essence when fire gems are destroyed
const arsonistLevels = generatePassive5Levels(
  [
    { bonusEssence: 1 },
    { bonusEssence: 2 },
    { bonusEssence: 3 },
    { bonusEssence: 5 },
    { bonusEssence: 10 },
  ],
  [
    '+1 essence per fire gem destroyed',
    '+2 essence per fire gem destroyed',
    '+3 essence per fire gem destroyed',
    '+5 essence per fire gem destroyed',
    '+10 essence per fire gem destroyed',
  ],
);

export const ARSONIST: PowerUpDefinition = {
  id: 'arsonist',
  name: 'Arsonist',
  element: 'fire',
  category: 'passive',
  maxLevel: 5,
  levels: arsonistLevels,
};

// ─── METEOR SHOWER (passive) ───
// Chance to refund fireball charge on use
const meteorShowerLevels = generatePassive5Levels(
  [
    { refundChance: 10 },
    { refundChance: 15 },
    { refundChance: 20 },
    { refundChance: 30 },
    { refundChance: 40 },
  ],
  [
    '10% chance to refund fireball charge',
    '15% chance to refund fireball charge',
    '20% chance to refund fireball charge',
    '30% chance to refund fireball charge',
    '40% chance to refund fireball charge',
  ],
);

export const METEOR_SHOWER: PowerUpDefinition = {
  id: 'meteorShower',
  name: 'Meteor Shower',
  element: 'fire',
  category: 'passive',
  maxLevel: 5,
  requires: 'fireball',
  levels: meteorShowerLevels,
};

// ─── KINDLING (passivePower) ───
// Matching exactly 3 fire gems has a chance to refund 1 Fireball charge
// Lv1: 10% → Lv5: 20% → Lv10: 30% → Lv15: 40% → Lv20: 50%
const kindlingLevels = generatePower20Levels(
  [
    { triggerChance: 10 },
    { triggerChance: 20 },
    { triggerChance: 30 },
    { triggerChance: 40 },
    { triggerChance: 50 },
  ],
  [
    'Matching 3 fire gems: 10% chance to refund 1 Fireball charge',
    'Matching 3 fire gems: 20% chance to refund 1 Fireball charge',
    'Matching 3 fire gems: 30% chance to refund 1 Fireball charge',
    'Matching 3 fire gems: 40% chance to refund 1 Fireball charge',
    'Matching 3 fire gems: 50% chance to refund 1 Fireball charge',
  ],
);

export const KINDLING: PowerUpDefinition = {
  id: 'kindling',
  name: 'Kindling',
  element: 'fire',
  category: 'passive',
  maxLevel: 20,
  requires: 'fireball',
  levels: kindlingLevels,
  milestones: POWER_MILESTONES,
};

export const FIRE_POWERS: PowerUpDefinition[] = [
  FIREBALL, COMBUSTION, KINDLING, ARSONIST, METEOR_SHOWER,
];
