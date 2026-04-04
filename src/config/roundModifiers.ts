// ─── Round Modifiers ───
// One modifier may be active per round (rolled in ShopScene, applied in GameScene).
// Round 1 always has no modifier. Rounds 2+ have a 70% chance of rolling a modifier.

export interface RoundModifier {
  id: string;
  name: string;
  description: string;
  /** Minimum round at which this modifier can appear */
  minRound: number;
  /** Higher weight = more likely to be picked */
  weight: number;
}

export const ROUND_MODIFIERS: RoundModifier[] = [
  {
    id: 'overcrowded',
    name: 'Overcrowded',
    description: '+2 extra enemies this round',
    minRound: 2,
    weight: 4,
  },
  {
    id: 'rush',
    name: 'Rush',
    description: 'Only 10 turns this round instead of 15',
    minRound: 3,
    weight: 3,
  },
  {
    id: 'hazardStorm',
    name: 'Hazard Storm',
    description: 'Hazard cap raised to 25 and spawn rate increased',
    minRound: 4,
    weight: 3,
  },
  {
    id: 'abundance',
    name: 'Abundance',
    description: '+50% essence income this round',
    minRound: 2,
    weight: 4,
  },
];

/**
 * Roll a modifier for the given round.
 * - Round 1 always returns null.
 * - Rounds 2+: 30% chance of no modifier, 70% chance of a weighted random pick.
 */
export function rollModifier(round: number): RoundModifier | null {
  if (round <= 1) return null;

  // 30% chance of no modifier
  if (Math.random() < 0.30) return null;

  const eligible = ROUND_MODIFIERS.filter(m => round >= m.minRound);
  if (eligible.length === 0) return null;

  const totalWeight = eligible.reduce((sum, m) => sum + m.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const mod of eligible) {
    roll -= mod.weight;
    if (roll <= 0) return mod;
  }

  return eligible[eligible.length - 1];
}
