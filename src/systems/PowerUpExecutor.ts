import type { GameContext } from '../types/GameContext.ts';
import type { CascadeSystem } from './CascadeSystem.ts';
import type { DamageSystem } from './DamageSystem.ts';
import type { PassiveManager } from './PassiveManager.ts';
import { FirePowerExecutor } from './powers/FirePowerExecutor.ts';
import { WaterPowerExecutor } from './powers/WaterPowerExecutor.ts';
import { AirPowerExecutor } from './powers/AirPowerExecutor.ts';
import { EarthPowerExecutor } from './powers/EarthPowerExecutor.ts';
import { NaturePowerExecutor } from './powers/NaturePowerExecutor.ts';
import { LightningPowerExecutor } from './powers/LightningPowerExecutor.ts';

/**
 * PowerUpExecutor: thin dispatcher that delegates to per-element executors.
 * Handles charge consumption, targeting flow, and round-end checks.
 * All execution logic lives in the element-specific executors.
 */
export class PowerUpExecutor {
  private ctx: GameContext;
  private updateHudCharges: () => void;
  private cancelTargeting: () => void;
  private endRound: () => Promise<void>;
  private onActionComplete: () => void;
  private onFlashCard: (id: string) => void;
  private onPowerTurnConsumed: () => void;

  // Element executors (initialized via setDamageSystem)
  private fireExecutor!: FirePowerExecutor;
  private waterExecutor!: WaterPowerExecutor;
  private airExecutor!: AirPowerExecutor;
  private earthExecutor!: EarthPowerExecutor;
  private natureExecutor!: NaturePowerExecutor;
  private lightningExecutor!: LightningPowerExecutor;

  constructor(
    ctx: GameContext,
    _cascadeSystem: CascadeSystem,
    callbacks: {
      updateHudCharges: () => void;
      cancelTargeting: () => void;
      endRound: () => Promise<void>;
      onActionComplete: () => void;
      onFlashCard: (id: string) => void;
      onPowerTurnConsumed: () => void;
    },
  ) {
    this.ctx = ctx;
    this.updateHudCharges = callbacks.updateHudCharges;
    this.cancelTargeting = callbacks.cancelTargeting;
    this.endRound = callbacks.endRound;
    this.onActionComplete = callbacks.onActionComplete;
    this.onFlashCard = callbacks.onFlashCard;
    this.onPowerTurnConsumed = callbacks.onPowerTurnConsumed;
  }

  /**
   * Late-init: create all element executors once DamageSystem and PassiveManager are available.
   */
  initExecutors(
    cascadeSystem: CascadeSystem,
    damageSystem: DamageSystem,
    passiveManager: PassiveManager,
  ): void {
    this.fireExecutor = new FirePowerExecutor(this.ctx, cascadeSystem, damageSystem, passiveManager);
    this.waterExecutor = new WaterPowerExecutor(this.ctx, cascadeSystem, damageSystem, passiveManager);
    this.airExecutor = new AirPowerExecutor(this.ctx, cascadeSystem, damageSystem, passiveManager);
    this.earthExecutor = new EarthPowerExecutor(this.ctx, cascadeSystem, damageSystem, passiveManager);
    this.natureExecutor = new NaturePowerExecutor(this.ctx, cascadeSystem);
    this.lightningExecutor = new LightningPowerExecutor(this.ctx, cascadeSystem, damageSystem, passiveManager);
  }

  // ──────────────── DISPATCH ────────────────

  async executeNonTargetedPowerUp(id: string): Promise<void> {
    this.ctx.isSwapping = true;
    const owned = this.ctx.ownedPowerUps.find(p => p.powerUpId === id);
    if (!owned || owned.charges <= 0) {
      this.cancelTargeting();
      this.ctx.isSwapping = false;
      return;
    }

    owned.charges--;
    this.updateHudCharges(); // show charge removal immediately
    this.onFlashCard(id);
    // All non-Transmute active powers cost a turn
    this.ctx.turnsRemaining--;
    this.onPowerTurnConsumed();
    this.cancelTargeting();

    switch (id) {
      case 'earthquake':
        await this.earthExecutor.executeEarthquake(owned.level);
        break;
      case 'gust':
        await this.airExecutor.executeGust(owned.level);
        break;
      case 'watergun':
        await this.waterExecutor.executeWaterGun(owned.level);
        break;
    }
    this.onActionComplete();
    this.ctx.isSwapping = false;

    if (this.ctx.turnsRemaining <= 0) {
      await this.endRound();
    }
  }

  async executeTargetedPowerUp(id: string, row: number, col: number): Promise<void> {
    this.ctx.isSwapping = true;
    const owned = this.ctx.ownedPowerUps.find(p => p.powerUpId === id);
    if (!owned || owned.charges <= 0) {
      this.cancelTargeting();
      this.ctx.isSwapping = false;
      return;
    }

    this.cancelTargeting();

    // Transmute has a 2-step UI (gem click → color picker) that can be cancelled
    if (id === 'transmute') {
      const confirmed = await this.natureExecutor.executeTransmute(owned.level, row, col);
      if (!confirmed) {
        // Player cancelled the element picker — refund and reset
        this.updateHudCharges();
        this.ctx.isSwapping = false;
        return;
      }
      owned.charges--;
      this.updateHudCharges(); // show charge removal immediately
      this.onFlashCard(id);
    } else {
      owned.charges--;
      this.updateHudCharges(); // show charge removal immediately
      this.onFlashCard(id);
      // Non-Transmute targeted powers cost a turn
      this.ctx.turnsRemaining--;
      this.onPowerTurnConsumed();
      switch (id) {
        case 'fireball':
          await this.fireExecutor.executeFireball(owned.level, row, col);
          break;
        case 'chainstrike':
          await this.lightningExecutor.executeChainStrike(owned.level, row, col);
          break;
      }
    }
    this.onActionComplete();
    this.ctx.isSwapping = false;

    if (this.ctx.turnsRemaining <= 0) {
      await this.endRound();
    }
  }

  // ──────────────── PASSIVE POWER TRIGGERS ────────────────

  /**
   * Called after every match cascade step.
   * Triggers all passive powers that fire on match.
   * matchPositions: the gems that were just matched (used by Capacitor for adjacent targeting).
   */
  async executePostMatchPassives(matchPositions: { row: number; col: number }[] = []): Promise<void> {
    // Splash (water passive power)
    if (await this.waterExecutor.executeSplashPassive()) this.onFlashCard('splash');

    // Windslash (air passive power) — chance-based, only flashes when it triggers
    if (await this.airExecutor.executeWindslashPassive()) this.onFlashCard('windslash');

    // Capacitor (lightning passive power) — chains adjacent to matched gems
    if (await this.lightningExecutor.executeCapacitorPassive(matchPositions)) this.onFlashCard('capacitor');
  }

  /**
   * Legacy method for backward compat with CascadeSystem.
   * Now delegates to executePostMatchPassives.
   */
  async executeSplashPassive(matchPositions: { row: number; col: number }[] = []): Promise<void> {
    await this.executePostMatchPassives(matchPositions);
  }
}
