import type { Gem } from './Gem.ts';
import type { GemType } from '../config/gameConfig.ts';

export class Grid {
  rows: number;
  cols: number;
  gemTypes: GemType[];
  grid: (Gem | null)[][];

  constructor(rows: number, cols: number, gemTypes: GemType[]) {
    this.rows = rows;
    this.cols = cols;
    this.gemTypes = gemTypes;
    this.grid = [];
    this.initialize();
  }

  initialize(): void {
    this.grid = [];
    for (let row = 0; row < this.rows; row++) {
      this.grid[row] = [];
      for (let col = 0; col < this.cols; col++) {
        this.grid[row][col] = null;
      }
    }
  }

  getGem(row: number, col: number): Gem | null {
    if (!this.isValidPosition(row, col)) return null;
    return this.grid[row][col];
  }

  setGem(row: number, col: number, gem: Gem | null): void {
    if (!this.isValidPosition(row, col)) return;
    this.grid[row][col] = gem;
  }

  swap(row1: number, col1: number, row2: number, col2: number): void {
    if (!this.isValidPosition(row1, col1) || !this.isValidPosition(row2, col2)) return;

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
   * Find all matching positions (3+ in a row).
   * Gems under hazards are treated as blockers — they break runs and
   * cannot themselves be part of a match.
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

  applyGravity(): { gem: Gem; fromRow: number; toRow: number; col: number }[] {
    const moves: { gem: Gem; fromRow: number; toRow: number; col: number }[] = [];

    for (let col = 0; col < this.cols; col++) {
      let writeRow = this.rows - 1;
      for (let readRow = this.rows - 1; readRow >= 0; readRow--) {
        const gem = this.grid[readRow][col];
        if (gem) {
          if (readRow !== writeRow) {
            this.grid[writeRow][col] = gem;
            this.grid[readRow][col] = null;
            moves.push({ gem, fromRow: readRow, toRow: writeRow, col });
            gem.setGridPosition(writeRow, col);
          }
          writeRow--;
        }
      }
    }

    return moves;
  }

  countEmptyTop(): { col: number; count: number }[] {
    const result: { col: number; count: number }[] = [];
    for (let col = 0; col < this.cols; col++) {
      let count = 0;
      for (let row = 0; row < this.rows; row++) {
        if (this.grid[row][col] === null) count++;
        else break;
      }
      if (count > 0) result.push({ col, count });
    }
    return result;
  }
}
