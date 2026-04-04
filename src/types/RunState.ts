export interface OwnedPowerUp {
  powerUpId: string;
  level: number;
  charges: number;    // remaining uses this round (active only)
  maxCharges: number; // charges at start of each round
}

export interface RunState {
  essence: number;
  round: number;
  ownedPowerUps: OwnedPowerUp[];
  powerSlotCount: number;     // shared active + passive power slots (starts 4, max 8)
  passiveSlotCount: number;   // stat passive slots (starts 2, max 8)
  // Persisted for balance logging — stable across all rounds in the same run
  runId?: string;
  // Active round modifier (rolled in ShopScene, applied in GameScene)
  currentModifier?: { id: string; name: string; description: string } | null;
}
