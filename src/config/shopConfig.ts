// ─── Shop Configuration ───

export const SHOP_CONFIG = {
  powerSlots: {
    initial: 4,
    max: 8,
    costs: [500, 1250, 2500, 5000],  // cost for slot 5, 6, 7, 8
    maxActivePowers: 4,   // of the 8 total, at most 4 can be activePower
    maxPassivePowers: 4,  // of the 8 total, at most 4 can be passivePower
  },
  passiveSlots: {
    initial: 2,
    max: 8,
    costs: [500, 1250, 2500, 5000, 12500, 25000],  // cost for slot 3–8
  },
  shopOfferSlots: {
    powers: 3,     // number of activePower + passivePower cards shown
    passives: 2,   // number of stat passive cards shown
  },
  rerollCost: 500,
  questSlots: 2,   // placeholder for future quest system

  // Layout constants (720px wide portrait)
  layout: {
    headerY: 80,
    scoreY: 130,
    essenceY: 175,
    powerSectionLabelY: 220,
    powerCardsStartY: 248,
    passiveSectionLabelY: 0,  // computed dynamically
    passiveCardsStartY: 0,    // computed dynamically
    cardWidth: 400,
    cardHeight: 105,
    cardGap: 10,
    slotButtonY: 0,           // computed dynamically
    rerollButtonY: 0,         // computed dynamically
    nextRoundButtonY: 0,      // computed dynamically
  },
};

/**
 * Get the cost to buy the next power slot.
 * Returns null if already at max.
 */
export function getPowerSlotCost(currentSlots: number): number | null {
  const cfg = SHOP_CONFIG.powerSlots;
  const slotsAboveInitial = currentSlots - cfg.initial;
  if (slotsAboveInitial >= cfg.costs.length) return null;
  return cfg.costs[slotsAboveInitial];
}

/**
 * Get the cost to buy the next passive slot.
 * Returns null if already at max.
 */
export function getPassiveSlotCost(currentSlots: number): number | null {
  const cfg = SHOP_CONFIG.passiveSlots;
  const slotsAboveInitial = currentSlots - cfg.initial;
  if (slotsAboveInitial >= cfg.costs.length) return null;
  return cfg.costs[slotsAboveInitial];
}
