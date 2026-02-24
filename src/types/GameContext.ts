import type Phaser from 'phaser';
import type { Grid } from '../entities/Grid.ts';
import type { Gem } from '../entities/Gem.ts';
import type { GemType } from '../config/gameConfig.ts';
import type { OwnedPowerUp } from './RunState.ts';
import type { HazardManager } from '../systems/HazardManager.ts';

export interface GameContext {
  phaserScene: Phaser.Scene;
  grid: Grid;
  hazardManager: HazardManager;
  essence: number;
  score: number;
  round: number;
  turnsRemaining: number;
  isSwapping: boolean;
  ownedPowerUps: OwnedPowerUp[];
  powerSlotCount: number;
  passiveSlotCount: number;

  // UI updates
  updateEssenceDisplay(): void;
  updateScoreDisplay(): void;
  updateTurnsDisplay(): void;

  // Gem helpers
  getRandomGemType(): GemType;
  onGemClick(gem: Gem): void;

  // Grid queries (hazard-aware)
  findMatches(): { row: number; col: number }[];

  // Timing
  delay(ms: number): Promise<void>;
}
