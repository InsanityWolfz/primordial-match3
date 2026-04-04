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
 * Powers do NOT cost turns — only successful matches cost turns.
 */
export class PowerUpExecutor {
  private ctx: GameContext;
  private updateHudCharges: () => void;
  private cancelTargeting: () => void;
  private endRound: () => Promise<void>;
  private onActionComplete: () => void;
  private onFlashCard: (id: string) => void;

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
    },
  ) {
    this.ctx = ctx;
    this.updateHudCharges = callbacks.updateHudCharges;
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
    this.updateHudCharges();
    this.onFlashCard(id);
    this.cancelTargeting();

    // Powers do NOT cost turns
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

    // Check lose condition: turns exhausted AND no charges left
    if (this.ctx.turnsRemaining <= 0) {
      await this.checkEndCondition();
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

    if (id === 'transmute') {
      const confirmed = await this.natureExecutor.executeTransmute(owned.level, row, col);
      if (!confirmed) {
        this.updateHudCharges();
        this.ctx.isSwapping = false;
        return;
      }
      owned.charges--;
      this.updateHudCharges();
      this.onFlashCard(id);
    } else {
      owned.charges--;
      this.updateHudCharges();
      this.onFlashCard(id);

      // Powers do NOT cost turns
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

    // Check lose condition after every power use
    if (this.ctx.turnsRemaining <= 0) {
      await this.checkEndCondition();
    }
  }

  /**
   * After turns hit 0, check if the player can still act.
   * Lose if turns = 0 AND no power charges remain.
   * If all enemies are dead, go to shop regardless.
   */
  private async checkEndCondition(): Promise<void> {
    if (this.ctx.enemyManager.allEnemiesDead()) {
      await this.endRound();
      return;
    }

    const hasCharges = this.ctx.ownedPowerUps.some(p => p.charges > 0);
    if (!hasCharges) {
      await this.endRound();
    }
    // Otherwise: turns = 0 but has charges — keep playing
  }

  // ──────────────── PASSIVE POWER TRIGGERS ────────────────

  async executePostMatchPassives(matchPositions: { row: number; col: number }[] = []): Promise<void> {
    if (await this.waterExecutor.executeSplashPassive()) this.onFlashCard('splash');
    if (await this.airExecutor.executeWindslashPassive()) this.onFlashCard('windslash');
    if (await this.lightningExecutor.executeCapacitorPassive(matchPositions)) this.onFlashCard('capacitor');
  }

  async executeSplashPassive(matchPositions: { row: number; col: number }[] = []): Promise<void> {
    await this.executePostMatchPassives(matchPositions);
  }
}
