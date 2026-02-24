import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { GameContext } from '../types/GameContext.ts';
import type { PassiveManager } from './PassiveManager.ts';
import { getPowerUpDef } from '../config/powerUps.ts';

export interface DamageResult {
  destroyed: { row: number; col: number }[];
  damaged: { row: number; col: number; remainingHp: number }[];
  hazardsDestroyed: { row: number; col: number }[];
  essenceGained: number;
}

export class DamageSystem {
  private ctx: GameContext;
  private passiveManager!: PassiveManager;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
  }

  setPassiveManager(passiveManager: PassiveManager): void {
    this.passiveManager = passiveManager;
  }

  /**
   * Central damage pipeline. All gem destruction should flow through here.
   * Damage hits hazards first — if a hazard absorbs all damage, the gem is untouched.
   * If the hazard breaks and there's remaining damage, it passes through to the gem.
   *
   * @param positions - Grid positions to deal damage to
   * @param amount - Damage amount per position
   * @param _element - Element type of the damage source (for future use)
   * @returns DamageResult with destroyed/damaged positions and essence gained
   */
  async dealDamage(
    positions: { row: number; col: number }[],
    amount: number,
    _element: string | null,
  ): Promise<DamageResult> {
    const result: DamageResult = {
      destroyed: [],
      damaged: [],
      hazardsDestroyed: [],
      essenceGained: 0,
    };

    const toDestroy: { row: number; col: number }[] = [];
    const hazardDestroyPromises: Promise<void>[] = [];

    for (const pos of positions) {
      const gem = this.ctx.grid.getGem(pos.row, pos.col);
      if (!gem) continue;

      let remainingDamage = amount;

      // Hazard absorbs damage first
      const hazard = this.ctx.hazardManager.getHazard(pos.row, pos.col);
      if (hazard) {
        // Power-immune hazards ignore power-up damage (element !== null)
        if (hazard.def.powerImmune && _element !== null) {
          continue; // Skip this position entirely
        }

        const hazardHp = hazard.hp;
        const hazardDestroyed = hazard.takeDamage(remainingDamage);
        if (hazardDestroyed) {
          result.hazardsDestroyed.push(pos);
          // Animate and then clear from grid
          const p = pos; // capture for closure
          const destroyedDef = hazard.def; // capture def for post-destroy effects
          hazardDestroyPromises.push(
            hazard.playDestroyAnimation(GAME_CONFIG.clearDuration).then(() => {
              this.ctx.hazardManager.clearPositions([p]);
              // Energy Siphon: drain a charge from random active power
              if (destroyedDef.onDestroyDrainCharge) {
                this.drainRandomCharge();
              }
            }),
          );
          // Remaining damage passes through to gem
          remainingDamage = remainingDamage - hazardHp;
        } else {
          // Hazard survived, all damage absorbed
          remainingDamage = 0;
        }
      }

      if (remainingDamage <= 0) continue;

      const killed = gem.takeDamage(remainingDamage);
      if (killed) {
        toDestroy.push(pos);
        result.destroyed.push(pos);
        result.essenceGained++;

        // Passive: element-specific bonus essence (Arsonist, Pirate, etc.)
        if (this.passiveManager) {
          const bonusResult = this.passiveManager.onGemDestroyed(gem.type.name);
          if (bonusResult.bonusEssence > 0) {
            result.essenceGained += bonusResult.bonusEssence;
          }
        }
      } else {
        result.damaged.push({
          row: pos.row,
          col: pos.col,
          remainingHp: gem.hp,
        });
        gem.playDamageFlash();
      }
    }

    // Wait for hazard destroy animations
    if (hazardDestroyPromises.length > 0) {
      await Promise.all(hazardDestroyPromises);
    }

    // Animate destruction for killed gems
    if (toDestroy.length > 0) {
      const destroyPromises: Promise<void>[] = [];
      for (const pos of toDestroy) {
        const gem = this.ctx.grid.getGem(pos.row, pos.col);
        if (gem) {
          destroyPromises.push(gem.playDestroyAnimation(GAME_CONFIG.clearDuration));
        }
      }
      await Promise.all(destroyPromises);

      this.ctx.grid.clearPositions(toDestroy);
    }

    // Award essence
    if (result.essenceGained > 0) {
      this.ctx.essence += result.essenceGained;
      this.ctx.updateEssenceDisplay();
    }

    return result;
  }

  /**
   * Deal damage sequentially with visual delays (for chain-style effects).
   * Each gem is damaged one at a time with optional stagger.
   */
  async dealDamageSequential(
    positions: { row: number; col: number }[],
    amount: number,
    _element: string | null,
    staggerInterval: number = 50,
    staggerGroupSize: number = 3,
  ): Promise<DamageResult> {
    const result: DamageResult = {
      destroyed: [],
      damaged: [],
      hazardsDestroyed: [],
      essenceGained: 0,
    };

    const toDestroy: { row: number; col: number }[] = [];

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const gem = this.ctx.grid.getGem(pos.row, pos.col);
      if (!gem) continue;

      let remainingDamage = amount;

      // Hazard absorbs damage first
      const hazard = this.ctx.hazardManager.getHazard(pos.row, pos.col);
      if (hazard) {
        // Power-immune hazards ignore power-up damage (element !== null)
        if (hazard.def.powerImmune && _element !== null) {
          continue; // Skip this position entirely
        }

        const hazardHp = hazard.hp;
        const hazardDestroyed = hazard.takeDamage(remainingDamage);
        if (hazardDestroyed) {
          result.hazardsDestroyed.push(pos);
          const destroyedDef = hazard.def;
          await hazard.playDestroyAnimation(100);
          this.ctx.hazardManager.clearPositions([pos]);
          // Energy Siphon: drain a charge from random active power
          if (destroyedDef.onDestroyDrainCharge) {
            this.drainRandomCharge();
          }
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

          // Passive: element-specific bonus essence
          if (this.passiveManager) {
            const bonusResult = this.passiveManager.onGemDestroyed(gem.type.name);
            if (bonusResult.bonusEssence > 0) {
              result.essenceGained += bonusResult.bonusEssence;
            }
          }

          gem.playDestroyAnimation(100);
        } else {
          result.damaged.push({
            row: pos.row,
            col: pos.col,
            remainingHp: gem.hp,
          });
          gem.playDamageFlash();
        }
      }

      if (i % staggerGroupSize === 0) {
        await this.ctx.delay(staggerInterval);
      }
    }

    // Wait for final animations
    await this.ctx.delay(150);

    // Clear all destroyed positions
    if (toDestroy.length > 0) {
      this.ctx.grid.clearPositions(toDestroy);
    }

    // Award essence
    if (result.essenceGained > 0) {
      this.ctx.essence += result.essenceGained;
      this.ctx.updateEssenceDisplay();
    }

    return result;
  }

  /**
   * Energy Siphon effect: drain 1 charge from a random active power-up.
   * If no active power has charges remaining, does nothing.
   */
  private drainRandomCharge(): void {
    const activePowers = this.ctx.ownedPowerUps.filter(p => {
      const def = getPowerUpDef(p.powerUpId);
      return def?.category === 'activePower' && p.charges > 0;
    });

    if (activePowers.length === 0) return;

    const target = activePowers[Math.floor(Math.random() * activePowers.length)];
    target.charges = Math.max(0, target.charges - 1);

    // Visual feedback — brief red flash on the screen
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
