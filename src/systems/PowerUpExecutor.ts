import type { GameContext } from '../types/GameContext.ts';
import type { CascadeSystem } from './CascadeSystem.ts';
import type { DamageSystem } from './DamageSystem.ts';
import type { PassiveManager } from './PassiveManager.ts';
import { FirePowerExecutor } from './powers/FirePowerExecutor.ts';
import { WaterPowerExecutor } from './powers/WaterPowerExecutor.ts';
import { AirPowerExecutor } from './powers/AirPowerExecutor.ts';
import { EarthPowerExecutor } from './powers/EarthPowerExecutor.ts';
import { LightningPowerExecutor } from './powers/LightningPowerExecutor.ts';

/**
 * PowerUpExecutor: dispatches to per-element executors.
 *
 * New power model:
 *  - Powers have a `base` damage pool and a `multiplierPool`.
 *  - Firing is only allowed when base > 0.
 *  - Firing costs 1 turn.
 *  - Damage = base × max(1, multiplierPool). Both reset to 0 after firing.
 */
export class PowerUpExecutor {
  private ctx: GameContext;
  private cancelTargeting: () => void;
  private endRound: () => Promise<void>;
  private onActionComplete: () => void;
  private onFlashCard: (id: string) => void;

  private lastConsumedBase = 0;
  private lastConsumedMult = 0;

  private fireExecutor!: FirePowerExecutor;
  private waterExecutor!: WaterPowerExecutor;
  private airExecutor!: AirPowerExecutor;
  private earthExecutor!: EarthPowerExecutor;
  private lightningExecutor!: LightningPowerExecutor;

  constructor(
    ctx: GameContext,
    _cascadeSystem: CascadeSystem,
    callbacks: {
      cancelTargeting: () => void;
      endRound: () => Promise<void>;
      onActionComplete: () => void;
      onFlashCard: (id: string) => void;
    },
  ) {
    this.ctx = ctx;
    this.cancelTargeting = callbacks.cancelTargeting;
    this.endRound = callbacks.endRound;
    this.onActionComplete = callbacks.onActionComplete;
    this.onFlashCard = callbacks.onFlashCard;
  }

  initExecutors(
    cascadeSystem: CascadeSystem,
    damageSystem: DamageSystem,
    passiveManager: PassiveManager,
  ): void {
    this.fireExecutor = new FirePowerExecutor(this.ctx, cascadeSystem, damageSystem, passiveManager);
    this.waterExecutor = new WaterPowerExecutor(this.ctx, cascadeSystem, damageSystem, passiveManager);
    this.airExecutor = new AirPowerExecutor(this.ctx, cascadeSystem, damageSystem, passiveManager);
    this.earthExecutor = new EarthPowerExecutor(this.ctx, cascadeSystem, damageSystem, passiveManager);
    this.lightningExecutor = new LightningPowerExecutor(this.ctx, cascadeSystem, damageSystem, passiveManager);
  }

  // ──────────────── HELPERS ────────────────

  /**
   * Compute and consume a power's accumulated damage.
   * Returns 0 (and does not consume) if base is 0.
   * Pre-modifiers applied here: Glacial Wrath (icelance).
   * Post-consume: Flash Fire preserves multiplierPool at streak 5+.
   * Stores lastConsumedBase/Mult for executors that need them.
   */
  private consumePower(id: string): number {
    const owned = this.ctx.ownedPowerUps.find(p => p.powerUpId === id);
    if (!owned || owned.base <= 0) return 0;

    // Glacial Wrath: add hazard count to icelance mult before computing damage
    if (id === 'icelance' && this.ctx.ownedModifiers.includes('ice_glacial_wrath')) {
      owned.multiplierPool += this.ctx.hazardManager.getRemainingCount();
    }

    this.lastConsumedBase = owned.base;
    this.lastConsumedMult = owned.multiplierPool;

    const damage = Math.floor(owned.base * Math.max(1, owned.multiplierPool));
    const savedMult = owned.multiplierPool;
    owned.base = 0;
    owned.multiplierPool = 0;

    // Flash Fire: streak 5+ preserves multiplierPool on fireball
    if (
      id === 'fireball' &&
      this.ctx.ownedModifiers.includes('fire_flash_fire') &&
      this.ctx.fireStreakCount >= 5
    ) {
      owned.multiplierPool = savedMult;
    }

    // Jet Stream: retain 50% of Gust's cascade multiplier after firing instead of full reset
    if (id === 'gust' && this.ctx.ownedModifiers.includes('air_jet_stream')) {
      owned.multiplierPool = Math.floor(savedMult * 0.5);
    }

    return damage;
  }

  /** Spend one turn for a power activation. */
  private spendTurn(): void {
    this.ctx.turnsRemaining--;
    this.ctx.updateTurnsDisplay();
  }

  // ──────────────── DISPATCH ────────────────

  async executeNonTargetedPowerUp(id: string): Promise<void> {
    this.ctx.isSwapping = true;
    const owned = this.ctx.ownedPowerUps.find(p => p.powerUpId === id);
    if (!owned || owned.base <= 0) {
      this.cancelTargeting();
      this.ctx.isSwapping = false;
      return;
    }

    const computedDamage = this.consumePower(id);
    this.spendTurn();
    this.onFlashCard(id);
    this.cancelTargeting();

    switch (id) {
      case 'earthquake':
        await this.earthExecutor.executeEarthquake(computedDamage, this.lastConsumedBase, this.lastConsumedMult);
        break;
      case 'icelance':
        await this.waterExecutor.executeIceLance(computedDamage, this.lastConsumedMult);
        break;
    }

    this.onActionComplete();
    this.ctx.isSwapping = false;

    await this.checkEndCondition();
  }

  async executeTargetedPowerUp(id: string, row: number, col: number): Promise<void> {
    this.ctx.isSwapping = true;
    const owned = this.ctx.ownedPowerUps.find(p => p.powerUpId === id);
    if (!owned || owned.base <= 0) {
      this.cancelTargeting();
      this.ctx.isSwapping = false;
      return;
    }

    const computedDamage = this.consumePower(id);
    this.spendTurn();
    this.onFlashCard(id);
    this.cancelTargeting();

    switch (id) {
      case 'fireball':
        await this.fireExecutor.executeFireball(row, col, computedDamage);
        break;
      case 'chainstrike':
        await this.lightningExecutor.executeChainStrike(row, col, computedDamage);
        break;
      case 'gust':
        await this.airExecutor.executeGust(row, col, computedDamage);
        break;
    }

    this.onActionComplete();
    this.ctx.isSwapping = false;

    await this.checkEndCondition();
  }

  private async checkEndCondition(): Promise<void> {
    if (this.ctx.enemyManager.allEnemiesDead()) {
      await this.endRound();
      return;
    }
    if (this.ctx.turnsRemaining <= 0) {
      await this.endRound();
    }
  }

  // ──────────────── PASSIVE POWER TRIGGERS ────────────────

  async executePostMatchPassives(_matchPositions: { row: number; col: number }[] = []): Promise<void> {
    // No passive powers currently active — modifiers will add effects here
  }
}
