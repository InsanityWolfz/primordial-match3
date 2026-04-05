import type Phaser from 'phaser';
import { Enemy } from '../entities/Enemy.ts';
import { getEnemiesForRound, ENEMY_COLORS, ENEMY_SCALE_START_ROUND } from '../config/enemyConfig.ts';
import type { Grid } from '../entities/Grid.ts';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import { rollTrait } from '../config/enemyTraits.ts';

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

  /** Wire up callback for when any enemy dies (used to check win condition). */
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

  // ─── Placement ───

  /**
   * Place enemies for the current round onto the board.
   * Must be called AFTER clearInitialMatches so the gem grid is stable.
   */
  placeEnemies(round: number): void {
    this.currentRound = round;
    const defs = getEnemiesForRound(round);

    // Shuffle defs so placement order varies
    const shuffled = [...defs].sort(() => Math.random() - 0.5);

    for (let i = 0; i < shuffled.length; i++) {
      const def = shuffled[i];
      const color = ENEMY_COLORS[i % ENEMY_COLORS.length];
      const placed = this.tryPlaceEnemy(def.widthInCells, def.heightInCells, color, round);
      if (!placed) {
        // Board too full — skip this enemy rather than crash
        console.warn(`[EnemyManager] Could not place ${def.widthInCells}x${def.heightInCells} enemy (board full)`);
      }
    }
  }

  private tryPlaceEnemy(w: number, h: number, color: number, round?: number): boolean {
    // Collect all valid top-left positions where the enemy fits fully on board
    // and doesn't overlap any already-placed enemy tiles
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

    // Late-game HP scaling: 1.5× per round beyond the cap
    const hpMultiplier = effectiveRound > ENEMY_SCALE_START_ROUND
      ? Math.pow(1.5, effectiveRound - ENEMY_SCALE_START_ROUND)
      : 1;

    // Pick random candidate
    const pos = candidates[Math.floor(Math.random() * candidates.length)];
    const enemy = new Enemy(this.scene, pos.row, pos.col, w, h, color, hpMultiplier);

    // Roll trait (if a round is supplied and traits are enabled for this round)
    const trait = rollTrait(effectiveRound);
    if (trait) {
      let wardedElement: string | undefined;
      if (trait === 'warded') {
        const elements = GAME_CONFIG.gemTypes.map(g => g.name);
        wardedElement = elements[Math.floor(Math.random() * elements.length)];
      }
      enemy.setTrait(trait, wardedElement);
    }

    // Register in grid overlay
    this.grid.placeEnemy(enemy);

    // Destroy gems that the enemy now occupies
    for (let r2 = pos.row; r2 < pos.row + h; r2++) {
      for (let c = pos.col; c < pos.col + w; c++) {
        const gem = this.grid.getGem(r2, c);
        if (gem) {
          gem.sprite.destroy();
          this.grid.setGem(r2, c, null);
        }
      }
    }

    this.enemies.push(enemy);
    return true;
  }

  /**
   * Place additional enemies (for the 'overcrowded' modifier).
   * Picks random sizes from the round's defined pool.
   */
  addExtraEnemies(count: number, round: number): void {
    const defs = getEnemiesForRound(round);
    if (defs.length === 0) return;
    for (let i = 0; i < count; i++) {
      const def = defs[Math.floor(Math.random() * defs.length)];
      const color = ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)];
      this.tryPlaceEnemy(def.widthInCells, def.heightInCells, color, round);
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

  /**
   * Deal damage to an enemy. Applies trait modifiers. Plays death animation and removes if killed.
   * @param element  The attacking element (null = no element)
   * @returns true if the enemy died
   */
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
    // Clear grid overlay tiles
    this.grid.clearEnemyTiles(enemy);

    // Play death animation
    await enemy.playDeathAnimation(this.scene);
    enemy.destroy();

    // Remove from list
    const idx = this.enemies.indexOf(enemy);
    if (idx >= 0) this.enemies.splice(idx, 1);
  }

  /**
   * Deal damage to all enemies whose tiles overlap the given positions.
   * Each unique enemy is damaged once per call (not once per tile).
   * @param element  The attacking element (passed through to enemy trait logic)
   */
  async damageEnemiesAtPositions(
    positions: { row: number; col: number }[],
    amount: number,
    element?: string | null,
  ): Promise<{ enemy: Enemy; died: boolean }[]> {
    // De-duplicate enemies (each enemy hit once per power use)
    const hitEnemies = new Map<Enemy, number>();

    for (const pos of positions) {
      const enemy = this.getEnemyAt(pos.row, pos.col);
      if (enemy) {
        const currentCount = hitEnemies.get(enemy) ?? 0;
        hitEnemies.set(enemy, currentCount + 1);
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
   * Called at the end of each player turn.
   * Handles 'regenerating' trait: each living regenerating enemy heals 1 HP.
   */
  processTurnEnd(): void {
    for (const enemy of this.enemies) {
      if (enemy.trait === 'regenerating' && enemy.hp > 0) {
        enemy.heal(1);
      }
    }
  }

  // ─── Cleanup ───

  destroyAll(): void {
    for (const enemy of this.enemies) {
      this.grid.clearEnemyTiles(enemy);
      enemy.destroy();
    }
    this.enemies = [];
  }

  /** Draw a simple debug label showing HP on each enemy (used during development). */
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
