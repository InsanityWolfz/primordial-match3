export interface OwnedPowerUp {
  powerUpId: string;
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
}
