import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { GameContext } from '../types/GameContext.ts';
import type { PassiveManager } from './PassiveManager.ts';
import { getPowerUpDef } from '../config/powerUps.ts';

export interface DamageResult {
  destroyed: { row: number; col: number }[];
  damaged: { row: number; col: number; remainingHp: number }[];
  hazardsDestroyed: { row: number; col: number }[];
  enemiesKilled: number;
  essenceGained: number;
}

export class DamageSystem {
  private ctx: GameContext;
  private passiveManager!: PassiveManager;
  private onGemsDestroyedCb?: (count: number) => void;
  private onHazardsDestroyedCb?: (count: number) => void;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
  }

  setPassiveManager(passiveManager: PassiveManager): void {
    this.passiveManager = passiveManager;
  }

  /** Wire up the gem-destruction count callback (feeds per-round essence tracking). */
  setOnGemsDestroyed(cb: (count: number) => void): void {
    this.onGemsDestroyedCb = cb;
  }

  /** Wire up the hazard-destruction count callback (feeds per-round stats tracking). */
  setOnHazardsDestroyed(cb: (count: number) => void): void {
    this.onHazardsDestroyedCb = cb;
  }

  /**
   * Central damage pipeline. All gem destruction flows through here.
   *
   * For each position:
   *   1. If it's an enemy tile → deal full damage to that enemy
   *   2. Else if it has a hazard → hazard absorbs damage first
   *   3. Else if it has a gem → deal damage to the gem
   *
   * @param positions - Grid positions to deal damage to
   * @param amount    - Damage per position
   * @param element   - Element of the source (null = match damage)
   */
  async dealDamage(
    positions: { row: number; col: number }[],
    amount: number,
    element: string | null,
  ): Promise<DamageResult> {
    const result: DamageResult = {
      destroyed: [],
      damaged: [],
      hazardsDestroyed: [],
      enemiesKilled: 0,
      essenceGained: 0,
    };

    const toDestroy: { row: number; col: number }[] = [];
    const hazardDestroyPromises: Promise<void>[] = [];

    for (const pos of positions) {
      // ── Enemy tile — damage per tile hit ──
      const enemy = this.ctx.grid.getEnemyAt(pos.row, pos.col);
      if (enemy) {
        if (enemy.hp > 0) { // only damage while still alive
          const died = await this.ctx.enemyManager.damageEnemy(enemy, amount, element);
          if (died) {
            result.enemiesKilled++;
            this.ctx.updateEnemyDisplay();
          }
          // Show floating damage number above the enemy tile
          const ex = enemy.worldX + enemy.worldW / 2;
          const ey = enemy.worldY + enemy.worldH / 2;
          this.ctx.showDamageNumber(ex, ey, amount, true);
        }
        continue; // don't also process gem/hazard damage on this cell
      }

      // ── Normal gem cell ──
      const gem = this.ctx.grid.getGem(pos.row, pos.col);
      if (!gem) continue;

      let remainingDamage = amount;

      // Hazard absorbs damage first
      const hazard = this.ctx.hazardManager.getHazard(pos.row, pos.col);
      if (hazard) {
        // Power-immune hazards ignore power damage (element !== null)
        if (hazard.def.powerImmune && element !== null) {
          continue;
        }

        const hazardHp = hazard.hp;
        const hazardDestroyed = hazard.takeDamage(remainingDamage);
        if (hazardDestroyed) {
          result.hazardsDestroyed.push(pos);
          const p = pos;
          const destroyedDef = hazard.def;
          hazardDestroyPromises.push(
            hazard.playDestroyAnimation(GAME_CONFIG.clearDuration).then(() => {
              this.ctx.hazardManager.clearPositions([p]);
              if (destroyedDef.onDestroyDrainCharge) {
                this.drainRandomCharge();
              }
            }),
          );
          remainingDamage = remainingDamage - hazardHp;
        } else {
          remainingDamage = 0;
        }
      }

      if (remainingDamage <= 0) continue;

      const killed = gem.takeDamage(remainingDamage);
      if (killed) {
        toDestroy.push(pos);
        result.destroyed.push(pos);
        result.essenceGained++;

        if (this.passiveManager) {
          const bonusResult = this.passiveManager.onGemDestroyed(gem.type.name);
          if (bonusResult.bonusEssence > 0) {
            result.essenceGained += bonusResult.bonusEssence;
          }
        }
      } else {
        result.damaged.push({ row: pos.row, col: pos.col, remainingHp: gem.hp });
        gem.playDamageFlash();
      }
    }

    if (hazardDestroyPromises.length > 0) {
      await Promise.all(hazardDestroyPromises);
      if (result.hazardsDestroyed.length > 0) {
        this.onHazardsDestroyedCb?.(result.hazardsDestroyed.length);
      }
    }

    if (toDestroy.length > 0) {
      const destroyPromises: Promise<void>[] = [];
      for (const pos of toDestroy) {
        const gem = this.ctx.grid.getGem(pos.row, pos.col);
        if (gem) destroyPromises.push(gem.playDestroyAnimation(GAME_CONFIG.clearDuration));
      }
      await Promise.all(destroyPromises);
      this.ctx.grid.clearPositions(toDestroy);
      this.onGemsDestroyedCb?.(result.essenceGained);
    }

    return result;
  }

  /**
   * Deal damage sequentially with visual stagger (for chain-style effects).
   */
  async dealDamageSequential(
    positions: { row: number; col: number }[],
    amount: number,
    element: string | null,
    staggerInterval: number = 50,
    staggerGroupSize: number = 3,
  ): Promise<DamageResult> {
    const result: DamageResult = {
      destroyed: [],
      damaged: [],
      hazardsDestroyed: [],
      enemiesKilled: 0,
      essenceGained: 0,
    };

    const toDestroy: { row: number; col: number }[] = [];

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];

      // ── Enemy tile — damage per tile hit ──
      const enemy = this.ctx.grid.getEnemyAt(pos.row, pos.col);
      if (enemy) {
        if (enemy.hp > 0) {
          const died = await this.ctx.enemyManager.damageEnemy(enemy, amount, element);
          if (died) {
            result.enemiesKilled++;
            this.ctx.updateEnemyDisplay();
          }
        }
        continue;
      }

      // ── Normal gem cell ──
      const gem = this.ctx.grid.getGem(pos.row, pos.col);
      if (!gem) continue;

      let remainingDamage = amount;

      const hazard = this.ctx.hazardManager.getHazard(pos.row, pos.col);
      if (hazard) {
        if (hazard.def.powerImmune && element !== null) continue;

        const hazardHp = hazard.hp;
        const hazardDestroyed = hazard.takeDamage(remainingDamage);
        if (hazardDestroyed) {
          result.hazardsDestroyed.push(pos);
          const destroyedDef = hazard.def;
          await hazard.playDestroyAnimation(100);
          this.ctx.hazardManager.clearPositions([pos]);
          if (destroyedDef.onDestroyDrainCharge) this.drainRandomCharge();
          remainingDamage = remainingDamage - hazardHp;
        } else {
          remainingDamage = 0;
        }
      }

      if (remainingDamage > 0) {
        const killed = gem.takeDamage(remainingDamage);
        if (killed) {
          toDestroy.push(pos);
          result.destroyed.push(pos);
          result.essenceGained++;

          if (this.passiveManager) {
            const bonusResult = this.passiveManager.onGemDestroyed(gem.type.name);
            if (bonusResult.bonusEssence > 0) result.essenceGained += bonusResult.bonusEssence;
          }
          gem.playDestroyAnimation(100);
        } else {
          result.damaged.push({ row: pos.row, col: pos.col, remainingHp: gem.hp });
          gem.playDamageFlash();
        }
      }

      if (i % staggerGroupSize === 0) {
        await this.ctx.delay(staggerInterval);
      }
    }

    await this.ctx.delay(150);

    if (result.hazardsDestroyed.length > 0) {
      this.onHazardsDestroyedCb?.(result.hazardsDestroyed.length);
    }

    if (toDestroy.length > 0) {
      this.ctx.grid.clearPositions(toDestroy);
      this.onGemsDestroyedCb?.(result.essenceGained);
    }

    return result;
  }

  /**
   * Energy Siphon: drain 1 charge from a random active power-up.
   */
  private drainRandomCharge(): void {
    const activePowers = this.ctx.ownedPowerUps.filter(p => {
      const def = getPowerUpDef(p.powerUpId);
      return def?.category === 'activePower' && p.charges > 0;
    });

    if (activePowers.length === 0) return;

    const target = activePowers[Math.floor(Math.random() * activePowers.length)];
    target.charges = Math.max(0, target.charges - 1);

    const flash = this.ctx.phaserScene.add.graphics();
    flash.fillStyle(0xcc3366, 0.15);
    flash.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
    flash.setDepth(100);
    this.ctx.phaserScene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      onComplete: () => flash.destroy(),
    });
  }
}
