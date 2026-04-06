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
  blockSwap?: boolean;          // Gem can't be swapped while hazard is present
  spreads?: boolean;            // Thorn Vine: spreads to adjacent gems
  spreadInterval?: number;      // Thorn Vine: turns between spreads (default 2)
}

// Hard cap on total hazards placed per round across all types
export const MAX_HAZARDS_PER_ROUND = 15;

// ─── HAZARD DEFINITIONS ───
// All counts scaled way down. Combined total across all types never exceeds 15.
// Ice appears first (round 1), others introduced later.

export const HAZARD_DEFINITIONS: HazardDefinition[] = [
  // ─── ICE ───
  // 1-HP hazard. Starts small, never goes above 6 on its own.
  {
    id: 'ice',
    name: 'Ice',
    hp: 1,
    color: 0x88ccff,
    blockSwap: true,
    roundEntries: [
      { round: 1, min: 0, max: 2 },
      { round: 2, min: 1, max: 3 },
      { round: 3, min: 2, max: 4 },
      { round: 5, min: 2, max: 5 },
      { round: 8, min: 3, max: 6 },
      { round: 12, min: 3, max: 6 },
      { round: 16, min: 4, max: 6 },
      { round: 20, min: 4, max: 6 },
    ],
  },

  // ─── STONE ───
  // 3-HP hazard. Introduced round 5, stays low.
  {
    id: 'stone',
    name: 'Stone',
    hp: 3,
    color: 0x8b7355,
    blockSwap: true,
    roundEntries: [
      { round: 5, min: 0, max: 1 },
      { round: 6, min: 1, max: 2 },
      { round: 8, min: 1, max: 3 },
      { round: 12, min: 2, max: 4 },
      { round: 16, min: 2, max: 5 },
      { round: 20, min: 3, max: 5 },
    ],
  },

  // ─── THORN VINE ───
  // 3 HP, spreads every 2 turns. Introduced round 10.
  {
    id: 'thornVine',
    name: 'Thorn Vine',
    hp: 3,
    color: 0x2d8a4e,
    blockSwap: true,
    spreads: true,
    spreadInterval: 2,
    roundEntries: [
      { round: 10, min: 0, max: 1 },
      { round: 12, min: 1, max: 2 },
      { round: 15, min: 1, max: 3 },
      { round: 18, min: 2, max: 4 },
      { round: 20, min: 2, max: 4 },
    ],
  },

];

// ─── HELPERS ───

export function getHazardDef(id: string): HazardDefinition | undefined {
  return HAZARD_DEFINITIONS.find(h => h.id === id);
}

/**
 * Get the number of hazards of a given type to place for a given round.
 * Interpolates between defined round entries.
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

  // After last defined round — use last entry values
  const last = entries[entries.length - 1];
  if (round > last.round) {
    return randomBetween(last.min, last.max);
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
