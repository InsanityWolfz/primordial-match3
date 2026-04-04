import type { PowerUpDefinition } from '../powerUpConfig.ts';
import { generatePower20Levels, generatePassive5Levels, POWER_MILESTONES } from '../powerUpConfig.ts';

// ─── LIGHTNING (activePower) ───
// Chain gems in cardinal directions from target
// Lv1: chain 9/1dmg → Lv5: 14/1dmg → Lv10: 21/2dmg → Lv15: 32/2dmg → Lv20: 50/3dmg
const lightningLevels = generatePower20Levels(
  [
    { chainCount: 9,  damage: 1 },
    { chainCount: 14, damage: 1 },
    { chainCount: 21, damage: 2 },
    { chainCount: 32, damage: 2 },
    { chainCount: 50, damage: 3 },
  ],
  [
    'Chain through 9 tiles in a zig-zag path, 1 damage each',
    'Chain through 14 tiles in a zig-zag path, 1 damage each',
    'Chain through 21 tiles in a zig-zag path, 2 damage each',
    'Chain through 32 tiles in a zig-zag path, 2 damage each',
    'Chain through 50 tiles in a zig-zag path, 3 damage each',
  ],
  [2, 2, 3, 3, 4],
);

export const LIGHTNING: PowerUpDefinition = {
  id: 'chainstrike',
  name: 'Lightning',
  element: 'lightning',
  category: 'activePower',
  maxLevel: 20,
  needsTarget: true,
  levels: lightningLevels,
  milestones: POWER_MILESTONES,
};

// ─── CAPACITOR (passivePower) ───
// Match triggers chain for extra gems
// Lv1: 1/1dmg → Lv5: 3/1dmg → Lv10: 6/1dmg → Lv15: 10/2dmg → Lv20: 15/2dmg
const capacitorLevels = generatePower20Levels(
  [
    { chainCount: 1,  damage: 1 },
    { chainCount: 3,  damage: 1 },
    { chainCount: 6,  damage: 1 },
    { chainCount: 10, damage: 2 },
    { chainCount: 15, damage: 2 },
  ],
  [
    'After match: zap 1 random tile, 1 damage',
    'After match: zap 3 random tiles, 1 damage each',
    'After match: zap 6 random tiles, 1 damage each',
    'After match: zap 10 random tiles, 2 damage each',
    'After match: zap 15 random tiles, 2 damage each',
  ],
  undefined, undefined,
  (p) => `After match: zap ${p.chainCount} random tile${p.chainCount !== 1 ? 's' : ''}, ${p.damage} damage each`,
);

export const CAPACITOR: PowerUpDefinition = {
  id: 'capacitor',
  name: 'Capacitor',
  element: 'lightning',
  category: 'passivePower',
  maxLevel: 20,
  levels: capacitorLevels,
  milestones: POWER_MILESTONES,
};

// ─── POWER PLANT (passive) ───
// Bonus essence when lightning gems are destroyed
const powerPlantLevels = generatePassive5Levels(
  [
    { bonusEssence: 1 },
    { bonusEssence: 2 },
    { bonusEssence: 3 },
    { bonusEssence: 5 },
    { bonusEssence: 10 },
  ],
  [
    '+1 essence per lightning gem destroyed',
    '+2 essence per lightning gem destroyed',
    '+3 essence per lightning gem destroyed',
    '+5 essence per lightning gem destroyed',
    '+10 essence per lightning gem destroyed',
  ],
);

export const POWER_PLANT: PowerUpDefinition = {
  id: 'powerPlant',
  name: 'Power Plant',
  element: 'lightning',
  category: 'passive',
  maxLevel: 5,
  levels: powerPlantLevels,
};

// ─── LIGHTNING ROD (passive) ───
// Chance to refund Chainstrike charge on use
const strikeTwiceLevels = generatePassive5Levels(
  [
    { refundChance: 10 },
    { refundChance: 15 },
    { refundChance: 20 },
    { refundChance: 30 },
    { refundChance: 40 },
  ],
  [
    '10% chance to refund Lightning charge',
    '15% chance to refund Lightning charge',
    '20% chance to refund Lightning charge',
    '30% chance to refund Lightning charge',
    '40% chance to refund Lightning charge',
  ],
);

export const STRIKE_TWICE: PowerUpDefinition = {
  id: 'strikeTwice',
  name: 'Lightning Rod',
  element: 'lightning',
  category: 'passive',
  maxLevel: 5,
  requires: 'chainstrike',
  levels: strikeTwiceLevels,
};

export const LIGHTNING_POWERS: PowerUpDefinition[] = [
  LIGHTNING, CAPACITOR, POWER_PLANT, STRIKE_TWICE,
];
