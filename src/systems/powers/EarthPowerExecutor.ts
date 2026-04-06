import { Gem } from '../../entities/Gem.ts';
import type { GameContext } from '../../types/GameContext.ts';
import type { CascadeSystem } from '../CascadeSystem.ts';
import type { DamageSystem } from '../DamageSystem.ts';
import type { PassiveManager } from '../PassiveManager.ts';
import { getPowerUpDef } from '../../config/powerUps.ts';

export class EarthPowerExecutor {
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
   * Earthquake: shuffle all gems + deal damage to N random gems (targetCount).
   * Passive bonuses: Tectonic Plates (bonus turns), Fissure (bonus damage).
   */
  async executeEarthquake(level: number, computedDamage: number): Promise<void> {
    const params = this.getParams('earthquake', level);
    const targetCount = params.targetCount ?? 12;
    let damage = computedDamage;

    this.passiveManager.onDamageDealt('earth', damage, 'earthquake');

    // Passive: earthquake bonuses
    const eqPassive = this.passiveManager.onEarthquakeUsed();
    damage += eqPassive.bonusDamage;

    // Release hazard-gem associations before shuffle so gems restore full alpha
    this.ctx.hazardManager.releaseAllGems();

    // Collect all non-enemy positions and the gems on them
    const nonEnemyPositions: { row: number; col: number }[] = [];
    const allGems: (Gem | null)[] = [];
    for (let r = 0; r < this.ctx.grid.rows; r++) {
      for (let c = 0; c < this.ctx.grid.cols; c++) {
        if (this.ctx.grid.isEnemyTile(r, c)) continue;
        nonEnemyPositions.push({ row: r, col: c });
        allGems.push(this.ctx.grid.getGem(r, c));
      }
    }

    // Fisher-Yates shuffle on the gems array
    for (let i = allGems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allGems[i], allGems[j]] = [allGems[j], allGems[i]];
    }

    // Reassign gems back to the same non-enemy positions
    const movePromises: Promise<void>[] = [];
    for (let i = 0; i < nonEnemyPositions.length; i++) {
      const { row: r, col: c } = nonEnemyPositions[i];
      const gem = allGems[i];
      this.ctx.grid.setGem(r, c, gem);
      if (gem) {
        gem.setGridPosition(r, c);
        const pos = gem.getWorldPosition();
        movePromises.push(gem.moveTo(pos.x, pos.y, 400));
      }
    }
    await Promise.all(movePromises);

    // Re-associate hazards with the gems now at their positions
    this.ctx.hazardManager.reassociateGems();

    // Deal damage to targetCount random gems (not the whole board)
    if (damage > 0) {
      // Build list of all occupied positions and pick N at random
      const allPositions: { row: number; col: number }[] = [];
      for (let r = 0; r < this.ctx.grid.rows; r++) {
        for (let c = 0; c < this.ctx.grid.cols; c++) {
          if (this.ctx.grid.getGem(r, c) || this.ctx.grid.isEnemyTile(r, c)) {
            allPositions.push({ row: r, col: c });
          }
        }
      }

      // Fisher-Yates on positions, then take the first targetCount
      for (let i = allPositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
      }
      const targets = allPositions.slice(0, targetCount);

      const result = await this.damageSystem.dealDamage(targets, damage, 'earth');

      if (result.destroyed.length > 0) {
        await this.cascadeSystem.applyGravityAndSpawn();
      }
    }

    // Process any matches created by the shuffle
    await this.ctx.delay(200);
    const matches = this.ctx.findMatches();
    if (matches.length > 0) {
      await this.cascadeSystem.processCascade(matches, 1);
    }

    // Passive: Tectonic Plates bonus turns
    if (eqPassive.bonusTurns > 0) {
      this.ctx.turnsRemaining += eqPassive.bonusTurns;
      this.ctx.updateTurnsDisplay();
    }

  }
}
