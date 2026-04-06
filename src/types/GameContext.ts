import type Phaser from 'phaser';
import type { Grid } from '../entities/Grid.ts';
import type { Gem } from '../entities/Gem.ts';
import type { GemType } from '../config/gameConfig.ts';
import type { OwnedPowerUp } from './RunState.ts';
import type { HazardManager } from '../systems/HazardManager.ts';
import type { EnemyManager } from '../systems/EnemyManager.ts';

export interface GameContext {
  phaserScene: Phaser.Scene;
  grid: Grid;
  hazardManager: HazardManager;
  enemyManager: EnemyManager;
  round: number;
  turnsRemaining: number;
  isSwapping: boolean;
  ownedPowerUps: OwnedPowerUp[];

  // UI updates
  updateTurnsDisplay(): void;
  updateEnemyDisplay(): void;
  showDamageNumber(worldX: number, worldY: number, amount: number, element?: string | null, isEnemy?: boolean): void;
  flashPowerActivation(): void;

  // Gem helpers
  getRandomGemType(): GemType;
  onGemClick(gem: Gem): void;
  onGemPointerDown(gem: Gem, pointer: Phaser.Input.Pointer): void;

  // Grid queries (hazard-aware)
  findMatches(): { row: number; col: number }[];

  // Timing
  delay(ms: number): Promise<void>;
}
