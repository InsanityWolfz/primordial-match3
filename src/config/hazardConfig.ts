export interface HazardRoundEntry {
  round: number;
  min: number;
  max: number;
}

export interface HazardDefinition {
  id: string;
  name: string;
  hp: number;
  color: number;
  roundEntries: HazardRoundEntry[];
  // Special behavior flags
  powerImmune?: boolean;        // Ancient Ward: can't be damaged by power-ups
  blockSwap?: boolean;          // Ancient Ward: gem can't be swapped
  spreads?: boolean;            // Thorn Vine: spreads to adjacent gems
  spreadInterval?: number;      // Thorn Vine: turns between spreads (default 2)
  onDestroyDrainCharge?: boolean; // Energy Siphon: drain 1 active charge on destroy
}

// ─── HAZARD DEFINITIONS ───

export const HAZARD_DEFINITIONS: HazardDefinition[] = [
  // ─── ICE ───
  // Simple 1-HP hazard. Ramps up rounds 1-4, boss at round 5.
  {
    id: 'ice',
    name: 'Ice',
    hp: 1,
    color: 0x88ccff,
    blockSwap: true,
    roundEntries: [
      { round: 1, min: 1, max: 3 },
      { round: 2, min: 3, max: 5 },
      { round: 3, min: 5, max: 8 },
      { round: 4, min: 8, max: 12 },
      { round: 5, min: 15, max: 20 },   // ICE BOSS
      { round: 6, min: 3, max: 5 },
      { round: 7, min: 4, max: 6 },
      { round: 8, min: 4, max: 6 },
      { round: 9, min: 5, max: 7 },
      { round: 10, min: 0, max: 0 },     // Stone boss — no ice
      { round: 11, min: 4, max: 6 },
      { round: 12, min: 5, max: 7 },
      { round: 13, min: 5, max: 7 },
      { round: 14, min: 6, max: 8 },
      { round: 15, min: 0, max: 0 },     // Thorn boss — no ice
      { round: 16, min: 6, max: 8 },
      { round: 17, min: 7, max: 9 },
      { round: 18, min: 7, max: 9 },
      { round: 19, min: 8, max: 10 },
      { round: 20, min: 8, max: 10 },
    ],
  },

  // ─── STONE ───
  // Tanky 5-HP hazard. Introduced round 6, boss at round 10.
  {
    id: 'stone',
    name: 'Stone',
    hp: 5,
    color: 0x8b7355,
    blockSwap: true,
    roundEntries: [
      { round: 6, min: 1, max: 3 },
      { round: 7, min: 3, max: 5 },
      { round: 8, min: 5, max: 8 },
      { round: 9, min: 8, max: 12 },
      { round: 10, min: 15, max: 20 },   // STONE BOSS
      { round: 11, min: 3, max: 5 },
      { round: 12, min: 4, max: 6 },
      { round: 13, min: 5, max: 7 },
      { round: 14, min: 5, max: 7 },
      { round: 15, min: 0, max: 0 },     // Thorn boss — no stone
      { round: 16, min: 5, max: 7 },
      { round: 17, min: 6, max: 8 },
      { round: 18, min: 6, max: 8 },
      { round: 19, min: 7, max: 9 },
      { round: 20, min: 7, max: 9 },
    ],
  },

  // ─── ANCIENT WARD ───
  // 1 HP but immune to power-up damage and blocks swapping.
  // Must be cleared by matching adjacent gems.
  {
    id: 'ancientWard',
    name: 'Ancient Ward',
    hp: 1,
    color: 0x9966cc,
    powerImmune: true,
    blockSwap: true,
    roundEntries: [
      { round: 8, min: 1, max: 2 },
      { round: 9, min: 2, max: 3 },
      { round: 10, min: 0, max: 0 },     // Stone boss — no wards
      { round: 11, min: 2, max: 4 },
      { round: 12, min: 3, max: 5 },
      { round: 13, min: 3, max: 5 },
      { round: 14, min: 3, max: 5 },
      { round: 15, min: 0, max: 0 },     // Thorn boss — no wards
      { round: 16, min: 4, max: 6 },
      { round: 17, min: 4, max: 6 },
      { round: 18, min: 5, max: 7 },
      { round: 19, min: 5, max: 7 },
      { round: 20, min: 5, max: 7 },
    ],
  },

  // ─── THORN VINE ───
  // 3 HP. Every 2 turns, each vine spreads to 1 adjacent gem.
  // Exponential threat if ignored. Boss at round 15.
  {
    id: 'thornVine',
    name: 'Thorn Vine',
    hp: 3,
    color: 0x2d8a4e,
    blockSwap: true,
    spreads: true,
    spreadInterval: 2,
    roundEntries: [
      { round: 11, min: 1, max: 3 },
      { round: 12, min: 3, max: 5 },
      { round: 13, min: 5, max: 8 },
      { round: 14, min: 8, max: 12 },
      { round: 15, min: 15, max: 20 },   // THORN BOSS
      { round: 16, min: 5, max: 8 },
      { round: 17, min: 6, max: 9 },
      { round: 18, min: 7, max: 10 },
      { round: 19, min: 8, max: 11 },
      { round: 20, min: 8, max: 11 },
    ],
  },

  // ─── ENERGY SIPHON ───
  // 2 HP. On destroy, drains 1 charge from a random active power.
  // No penalty if no charges remain.
  {
    id: 'energySiphon',
    name: 'Energy Siphon',
    hp: 2,
    color: 0xcc3366,
    onDestroyDrainCharge: true,
    roundEntries: [
      { round: 12, min: 1, max: 2 },
      { round: 13, min: 1, max: 3 },
      { round: 14, min: 2, max: 3 },
      { round: 15, min: 0, max: 0 },     // Thorn boss — no siphons
      { round: 16, min: 3, max: 5 },
      { round: 17, min: 3, max: 5 },
      { round: 18, min: 4, max: 6 },
      { round: 19, min: 4, max: 6 },
      { round: 20, min: 5, max: 7 },
    ],
  },
];

// ─── HELPERS ───

export function getHazardDef(id: string): HazardDefinition | undefined {
  return HAZARD_DEFINITIONS.find(h => h.id === id);
}

/**
 * Get the number of hazards of a given type to place for a given round.
 * Uses per-round entries with interpolation between defined rounds.
 * Returns a random value between min and max (inclusive).
 */
export function getHazardCount(def: HazardDefinition, round: number): number {
  const entries = def.roundEntries;
  if (entries.length === 0) return 0;

  // Before first defined round — no hazards
  if (round < entries[0].round) return 0;

  // Exact match
  const exact = entries.find(e => e.round === round);
  if (exact) {
    return randomBetween(exact.min, exact.max);
  }

  // After last defined round — extrapolate with +1 min/max every 3 rounds
  const last = entries[entries.length - 1];
  if (round > last.round) {
    const roundsPast = round - last.round;
    const bonus = Math.floor(roundsPast / 3);
    return randomBetween(last.min + bonus, last.max + bonus);
  }

  // Between defined rounds — interpolate
  let lower = entries[0];
  let upper = entries[entries.length - 1];
  for (const entry of entries) {
    if (entry.round <= round && entry.round > lower.round) lower = entry;
    if (entry.round >= round && entry.round < upper.round) upper = entry;
  }

  if (lower.round === upper.round) {
    return randomBetween(lower.min, lower.max);
  }

  const t = (round - lower.round) / (upper.round - lower.round);
  const min = Math.round(lower.min + t * (upper.min - lower.min));
  const max = Math.round(lower.max + t * (upper.max - lower.max));
  return randomBetween(min, max);
}

function randomBetween(min: number, max: number): number {
  if (min >= max) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
