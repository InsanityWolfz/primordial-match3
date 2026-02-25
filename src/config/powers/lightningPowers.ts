import type { PowerUpDefinition } from '../powerUpConfig.ts';
import { generatePower20Levels, generatePassive5Levels, POWER_MILESTONES } from '../powerUpConfig.ts';

// ─── LIGHTNING (activePower) ───
// Chain gems in cardinal directions from target
// Lv1: chain 9/1dmg → Lv5: 14/5dmg → Lv10: 21/10dmg → Lv15: 32/15dmg → Lv20: 50/20dmg
const lightningLevels = generatePower20Levels(
  [
    { chainCount: 9, damage: 1 },
    { chainCount: 14, damage: 5 },
    { chainCount: 21, damage: 10 },
    { chainCount: 32, damage: 15 },
    { chainCount: 50, damage: 20 },
  ],
  [
    'Chain damage through 9 gems in a zig-zag path, 1 damage',
    'Chain damage through 14 gems in a zig-zag path, 5 damage',
    'Chain damage through 21 gems in a zig-zag path, 10 damage',
    'Chain damage through 32 gems in a zig-zag path, 15 damage',
    'Chain damage through 50 gems in a zig-zag path, 20 damage',
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
// Lv1: 1/1dmg → Lv5: 3/5dmg → Lv10: 6/10dmg → Lv15: 10/15dmg → Lv20: 15/20dmg
const capacitorLevels = generatePower20Levels(
  [
    { chainCount: 1, damage: 1 },
    { chainCount: 3, damage: 5 },
    { chainCount: 6, damage: 10 },
    { chainCount: 10, damage: 15 },
    { chainCount: 15, damage: 20 },
  ],
  [
    'After match: zap 1 random gem, 1 damage',
    'After match: zap 3 random gems, 5 damage',
    'After match: zap 6 random gems, 10 damage',
    'After match: zap 10 random gems, 15 damage',
    'After match: zap 15 random gems, 20 damage',
  ],
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
// Chance to refund Lightning charge
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

// ─── CHARGE UP (passivePower) ───
// Matching exactly 3 lightning gems has a chance to refund 1 Lightning charge
// Lv1: 10% → Lv5: 20% → Lv10: 30% → Lv15: 40% → Lv20: 50%
const chargeUpLevels = generatePower20Levels(
  [
    { triggerChance: 10 },
    { triggerChance: 20 },
    { triggerChance: 30 },
    { triggerChance: 40 },
    { triggerChance: 50 },
  ],
  [
    'Matching 3 lightning gems: 10% chance to refund 1 Lightning charge',
    'Matching 3 lightning gems: 20% chance to refund 1 Lightning charge',
    'Matching 3 lightning gems: 30% chance to refund 1 Lightning charge',
    'Matching 3 lightning gems: 40% chance to refund 1 Lightning charge',
    'Matching 3 lightning gems: 50% chance to refund 1 Lightning charge',
  ],
);

export const CHARGE_UP: PowerUpDefinition = {
  id: 'chargeUp',
  name: 'Charge Up',
  element: 'lightning',
  category: 'passive',
  maxLevel: 20,
  requires: 'chainstrike',
  levels: chargeUpLevels,
  milestones: POWER_MILESTONES,
};

export const LIGHTNING_POWERS: PowerUpDefinition[] = [
  LIGHTNING, CAPACITOR, CHARGE_UP, POWER_PLANT, STRIKE_TWICE,
];
