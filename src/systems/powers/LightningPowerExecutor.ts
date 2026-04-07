import { GAME_CONFIG } from '../../config/gameConfig.ts';
import type { GameContext } from '../../types/GameContext.ts';
import type { CascadeSystem } from '../CascadeSystem.ts';
import type { DamageSystem } from '../DamageSystem.ts';
import type { PassiveManager } from '../PassiveManager.ts';
import { getPowerUpDef } from '../../config/powerUps.ts';

export class LightningPowerExecutor {
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

  /**
   * Lightning (Chain Strike): chain destroy from target gem in a zig-zag pattern.
   * chainCount comes from the power's flat params.
   */
  async executeChainStrike(startRow: number, startCol: number, computedDamage: number): Promise<void> {
    const params = getPowerUpDef('chainstrike')?.params ?? {};
    const maxChain = params.chainCount ?? 14;

    this.passiveManager.onDamageDealt('lightning', computedDamage, 'chainstrike');

    const positions: { row: number; col: number }[] = [{ row: startRow, col: startCol }];
    const visited = new Set<string>();
    visited.add(`${startRow},${startCol}`);

    const diagonals: [number, number][][] = [
      [[-1, 0], [0, 1]],
      [[1, 0], [0, 1]],
      [[1, 0], [0, -1]],
      [[-1, 0], [0, -1]],
    ];

    let diagIdx = Math.floor(Math.random() * 4);
    let stepIdx = 0;
    let rotationAttempts = 0;
    let curRow = startRow;
    let curCol = startCol;

    while (positions.length < maxChain) {
      const [dr, dc] = diagonals[diagIdx][stepIdx % 2];
      const nr = curRow + dr;
      const nc = curCol + dc;
      const key = `${nr},${nc}`;

      if (
        this.ctx.grid.isValidPosition(nr, nc) &&
        !visited.has(key) &&
        (this.ctx.grid.getGem(nr, nc) || this.ctx.grid.isEnemyTile(nr, nc))
      ) {
        visited.add(key);
        positions.push({ row: nr, col: nc });
        curRow = nr;
        curCol = nc;
        stepIdx++;
        rotationAttempts = 0;
      } else {
        rotationAttempts++;
        if (rotationAttempts < 4) {
          diagIdx = (diagIdx + 1) % 4;
        } else {
          const oppositeRow = curRow < this.ctx.grid.rows / 2 ? this.ctx.grid.rows - 1 : 0;
          const oppositeCol = curCol < this.ctx.grid.cols / 2 ? this.ctx.grid.cols - 1 : 0;

          let warpTarget: { row: number; col: number } | null = null;
          const maxSearch = Math.max(this.ctx.grid.rows, this.ctx.grid.cols);
          for (let dist = 0; dist < maxSearch && !warpTarget; dist++) {
            for (let ddr = -dist; ddr <= dist && !warpTarget; ddr++) {
              for (let ddc = -dist; ddc <= dist && !warpTarget; ddc++) {
                if (Math.abs(ddr) !== dist && Math.abs(ddc) !== dist) continue;
                const wr = oppositeRow + ddr;
                const wc = oppositeCol + ddc;
                const wKey = `${wr},${wc}`;
                if (this.ctx.grid.isValidPosition(wr, wc) && !visited.has(wKey) &&
                  (this.ctx.grid.getGem(wr, wc) || this.ctx.grid.isEnemyTile(wr, wc))) {
                  warpTarget = { row: wr, col: wc };
                }
              }
            }
          }

          if (!warpTarget) break;

          visited.add(`${warpTarget.row},${warpTarget.col}`);
          positions.push(warpTarget);
          curRow = warpTarget.row;
          curCol = warpTarget.col;

          const toCenterDiag = (warpTarget.row < this.ctx.grid.rows / 2 ? 1 : 0) * 2 +
            (warpTarget.col < this.ctx.grid.cols / 2 ? 1 : 0);
          const diagMap = [1, 2, 0, 3];
          diagIdx = diagMap[toCenterDiag];
          stepIdx = 0;
          rotationAttempts = 0;
        }
      }
    }

    // Lightning visual
    const scene = this.ctx.phaserScene;
    const lightning = scene.add.graphics();
    const lightningColor = GAME_CONFIG.gemTypes.find(g => g.name === 'lightning')?.color ?? 0xffdd00;
    lightning.lineStyle(3, lightningColor, 0.8);
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;

    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      const x1 = GAME_CONFIG.gridOffsetX + prev.col * cellSize + GAME_CONFIG.gemSize / 2;
      const y1 = GAME_CONFIG.gridOffsetY + prev.row * cellSize + GAME_CONFIG.gemSize / 2;
      const x2 = GAME_CONFIG.gridOffsetX + curr.col * cellSize + GAME_CONFIG.gemSize / 2;
      const y2 = GAME_CONFIG.gridOffsetY + curr.row * cellSize + GAME_CONFIG.gemSize / 2;
      lightning.lineBetween(x1, y1, x2, y2);
    }
    scene.tweens.add({
      targets: lightning,
      alpha: 0,
      duration: 500,
      onComplete: () => lightning.destroy(),
    });

    await this.damageSystem.dealDamageSequential(positions, computedDamage, 'lightning', 50, 3);
    await this.cascadeSystem.applyGravityAndSpawn();

    const matches = this.ctx.findMatches();
    if (matches.length > 0) {
      await this.cascadeSystem.processCascade(matches, 1);
    }
  }
}
