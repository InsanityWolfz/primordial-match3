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

  private getParams(id: string, level: number): Record<string, number> {
    const def = getPowerUpDef(id);
    if (!def) return {};
    const clampedLevel = Math.min(Math.max(level, 1), def.maxLevel);
    return def.levels[clampedLevel - 1]?.params ?? {};
  }

  /**
   * Fireball: area blast around target.
   * Radius and damage scale with level from config.
   */
  async executeFireball(level: number, targetRow: number, targetCol: number): Promise<void> {
    const params = this.getParams('fireball', level);
    const r = params.radius ?? 1;
    let damage = params.damage ?? 1;

    // Passive: crit chance + refund
    const passiveResult = this.passiveManager.onDamageDealt('fire', damage, 'fireball');
    damage = passiveResult.modifiedDamage;

    const positions: { row: number; col: number }[] = [];
    for (let dr = -r; dr <= r; dr++) {
      for (let dc = -r; dc <= r; dc++) {
        const nr = targetRow + dr;
        const nc = targetCol + dc;
        if (this.ctx.grid.isValidPosition(nr, nc) && this.ctx.grid.getGem(nr, nc)) {
          positions.push({ row: nr, col: nc });
        }
      }
    }

    // Flash effect
    const scene = this.ctx.phaserScene;
    const flash = scene.add.graphics();
    const gemType = GAME_CONFIG.gemTypes.find(g => g.name === 'fire');
    const flashColor = gemType ? gemType.color : 0xff4444;
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    const cx = GAME_CONFIG.gridOffsetX + targetCol * cellSize + GAME_CONFIG.gemSize / 2;
    const cy = GAME_CONFIG.gridOffsetY + targetRow * cellSize + GAME_CONFIG.gemSize / 2;
    flash.fillStyle(flashColor, 0.4);
    flash.fillCircle(cx, cy, (r + 0.5) * cellSize);
    scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      onComplete: () => flash.destroy(),
    });

    const result = await this.damageSystem.dealDamage(positions, damage, 'fire');

    this.ctx.score += result.destroyed.length * GAME_CONFIG.scorePerGem;
    this.ctx.updateScoreDisplay();

    await this.cascadeSystem.applyGravityAndSpawn();

    const matches = this.ctx.findMatches();
    if (matches.length > 0) {
      await this.cascadeSystem.processCascade(matches, 1);
    }

    // Passive: refund charge
    if (passiveResult.refundCharge) {
      const owned = this.ctx.ownedPowerUps.find(p => p.powerUpId === 'fireball');
      if (owned) owned.charges++;
    }
  }
}
