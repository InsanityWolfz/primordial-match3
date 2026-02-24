import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { GameContext } from '../types/GameContext.ts';
import type { DamageSystem } from './DamageSystem.ts';
import { getPowerUpDef } from '../config/powerUps.ts';

/**
 * PassiveManager handles all stat passive hooks.
 * Called by CascadeSystem, PowerUpExecutor, and GameScene at appropriate moments.
 *
 * Passive categories:
 * - Essence bonus passives (arsonist, pirate, skybound, goldDigger, photosynthesis, powerPlant)
 * - Refund passives (meteorShower, monsoon, windstorm, monolith, strikeTwice)
 * - Bonus turn passives (windWalker)
 * - Bonus damage passives (fissure, thorns)
 * - Cascade essence bonus (cascade)
 */
export class PassiveManager {
  private ctx: GameContext;
  private damageSystem!: DamageSystem;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
  }

  setDamageSystem(damageSystem: DamageSystem): void {
    this.damageSystem = damageSystem;
  }

  // ──────────────── HELPERS ────────────────

  private getPassiveParams(id: string): Record<string, number> | null {
    const owned = this.ctx.ownedPowerUps.find(p => p.powerUpId === id);
    if (!owned) return null;
    const def = getPowerUpDef(id);
    if (!def) return null;
    const level = Math.min(Math.max(owned.level, 1), def.maxLevel);
    return def.levels[level - 1]?.params ?? null;
  }

  // ──────────────── HOOKS ────────────────

  /**
   * Called when a gem is destroyed. Returns bonus essence from element-specific passives.
   * Element passives: arsonist (fire), pirate (water), skybound (air),
   *   goldDigger (earth), photosynthesis (nature), powerPlant (lightning)
   */
  onGemDestroyed(gemElement: string): { bonusEssence: number } {
    const result = { bonusEssence: 0 };

    // Map element to its essence passive id
    const essencePassiveMap: Record<string, string> = {
      fire: 'arsonist',
      water: 'pirate',
      air: 'skybound',
      earth: 'goldDigger',
      nature: 'photosynthesis',
      lightning: 'powerPlant',
    };

    const passiveId = essencePassiveMap[gemElement];
    if (passiveId) {
      const params = this.getPassiveParams(passiveId);
      if (params && params.bonusEssence) {
        result.bonusEssence += params.bonusEssence;
      }
    }

    return result;
  }

  /**
   * Called when damage is about to be dealt. Returns whether to refund a charge.
   * Refund passives give a chance to refund the active power charge.
   */
  onDamageDealt(
    damageElement: string | null,
    amount: number,
    activePowerId?: string,
  ): { modifiedDamage: number; refundCharge: boolean } {
    const modifiedDamage = amount;
    let refundCharge = false;

    if (!damageElement) return { modifiedDamage, refundCharge };

    // Refund passives: chance to refund the active power charge
    if (activePowerId) {
      const refundPassiveMap: Record<string, string> = {
        fireball: 'meteorShower',
        watergun: 'monsoon',
        gust: 'windstorm',
        earthquake: 'monolith',
        chainstrike: 'strikeTwice',
      };

      const refundId = refundPassiveMap[activePowerId];
      if (refundId) {
        const params = this.getPassiveParams(refundId);
        if (params && params.refundChance) {
          if (Math.random() * 100 < params.refundChance) {
            refundCharge = true;
          }
        }
      }
    }

    return { modifiedDamage, refundCharge };
  }

  /**
   * Called when a match is completed. Returns bonus essence.
   * Wild Growth: flat bonus essence per match.
   * Elemental Resonance (Kindling/Wellspring/etc.): exactly-3 gem matches of
   * the power's element have a chance to refund 1 charge of that element's active power.
   */
  onMatchCompleted(matchElement: string, matchLength: number): { bonusEssence: number; bonusScore: number } {
    const result = { bonusEssence: 0, bonusScore: 0 };

    // Wild Growth: flat bonus essence per match
    const wildGrowthParams = this.getPassiveParams('wildGrowth');
    if (wildGrowthParams && wildGrowthParams.bonusEssence) {
      result.bonusEssence += wildGrowthParams.bonusEssence;
    }

    // Elemental Resonance: only triggers on exactly 3-gem matches
    if (matchLength === 3 && matchElement) {
      const resonanceMap: Record<string, { passiveId: string; activePowerId: string }> = {
        fire:      { passiveId: 'kindling',    activePowerId: 'fireball'    },
        water:     { passiveId: 'wellspring',  activePowerId: 'watergun'    },
        earth:     { passiveId: 'tremorSense', activePowerId: 'earthquake'  },
        air:       { passiveId: 'updraft',     activePowerId: 'gust'        },
        lightning: { passiveId: 'chargeUp',    activePowerId: 'chainstrike' },
        nature:    { passiveId: 'overgrowth',  activePowerId: 'transmute'   },
      };

      const resonance = resonanceMap[matchElement];
      if (resonance) {
        const params = this.getPassiveParams(resonance.passiveId);
        if (params && params.triggerChance) {
          if (Math.random() * 100 < params.triggerChance) {
            const activeOwned = this.ctx.ownedPowerUps.find(p => p.powerUpId === resonance.activePowerId);
            if (activeOwned && activeOwned.charges < activeOwned.maxCharges) {
              activeOwned.charges += 1;
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Called when a turn is about to be consumed.
   * Sturdy: chance to save the turn
   * Wind Walker: chance for a bonus turn
   */
  onTurnConsumed(): { turnSaved: boolean; bonusTurn: boolean } {
    let turnSaved = false;
    let bonusTurn = false;

    // Sturdy: chance to not consume the turn
    const sturdyParams = this.getPassiveParams('sturdy');
    if (sturdyParams && sturdyParams.turnSaveChance) {
      if (Math.random() * 100 < sturdyParams.turnSaveChance) {
        turnSaved = true;
      }
    }

    // Wind Walker: chance for bonus turn (separate from save)
    const windWalkerParams = this.getPassiveParams('windWalker');
    if (windWalkerParams && windWalkerParams.bonusTurnChance) {
      if (Math.random() * 100 < windWalkerParams.bonusTurnChance) {
        bonusTurn = true;
      }
    }

    return { turnSaved, bonusTurn };
  }

  /**
   * Called when a hazard is destroyed. Triggers Combustion (fire passivePower).
   */
  async onHazardDestroyed(hazardRow: number, hazardCol: number): Promise<void> {
    const combustionOwned = this.ctx.ownedPowerUps.find(p => p.powerUpId === 'combustion');
    if (!combustionOwned || !this.damageSystem) return;

    const def = getPowerUpDef('combustion');
    if (!def) return;

    const level = Math.min(Math.max(combustionOwned.level, 1), def.maxLevel);
    const params = def.levels[level - 1]?.params;
    if (!params) return;

    const explosionCount = params.explosionCount ?? 3;
    const explosionRadius = params.explosionRadius ?? 0;
    const damage = params.damage ?? 1;

    // Pick random positions around the destroyed hazard
    const available: { row: number; col: number }[] = [];
    const range = 3; // Search within a 7x7 area centered on the hazard
    for (let dr = -range; dr <= range; dr++) {
      for (let dc = -range; dc <= range; dc++) {
        const nr = hazardRow + dr;
        const nc = hazardCol + dc;
        if (this.ctx.grid.isValidPosition(nr, nc) && this.ctx.grid.getGem(nr, nc)) {
          available.push({ row: nr, col: nc });
        }
      }
    }

    // Shuffle and pick explosion centers
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }

    const centers = available.slice(0, Math.min(explosionCount, available.length));

    // Build all positions to damage (accounting for explosion radius)
    const allPositions: { row: number; col: number }[] = [];
    const posSet = new Set<string>();
    for (const center of centers) {
      for (let dr = -explosionRadius; dr <= explosionRadius; dr++) {
        for (let dc = -explosionRadius; dc <= explosionRadius; dc++) {
          const nr = center.row + dr;
          const nc = center.col + dc;
          const key = `${nr},${nc}`;
          if (!posSet.has(key) && this.ctx.grid.isValidPosition(nr, nc) && this.ctx.grid.getGem(nr, nc)) {
            posSet.add(key);
            allPositions.push({ row: nr, col: nc });
          }
        }
      }
    }

    if (allPositions.length === 0) return;

    // Visual effect — small orange bursts
    const scene = this.ctx.phaserScene;
    const flash = scene.add.graphics();
    const fireColor = 0xff6622;
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    for (const center of centers) {
      const cx = GAME_CONFIG.gridOffsetX + center.col * cellSize + GAME_CONFIG.gemSize / 2;
      const cy = GAME_CONFIG.gridOffsetY + center.row * cellSize + GAME_CONFIG.gemSize / 2;
      flash.fillStyle(fireColor, 0.5);
      flash.fillCircle(cx, cy, (explosionRadius + 0.5) * cellSize);
    }
    scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      onComplete: () => flash.destroy(),
    });

    await this.damageSystem.dealDamage(allPositions, damage, 'fire');
  }

  /**
   * Called after an earthquake. Returns bonus turns from Tectonic Plates.
   */
  onEarthquakeUsed(): { bonusTurns: number; bonusDamage: number } {
    const result = { bonusTurns: 0, bonusDamage: 0 };

    const tectonicParams = this.getPassiveParams('tectonicPlates');
    if (tectonicParams && tectonicParams.bonusTurns) {
      result.bonusTurns += tectonicParams.bonusTurns;
    }

    return result;
  }

  /**
   * Returns bonus essence per cascade level from the Cascade passive.
   * The deeper the combo chain, the more essence you earn.
   */
  getCascadeEssenceBonus(): number {
    const cascadeParams = this.getPassiveParams('cascade');
    if (cascadeParams && cascadeParams.essencePerCascade) {
      return cascadeParams.essencePerCascade;
    }
    return 0;
  }
}
