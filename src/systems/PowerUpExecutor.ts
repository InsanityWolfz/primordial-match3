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
    },
  ) {
    this.ctx = ctx;
    this.updateHudCharges = callbacks.updateHudCharges;
    this.cancelTargeting = callbacks.cancelTargeting;
    this.endRound = callbacks.endRound;
    this.onActionComplete = callbacks.onActionComplete;
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

    this.updateHudCharges();
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
    } else {
      owned.charges--;
      switch (id) {
        case 'fireball':
          await this.fireExecutor.executeFireball(owned.level, row, col);
          break;
        case 'chainstrike':
          await this.lightningExecutor.executeChainStrike(owned.level, row, col);
          break;
      }
    }

    this.updateHudCharges();
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
   */
  async executePostMatchPassives(): Promise<void> {
    // Splash (water passive power)
    await this.waterExecutor.executeSplashPassive();

    // Windslash (air passive power) — chance-based
    await this.airExecutor.executeWindslashPassive();

    // Capacitor (lightning passive power)
    await this.lightningExecutor.executeCapacitorPassive();
  }

  /**
   * Legacy method for backward compat with CascadeSystem.
   * Now delegates to executePostMatchPassives.
   */
  async executeSplashPassive(): Promise<void> {
    await this.executePostMatchPassives();
  }
}
