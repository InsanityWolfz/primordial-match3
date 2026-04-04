import type { Gem } from './Gem.ts';
import type { GemType } from '../config/gameConfig.ts';
import type { Enemy } from './Enemy.ts';

export class Grid {
  rows: number;
  cols: number;
  gemTypes: GemType[];
  grid: (Gem | null)[][];

  // Parallel overlay: tracks which cells are occupied by an enemy.
  // Gems are never placed in enemy tiles; gravity passes through them.
  private enemyGrid: (Enemy | null)[][];

  constructor(rows: number, cols: number, gemTypes: GemType[]) {
    this.rows = rows;
    this.cols = cols;
    this.gemTypes = gemTypes;
    this.grid = [];
    this.enemyGrid = [];
    this.initialize();
  }

  initialize(): void {
    this.grid = [];
    this.enemyGrid = [];
    for (let row = 0; row < this.rows; row++) {
      this.grid[row] = [];
      this.enemyGrid[row] = [];
      for (let col = 0; col < this.cols; col++) {
        this.grid[row][col] = null;
        this.enemyGrid[row][col] = null;
      }
    }
  }

  // ─── Gem access ───

  getGem(row: number, col: number): Gem | null {
    if (!this.isValidPosition(row, col)) return null;
    return this.grid[row][col];
  }

  setGem(row: number, col: number, gem: Gem | null): void {
    if (!this.isValidPosition(row, col)) return;
    // Never place a gem on an enemy tile
    if (gem && this.enemyGrid[row][col]) return;
    this.grid[row][col] = gem;
  }

  // ─── Enemy overlay ───

  isEnemyTile(row: number, col: number): boolean {
    if (!this.isValidPosition(row, col)) return false;
    return this.enemyGrid[row][col] !== null;
  }

  getEnemyAt(row: number, col: number): Enemy | null {
    if (!this.isValidPosition(row, col)) return null;
    return this.enemyGrid[row][col];
  }

  /** Register all tiles an enemy occupies into the overlay. */
  placeEnemy(enemy: Enemy): void {
    for (let r = enemy.gridRow; r < enemy.gridRow + enemy.heightInCells; r++) {
      for (let c = enemy.gridCol; c < enemy.gridCol + enemy.widthInCells; c++) {
        if (this.isValidPosition(r, c)) {
          this.enemyGrid[r][c] = enemy;
          if (this.grid[r][c]) {
            this.grid[r][c]!.destroy(); // remove the Phaser graphics object
            this.grid[r][c] = null;
          }
        }
      }
    }
  }

  /** Clear all tiles an enemy occupies from the overlay. */
  clearEnemyTiles(enemy: Enemy): void {
    for (let r = enemy.gridRow; r < enemy.gridRow + enemy.heightInCells; r++) {
      for (let c = enemy.gridCol; c < enemy.gridCol + enemy.widthInCells; c++) {
        if (this.isValidPosition(r, c) && this.enemyGrid[r][c] === enemy) {
          this.enemyGrid[r][c] = null;
        }
      }
    }
  }

  // ─── Position helpers ───

  swap(row1: number, col1: number, row2: number, col2: number): void {
    if (!this.isValidPosition(row1, col1) || !this.isValidPosition(row2, col2)) return;
    // Never swap into an enemy tile
    if (this.enemyGrid[row1][col1] || this.enemyGrid[row2][col2]) return;

    const gem1 = this.grid[row1][col1];
    const gem2 = this.grid[row2][col2];

    this.grid[row1][col1] = gem2;
    this.grid[row2][col2] = gem1;

    if (gem1) gem1.setGridPosition(row2, col2);
    if (gem2) gem2.setGridPosition(row1, col1);
  }

  isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }

  areAdjacent(row1: number, col1: number, row2: number, col2: number): boolean {
    return Math.abs(row1 - row2) + Math.abs(col1 - col2) === 1;
  }

  /**
   * Find all matching positions (3+ in a row or column).
   * Enemy tiles are null in the gem grid, so they naturally break runs.
   * Hazarded gems are treated as blockers via the optional isHazarded callback.
   */
  findMatches(isHazarded?: (row: number, col: number) => boolean): { row: number; col: number }[] {
    const matched = new Set<string>();

    // Horizontal scan
    for (let row = 0; row < this.rows; row++) {
      let runStart = 0;
      for (let col = 1; col <= this.cols; col++) {
        const current = col < this.cols ? this.grid[row][col] : null;
        const prev = this.grid[row][runStart];
        const currentBlocked = current && isHazarded?.(row, col);
        const prevBlocked = prev && isHazarded?.(row, runStart);
        const runsMatch = current && prev && !currentBlocked && !prevBlocked && current.type.id === prev.type.id;
        if (runsMatch) continue;
        const runLength = col - runStart;
        if (runLength >= 3 && prev && !prevBlocked) {
          for (let c = runStart; c < col; c++) {
            matched.add(`${row},${c}`);
          }
        }
        runStart = col;
      }
    }

    // Vertical scan
    for (let col = 0; col < this.cols; col++) {
      let runStart = 0;
      for (let row = 1; row <= this.rows; row++) {
        const current = row < this.rows ? this.grid[row][col] : null;
        const prev = this.grid[runStart][col];
        const currentBlocked = current && isHazarded?.(row, col);
        const prevBlocked = prev && isHazarded?.(runStart, col);
        const runsMatch = current && prev && !currentBlocked && !prevBlocked && current.type.id === prev.type.id;
        if (runsMatch) continue;
        const runLength = row - runStart;
        if (runLength >= 3 && prev && !prevBlocked) {
          for (let r = runStart; r < row; r++) {
            matched.add(`${r},${col}`);
          }
        }
        runStart = row;
      }
    }

    return Array.from(matched).map((key) => {
      const [r, c] = key.split(',').map(Number);
      return { row: r, col: c };
    });
  }

  /**
   * Find match groups — each contiguous match returned as a separate group.
   * Each group has element name and exact size. Used for charge refunds and
   * essence multiplier tracking (match-3, match-4, match-5+).
   */
  findMatchGroups(isHazarded?: (row: number, col: number) => boolean): {
    positions: { row: number; col: number }[];
    element: string;
    size: number;
  }[] {
    const groups: { positions: { row: number; col: number }[]; element: string; size: number }[] = [];

    // Horizontal scan
    for (let row = 0; row < this.rows; row++) {
      let runStart = 0;
      for (let col = 1; col <= this.cols; col++) {
        const current = col < this.cols ? this.grid[row][col] : null;
        const prev = this.grid[row][runStart];
        const currentBlocked = current && isHazarded?.(row, col);
        const prevBlocked = prev && isHazarded?.(row, runStart);
        const runsMatch = current && prev && !currentBlocked && !prevBlocked && current.type.id === prev.type.id;
        if (runsMatch) continue;
        const runLength = col - runStart;
        if (runLength >= 3 && prev && !prevBlocked) {
          const positions: { row: number; col: number }[] = [];
          for (let c = runStart; c < col; c++) positions.push({ row, col: c });
          groups.push({ positions, element: prev.type.name, size: runLength });
        }
        runStart = col;
      }
    }

    // Vertical scan
    for (let col = 0; col < this.cols; col++) {
      let runStart = 0;
      for (let row = 1; row <= this.rows; row++) {
        const current = row < this.rows ? this.grid[row][col] : null;
        const prev = this.grid[runStart][col];
        const currentBlocked = current && isHazarded?.(row, col);
        const prevBlocked = prev && isHazarded?.(runStart, col);
        const runsMatch = current && prev && !currentBlocked && !prevBlocked && current.type.id === prev.type.id;
        if (runsMatch) continue;
        const runLength = row - runStart;
        if (runLength >= 3 && prev && !prevBlocked) {
          const positions: { row: number; col: number }[] = [];
          for (let r = runStart; r < row; r++) positions.push({ row: r, col });
          groups.push({ positions, element: prev.type.name, size: runLength });
        }
        runStart = row;
      }
    }

    return groups;
  }

  hasMatches(_isHazarded?: (row: number, col: number) => boolean): boolean {
    // Horizontal
    for (let row = 0; row < this.rows; row++) {
      let run = 1;
      for (let col = 1; col < this.cols; col++) {
        const current = this.grid[row][col];
        const prev = this.grid[row][col - 1];
        if (current && prev && current.type.id === prev.type.id) {
          run++;
          if (run >= 3) return true;
        } else {
          run = 1;
        }
      }
    }
    // Vertical
    for (let col = 0; col < this.cols; col++) {
      let run = 1;
      for (let row = 1; row < this.rows; row++) {
        const current = this.grid[row][col];
        const prev = this.grid[row - 1][col];
        if (current && prev && current.type.id === prev.type.id) {
          run++;
          if (run >= 3) return true;
        } else {
          run = 1;
        }
      }
    }
    return false;
  }

  clearPositions(positions: { row: number; col: number }[]): void {
    for (const pos of positions) {
      this.grid[pos.row][pos.col] = null;
    }
  }

  /**
   * Apply gravity with enemy fall-through.
   * Gems pass through enemy tiles and land in the first empty non-enemy cell below.
   * If no empty space below the enemy, gems pile up on top.
   */
  applyGravity(): { gem: Gem; fromRow: number; toRow: number; col: number }[] {
    const moves: { gem: Gem; fromRow: number; toRow: number; col: number }[] = [];

    for (let col = 0; col < this.cols; col++) {
      // Find the initial write position: lowest non-enemy row from the bottom
      let writeRow = this.rows - 1;
      while (writeRow >= 0 && this.enemyGrid[writeRow][col]) {
        writeRow--;
      }

      // Scan upward: place each gem at writeRow, skip enemy tiles entirely
      for (let readRow = this.rows - 1; readRow >= 0; readRow--) {
        if (this.enemyGrid[readRow][col]) continue; // enemy tile — skip, don't count as a slot
        const gem = this.grid[readRow][col];
        if (gem) {
          if (readRow !== writeRow) {
            this.grid[writeRow][col] = gem;
            this.grid[readRow][col] = null;
            moves.push({ gem, fromRow: readRow, toRow: writeRow, col });
            gem.setGridPosition(writeRow, col);
          }
          // Advance writeRow upward, skipping enemy tiles
          writeRow--;
          while (writeRow >= 0 && this.enemyGrid[writeRow][col]) {
            writeRow--;
          }
        }
      }
    }

    return moves;
  }

  /**
   * Find all empty non-enemy cells that need new gems per column.
   * Skips over enemy tiles so cells below a top-row enemy are included.
   * Stops at the first gem (everything below a gem is already occupied).
   * Used by CascadeSystem to determine where to spawn new gems.
   */
  countEmptyTop(): { col: number; count: number; rows: number[] }[] {
    const result: { col: number; count: number; rows: number[] }[] = [];
    for (let col = 0; col < this.cols; col++) {
      const emptyRows: number[] = [];
      for (let row = 0; row < this.rows; row++) {
        if (this.enemyGrid[row][col]) continue; // skip enemy tile, keep scanning below
        if (this.grid[row][col] === null) emptyRows.push(row);
        else break; // hit a gem — stop
      }
      if (emptyRows.length > 0) result.push({ col, count: emptyRows.length, rows: emptyRows });
    }
    return result;
  }
}
