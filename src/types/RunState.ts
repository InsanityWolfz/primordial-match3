export interface OwnedPowerUp {
  powerUpId: string;
  level: number;
  /** Accumulated gem damage for this power (active only). Resets to 0 after firing. */
  base: number;
  /** Accumulated multiplier pool (active only). Resets to 0 after firing. Display as max(1, multiplierPool). */
  multiplierPool: number;
}

export interface RunState {
  round: number;
  ownedPowerUps: OwnedPowerUp[];
  ownedModifiers: string[];
  // Persisted for balance logging — stable across all rounds in the same run
  runId?: string;
  // Active round modifier (rolled in ShopScene, applied in GameScene)
  currentModifier?: { id: string; name: string; description: string } | null;
  // ShopScene-managed fields (optional so GameScene can build a minimal RunState)
  essence?: number;
  powerSlotCount?: number;    // shared activePower + passivePower slots (starts 4, max 8; max 4 of each category)
  passiveSlotCount?: number;  // stat passive slots (starts 2, max 8)
}
