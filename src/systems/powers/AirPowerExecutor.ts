import { GAME_CONFIG } from '../../config/gameConfig.ts';
import type { GameContext } from '../../types/GameContext.ts';
import type { CascadeSystem } from '../CascadeSystem.ts';
import type { DamageSystem } from '../DamageSystem.ts';
import type { PassiveManager } from '../PassiveManager.ts';

export class AirPowerExecutor {
  private ctx: GameContext;
  private cascadeSystem: CascadeSystem;
  private damageSystem: DamageSystem;
  private passiveManager: PassiveManager;

  constructor(ctx: GameContext, cascadeSystem: CascadeSystem, damageSystem: DamageSystem, passiveManager: PassiveManager) {
    this.ctx = ctx;
    this.cascadeSystem = cascadeSystem;
    this.damageSystem = damageSystem;
    this.passiveManager = passiveManager;
  }

  /**
   * Gust: hit every tile in the target's row AND column (cross/plus pattern).
   * Targeted active power.
   */
  async executeGust(targetRow: number, targetCol: number, computedDamage: number): Promise<void> {
    this.passiveManager.onDamageDealt('air', computedDamage, 'gust');

    const positions: { row: number; col: number }[] = [];
    const posSet = new Set<string>();

    const addTile = (r: number, c: number) => {
      const key = `${r},${c}`;
      if (!posSet.has(key) && (this.ctx.grid.getGem(r, c) || this.ctx.grid.isEnemyTile(r, c))) {
        posSet.add(key);
        positions.push({ row: r, col: c });
      }
    };

    // Full row
    for (let c = 0; c < this.ctx.grid.cols; c++) addTile(targetRow, c);
    // Full column
    for (let r = 0; r < this.ctx.grid.rows; r++) addTile(r, targetCol);

    if (positions.length === 0) return;

    // Cross flash effect
    const scene = this.ctx.phaserScene;
    const flash = scene.add.graphics();
    const airColor = GAME_CONFIG.gemTypes.find(g => g.name === 'air')?.color ?? 0xe8e8e8;
    flash.fillStyle(airColor, 0.3);
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;

    // Highlight full row
    for (let c = 0; c < this.ctx.grid.cols; c++) {
      flash.fillRect(
        GAME_CONFIG.gridOffsetX + c * cellSize,
        GAME_CONFIG.gridOffsetY + targetRow * cellSize,
        GAME_CONFIG.gemSize, GAME_CONFIG.gemSize,
      );
    }
    // Highlight full column
    for (let r = 0; r < this.ctx.grid.rows; r++) {
      flash.fillRect(
        GAME_CONFIG.gridOffsetX + targetCol * cellSize,
        GAME_CONFIG.gridOffsetY + r * cellSize,
        GAME_CONFIG.gemSize, GAME_CONFIG.gemSize,
      );
    }

    scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 350,
      onComplete: () => flash.destroy(),
    });

    await this.damageSystem.dealDamage(positions, computedDamage, 'air');
    await this.cascadeSystem.applyGravityAndSpawn();

    const matches = this.ctx.findMatches();
    if (matches.length > 0) {
      await this.cascadeSystem.processCascade(matches, 1);
    }
  }
}
