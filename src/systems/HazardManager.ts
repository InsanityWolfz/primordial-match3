import type Phaser from 'phaser';
import { Hazard } from '../entities/Hazard.ts';
import { HAZARD_DEFINITIONS, getHazardCount } from '../config/hazardConfig.ts';
import type { HazardDefinition } from '../config/hazardConfig.ts';
import type { Grid } from '../entities/Grid.ts';
import { GAME_CONFIG } from '../config/gameConfig.ts';

export class HazardManager {
  private scene: Phaser.Scene;
  private grid: Grid;
  private hazardGrid: (Hazard | null)[][];
  readonly rows: number;
  readonly cols: number;
  private totalPlacedThisRound = 0;
  private turnCounter = 0;

  constructor(scene: Phaser.Scene, grid: Grid) {
    this.scene = scene;
    this.grid = grid;
    this.rows = grid.rows;
    this.cols = grid.cols;

    // Initialize empty hazard grid
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

  /**
   * Check if a position has a hazard that blocks swapping (e.g., Ancient Ward).
   */
  hasBlockingHazard(row: number, col: number): boolean {
    const hazard = this.getHazard(row, col);
    return hazard !== null && hazard.def.blockSwap === true;
  }

  /**
   * Release all hazard gem references, restoring gem alphas to full.
   * Call before earthquake shuffle so gems can be repositioned safely.
   */
  releaseAllGems(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const hazard = this.hazardGrid[r][c];
        if (hazard) hazard.releaseGem();
      }
    }
  }

  /**
   * Re-associate each hazard with the gem now at its grid position.
   * Call after earthquake shuffle so hazards dim the correct gems.
   */
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

  /**
   * Count remaining hazards on the board.
   */
  getRemainingCount(): number {
    let count = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.hazardGrid[r][c]) count++;
      }
    }
    return count;
  }

  // ─── Placement ───

  /**
   * Place hazards for the start of a round.
   * Avoids placing on positions that already have hazards.
   */
  placeHazards(round: number): void {
    this.totalPlacedThisRound = 0;
    this.turnCounter = 0;
    for (const def of HAZARD_DEFINITIONS) {
      const count = getHazardCount(def, round);
      if (count <= 0) continue;
      this.placeHazardType(def, count);
    }
    this.totalPlacedThisRound = this.getRemainingCount();
  }

  /**
   * Get total hazards placed at the start of this round.
   */
  getTotalPlaced(): number {
    return this.totalPlacedThisRound;
  }

  private placeHazardType(def: HazardDefinition, count: number): void {
    // Collect available positions (has gem, no existing hazard)
    const available: { row: number; col: number }[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid.getGem(r, c) && !this.hazardGrid[r][c]) {
          available.push({ row: r, col: c });
        }
      }
    }

    // Shuffle
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }

    const toPlace = Math.min(count, available.length);
    for (let i = 0; i < toPlace; i++) {
      const pos = available[i];
      const hazard = new Hazard(this.scene, pos.row, pos.col, def);
      this.hazardGrid[pos.row][pos.col] = hazard;
      const gem = this.grid.getGem(pos.row, pos.col);
      if (gem) hazard.setGem(gem);
    }
  }

  // ─── Damage ───

  /**
   * Deal damage to a hazard at a position.
   * Returns true if the hazard was destroyed.
   * Returns false if the hazard survived or there was no hazard.
   */
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

  /**
   * Deal 1 damage to hazards adjacent to the given positions.
   * Used after matches to chip away at neighboring hazards.
   * Returns positions of destroyed hazards.
   */
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
        // Only count adjacent cells that have hazards and weren't themselves matched
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
          if (destroyed) {
            destroyedPositions.push({ row: r, col: c });
          }
        }),
      );
    }

    await Promise.all(damagePromises);
    return destroyedPositions;
  }

  // ─── Gravity support ───

  /**
   * Move hazards down to follow their gems during gravity.
   * Call this AFTER grid.applyGravity() so gems have their new positions.
   * Hazards follow the gem they were covering.
   */
  applyGravity(gemMoves: { gem: { gridRow: number; gridCol: number }; fromRow: number; toRow: number; col: number }[]): void {
    // Process moves from bottom to top to avoid overwriting
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

  /**
   * Animate hazards falling to match their gems.
   */
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

  /**
   * Remove hazards at destroyed gem positions.
   * Called when gems are destroyed (the hazard breaks with the gem).
   */
  clearPositions(positions: { row: number; col: number }[]): void {
    for (const pos of positions) {
      const hazard = this.hazardGrid[pos.row]?.[pos.col];
      if (hazard) {
        hazard.destroy();
        this.hazardGrid[pos.row][pos.col] = null;
      }
    }
  }

  /**
   * Destroy all hazards (for scene cleanup).
   */
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

  /**
   * Called at the end of each turn. Handles thorn vine spreading.
   * Returns the number of new hazards spawned.
   */
  async processTurnEnd(): Promise<number> {
    this.turnCounter++;
    let spawned = 0;

    // Collect all spreading hazards that should trigger this turn
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

    // Each spreader tries to spread to 1 random adjacent cell
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const newHazards: Hazard[] = [];

    for (const spreader of spreaders) {
      const candidates: { row: number; col: number }[] = [];
      for (const [dr, dc] of dirs) {
        const nr = spreader.gridRow + dr;
        const nc = spreader.gridCol + dc;
        if (
          nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols &&
          this.grid.getGem(nr, nc) && !this.hazardGrid[nr][nc]
        ) {
          candidates.push({ row: nr, col: nc });
        }
      }

      if (candidates.length === 0) continue;

      // Pick random adjacent cell
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      const newHazard = new Hazard(this.scene, target.row, target.col, spreader.def, spreader.hp);
      this.hazardGrid[target.row][target.col] = newHazard;
      const spreadGem = this.grid.getGem(target.row, target.col);
      if (spreadGem) newHazard.setGem(spreadGem);
      newHazards.push(newHazard);
      spawned++;
    }

    // Animate the new hazards appearing (brief pulse)
    if (newHazards.length > 0) {
      this.totalPlacedThisRound += newHazards.length;
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
      // Wait for animations
      await new Promise<void>(resolve => {
        this.scene.time.delayedCall(350, () => resolve());
      });
    }

    return spawned;
  }
}
