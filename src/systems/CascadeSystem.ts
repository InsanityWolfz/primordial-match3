import type Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import { Gem } from '../entities/Gem.ts';
import type { GameContext } from '../types/GameContext.ts';
import type { DamageSystem } from './DamageSystem.ts';
import type { PassiveManager } from './PassiveManager.ts';

export class CascadeSystem {
  private ctx: GameContext;
  private executePostMatchPassives: (matchPositions: { row: number; col: number }[]) => Promise<void>;
  private damageSystem!: DamageSystem;
  private passiveManager!: PassiveManager;

  // Per-round essence tracking callbacks
  private onMatchGroupCb?: (element: string, size: number) => void;
  private onGemsDestroyedCb?: (count: number) => void;

  constructor(ctx: GameContext, executePostMatchPassives: (matchPositions: { row: number; col: number }[]) => Promise<void>) {
    this.ctx = ctx;
    this.executePostMatchPassives = executePostMatchPassives;
  }

  setDamageSystem(damageSystem: DamageSystem): void {
    this.damageSystem = damageSystem;
  }

  setPassiveManager(passiveManager: PassiveManager): void {
    this.passiveManager = passiveManager;
  }

  /**
   * Called for each match group (element + size).
   * Used for charge refunds and per-round essence multiplier tracking.
   */
  setOnMatchGroup(cb: (element: string, size: number) => void): void {
    this.onMatchGroupCb = cb;
  }

  /** Called with total gem count destroyed in a match wave. */
  setOnGemsDestroyed(cb: (count: number) => void): void {
    this.onGemsDestroyedCb = cb;
  }

  async processCascade(matches: { row: number; col: number }[], cascadeLevel: number): Promise<void> {
    // Identify match groups for charge refunds and multiplier tracking
    const groups = this.ctx.grid.findMatchGroups(
      (r, c) => this.ctx.hazardManager.hasHazard(r, c),
    );

    // Fire per-group callbacks (charge refund + essence multiplier)
    for (const group of groups) {
      this.onMatchGroupCb?.(group.element, group.size);
    }

    // Passive: match completed bonuses
    if (this.passiveManager) {
      const matchElement = matches.length > 0
        ? (this.ctx.grid.getGem(matches[0].row, matches[0].col)?.type.name ?? '')
        : '';
      const matchResult = this.passiveManager.onMatchCompleted(matchElement, matches.length);
      if (matchResult.bonusEssence > 0) {
        this.ctx.essence += matchResult.bonusEssence;
        this.ctx.updateEssenceDisplay();
      }
    }

    // Destroy matched gems (DamageSystem handles animation + grid clearing)
    const damageResult = await this.damageSystem.dealDamage(matches, 1, null);

    // Report gem count for per-round essence accumulation
    if (damageResult.essenceGained > 0) {
      this.onGemsDestroyedCb?.(damageResult.essenceGained);
    }

    // Adjacent matches deal 1 instance of damage to neighbouring hazards
    const destroyedHazards = await this.ctx.hazardManager.damageAdjacentHazards(matches);

    // Passive: Combustion triggers on hazard destroy
    if (this.passiveManager && destroyedHazards.length > 0) {
      for (const pos of destroyedHazards) {
        await this.passiveManager.onHazardDestroyed(pos.row, pos.col);
      }
    }

    // Post-match passive powers (Splash, Windslash, Capacitor)
    await this.executePostMatchPassives(matches);

    await this.applyGravityAndSpawn();

    // Check for cascades
    const newMatches = this.ctx.findMatches();
    if (newMatches.length > 0) {
      await this.processCascade(newMatches, cascadeLevel + 1);
    }
  }

  async applyGravityAndSpawn(): Promise<void> {
    const gravityMoves = this.ctx.grid.applyGravity();
    if (gravityMoves.length > 0) {
      this.ctx.hazardManager.applyGravity(gravityMoves);

      const fallPromises = gravityMoves.map((move) => {
        const targetPos = move.gem.getWorldPosition();
        return move.gem.moveTo(targetPos.x, targetPos.y, GAME_CONFIG.fallDuration);
      });
      const hazardFallPromises = this.ctx.hazardManager.animateGravity(gravityMoves);
      await Promise.all([...fallPromises, ...hazardFallPromises]);
    }
    await this.spawnNewGems();
    await this.ctx.delay(GAME_CONFIG.cascadeDelay);
  }

  async spawnNewGems(): Promise<void> {
    const emptyColumns = this.ctx.grid.countEmptyTop();
    const fallPromises: Promise<void>[] = [];

    for (const { col, count, rows } of emptyColumns) {
      for (let i = 0; i < count; i++) {
        const row = rows[i]; // actual empty row — may be below enemy tiles

        // Skip if this row is an enemy tile (safety guard)
        if (this.ctx.grid.isEnemyTile(row, col)) continue;

        const gemType = this.ctx.getRandomGemType();
        const gem = new Gem(this.ctx.phaserScene, row, col, gemType, GAME_CONFIG.gemSize);

        // Maybe spawn as hazard (dynamic hazard chance)
        const hazardSpawned = this.ctx.hazardManager.maybeSpawnHazardOnGem(row, col, gem);
        if (!hazardSpawned) {
          // Normal spawn — position above grid and animate falling
          const spawnY = GAME_CONFIG.gridOffsetY - (i + 1) * (GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding);
          gem.sprite.setPosition(gem.sprite.x, spawnY);
        }

        this.ctx.grid.setGem(row, col, gem);
        gem.sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.ctx.onGemPointerDown(gem, pointer));

        const targetPos = gem.getWorldPosition();
        fallPromises.push(gem.moveTo(targetPos.x, targetPos.y, GAME_CONFIG.fallDuration));
      }
    }

    await Promise.all(fallPromises);
  }

  async clearInitialMatches(): Promise<void> {
    this.ctx.isSwapping = true;

    let matches = this.ctx.grid.findMatches();
    while (matches.length > 0) {
      const clearPromises: Promise<void>[] = [];
      for (const pos of matches) {
        const gem = this.ctx.grid.getGem(pos.row, pos.col);
        if (gem) {
          clearPromises.push(gem.playDestroyAnimation(GAME_CONFIG.clearDuration));
        }
      }
      await Promise.all(clearPromises);

      this.ctx.grid.clearPositions(matches);

      const gravityMoves = this.ctx.grid.applyGravity();
      if (gravityMoves.length > 0) {
        const fallPromises = gravityMoves.map((move) => {
          const targetPos = move.gem.getWorldPosition();
          return move.gem.moveTo(targetPos.x, targetPos.y, GAME_CONFIG.fallDuration);
        });
        await Promise.all(fallPromises);
      }

      await this.spawnNewGems();
      await this.ctx.delay(GAME_CONFIG.cascadeDelay);

      matches = this.ctx.grid.findMatches();
    }

    this.ctx.isSwapping = false;
  }
}
