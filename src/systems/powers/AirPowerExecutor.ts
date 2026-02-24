import { GAME_CONFIG } from '../../config/gameConfig.ts';
import type { GameContext } from '../../types/GameContext.ts';
import type { CascadeSystem } from '../CascadeSystem.ts';
import type { DamageSystem } from '../DamageSystem.ts';
import type { PassiveManager } from '../PassiveManager.ts';
import { getPowerUpDef } from '../../config/powerUps.ts';

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

  private getParams(id: string, level: number): Record<string, number> {
    const def = getPowerUpDef(id);
    if (!def) return {};
    const clampedLevel = Math.min(Math.max(level, 1), def.maxLevel);
    return def.levels[clampedLevel - 1]?.params ?? {};
  }

  private pickUniqueRandom(max: number, count: number): number[] {
    const indices = Array.from({ length: max }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, count);
  }

  /**
   * Gust: clear random row(s) for damage.
   * Non-targeted active power.
   */
  async executeGust(level: number): Promise<void> {
    const params = this.getParams('gust', level);
    const rowCount = params.rowCount ?? 1;
    let damage = params.damage ?? 1;

    // Passive: crit chance + refund
    const passiveResult = this.passiveManager.onDamageDealt('air', damage, 'gust');
    damage = passiveResult.modifiedDamage;

    const positions: { row: number; col: number }[] = [];
    const posSet = new Set<string>();

    const addRow = (row: number) => {
      for (let c = 0; c < this.ctx.grid.cols; c++) {
        const key = `${row},${c}`;
        if (!posSet.has(key) && this.ctx.grid.getGem(row, c)) {
          posSet.add(key);
          positions.push({ row, col: c });
        }
      }
    };

    const rows = this.pickUniqueRandom(this.ctx.grid.rows, rowCount);
    for (const r of rows) addRow(r);

    // Flash effect
    const scene = this.ctx.phaserScene;
    const flash = scene.add.graphics();
    const airColor = GAME_CONFIG.gemTypes.find(g => g.name === 'air')?.color ?? 0xe8e8e8;
    flash.fillStyle(airColor, 0.3);
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    for (const pos of positions) {
      const px = GAME_CONFIG.gridOffsetX + pos.col * cellSize;
      const py = GAME_CONFIG.gridOffsetY + pos.row * cellSize;
      flash.fillRect(px, py, GAME_CONFIG.gemSize, GAME_CONFIG.gemSize);
    }
    scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy(),
    });

    const result = await this.damageSystem.dealDamage(positions, damage, 'air');

    this.ctx.score += result.destroyed.length * GAME_CONFIG.scorePerGem;
    this.ctx.updateScoreDisplay();

    await this.cascadeSystem.applyGravityAndSpawn();

    const matches = this.ctx.findMatches();
    if (matches.length > 0) {
      await this.cascadeSystem.processCascade(matches, 1);
    }

    // Passive: refund charge
    if (passiveResult.refundCharge) {
      const owned = this.ctx.ownedPowerUps.find(p => p.powerUpId === 'gust');
      if (owned) owned.charges++;
    }
  }

  /**
   * Windslash: passive power that triggers after match with a chance.
   * Hits a random column for damage.
   */
  async executeWindslashPassive(): Promise<void> {
    const windslashOwned = this.ctx.ownedPowerUps.find(p => p.powerUpId === 'windslash');
    if (!windslashOwned) return;

    const params = this.getParams('windslash', windslashOwned.level);
    const triggerChance = params.triggerChance ?? 10;
    const damage = params.damage ?? 1;

    // Roll for trigger
    if (Math.random() * 100 >= triggerChance) return;

    // Pick random column
    const col = Math.floor(Math.random() * this.ctx.grid.cols);
    const positions: { row: number; col: number }[] = [];
    for (let r = 0; r < this.ctx.grid.rows; r++) {
      if (this.ctx.grid.getGem(r, col)) {
        positions.push({ row: r, col });
      }
    }

    if (positions.length === 0) return;

    // Slash visual
    const scene = this.ctx.phaserScene;
    const flash = scene.add.graphics();
    const airColor = GAME_CONFIG.gemTypes.find(g => g.name === 'air')?.color ?? 0xe8e8e8;
    flash.fillStyle(airColor, 0.4);
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    for (const pos of positions) {
      const px = GAME_CONFIG.gridOffsetX + pos.col * cellSize;
      const py = GAME_CONFIG.gridOffsetY + pos.row * cellSize;
      flash.fillRect(px, py, GAME_CONFIG.gemSize, GAME_CONFIG.gemSize);
    }
    scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy(),
    });

    const result = await this.damageSystem.dealDamage(positions, damage, 'air');

    this.ctx.score += result.destroyed.length * GAME_CONFIG.scorePerGem;
    this.ctx.updateScoreDisplay();
  }
}
