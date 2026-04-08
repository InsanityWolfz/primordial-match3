import { GAME_CONFIG } from '../../config/gameConfig.ts';
import type { GameContext } from '../../types/GameContext.ts';
import type { CascadeSystem } from '../CascadeSystem.ts';
import type { DamageSystem } from '../DamageSystem.ts';
import type { PassiveManager } from '../PassiveManager.ts';
import { getPowerUpDef } from '../../config/powerUps.ts';
import type { Enemy } from '../../entities/Enemy.ts';

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

  private has(id: string): boolean {
    return this.ctx.ownedModifiers.includes(id);
  }

  /**
   * Chain Strike: zig-zag chain dealing damage through tiles.
   * Modifiers:
   *   Extended Chain  — 7 more tiles (21 total)
   *   Conductor       — strip shields before dealing damage
   *   Thunderstruck   — Shock all enemies hit that took damage
   *   Overload        — +75% damage to enemies with 2+ intents
   *   Arc Flash       — destroy 3 random hazards after firing
   *   Faraday Shield  — handled in PassiveManager / GameScene
   *   Discharge       — hit enemies (that took damage) get discharged flag
   *   Ball Lightning  — guarantee at least one enemy tile in the chain
   *   EMP             — first chain strike per round: cancel all intents on hit enemies
   */
  async executeChainStrike(startRow: number, startCol: number, computedDamage: number): Promise<void> {
    const params = getPowerUpDef('chainstrike')?.params ?? {};
    let maxChain = params.chainCount ?? 14;
    if (this.has('lightning_extended_chain')) maxChain += 7;

    this.passiveManager.onDamageDealt('lightning', computedDamage, 'chainstrike');

    // Build chain positions
    const positions = this.buildChain(startRow, startCol, maxChain);

    // Ball Lightning: ensure at least one enemy tile is in the chain
    if (this.has('lightning_ball_lightning')) {
      const hasEnemy = positions.some(p => this.ctx.grid.isEnemyTile(p.row, p.col));
      if (!hasEnemy) {
        const living = this.ctx.enemyManager.getEnemies().filter(e => e.hp > 0);
        if (living.length > 0) {
          const target = living[Math.floor(Math.random() * living.length)];
          const er = target.gridRow + Math.floor(Math.random() * target.heightInCells);
          const ec = target.gridCol + Math.floor(Math.random() * target.widthInCells);
          const key = `${er},${ec}`;
          if (!positions.some(p => p.row === er && p.col === ec)) {
            positions.push({ row: er, col: ec });
          }
          void key;
        }
      }
    }

    // Conductor: strip shields from all enemies in chain path before damage
    if (this.has('lightning_conductor')) {
      const strippedEnemies = new Set<Enemy>();
      for (const pos of positions) {
        const enemy = this.ctx.grid.getEnemyAt(pos.row, pos.col);
        if (enemy && enemy.shieldActive && !strippedEnemies.has(enemy)) {
          strippedEnemies.add(enemy);
          enemy.stripShield();
        }
      }
    }

    // Track which enemies were shielded before damage (Discharge/Thunderstruck skip them)
    const shieldedBefore = new Set<Enemy>();
    if (this.has('lightning_discharge') || this.has('lightning_thunderstruck')) {
      for (const pos of positions) {
        const enemy = this.ctx.grid.getEnemyAt(pos.row, pos.col);
        if (enemy && enemy.shieldActive) shieldedBefore.add(enemy);
      }
    }

    // Overload: deal extra 75% damage to enemies with 2+ intents BEFORE main chain
    if (this.has('lightning_overload')) {
      const extraDmg = Math.floor(computedDamage * 0.75);
      const overloaded = new Set<Enemy>();
      for (const pos of positions) {
        const enemy = this.ctx.grid.getEnemyAt(pos.row, pos.col);
        if (enemy && enemy.hp > 0 && !overloaded.has(enemy) && enemy.getIntentCount() >= 2) {
          overloaded.add(enemy);
          await this.ctx.enemyManager.damageEnemy(enemy, extraDmg, 'lightning');
        }
      }
    }

    // EMP: first chain strike per round — cancel all intents on enemies in chain
    if (this.has('lightning_emp') && !this.ctx.empFiredThisRound) {
      this.ctx.empFiredThisRound = true;
      const empHit = new Set<Enemy>();
      for (const pos of positions) {
        const enemy = this.ctx.grid.getEnemyAt(pos.row, pos.col);
        if (enemy && enemy.hp > 0 && !empHit.has(enemy)) {
          empHit.add(enemy);
          enemy.cancelAllIntents();
        }
      }
    }

    // Lightning visual
    this.drawChainVisual(positions);

    // Main chain damage
    await this.damageSystem.dealDamageSequential(positions, computedDamage, 'lightning', 50, 3);

    // Post-damage effects on hit enemies
    const hitEnemies = new Set<Enemy>();
    for (const pos of positions) {
      const enemy = this.ctx.grid.getEnemyAt(pos.row, pos.col);
      if (enemy && !hitEnemies.has(enemy)) {
        hitEnemies.add(enemy);
        const wasShielded = shieldedBefore.has(enemy);
        // Only apply to enemies that took actual damage (not shielded)
        if (!wasShielded) {
          if (this.has('lightning_thunderstruck')) enemy.shocked = true;
          if (this.has('lightning_discharge')) enemy.discharged = true;
        }
      }
    }

    // Arc Flash: destroy 3 random hazards
    if (this.has('lightning_arc_flash')) {
      const hazardPositions = this.ctx.hazardManager.getAllHazardPositions()
        .sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(3, hazardPositions.length); i++) {
        await this.ctx.hazardManager.destroyHazardAt(hazardPositions[i].row, hazardPositions[i].col);
      }
    }

    await this.cascadeSystem.applyGravityAndSpawn();

    const matches = this.ctx.findMatches();
    if (matches.length > 0) {
      await this.cascadeSystem.processCascade(matches, 1);
    }
  }

  private buildChain(startRow: number, startCol: number, maxChain: number): { row: number; col: number }[] {
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
                if (
                  this.ctx.grid.isValidPosition(wr, wc) &&
                  !visited.has(wKey) &&
                  (this.ctx.grid.getGem(wr, wc) || this.ctx.grid.isEnemyTile(wr, wc))
                ) {
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

          const toCenterDiag =
            (warpTarget.row < this.ctx.grid.rows / 2 ? 1 : 0) * 2 +
            (warpTarget.col < this.ctx.grid.cols / 2 ? 1 : 0);
          const diagMap = [1, 2, 0, 3];
          diagIdx = diagMap[toCenterDiag];
          stepIdx = 0;
          rotationAttempts = 0;
        }
      }
    }

    return positions;
  }

  private drawChainVisual(positions: { row: number; col: number }[]): void {
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
  }
}
