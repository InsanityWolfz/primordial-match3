import type Phaser from 'phaser';
import { Hazard } from '../entities/Hazard.ts';
import { HAZARD_DEFINITIONS, MAX_HAZARDS_PER_ROUND } from '../config/hazardConfig.ts';
import type { Grid } from '../entities/Grid.ts';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { Enemy } from '../entities/Enemy.ts';

export class HazardManager {
  private scene: Phaser.Scene;
  private grid: Grid;
  private hazardGrid: (Hazard | null)[][];
  readonly rows: number;
  readonly cols: number;
  private turnCounter = 0;
  // Modifier override — set by GameScene when a round modifier is active
  maxHazards: number = MAX_HAZARDS_PER_ROUND;

  constructor(scene: Phaser.Scene, grid: Grid) {
    this.scene = scene;
    this.grid = grid;
    this.rows = grid.rows;
    this.cols = grid.cols;

    this.hazardGrid = [];
    for (let r = 0; r < this.rows; r++) {
      this.hazardGrid[r] = [];
      for (let c = 0; c < this.cols; c++) {
        this.hazardGrid[r][c] = null;
      }
    }
  }

  // ─── Queries ───

  hasHazard(row: number, col: number): boolean {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return false;
    return this.hazardGrid[row][col] !== null;
  }

  getHazard(row: number, col: number): Hazard | null {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    return this.hazardGrid[row][col];
  }

  hasBlockingHazard(row: number, col: number): boolean {
    const hazard = this.getHazard(row, col);
    return hazard !== null && hazard.def.blockSwap === true;
  }

  releaseAllGems(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const hazard = this.hazardGrid[r][c];
        if (hazard) hazard.releaseGem();
      }
    }
  }

  reassociateGems(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const hazard = this.hazardGrid[r][c];
        if (hazard) {
          const gem = this.grid.getGem(r, c);
          if (gem) hazard.setGem(gem);
        }
      }
    }
  }

  getRemainingCount(): number {
    let count = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.hazardGrid[r][c]) count++;
      }
    }
    return count;
  }

  // ─── Intent-driven spawning ───

  /**
   * Spawn a hazard of the given type on a gem adjacent to the enemy.
   * Searches ring by ring outward from the enemy's tiles, picking a random
   * eligible (has gem, no hazard, not enemy tile) position in the nearest ring.
   * No-ops if at the hazard cap or no valid position exists.
   */
  spawnHazardNearEnemy(enemy: Enemy, hazardId: string): void {
    if (this.getRemainingCount() >= this.maxHazards) return;

    const def = HAZARD_DEFINITIONS.find(d => d.id === hazardId);
    if (!def) return;

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;

    // Seed the visited set with all enemy tiles
    const visited = new Set<string>();
    for (let r = enemy.gridRow; r < enemy.gridRow + enemy.heightInCells; r++) {
      for (let c = enemy.gridCol; c < enemy.gridCol + enemy.widthInCells; c++) {
        visited.add(`${r},${c}`);
      }
    }

    // Starting frontier = the enemy tile set itself
    let frontier = new Set<string>(visited);

    while (frontier.size > 0) {
      // Expand one ring outward
      const nextFrontier = new Set<string>();
      for (const key of frontier) {
        const [r, c] = key.split(',').map(Number);
        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          const nkey = `${nr},${nc}`;
          if (!visited.has(nkey) && nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
            visited.add(nkey);
            nextFrontier.add(nkey);
          }
        }
      }

      if (nextFrontier.size === 0) break;

      // Find eligible positions in this ring
      const candidates = [...nextFrontier]
        .map(key => { const [r, c] = key.split(',').map(Number); return { row: r, col: c }; })
        .filter(pos =>
          this.grid.getGem(pos.row, pos.col) &&
          !this.hazardGrid[pos.row][pos.col] &&
          !this.grid.isEnemyTile(pos.row, pos.col),
        );

      if (candidates.length > 0) {
        const pos = candidates[Math.floor(Math.random() * candidates.length)];
        const gem = this.grid.getGem(pos.row, pos.col)!;
        const hazard = new Hazard(this.scene, pos.row, pos.col, def);
        this.hazardGrid[pos.row][pos.col] = hazard;
        hazard.setGem(gem);
        return;
      }

      frontier = nextFrontier;
    }
    // No valid position found — all reachable gems already have hazards
  }

  // ─── Damage ───

  async damageHazard(row: number, col: number, amount: number): Promise<boolean> {
    const hazard = this.hazardGrid[row][col];
    if (!hazard) return false;

    const destroyed = hazard.takeDamage(amount);
    if (destroyed) {
      await hazard.playDestroyAnimation(GAME_CONFIG.clearDuration);
      this.hazardGrid[row][col] = null;
      return true;
    }
    return false;
  }

  async damageAdjacentHazards(
    matchPositions: { row: number; col: number }[],
  ): Promise<{ row: number; col: number }[]> {
    const adjacentHazards = new Set<string>();
    const matchSet = new Set(matchPositions.map(p => `${p.row},${p.col}`));

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const pos of matchPositions) {
      for (const [dr, dc] of dirs) {
        const nr = pos.row + dr;
        const nc = pos.col + dc;
        const key = `${nr},${nc}`;
        if (!matchSet.has(key) && this.hasHazard(nr, nc)) {
          adjacentHazards.add(key);
        }
      }
    }

    const destroyedPositions: { row: number; col: number }[] = [];
    const damagePromises: Promise<void>[] = [];

    for (const key of adjacentHazards) {
      const [r, c] = key.split(',').map(Number);
      damagePromises.push(
        this.damageHazard(r, c, 1).then(destroyed => {
          if (destroyed) destroyedPositions.push({ row: r, col: c });
        }),
      );
    }

    await Promise.all(damagePromises);
    return destroyedPositions;
  }

  /**
   * Directly spawn a hazard of the given type at an exact grid position.
   * No-ops if the cell is out of bounds, already has a hazard, is at the cap,
   * or has no gem to attach to.
   */
  spawnHazardAt(row: number, col: number, hazardId: string): void {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
    if (this.hazardGrid[row][col]) return;
    if (this.getRemainingCount() >= this.maxHazards) return;
    const def = HAZARD_DEFINITIONS.find(d => d.id === hazardId);
    if (!def) return;
    const gem = this.grid.getGem(row, col);
    if (!gem) return;
    const hazard = new Hazard(this.scene, row, col, def);
    this.hazardGrid[row][col] = hazard;
    hazard.setGem(gem);
  }

  /** Destroy a hazard at position immediately (animation + grid clear), ignoring HP. */
  async destroyHazardAt(row: number, col: number): Promise<void> {
    const hazard = this.hazardGrid[row]?.[col];
    if (!hazard) return;
    await hazard.playDestroyAnimation(GAME_CONFIG.clearDuration);
    this.hazardGrid[row][col] = null;
  }

  /** Destroy all hazards on the board immediately. */
  async destroyAllHazards(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.hazardGrid[r][c]) {
          promises.push(this.destroyHazardAt(r, c));
        }
      }
    }
    await Promise.all(promises);
  }

  /** Return all positions that currently have a hazard. */
  getAllHazardPositions(): { row: number; col: number }[] {
    const positions: { row: number; col: number }[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.hazardGrid[r][c]) positions.push({ row: r, col: c });
      }
    }
    return positions;
  }

  // ─── Gravity support ───

  applyGravity(gemMoves: { gem: { gridRow: number; gridCol: number }; fromRow: number; toRow: number; col: number }[]): void {
    const sortedMoves = [...gemMoves].sort((a, b) => b.toRow - a.toRow);

    for (const move of sortedMoves) {
      const hazard = this.hazardGrid[move.fromRow]?.[move.col];
      if (hazard) {
        this.hazardGrid[move.fromRow][move.col] = null;
        this.hazardGrid[move.toRow][move.col] = hazard;
        hazard.setGridPosition(move.toRow, move.col);
      }
    }
  }

  animateGravity(gemMoves: { gem: { gridRow: number; gridCol: number }; fromRow: number; toRow: number; col: number }[]): Promise<void>[] {
    const promises: Promise<void>[] = [];
    for (const move of gemMoves) {
      const hazard = this.hazardGrid[move.toRow]?.[move.col];
      if (hazard) {
        const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
        const targetX = GAME_CONFIG.gridOffsetX + move.col * cellSize + GAME_CONFIG.gemSize / 2;
        const targetY = GAME_CONFIG.gridOffsetY + move.toRow * cellSize + GAME_CONFIG.gemSize / 2;
        promises.push(hazard.moveTo(targetX, targetY, GAME_CONFIG.fallDuration));
      }
    }
    return promises;
  }

  // ─── Clearing ───

  clearPositions(positions: { row: number; col: number }[]): void {
    for (const pos of positions) {
      const hazard = this.hazardGrid[pos.row]?.[pos.col];
      if (hazard) {
        hazard.destroy();
        this.hazardGrid[pos.row][pos.col] = null;
      }
    }
  }

  destroyAll(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const hazard = this.hazardGrid[r][c];
        if (hazard) {
          hazard.destroy();
          this.hazardGrid[r][c] = null;
        }
      }
    }
  }

  // ─── Turn-based behaviors ───

  async processTurnEnd(): Promise<number> {
    this.turnCounter++;
    let spawned = 0;

    const spreaders: Hazard[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const hazard = this.hazardGrid[r][c];
        if (hazard && hazard.def.spreads) {
          const interval = hazard.def.spreadInterval ?? 2;
          if (this.turnCounter % interval === 0) {
            spreaders.push(hazard);
          }
        }
      }
    }

    if (spreaders.length === 0) return 0;

    // Check total cap before spreading
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const newHazards: Hazard[] = [];

    for (const spreader of spreaders) {
      if (this.getRemainingCount() >= this.maxHazards) break;

      const candidates: { row: number; col: number }[] = [];
      for (const [dr, dc] of dirs) {
        const nr = spreader.gridRow + dr;
        const nc = spreader.gridCol + dc;
        if (
          nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols &&
          this.grid.getGem(nr, nc) && !this.hazardGrid[nr][nc] &&
          !this.grid.isEnemyTile(nr, nc)
        ) {
          candidates.push({ row: nr, col: nc });
        }
      }

      if (candidates.length === 0) continue;

      const target = candidates[Math.floor(Math.random() * candidates.length)];
      const newHazard = new Hazard(this.scene, target.row, target.col, spreader.def, spreader.hp);
      this.hazardGrid[target.row][target.col] = newHazard;
      const spreadGem = this.grid.getGem(target.row, target.col);
      if (spreadGem) newHazard.setGem(spreadGem);
      newHazards.push(newHazard);
      spawned++;
    }

    if (newHazards.length > 0) {
      for (const hazard of newHazards) {
        hazard.overlay.setAlpha(0);
        if (hazard.hpText) hazard.hpText.setAlpha(0);
        this.scene.tweens.add({
          targets: hazard.overlay,
          alpha: 1,
          duration: 300,
          ease: 'Power2',
        });
        if (hazard.hpText) {
          this.scene.tweens.add({
            targets: hazard.hpText,
            alpha: 1,
            duration: 300,
            ease: 'Power2',
          });
        }
      }
      await new Promise<void>(resolve => {
        this.scene.time.delayedCall(350, () => resolve());
      });
    }

    return spawned;
  }
}
