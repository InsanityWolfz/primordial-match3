import { GAME_CONFIG } from '../../config/gameConfig.ts';
import type { GameContext } from '../../types/GameContext.ts';
import type { CascadeSystem } from '../CascadeSystem.ts';
import type { DamageSystem } from '../DamageSystem.ts';
import type { PassiveManager } from '../PassiveManager.ts';
import { Gem } from '../../entities/Gem.ts';

export class AirPowerExecutor {
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
   * Gust: hit full row + full column of target (cross pattern).
   * Modifiers:
   *   Turbulence     — cascade mult bonus ×2 (handled in PassiveManager.getAirCascadeBonus)
   *   Crosswind      — also hit adjacent rows/cols (±1 from target)
   *   Tailwind       — apply Haste to all enemies hit
   *   Eye of Storm   — if 3+ cascades triggered, auto-reshuffle the board
   *   Cyclone        — fire a small 5-tile cross at a random position after main blast
   *   Supercell      — destroy all hazards on board
   *   Jet Stream     — handled in GameScene (retain 50% of cascade mult between turns)
   *   Hurricane      — if 5+ cascades triggered, fire second gust at 50% damage
   *   Twister        — convert least-common element gems to air gems
   */
  async executeGust(targetRow: number, targetCol: number, computedDamage: number): Promise<void> {
    this.passiveManager.onDamageDealt('air', computedDamage, 'gust');

    const { doubleTap } = this.passiveManager.onPowerFired('gust');

    const positions = this.buildCrossPositions(targetRow, targetCol);
    if (positions.length === 0) return;

    this.drawGustVisual(targetRow, targetCol);

    // Supercell: destroy all hazards before/during gust
    if (this.has('air_supercell')) {
      await this.ctx.hazardManager.destroyAllHazards();
    }

    await this.damageSystem.dealDamage(positions, computedDamage, 'air');

    // Tailwind: haste all enemies hit
    if (this.has('air_tailwind')) {
      const hastedEnemies = new Set<string>();
      for (const pos of positions) {
        const enemy = this.ctx.enemyManager.getEnemyAt(pos.row, pos.col);
        if (!enemy || enemy.hp <= 0) continue;
        const key = `${enemy.gridRow},${enemy.gridCol}`;
        if (!hastedEnemies.has(key)) {
          hastedEnemies.add(key);
          enemy.hasteIntents();
        }
      }
    }

    // Cyclone: second small cross at a random tile
    if (this.has('air_cyclone')) {
      await this.executeCyclone(computedDamage);
    }

    // Process cascades and track depth for Eye of Storm / Hurricane
    this.cascadeSystem.resetCascadeCounter();
    await this.cascadeSystem.applyGravityAndSpawn();
    const matches = this.ctx.findMatches();
    if (matches.length > 0) {
      await this.cascadeSystem.processCascade(matches, 1);
    }
    const cascadeDepth = this.cascadeSystem.getLastCascadeDepth();

    // Eye of the Storm: 3+ cascades → reshuffle board
    if (this.has('air_eye_of_storm') && cascadeDepth >= 3) {
      await this.reshuffleBoard();
    }

    // Hurricane: 5+ cascades → fire second gust at 50%
    if (this.has('air_hurricane') && cascadeDepth >= 5) {
      const hurricaneDmg = Math.max(1, Math.floor(computedDamage * 0.5));
      await this.executeGust(targetRow, targetCol, hurricaneDmg);
      return; // hurricane gust handles its own cascade + twister
    }

    // Twister: convert least-common element to air
    if (this.has('air_twister')) {
      this.applyTwister();
    }

    // Double Tap
    if (doubleTap) {
      const tapDmg = Math.max(1, Math.floor(computedDamage * 0.3));
      await this.executeGust(targetRow, targetCol, tapDmg);
    }
  }

  private buildCrossPositions(targetRow: number, targetCol: number): { row: number; col: number }[] {
    const posSet = new Set<string>();
    const positions: { row: number; col: number }[] = [];

    const addTile = (r: number, c: number) => {
      if (r < 0 || r >= this.ctx.grid.rows || c < 0 || c >= this.ctx.grid.cols) return;
      const key = `${r},${c}`;
      if (!posSet.has(key) && (this.ctx.grid.getGem(r, c) || this.ctx.grid.isEnemyTile(r, c))) {
        posSet.add(key);
        positions.push({ row: r, col: c });
      }
    };

    // Primary cross: full row + full column
    for (let c = 0; c < this.ctx.grid.cols; c++) addTile(targetRow, c);
    for (let r = 0; r < this.ctx.grid.rows; r++) addTile(r, targetCol);

    // Crosswind: add adjacent rows and columns
    if (this.has('air_crosswind')) {
      for (let c = 0; c < this.ctx.grid.cols; c++) {
        addTile(targetRow - 1, c);
        addTile(targetRow + 1, c);
      }
      for (let r = 0; r < this.ctx.grid.rows; r++) {
        addTile(r, targetCol - 1);
        addTile(r, targetCol + 1);
      }
    }

    return positions;
  }

  private async executeCyclone(damage: number): Promise<void> {
    // Pick a random non-enemy position for cyclone center
    const candidates: { row: number; col: number }[] = [];
    for (let r = 0; r < this.ctx.grid.rows; r++) {
      for (let c = 0; c < this.ctx.grid.cols; c++) {
        if (this.ctx.grid.getGem(r, c) && !this.ctx.grid.isEnemyTile(r, c)) {
          candidates.push({ row: r, col: c });
        }
      }
    }
    if (candidates.length === 0) return;

    const center = candidates[Math.floor(Math.random() * candidates.length)];
    const dirs = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] as const;
    const cyclonePositions: { row: number; col: number }[] = [];
    for (const [dr, dc] of dirs) {
      const r = center.row + dr;
      const c = center.col + dc;
      if (
        r >= 0 && r < this.ctx.grid.rows &&
        c >= 0 && c < this.ctx.grid.cols &&
        (this.ctx.grid.getGem(r, c) || this.ctx.grid.isEnemyTile(r, c))
      ) {
        cyclonePositions.push({ row: r, col: c });
      }
    }

    const cycloneDmg = Math.max(1, Math.floor(damage * 0.5));
    await this.damageSystem.dealDamage(cyclonePositions, cycloneDmg, 'air');
  }

  private async reshuffleBoard(): Promise<void> {
    this.ctx.hazardManager.releaseAllGems();

    const nonEnemyPositions: { row: number; col: number }[] = [];
    const allGems: (Gem | null)[] = [];
    for (let r = 0; r < this.ctx.grid.rows; r++) {
      for (let c = 0; c < this.ctx.grid.cols; c++) {
        if (this.ctx.grid.isEnemyTile(r, c)) continue;
        nonEnemyPositions.push({ row: r, col: c });
        allGems.push(this.ctx.grid.getGem(r, c));
      }
    }

    for (let i = allGems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allGems[i], allGems[j]] = [allGems[j], allGems[i]];
    }

    const movePromises: Promise<void>[] = [];
    for (let i = 0; i < nonEnemyPositions.length; i++) {
      const { row: r, col: c } = nonEnemyPositions[i];
      const gem = allGems[i];
      this.ctx.grid.setGem(r, c, gem);
      if (gem) {
        gem.setGridPosition(r, c);
        const pos = gem.getWorldPosition();
        movePromises.push(gem.moveTo(pos.x, pos.y, 300));
      }
    }
    await Promise.all(movePromises);
    this.ctx.hazardManager.reassociateGems();

    const newMatches = this.ctx.findMatches();
    if (newMatches.length > 0) {
      await this.cascadeSystem.processCascade(newMatches, 1);
    }
  }

  private applyTwister(): void {
    const airType = GAME_CONFIG.gemTypes.find(g => g.name === 'air');
    if (!airType) return;

    // Count each element (excluding air and enemy tiles)
    const counts = new Map<string, { row: number; col: number }[]>();
    for (let r = 0; r < this.ctx.grid.rows; r++) {
      for (let c = 0; c < this.ctx.grid.cols; c++) {
        const gem = this.ctx.grid.getGem(r, c);
        if (!gem || this.ctx.grid.isEnemyTile(r, c)) continue;
        const name = gem.type.name;
        if (name === 'air') continue;
        if (!counts.has(name)) counts.set(name, []);
        counts.get(name)!.push({ row: r, col: c });
      }
    }

    if (counts.size === 0) return;

    // Find least-common element
    let minCount = Infinity;
    let leastCommon = '';
    for (const [type, positions] of counts) {
      if (positions.length < minCount) {
        minCount = positions.length;
        leastCommon = type;
      }
    }

    if (!leastCommon) return;

    for (const pos of counts.get(leastCommon)!) {
      const gem = this.ctx.grid.getGem(pos.row, pos.col);
      if (gem) gem.changeType(airType);
    }
  }

  private drawGustVisual(targetRow: number, targetCol: number): void {
    const scene = this.ctx.phaserScene;
    const flash = scene.add.graphics();
    const airColor = GAME_CONFIG.gemTypes.find(g => g.name === 'air')?.color ?? 0xe8e8e8;
    flash.fillStyle(airColor, 0.3);
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;

    const rowCount = this.has('air_crosswind') ? 3 : 1;
    const colCount = this.has('air_crosswind') ? 3 : 1;

    for (let dr = -(rowCount - 1); dr <= (rowCount - 1); dr++) {
      const r = targetRow + dr;
      if (r < 0 || r >= this.ctx.grid.rows) continue;
      for (let c = 0; c < this.ctx.grid.cols; c++) {
        flash.fillRect(
          GAME_CONFIG.gridOffsetX + c * cellSize,
          GAME_CONFIG.gridOffsetY + r * cellSize,
          GAME_CONFIG.gemSize, GAME_CONFIG.gemSize,
        );
      }
    }
    for (let dc = -(colCount - 1); dc <= (colCount - 1); dc++) {
      const c = targetCol + dc;
      if (c < 0 || c >= this.ctx.grid.cols) continue;
      for (let r = 0; r < this.ctx.grid.rows; r++) {
        flash.fillRect(
          GAME_CONFIG.gridOffsetX + c * cellSize,
          GAME_CONFIG.gridOffsetY + r * cellSize,
          GAME_CONFIG.gemSize, GAME_CONFIG.gemSize,
        );
      }
    }

    scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 350,
      onComplete: () => flash.destroy(),
    });
  }
}
