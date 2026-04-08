import { GAME_CONFIG } from '../../config/gameConfig.ts';
import type { GameContext } from '../../types/GameContext.ts';
import type { CascadeSystem } from '../CascadeSystem.ts';
import type { DamageSystem } from '../DamageSystem.ts';
import type { PassiveManager } from '../PassiveManager.ts';
import { getPowerUpDef } from '../../config/powerUps.ts';
import type { Enemy } from '../../entities/Enemy.ts';

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

  private has(id: string): boolean {
    return this.ctx.ownedModifiers.includes(id);
  }

  /**
   * Fireball: area blast around target tile.
   * Modifiers: Wide Burn (+1 radius), Pyromaniac (+50% at streak 3+),
   *            Scorched Earth (Burn), Conflagration (Burn spreads in row),
   *            Backdraft (destroy hazards in blast), Nova (full board at streak 10+, once/round).
   * Flash Fire is handled in PowerUpExecutor.consumePower.
   */
  async executeFireball(targetRow: number, targetCol: number, computedDamage: number): Promise<void> {
    const params = getPowerUpDef('fireball')?.params ?? {};
    let r = params.radius ?? 2;

    // Wide Burn: +1 radius
    if (this.has('fire_wide_burn')) r += 1;

    let damage = computedDamage;

    // Pyromaniac: +50% damage at streak 3+
    if (this.has('fire_pyromaniac') && this.ctx.fireStreakCount >= 3) {
      damage = Math.floor(damage * 1.5);
    }

    // Nova: once per round, if streak 10+, hits entire board at 50%
    const isNova = this.has('fire_nova') && !this.ctx.novaFiredThisRound && this.ctx.fireStreakCount >= 10;
    if (isNova) {
      this.ctx.novaFiredThisRound = true;
      damage = Math.floor(damage * 0.5);
    }

    const { modifiedDamage } = this.passiveManager.onDamageDealt('fire', damage, 'fireball');
    damage = modifiedDamage;

    // Notify passive (momentum, chain reaction, double tap)
    const { doubleTap } = this.passiveManager.onPowerFired('fireball');

    // Collect blast positions
    const positions: { row: number; col: number }[] = [];
    if (isNova) {
      for (let nr = 0; nr < this.ctx.grid.rows; nr++) {
        for (let nc = 0; nc < this.ctx.grid.cols; nc++) {
          if (this.ctx.grid.getGem(nr, nc) || this.ctx.grid.isEnemyTile(nr, nc)) {
            positions.push({ row: nr, col: nc });
          }
        }
      }
    } else {
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
    }

    // Flash effect
    const scene = this.ctx.phaserScene;
    const flash = scene.add.graphics();
    const fireColor = GAME_CONFIG.gemTypes.find(g => g.name === 'fire')?.color ?? 0xff4444;
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    const cx = GAME_CONFIG.gridOffsetX + targetCol * cellSize + GAME_CONFIG.gemSize / 2;
    const cy = GAME_CONFIG.gridOffsetY + targetRow * cellSize + GAME_CONFIG.gemSize / 2;
    flash.fillStyle(fireColor, isNova ? 0.6 : 0.4);
    flash.fillCircle(cx, cy, isNova ? 500 : (r + 0.5) * cellSize);
    scene.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });

    await this.damageSystem.dealDamage(positions, damage, 'fire');

    // Backdraft: destroy all hazards in blast area
    if (this.has('fire_backdraft')) {
      for (const pos of positions) {
        if (this.ctx.hazardManager.hasHazard(pos.row, pos.col)) {
          await this.ctx.hazardManager.destroyHazardAt(pos.row, pos.col);
        }
      }
    }

    // Scorched Earth: apply Burn to each enemy hit
    if (this.has('fire_scorched_earth')) {
      const burnDmg = Math.max(1, Math.floor(damage * 0.2));
      const hitEnemies = this.collectHitEnemies(positions);
      for (const enemy of hitEnemies) {
        enemy.applyBurn(burnDmg, 3);
      }

      // Conflagration: spread Burn to enemies sharing a row with any burning enemy
      if (this.has('fire_conflagration') && hitEnemies.size > 0) {
        const spreadBurnDmg = Math.max(1, Math.floor(burnDmg * 0.5));
        for (const burned of hitEnemies) {
          for (const other of this.ctx.enemyManager.getEnemies()) {
            if (hitEnemies.has(other) || other.hp <= 0) continue;
            const burnedRowEnd = burned.gridRow + burned.heightInCells;
            const otherRowEnd = other.gridRow + other.heightInCells;
            if (burned.gridRow < otherRowEnd && other.gridRow < burnedRowEnd) {
              other.applyBurn(spreadBurnDmg, 3);
            }
          }
        }
      }
    }

    await this.cascadeSystem.applyGravityAndSpawn();
    const newMatches = this.ctx.findMatches();
    if (newMatches.length > 0) {
      await this.cascadeSystem.processCascade(newMatches, 1);
    }

    // Double Tap: fire again at 30% of original damage
    if (doubleTap) {
      const tapDamage = Math.max(1, Math.floor(computedDamage * 0.3));
      await this.executeFireball(targetRow, targetCol, tapDamage);
    }
  }

  private collectHitEnemies(positions: { row: number; col: number }[]): Set<Enemy> {
    const result = new Set<Enemy>();
    for (const pos of positions) {
      const enemy = this.ctx.enemyManager.getEnemyAt(pos.row, pos.col);
      if (enemy && enemy.hp > 0) result.add(enemy);
    }
    return result;
  }
}
