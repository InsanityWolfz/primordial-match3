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
  private onMatchThreeCb?: () => void;

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

  /** Wire up the match count callback — fires for any match (3+) for A×B=C turn bonus. */
  setOnMatchThree(cb: () => void): void {
    this.onMatchThreeCb = cb;
  }

  async processCascade(matches: { row: number; col: number }[], cascadeLevel: number): Promise<void> {
    // Calculate score with cascade multiplier
    const multiplier = Math.pow(GAME_CONFIG.cascadeMultiplier, cascadeLevel - 1);
    const points = Math.round(matches.length * GAME_CONFIG.scorePerGem * multiplier);

    // Passive: match completed bonuses (Wild Growth, Elemental Resonance, etc.)
    // Cascade wave bonus and CASCADE passive removed — A×B=C turn bonus handles essence income.
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

    this.ctx.score += points;
    this.ctx.updateScoreDisplay();

    // Track any valid match (3+) for A×B=C turn bonus
    if (matches.length >= 3) this.onMatchThreeCb?.();

    // DamageSystem handles destruction, essence, and clearing
    await this.damageSystem.dealDamage(matches, 1, null);

    // Adjacent matches deal 1 damage to neighboring hazards
    const destroyedHazards = await this.ctx.hazardManager.damageAdjacentHazards(matches);

    // Passive: Combustion triggers on hazard destroy
    if (this.passiveManager && destroyedHazards.length > 0) {
      for (const pos of destroyedHazards) {
        await this.passiveManager.onHazardDestroyed(pos.row, pos.col);
      }
    }

    // Post-match passive powers (Splash, Windslash, Capacitor)
    // Pass match positions so Capacitor can chain to adjacent gems
    await this.executePostMatchPassives(matches);

    await this.applyGravityAndSpawn();

    // Use hazard-aware match finding
    const newMatches = this.ctx.findMatches();
    if (newMatches.length > 0) {
      await this.processCascade(newMatches, cascadeLevel + 1);
    }
  }

  async applyGravityAndSpawn(): Promise<void> {
    const gravityMoves = this.ctx.grid.applyGravity();
    if (gravityMoves.length > 0) {
      // Move hazards to follow their gems
      this.ctx.hazardManager.applyGravity(gravityMoves);

      const fallPromises = gravityMoves.map((move) => {
        const targetPos = move.gem.getWorldPosition();
        return move.gem.moveTo(targetPos.x, targetPos.y, GAME_CONFIG.fallDuration);
      });
      // Also animate hazards falling
      const hazardFallPromises = this.ctx.hazardManager.animateGravity(gravityMoves);
      await Promise.all([...fallPromises, ...hazardFallPromises]);
    }
    await this.spawnNewGems();
    await this.ctx.delay(GAME_CONFIG.cascadeDelay);
  }

  async spawnNewGems(): Promise<void> {
    const emptyColumns = this.ctx.grid.countEmptyTop();
    const fallPromises: Promise<void>[] = [];

    for (const { col, count } of emptyColumns) {
      for (let i = 0; i < count; i++) {
        const row = count - 1 - i;
        const gemType = this.ctx.getRandomGemType();
        const gem = new Gem(this.ctx.phaserScene, row, col, gemType, GAME_CONFIG.gemSize);

        const spawnY = GAME_CONFIG.gridOffsetY - (i + 1) * (GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding);
        gem.sprite.setPosition(gem.sprite.x, spawnY);

        this.ctx.grid.setGem(row, col, gem);
        gem.sprite.on('pointerdown', () => this.ctx.onGemClick(gem));

        const targetPos = gem.getWorldPosition();
        fallPromises.push(gem.moveTo(targetPos.x, targetPos.y, GAME_CONFIG.fallDuration));
      }
    }

    await Promise.all(fallPromises);
  }

  async clearInitialMatches(): Promise<void> {
    this.ctx.isSwapping = true;

    // clearInitialMatches runs before hazards are placed, so no hazard awareness needed
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
