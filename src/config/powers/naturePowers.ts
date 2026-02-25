import type { PowerUpDefinition } from '../powerUpConfig.ts';
import { generatePower20Levels, generatePassive5Levels, POWER_MILESTONES } from '../powerUpConfig.ts';

// ─── TRANSMUTE (activePower) ───
// Click gem → color picker menu → change to chosen element. Charges scale with level.
const transmuteLevels = generatePower20Levels(
  [
    {},
    {},
    {},
    {},
    {},
  ],
  [
    'Change any gem to any element (2 charges/round)',
    'Change any gem to any element (3 charges/round)',
    'Change any gem to any element (4 charges/round)',
    'Change any gem to any element (5 charges/round)',
    'Change any gem to any element (6 charges/round)',
  ],
  [2, 3, 4, 5, 6],
);

export const TRANSMUTE: PowerUpDefinition = {
  id: 'transmute',
  name: 'Transmute',
  element: 'nature',
  category: 'activePower',
  maxLevel: 20,
  needsTarget: true,
  levels: transmuteLevels,
  milestones: POWER_MILESTONES,
};

// ─── WILD GROWTH (passivePower) ───
// Flat bonus essence per match
// Lv1: +2 → Lv5: +4 → Lv10: +7 → Lv15: +11 → Lv20: +15
const wildGrowthLevels = generatePower20Levels(
  [
    { bonusEssence: 2 },
    { bonusEssence: 4 },
    { bonusEssence: 7 },
    { bonusEssence: 11 },
    { bonusEssence: 15 },
  ],
  [
    '+2 essence per match',
    '+4 essence per match',
    '+7 essence per match',
    '+11 essence per match',
    '+15 essence per match',
  ],
);

export const WILD_GROWTH: PowerUpDefinition = {
  id: 'wildGrowth',
  name: 'Wild Growth',
  element: 'nature',
  category: 'passivePower',
  maxLevel: 20,
  levels: wildGrowthLevels,
  milestones: POWER_MILESTONES,
};

// ─── PHOTOSYNTHESIS (passive) ───
// Bonus essence when nature gems are destroyed
const photosynthesisLevels = generatePassive5Levels(
  [
    { bonusEssence: 1 },
    { bonusEssence: 2 },
    { bonusEssence: 3 },
    { bonusEssence: 5 },
    { bonusEssence: 10 },
  ],
  [
    '+1 essence per nature gem destroyed',
    '+2 essence per nature gem destroyed',
    '+3 essence per nature gem destroyed',
    '+5 essence per nature gem destroyed',
    '+10 essence per nature gem destroyed',
  ],
);

export const PHOTOSYNTHESIS: PowerUpDefinition = {
  id: 'photosynthesis',
  name: 'Photosynthesis',
  element: 'nature',
  category: 'passive',
  maxLevel: 5,
  levels: photosynthesisLevels,
};

// ─── OVERGROWTH (passivePower) ───
// Matching exactly 3 nature gems has a chance to refund 1 Transmute charge
// Lv1: 10% → Lv5: 20% → Lv10: 30% → Lv15: 40% → Lv20: 50%
const overgrowthLevels = generatePower20Levels(
  [
    { triggerChance: 10 },
    { triggerChance: 20 },
    { triggerChance: 30 },
    { triggerChance: 40 },
    { triggerChance: 50 },
  ],
  [
    'Matching 3 nature gems: 10% chance to refund 1 Transmute charge',
    'Matching 3 nature gems: 20% chance to refund 1 Transmute charge',
    'Matching 3 nature gems: 30% chance to refund 1 Transmute charge',
    'Matching 3 nature gems: 40% chance to refund 1 Transmute charge',
    'Matching 3 nature gems: 50% chance to refund 1 Transmute charge',
  ],
  undefined, undefined,
  (p) => `Matching 3 nature gems: ${p.triggerChance}% chance to refund 1 Transmute charge`,
);

export const OVERGROWTH: PowerUpDefinition = {
  id: 'overgrowth',
  name: 'Overgrowth',
  element: 'nature',
  category: 'passive',
  maxLevel: 20,
  requires: 'transmute',
  levels: overgrowthLevels,
  milestones: POWER_MILESTONES,
};

export const NATURE_POWERS: PowerUpDefinition[] = [
  TRANSMUTE, WILD_GROWTH, OVERGROWTH, PHOTOSYNTHESIS,
];
