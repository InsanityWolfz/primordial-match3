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

  private getParams(id: string, level: number): Record<string, number> {
    const def = getPowerUpDef(id);
    if (!def) return {};
    const clampedLevel = Math.min(Math.max(level, 1), def.maxLevel);
    return def.levels[clampedLevel - 1]?.params ?? {};
  }

  /**
   * Lightning (Chain Strike): chain destroy from target gem.
   * Zig-zag pattern, warps to opposite corner when stuck.
   */
  async executeChainStrike(level: number, startRow: number, startCol: number, computedDamage: number): Promise<void> {
    const params = this.getParams('chainstrike', level);
    const maxChain = params.chainCount ?? 9;
    const damage = computedDamage;

    this.passiveManager.onDamageDealt('lightning', damage, 'chainstrike');

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
                if (this.ctx.grid.isValidPosition(wr, wc) && !visited.has(wKey) && (this.ctx.grid.getGem(wr, wc) || this.ctx.grid.isEnemyTile(wr, wc))) {
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

    await this.damageSystem.dealDamageSequential(positions, damage, 'lightning', 50, 3);

    await this.cascadeSystem.applyGravityAndSpawn();

    const matches = this.ctx.findMatches();
    if (matches.length > 0) {
      await this.cascadeSystem.processCascade(matches, 1);
    }

  }

  /**
   * Capacitor: passive power that triggers after match.
   * Chains gems adjacent to the matched gems (BFS outward), not random ones.
   */
  async executeCapacitorPassive(matchPositions: { row: number; col: number }[] = []): Promise<boolean> {
    const capacitorOwned = this.ctx.ownedPowerUps.find(p => p.powerUpId === 'capacitor');
    if (!capacitorOwned) return false;

    const params = this.getParams('capacitor', capacitorOwned.level);
    const chainCount = params.chainCount ?? 1;
    const damage = params.damage ?? 1;

    // BFS outward from match positions to find the nearest non-matched gems
    const matchSet = new Set(matchPositions.map(p => `${p.row},${p.col}`));
    const targets: { row: number; col: number }[] = [];
    const visited = new Set<string>(matchSet);
    let frontier = matchPositions.length > 0 ? [...matchPositions] : [];
    const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    while (targets.length < chainCount && frontier.length > 0) {
      const nextFrontier: { row: number; col: number }[] = [];
      for (const pos of frontier) {
        for (const [dr, dc] of dirs) {
          const nr = pos.row + dr;
          const nc = pos.col + dc;
          const key = `${nr},${nc}`;
          if (!visited.has(key) && this.ctx.grid.isValidPosition(nr, nc) && (this.ctx.grid.getGem(nr, nc) || this.ctx.grid.isEnemyTile(nr, nc))) {
            visited.add(key);
            targets.push({ row: nr, col: nc });
            nextFrontier.push({ row: nr, col: nc });
          }
        }
      }
      frontier = nextFrontier;
    }

    // If no adjacent targets found (e.g. no match positions), fall back to random gems
    if (targets.length === 0) {
      for (let r = 0; r < this.ctx.grid.rows; r++) {
        for (let c = 0; c < this.ctx.grid.cols; c++) {
          if (this.ctx.grid.getGem(r, c) || this.ctx.grid.isEnemyTile(r, c)) targets.push({ row: r, col: c });
        }
      }
      for (let i = targets.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [targets[i], targets[j]] = [targets[j], targets[i]];
      }
    }

    const limitedTargets = targets.slice(0, Math.min(chainCount, targets.length));
    if (limitedTargets.length === 0) return false;

    // Small lightning visual
    const scene = this.ctx.phaserScene;
    const lightning = scene.add.graphics();
    const lightningColor = GAME_CONFIG.gemTypes.find(g => g.name === 'lightning')?.color ?? 0xffdd00;
    lightning.lineStyle(2, lightningColor, 0.6);
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;

    for (let i = 1; i < limitedTargets.length; i++) {
      const prev = limitedTargets[i - 1];
      const curr = limitedTargets[i];
      const x1 = GAME_CONFIG.gridOffsetX + prev.col * cellSize + GAME_CONFIG.gemSize / 2;
      const y1 = GAME_CONFIG.gridOffsetY + prev.row * cellSize + GAME_CONFIG.gemSize / 2;
      const x2 = GAME_CONFIG.gridOffsetX + curr.col * cellSize + GAME_CONFIG.gemSize / 2;
      const y2 = GAME_CONFIG.gridOffsetY + curr.row * cellSize + GAME_CONFIG.gemSize / 2;
      lightning.lineBetween(x1, y1, x2, y2);
    }
    scene.tweens.add({
      targets: lightning,
      alpha: 0,
      duration: 400,
      onComplete: () => lightning.destroy(),
    });

    await this.damageSystem.dealDamageSequential(limitedTargets, damage, 'lightning', 30, 2);

    return true;
  }
}
