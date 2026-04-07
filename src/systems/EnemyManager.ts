import type Phaser from 'phaser';
import { Enemy } from '../entities/Enemy.ts';
import { getEnemiesForRound, ENEMY_SCALE_START_ROUND } from '../config/enemyConfig.ts';
import type { EnemyTypeDef, IntentDef } from '../config/enemyTypes.ts';
import type { Grid } from '../entities/Grid.ts';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import { rollTrait } from '../config/enemyTraits.ts';

export interface FiredIntent {
  enemy: Enemy;
  intent: IntentDef;
}

export class EnemyManager {
  private scene: Phaser.Scene;
  private grid: Grid;
  private enemies: Enemy[] = [];
  private onEnemyDiedCb?: () => void;
  private currentRound = 1;

  constructor(scene: Phaser.Scene, grid: Grid) {
    this.scene = scene;
    this.grid = grid;
  }

  setOnEnemyDied(cb: () => void): void {
    this.onEnemyDiedCb = cb;
  }

  // ─── Queries ───

  getEnemyAt(row: number, col: number): Enemy | null {
    return this.grid.getEnemyAt(row, col);
  }

  allEnemiesDead(): boolean {
    return this.enemies.length === 0;
  }

  getRemainingCount(): number {
    return this.enemies.length;
  }

  getEnemies(): Enemy[] {
    return this.enemies;
  }

  /**
   * Returns a random living enemy whose grid bounds are adjacent (touching)
   * to the source enemy. Returns null if none exists.
   */
  getAdjacentEnemy(source: Enemy): Enemy | null {
    const candidates: Enemy[] = [];
    for (const enemy of this.enemies) {
      if (enemy === source || enemy.hp <= 0) continue;
      const srcR2 = source.gridRow + source.heightInCells;
      const srcC2 = source.gridCol + source.widthInCells;
      const envR2 = enemy.gridRow + enemy.heightInCells;
      const envC2 = enemy.gridCol + enemy.widthInCells;
      // Overlap on one axis, adjacent (touching) on the other
      const hOverlap = source.gridRow < envR2 && enemy.gridRow < srcR2;
      const vOverlap = source.gridCol < envC2 && enemy.gridCol < srcC2;
      const hTouching = srcC2 === enemy.gridCol || envC2 === source.gridCol;
      const vTouching = srcR2 === enemy.gridRow || envR2 === source.gridRow;
      if ((hTouching && hOverlap) || (vTouching && vOverlap)) {
        candidates.push(enemy);
      }
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // ─── Placement ───

  placeEnemies(round: number): void {
    this.currentRound = round;
    const defs = getEnemiesForRound(round);

    const shuffled = [...defs].sort(() => Math.random() - 0.5);

    for (const def of shuffled) {
      const placed = this.tryPlaceEnemy(def, round);
      if (!placed) {
        console.warn(`[EnemyManager] Could not place ${def.type} (board full)`);
      }
    }
  }

  private tryPlaceEnemy(typeDef: EnemyTypeDef, round?: number): boolean {
    const { widthInCells: w, heightInCells: h } = typeDef;
    const candidates: { row: number; col: number }[] = [];

    for (let row = 0; row <= GAME_CONFIG.gridRows - h; row++) {
      for (let col = 0; col <= GAME_CONFIG.gridCols - w; col++) {
        if (this.canPlaceAt(row, col, w, h)) {
          candidates.push({ row, col });
        }
      }
    }

    if (candidates.length === 0) return false;

    const effectiveRound = round ?? this.currentRound;

    const perRoundBase = Math.pow(1.15, effectiveRound - 1);
    const hpMultiplier = effectiveRound > ENEMY_SCALE_START_ROUND
      ? perRoundBase * Math.pow(1.5, effectiveRound - ENEMY_SCALE_START_ROUND)
      : perRoundBase;

    const pos = candidates[Math.floor(Math.random() * candidates.length)];
    const enemy = new Enemy(this.scene, pos.row, pos.col, typeDef, hpMultiplier);

    const trait = rollTrait(effectiveRound);
    if (trait) {
      let wardedElement: string | undefined;
      if (trait === 'warded') {
        const elements = GAME_CONFIG.gemTypes.map(g => g.name);
        wardedElement = elements[Math.floor(Math.random() * elements.length)];
      }
      enemy.setTrait(trait, wardedElement);
    }

    this.grid.placeEnemy(enemy);

    for (let r = pos.row; r < pos.row + h; r++) {
      for (let c = pos.col; c < pos.col + w; c++) {
        const gem = this.grid.getGem(r, c);
        if (gem) {
          gem.sprite.destroy();
          this.grid.setGem(r, c, null);
        }
      }
    }

    this.enemies.push(enemy);
    return true;
  }

  addExtraEnemies(count: number, round: number): void {
    const defs = getEnemiesForRound(round);
    if (defs.length === 0) return;
    for (let i = 0; i < count; i++) {
      const def = defs[Math.floor(Math.random() * defs.length)];
      this.tryPlaceEnemy(def, round);
    }
  }

  private canPlaceAt(row: number, col: number, w: number, h: number): boolean {
    for (let r = row; r < row + h; r++) {
      for (let c = col; c < col + w; c++) {
        if (this.grid.isEnemyTile(r, c)) return false;
      }
    }
    return true;
  }

  // ─── Damage ───

  async damageEnemy(enemy: Enemy, amount: number, element?: string | null): Promise<boolean> {
    const died = enemy.takeDamage(amount, element);

    if (died) {
      await this.removeEnemy(enemy);
      this.onEnemyDiedCb?.();
      return true;
    }

    return false;
  }

  private async removeEnemy(enemy: Enemy): Promise<void> {
    this.grid.clearEnemyTiles(enemy);
    await enemy.playDeathAnimation(this.scene);
    enemy.destroy();
    const idx = this.enemies.indexOf(enemy);
    if (idx >= 0) this.enemies.splice(idx, 1);
  }

  async damageEnemiesAtPositions(
    positions: { row: number; col: number }[],
    amount: number,
    element?: string | null,
  ): Promise<{ enemy: Enemy; died: boolean }[]> {
    const hitEnemies = new Map<Enemy, number>();

    for (const pos of positions) {
      const enemy = this.getEnemyAt(pos.row, pos.col);
      if (enemy) {
        hitEnemies.set(enemy, (hitEnemies.get(enemy) ?? 0) + 1);
      }
    }

    const results: { enemy: Enemy; died: boolean }[] = [];

    for (const [enemy] of hitEnemies) {
      const died = await this.damageEnemy(enemy, amount, element);
      results.push({ enemy, died });
    }

    return results;
  }

  // ─── Turn Processing ───

  /**
   * Called at end of each player turn.
   * Handles trait regen, then ticks all enemy intents.
   * Returns the list of intents that fired this turn.
   */
  processTurnEnd(): FiredIntent[] {
    const fired: FiredIntent[] = [];

    for (const enemy of this.enemies) {
      // Trait: regenerating heals 1 HP per turn
      if (enemy.trait === 'regenerating' && enemy.hp > 0) {
        enemy.heal(1);
      }

      // Intent ticking
      const firedIntents = enemy.tickIntents();
      for (const intent of firedIntents) {
        fired.push({ enemy, intent });
      }
    }

    return fired;
  }

  // ─── Cleanup ───

  destroyAll(): void {
    for (const enemy of this.enemies) {
      this.grid.clearEnemyTiles(enemy);
      enemy.destroy();
    }
    this.enemies = [];
  }

  drawDebugInfo(): void {
    for (const enemy of this.enemies) {
      const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
      const cx = GAME_CONFIG.gridOffsetX + (enemy.gridCol + enemy.widthInCells / 2) * cellSize;
      const cy = GAME_CONFIG.gridOffsetY + (enemy.gridRow + enemy.heightInCells / 2) * cellSize;
      this.scene.add.text(cx, cy, `${enemy.hp}/${enemy.maxHp}`, {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5, 0.5).setDepth(7);
    }
  }
}
