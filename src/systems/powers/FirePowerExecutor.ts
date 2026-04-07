import { GAME_CONFIG } from '../../config/gameConfig.ts';
import type { GameContext } from '../../types/GameContext.ts';
import type { CascadeSystem } from '../CascadeSystem.ts';
import type { DamageSystem } from '../DamageSystem.ts';
import type { PassiveManager } from '../PassiveManager.ts';
import { getPowerUpDef } from '../../config/powerUps.ts';

export class FirePowerExecutor {
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
   * Fireball: area blast around target tile.
   * Radius comes from the power's flat params.
   */
  async executeFireball(targetRow: number, targetCol: number, computedDamage: number): Promise<void> {
    const params = getPowerUpDef('fireball')?.params ?? {};
    const r = params.radius ?? 2;

    this.passiveManager.onDamageDealt('fire', computedDamage, 'fireball');

    const positions: { row: number; col: number }[] = [];
    for (let dr = -r; dr <= r; dr++) {
      for (let dc = -r; dc <= r; dc++) {
        const nr = targetRow + dr;
        const nc = targetCol + dc;
        if (
          this.ctx.grid.isValidPosition(nr, nc) &&
          (this.ctx.grid.getGem(nr, nc) || this.ctx.grid.isEnemyTile(nr, nc))
        ) {
          positions.push({ row: nr, col: nc });
        }
      }
    }

    // Flash effect
    const scene = this.ctx.phaserScene;
    const flash = scene.add.graphics();
    const fireColor = GAME_CONFIG.gemTypes.find(g => g.name === 'fire')?.color ?? 0xff4444;
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    const cx = GAME_CONFIG.gridOffsetX + targetCol * cellSize + GAME_CONFIG.gemSize / 2;
    const cy = GAME_CONFIG.gridOffsetY + targetRow * cellSize + GAME_CONFIG.gemSize / 2;
    flash.fillStyle(fireColor, 0.4);
    flash.fillCircle(cx, cy, (r + 0.5) * cellSize);
    scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      onComplete: () => flash.destroy(),
    });

    await this.damageSystem.dealDamage(positions, computedDamage, 'fire');
    await this.cascadeSystem.applyGravityAndSpawn();

    const matches = this.ctx.findMatches();
    if (matches.length > 0) {
      await this.cascadeSystem.processCascade(matches, 1);
    }
  }
}
