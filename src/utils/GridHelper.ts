import { GAME_CONFIG } from '../config/gameConfig.ts';

export const GridHelper = {
  gridToWorld(row: number, col: number): { x: number; y: number } {
    return {
      x: GAME_CONFIG.gridOffsetX + col * (GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding) + GAME_CONFIG.gemSize / 2,
      y: GAME_CONFIG.gridOffsetY + row * (GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding) + GAME_CONFIG.gemSize / 2,
    };
  },

  isInBounds(row: number, col: number, rows: number, cols: number): boolean {
    return row >= 0 && row < rows && col >= 0 && col < cols;
  },

  getAdjacentCells(row: number, col: number): { row: number; col: number }[] {
    return [
      { row: row - 1, col },
      { row: row + 1, col },
      { row, col: col - 1 },
      { row, col: col + 1 },
    ];
  },

  manhattanDistance(row1: number, col1: number, row2: number, col2: number): number {
    return Math.abs(row1 - row2) + Math.abs(col1 - col2);
  },
};
