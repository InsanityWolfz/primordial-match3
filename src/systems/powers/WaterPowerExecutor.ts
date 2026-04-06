import { GAME_CONFIG } from '../../config/gameConfig.ts';
import type { GameContext } from '../../types/GameContext.ts';
import type { CascadeSystem } from '../CascadeSystem.ts';
import type { DamageSystem } from '../DamageSystem.ts';
import type { PassiveManager } from '../PassiveManager.ts';
import { getPowerUpDef } from '../../config/powerUps.ts';

export class WaterPowerExecutor {
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
   * Water Gun: hit random gems for damage.
   * Non-targeted active power.
   */
  async executeWaterGun(level: number, computedDamage: number): Promise<void> {
    const params = this.getParams('watergun', level);
    const targetCount = params.targetCount ?? 9;
    const damage = computedDamage;

    this.passiveManager.onDamageDealt('water', damage, 'watergun');

    const available: { row: number; col: number }[] = [];
    for (let r = 0; r < this.ctx.grid.rows; r++) {
      for (let c = 0; c < this.ctx.grid.cols; c++) {
        if (this.ctx.grid.getGem(r, c) || this.ctx.grid.isEnemyTile(r, c)) available.push({ row: r, col: c });
      }
    }

    // Shuffle and pick targets
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }

    const targets = available.slice(0, Math.min(targetCount, available.length));
    if (targets.length === 0) return;

    // Water splash visual
    const scene = this.ctx.phaserScene;
    const splash = scene.add.graphics();
    const waterColor = GAME_CONFIG.gemTypes.find(g => g.name === 'water')?.color ?? 0x4488ff;
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    for (const pos of targets) {
      const cx = GAME_CONFIG.gridOffsetX + pos.col * cellSize + GAME_CONFIG.gemSize / 2;
      const cy = GAME_CONFIG.gridOffsetY + pos.row * cellSize + GAME_CONFIG.gemSize / 2;
      splash.fillStyle(waterColor, 0.4);
      splash.fillCircle(cx, cy, GAME_CONFIG.gemSize / 2 + 4);
    }
    scene.tweens.add({
      targets: splash,
      alpha: 0,
      duration: 400,
      onComplete: () => splash.destroy(),
    });

    await this.damageSystem.dealDamage(targets, damage, 'water');

    // Refill board after destroying gems
    await this.cascadeSystem.applyGravityAndSpawn();

    const matches = this.ctx.findMatches();
    if (matches.length > 0) {
      await this.cascadeSystem.processCascade(matches, 1);
    }

  }

  /**
   * Splash: passive power that triggers after every match.
   * Hits random gems for damage.
   */
  async executeSplashPassive(): Promise<boolean> {
    const splashOwned = this.ctx.ownedPowerUps.find(p => p.powerUpId === 'splash');
    if (!splashOwned) return false;

    const params = this.getParams('splash', splashOwned.level);
    const count = params.targetCount ?? 1;
    const damage = params.damage ?? 1;

    const available: { row: number; col: number }[] = [];
    for (let r = 0; r < this.ctx.grid.rows; r++) {
      for (let c = 0; c < this.ctx.grid.cols; c++) {
        if (this.ctx.grid.getGem(r, c) || this.ctx.grid.isEnemyTile(r, c)) available.push({ row: r, col: c });
      }
    }

    // Shuffle and pick
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }

    const targets = available.slice(0, Math.min(count, available.length));
    if (targets.length === 0) return false;

    // Water splash visual
    const scene = this.ctx.phaserScene;
    const splash = scene.add.graphics();
    const waterColor = GAME_CONFIG.gemTypes.find(g => g.name === 'water')?.color ?? 0x4488ff;
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    for (const pos of targets) {
      const cx = GAME_CONFIG.gridOffsetX + pos.col * cellSize + GAME_CONFIG.gemSize / 2;
      const cy = GAME_CONFIG.gridOffsetY + pos.row * cellSize + GAME_CONFIG.gemSize / 2;
      splash.fillStyle(waterColor, 0.4);
      splash.fillCircle(cx, cy, GAME_CONFIG.gemSize / 2 + 4);
    }
    scene.tweens.add({
      targets: splash,
      alpha: 0,
      duration: 300,
      onComplete: () => splash.destroy(),
    });

    await this.damageSystem.dealDamage(targets, damage, 'water');

    return true;
  }
}
