import { GAME_CONFIG } from '../../config/gameConfig.ts';
import type { GameContext } from '../../types/GameContext.ts';
import type { CascadeSystem } from '../CascadeSystem.ts';
import type { DamageSystem } from '../DamageSystem.ts';
import type { PassiveManager } from '../PassiveManager.ts';

export class WaterPowerExecutor {
  private ctx: GameContext;
  private cascadeSystem: CascadeSystem;
  private passiveManager: PassiveManager;

  constructor(ctx: GameContext, cascadeSystem: CascadeSystem, _damageSystem: DamageSystem, passiveManager: PassiveManager) {
    this.ctx = ctx;
    this.cascadeSystem = cascadeSystem;
    this.passiveManager = passiveManager;
  }

  /**
   * Ice Lance: pick a random living enemy and deal damage to every tile they occupy.
   * Big enemies take proportionally more damage (tile count × damage).
   * Non-targeted — the randomness is the cost.
   */
  async executeIceLance(computedDamage: number): Promise<void> {
    const enemies = this.ctx.enemyManager.getEnemies().filter(e => e.hp > 0);
    if (enemies.length === 0) return;

    const target = enemies[Math.floor(Math.random() * enemies.length)];
    const tileCount = target.widthInCells * target.heightInCells;
    const totalDamage = computedDamage * tileCount;

    this.passiveManager.onDamageDealt('ice', totalDamage, 'icelance');

    // Visual: ice spike flash over every tile the enemy occupies
    const scene = this.ctx.phaserScene;
    const iceColor = GAME_CONFIG.gemTypes.find(g => g.name === 'ice')?.color ?? 0x88ddff;
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    const gfx = scene.add.graphics();
    gfx.setDepth(8);

    for (let r = target.gridRow; r < target.gridRow + target.heightInCells; r++) {
      for (let c = target.gridCol; c < target.gridCol + target.widthInCells; c++) {
        const cx = GAME_CONFIG.gridOffsetX + c * cellSize + GAME_CONFIG.gemSize / 2;
        const cy = GAME_CONFIG.gridOffsetY + r * cellSize + GAME_CONFIG.gemSize / 2;
        // Outer cold flash
        gfx.fillStyle(iceColor, 0.55);
        gfx.fillCircle(cx, cy, GAME_CONFIG.gemSize / 2 + 6);
        // White core
        gfx.fillStyle(0xffffff, 0.35);
        gfx.fillCircle(cx, cy, GAME_CONFIG.gemSize / 4);
      }
    }

    scene.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => gfx.destroy(),
    });

    await this.ctx.enemyManager.damageEnemy(target, totalDamage, 'ice');

    // Refill board if any gems were not involved (enemy tiles clear on death, may expose gaps)
    await this.cascadeSystem.applyGravityAndSpawn();

    const matches = this.ctx.findMatches();
    if (matches.length > 0) {
      await this.cascadeSystem.processCascade(matches, 1);
    }
  }
}
