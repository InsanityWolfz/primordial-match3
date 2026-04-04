import type { PowerUpDefinition } from '../powerUpConfig.ts';
import { generatePower20Levels, generatePassive5Levels, POWER_MILESTONES } from '../powerUpConfig.ts';

// ─── EARTHQUAKE (activePower) ───
// Shuffle + damage random gems. Target count scales with level.
// Lv1: 12/1dmg → Lv5: 20/1dmg → Lv10: 32/2dmg → Lv15: 48/2dmg → Lv20: 64/3dmg
const earthquakeLevels = generatePower20Levels(
  [
    { targetCount: 12, damage: 1 },
    { targetCount: 20, damage: 1 },
    { targetCount: 32, damage: 2 },
    { targetCount: 48, damage: 2 },
    { targetCount: 64, damage: 3 },
  ],
  [
    'Shuffle + hit 12 random tiles, 1 damage each',
    'Shuffle + hit 20 random tiles, 1 damage each',
    'Shuffle + hit 32 random tiles, 2 damage each',
    'Shuffle + hit 48 random tiles, 2 damage each',
    'Shuffle + hit entire board, 3 damage each',
  ],
  [1, 1, 2, 2, 3],
);

export const EARTHQUAKE: PowerUpDefinition = {
  id: 'earthquake',
  name: 'Earthquake',
  element: 'earth',
  category: 'activePower',
  maxLevel: 20,
  levels: earthquakeLevels,
  milestones: POWER_MILESTONES,
};

// ─── STURDY (passivePower) ───
// Chance to not consume a turn on match
// Lv1: 5% → Lv5: 12% → Lv10: 20% → Lv15: 30% → Lv20: 40%
const sturdyLevels = generatePower20Levels(
  [
    { turnSaveChance: 5 },
    { turnSaveChance: 12 },
    { turnSaveChance: 20 },
    { turnSaveChance: 30 },
    { turnSaveChance: 40 },
  ],
  [
    '5% chance a match doesn\'t consume a turn',
    '12% chance a match doesn\'t consume a turn',
    '20% chance a match doesn\'t consume a turn',
    '30% chance a match doesn\'t consume a turn',
    '40% chance a match doesn\'t consume a turn',
  ],
);

export const STURDY: PowerUpDefinition = {
  id: 'sturdy',
  name: 'Sturdy',
  element: 'earth',
  category: 'passivePower',
  maxLevel: 20,
  levels: sturdyLevels,
  milestones: POWER_MILESTONES,
};

// ─── GOLD DIGGER (passive) ───
// Bonus essence when earth gems are destroyed
const goldDiggerLevels = generatePassive5Levels(
  [
    { bonusEssence: 1 },
    { bonusEssence: 2 },
    { bonusEssence: 3 },
    { bonusEssence: 5 },
    { bonusEssence: 10 },
  ],
  [
    '+1 essence per earth gem destroyed',
    '+2 essence per earth gem destroyed',
    '+3 essence per earth gem destroyed',
    '+5 essence per earth gem destroyed',
    '+10 essence per earth gem destroyed',
  ],
);

export const GOLD_DIGGER: PowerUpDefinition = {
  id: 'goldDigger',
  name: 'Gold Digger',
  element: 'earth',
  category: 'passive',
  maxLevel: 5,
  levels: goldDiggerLevels,
};

// ─── TECTONIC PLATES (passive) ───
// Earthquake grants bonus turns
const tectonicPlatesLevels = generatePassive5Levels(
  [
    { bonusTurns: 2 },
    { bonusTurns: 4 },
    { bonusTurns: 6 },
    { bonusTurns: 8 },
    { bonusTurns: 10 },
  ],
  [
    '+2 bonus turns per Earthquake',
    '+4 bonus turns per Earthquake',
    '+6 bonus turns per Earthquake',
    '+8 bonus turns per Earthquake',
    '+10 bonus turns per Earthquake',
  ],
);

export const TECTONIC_PLATES: PowerUpDefinition = {
  id: 'tectonicPlates',
  name: 'Tectonic Plates',
  element: 'earth',
  category: 'passive',
  maxLevel: 5,
  requires: 'earthquake',
  levels: tectonicPlatesLevels,
};

// ─── MONOLITH (passive) ───
// Chance to refund Earthquake charge on use
const monolithLevels = generatePassive5Levels(
  [
    { refundChance: 10 },
    { refundChance: 15 },
    { refundChance: 20 },
    { refundChance: 30 },
    { refundChance: 40 },
  ],
  [
    '10% chance to refund Earthquake charge',
    '15% chance to refund Earthquake charge',
    '20% chance to refund Earthquake charge',
    '30% chance to refund Earthquake charge',
    '40% chance to refund Earthquake charge',
  ],
);

export const MONOLITH: PowerUpDefinition = {
  id: 'monolith',
  name: 'Monolith',
  element: 'earth',
  category: 'passive',
  maxLevel: 5,
  requires: 'earthquake',
  levels: monolithLevels,
};

export const EARTH_POWERS: PowerUpDefinition[] = [
  EARTHQUAKE, STURDY, GOLD_DIGGER, TECTONIC_PLATES, MONOLITH,
];
