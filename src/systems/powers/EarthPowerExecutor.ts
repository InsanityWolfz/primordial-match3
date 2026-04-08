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

  private has(id: string): boolean {
    return this.ctx.ownedModifiers.includes(id);
  }

  /**
   * Earthquake: shuffle board, deal damage to N random tiles.
   * Modifiers:
   *   Aftershock        — +5 target tiles (25 total)
   *   Rubble            — 25% chance to destroy each hazard hit
   *   Tremor            — stun all enemies hit (skip next intent tick)
   *   Fault Line        — if preFireMult ≥ 10, destroy ALL hazards before earthquake
   *   Richter Scale     — each hazard destroyed by earthquake → +5 base to Earthquake
   *   Continental Drift — hit ALL tiles on board
   *   Sinkhole          — plain gem tiles hit become stone hazards; refund ½ base+mult
   *   Patient Earth     — handled in GameScene (+2 patience per turn)
   *   Bedrock           — handled in GameScene (turn extension at 10+ mult)
   *
   * preFireBase/preFireMult: values before consumePower reset them (Sinkhole refund / Fault Line check).
   */
  async executeEarthquake(computedDamage: number, preFireBase: number = 0, preFireMult: number = 0): Promise<void> {
    const params = getPowerUpDef('earthquake')?.params ?? {};
    let targetCount = params.targetCount ?? 20;
    if (this.has('earth_aftershock')) targetCount += 5;

    this.passiveManager.onDamageDealt('earth', computedDamage, 'earthquake');

    // Fault Line: if pre-fire mult ≥ 10, destroy ALL hazards before the shake
    if (this.has('earth_fault_line') && preFireMult >= 10) {
      await this.ctx.hazardManager.destroyAllHazards();
    }

    // Release hazard-gem associations before shuffle
    this.ctx.hazardManager.releaseAllGems();

    // Collect non-enemy positions and shuffle gems
    const nonEnemyPositions: { row: number; col: number }[] = [];
    const allGems: (Gem | null)[] = [];
    for (let r = 0; r < this.ctx.grid.rows; r++) {
      for (let c = 0; c < this.ctx.grid.cols; c++) {
        if (this.ctx.grid.isEnemyTile(r, c)) continue;
        nonEnemyPositions.push({ row: r, col: c });
        allGems.push(this.ctx.grid.getGem(r, c));
      }
    }

    for (let i = allGems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allGems[i], allGems[j]] = [allGems[j], allGems[i]];
    }

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
    this.ctx.hazardManager.reassociateGems();

    if (computedDamage > 0) {
      // Build candidate positions for damage
      const allPositions: { row: number; col: number }[] = [];
      for (let r = 0; r < this.ctx.grid.rows; r++) {
        for (let c = 0; c < this.ctx.grid.cols; c++) {
          if (this.ctx.grid.getGem(r, c) || this.ctx.grid.isEnemyTile(r, c)) {
            allPositions.push({ row: r, col: c });
          }
        }
      }
      for (let i = allPositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
      }

      // Continental Drift: hit ALL positions, otherwise use targetCount
      const targets = this.has('earth_continental_drift')
        ? allPositions
        : allPositions.slice(0, targetCount);

      // Sinkhole: capture plain gem positions before damage
      const sinkholePositions = this.has('earth_sinkhole')
        ? targets.filter(p =>
            !this.ctx.grid.isEnemyTile(p.row, p.col) &&
            !this.ctx.hazardManager.hasHazard(p.row, p.col) &&
            this.ctx.grid.getGem(p.row, p.col) !== null,
          )
        : [];

      // Capture hazard positions before damage (for Rubble + Richter Scale)
      const preDamageHazards = (this.has('earth_rubble') || this.has('earth_richter_scale'))
        ? targets.filter(p => this.ctx.hazardManager.hasHazard(p.row, p.col))
        : [];

      const result = await this.damageSystem.dealDamage(targets, computedDamage, 'earth');
      let richterCount = result.hazardsDestroyed.length;

      // Rubble: 25% chance to force-destroy each remaining hazard
      if (this.has('earth_rubble')) {
        for (const pos of preDamageHazards) {
          if (this.ctx.hazardManager.hasHazard(pos.row, pos.col) && Math.random() < 0.25) {
            await this.ctx.hazardManager.destroyHazardAt(pos.row, pos.col);
            richterCount++;
          }
        }
      }

      // Richter Scale: +5 base per hazard destroyed
      if (this.has('earth_richter_scale') && richterCount > 0) {
        const eq = this.ctx.ownedPowerUps.find(p => p.powerUpId === 'earthquake');
        if (eq) eq.base += richterCount * 5;
      }

      // Tremor: stun all enemies whose tiles were hit
      if (this.has('earth_tremor')) {
        const stunned = new Set<string>();
        for (const pos of targets) {
          const enemy = this.ctx.enemyManager.getEnemyAt(pos.row, pos.col);
          if (!enemy || enemy.hp <= 0) continue;
          const key = `${enemy.gridRow},${enemy.gridCol}`;
          if (!stunned.has(key)) {
            stunned.add(key);
            enemy.stunnedTurns = Math.max(enemy.stunnedTurns, 1);
          }
        }
      }

      // Sinkhole: spawn stone hazards on surviving plain gem tiles; refund half base+mult
      if (this.has('earth_sinkhole') && sinkholePositions.length > 0) {
        for (const pos of sinkholePositions) {
          if (
            this.ctx.grid.getGem(pos.row, pos.col) &&
            !this.ctx.hazardManager.hasHazard(pos.row, pos.col)
          ) {
            this.ctx.hazardManager.spawnHazardAt(pos.row, pos.col, 'stone');
          }
        }
        const eq = this.ctx.ownedPowerUps.find(p => p.powerUpId === 'earthquake');
        if (eq) {
          eq.base += Math.floor(preFireBase / 2);
          eq.multiplierPool += Math.floor(preFireMult / 2);
        }
      }

      if (result.destroyed.length > 0) {
        await this.cascadeSystem.applyGravityAndSpawn();
      }
    }

    await this.ctx.delay(200);
    const matches = this.ctx.findMatches();
    if (matches.length > 0) {
      await this.cascadeSystem.processCascade(matches, 1);
    }
  }
}
