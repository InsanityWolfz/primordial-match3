import type Phaser from 'phaser';
import { Hazard } from '../entities/Hazard.ts';
import { HAZARD_DEFINITIONS, MAX_HAZARDS_PER_ROUND, getHazardCount } from '../config/hazardConfig.ts';
import type { HazardDefinition } from '../config/hazardConfig.ts';
import type { Grid } from '../entities/Grid.ts';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { Gem } from '../entities/Gem.ts';

export class HazardManager {
  private scene: Phaser.Scene;
  private grid: Grid;
  private hazardGrid: (Hazard | null)[][];
  readonly rows: number;
  readonly cols: number;
  private totalPlacedThisRound = 0;
  private turnCounter = 0;
  // Modifier overrides — set by GameScene when a round modifier is active
  maxHazards: number = MAX_HAZARDS_PER_ROUND;
  spawnRateMultiplier: number = 1.0;

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

  getTotalPlaced(): number {
    return this.totalPlacedThisRound;
  }

  // ─── Placement ───

  /**
   * Place hazards for round start. Total across all types is capped at MAX_HAZARDS_PER_ROUND.
   * Hazards are never placed on enemy tiles.
   */
  placeHazards(round: number): void {
    this.totalPlacedThisRound = 0;
    this.turnCounter = 0;

    let totalPlaced = 0;

    for (const def of HAZARD_DEFINITIONS) {
      if (totalPlaced >= this.maxHazards) break;
      const want = getHazardCount(def, round);
      if (want <= 0) continue;
      const canPlace = Math.min(want, this.maxHazards - totalPlaced);
      const placed = this.placeHazardType(def, canPlace);
      totalPlaced += placed;
    }

    this.totalPlacedThisRound = this.getRemainingCount();
  }

  private placeHazardType(def: HazardDefinition, count: number): number {
    // Available: has gem, no hazard, not an enemy tile
    const available: { row: number; col: number }[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid.getGem(r, c) && !this.hazardGrid[r][c] && !this.grid.isEnemyTile(r, c)) {
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
    return toPlace;
  }

  /**
   * Dynamic hazard spawning: called when a new gem is placed on the board.
   * Chance = currentHazardCount × 0.5% (0.005).
   * Returns true if the gem was converted to a hazard (so spawn logic can skip animating it normally).
   */
  maybeSpawnHazardOnGem(row: number, col: number, gem: Gem): boolean {
    const currentCount = this.getRemainingCount();
    if (currentCount >= this.maxHazards) return false;
    if (currentCount === 0) return false; // no hazards on board = no spawn pressure

    const chance = currentCount * 0.005 * this.spawnRateMultiplier;
    if (Math.random() >= chance) return false;

    // Pick a random eligible hazard type for this round
    // Only use hazard types that are already present on the board
    const presentTypes = new Set<string>();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const h = this.hazardGrid[r][c];
        if (h) presentTypes.add(h.def.id);
      }
    }

    if (presentTypes.size === 0) return false;

    const eligibleDefs = HAZARD_DEFINITIONS.filter(d => presentTypes.has(d.id));
    const def = eligibleDefs[Math.floor(Math.random() * eligibleDefs.length)];

    const hazard = new Hazard(this.scene, row, col, def);
    this.hazardGrid[row][col] = hazard;
    hazard.setGem(gem);
    return true;
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
      await new Promise<void>(resolve => {
        this.scene.time.delayedCall(350, () => resolve());
      });
    }

    return spawned;
  }
}
