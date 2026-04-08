import { GAME_CONFIG } from '../../config/gameConfig.ts';
import type { GameContext } from '../../types/GameContext.ts';
import type { CascadeSystem } from '../CascadeSystem.ts';
import type { DamageSystem } from '../DamageSystem.ts';
import type { PassiveManager } from '../PassiveManager.ts';
import type { Enemy } from '../../entities/Enemy.ts';

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

  private has(id: string): boolean {
    return this.ctx.ownedModifiers.includes(id);
  }

  /**
   * Ice Lance: deal damage to a random living enemy.
   * Modifiers:
   *   Glacial Wrath  — mult boosted by hazard count in PowerUpExecutor.consumePower
   *   Heavy Impact   — ×2 damage if target occupies 4+ tiles
   *   Cold Front     — hit 2 random enemies if 3+ alive
   *   Blizzard       — hit ALL enemies at 40% damage
   *   Avalanche      — always target largest enemy
   *   Frostbite      — apply Chill (+1 intent delay)
   *   Hypothermia    — Chill lasts 2 turns instead of 1
   *   Absolute Zero  — if consumedMult ≥ 6, Freeze (+5 intent delay) instead of Chill
   *   Cryo-Lock      — chilled enemies take 25% more damage
   *   Double Tap     — fire again at 30% (PassiveManager, once per round)
   *
   * consumedMult: the multiplierPool value before consumePower reset it (for Absolute Zero).
   */
  async executeIceLance(computedDamage: number, consumedMult: number = 0): Promise<void> {
    const enemies = this.ctx.enemyManager.getEnemies().filter(e => e.hp > 0);
    if (enemies.length === 0) return;

    const { modifiedDamage } = this.passiveManager.onDamageDealt('ice', computedDamage, 'icelance');
    const damage = modifiedDamage;

    const { doubleTap } = this.passiveManager.onPowerFired('icelance');

    if (this.has('ice_blizzard')) {
      await this.executeBlizzard(enemies, damage, consumedMult);
    } else {
      const targets = this.selectTargets(enemies);
      for (const target of targets) {
        await this.hitTarget(target, damage, consumedMult);
      }
    }

    await this.cascadeSystem.applyGravityAndSpawn();
    const matches = this.ctx.findMatches();
    if (matches.length > 0) {
      await this.cascadeSystem.processCascade(matches, 1);
    }

    if (doubleTap) {
      const tapDmg = Math.max(1, Math.floor(computedDamage * 0.3));
      await this.executeIceLance(tapDmg, 0);
    }
  }

  private async executeBlizzard(enemies: Enemy[], damage: number, consumedMult: number): Promise<void> {
    const blizzardDmg = Math.max(1, Math.floor(damage * 0.4));
    for (const enemy of enemies) {
      this.drawIceLanceVisual(enemy);
      const positions: { row: number; col: number }[] = [];
      for (let r = enemy.gridRow; r < enemy.gridRow + enemy.heightInCells; r++) {
        for (let c = enemy.gridCol; c < enemy.gridCol + enemy.widthInCells; c++) {
          positions.push({ row: r, col: c });
        }
      }
      await this.damageSystem.dealDamage(positions, blizzardDmg, 'ice');
      if (enemy.hp > 0) this.applyChill(enemy, consumedMult);
    }
  }

  private async hitTarget(target: Enemy, baseDamage: number, consumedMult: number): Promise<void> {
    let dmg = baseDamage;

    // Heavy Impact: ×2 if 4+ tiles
    if (this.has('ice_heavy_impact') && target.widthInCells * target.heightInCells >= 4) {
      dmg = Math.floor(dmg * 2);
    }
    // Cryo-Lock: +25% to chilled enemies
    if (this.has('ice_cryo_lock') && target.chillTurns > 0) {
      dmg = Math.floor(dmg * 1.25);
    }

    const tileCount = target.widthInCells * target.heightInCells;
    this.drawIceLanceVisual(target);
    await this.ctx.enemyManager.damageEnemy(target, dmg * tileCount, 'ice');
    if (target.hp > 0) this.applyChill(target, consumedMult);
  }

  private selectTargets(enemies: Enemy[]): Enemy[] {
    if (this.has('ice_cold_front') && enemies.length >= 3) {
      const shuffled = [...enemies].sort(() => Math.random() - 0.5);
      return [shuffled[0], shuffled[1]];
    }
    if (this.has('ice_avalanche')) {
      return [enemies.reduce((a, b) =>
        a.widthInCells * a.heightInCells >= b.widthInCells * b.heightInCells ? a : b,
      )];
    }
    return [enemies[Math.floor(Math.random() * enemies.length)]];
  }

  private applyChill(enemy: Enemy, consumedMult: number): void {
    const hasChill = this.has('ice_frostbite') || this.has('ice_hypothermia');
    const hasFreeze = this.has('ice_absolute_zero');
    if (!hasChill && !hasFreeze) return;

    if (hasFreeze && consumedMult >= 6) {
      // Absolute Zero: Freeze — delay intents 5 turns, set freezeTurns
      enemy.freezeTurns = Math.max(enemy.freezeTurns, 5);
      enemy.delayIntents(5);
    } else if (hasChill) {
      const duration = this.has('ice_hypothermia') ? 2 : 1;
      enemy.chillTurns = Math.max(enemy.chillTurns, duration);
      enemy.delayIntents(duration);
    }
  }

  private drawIceLanceVisual(target: Enemy): void {
    const scene = this.ctx.phaserScene;
    const iceColor = GAME_CONFIG.gemTypes.find(g => g.name === 'ice')?.color ?? 0x88ddff;
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    const gfx = scene.add.graphics();
    gfx.setDepth(8);
    for (let r = target.gridRow; r < target.gridRow + target.heightInCells; r++) {
      for (let c = target.gridCol; c < target.gridCol + target.widthInCells; c++) {
        const cx = GAME_CONFIG.gridOffsetX + c * cellSize + GAME_CONFIG.gemSize / 2;
        const cy = GAME_CONFIG.gridOffsetY + r * cellSize + GAME_CONFIG.gemSize / 2;
        gfx.fillStyle(iceColor, 0.55);
        gfx.fillCircle(cx, cy, GAME_CONFIG.gemSize / 2 + 6);
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
  }
}
