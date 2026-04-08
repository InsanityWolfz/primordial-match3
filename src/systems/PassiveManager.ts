import type { GameContext } from '../types/GameContext.ts';
import type { OwnedPowerUp } from '../types/RunState.ts';
import { getPowerUpDef } from '../config/powerUps.ts';

/**
 * PassiveManager handles all owned-modifier passive effects.
 * Hooks are called from GameScene, CascadeSystem, and power executors.
 */
export class PassiveManager {
  private ctx: GameContext;
  private onFlashCard: ((id: string) => void) | null = null;

  // Per-round state
  private doubleTapFiredThisRound = false;
  private faradayShieldUsedThisRound = false;
  private elementalSurgeMatchCount = 0; // total match-3s this round
  private killsThisRound = 0;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
  }

  setDamageSystem(_damageSystem: unknown): void {}

  setFlashCardCallback(cb: (id: string) => void): void {
    this.onFlashCard = cb;
  }

  // ──────────────── HELPERS ────────────────

  private has(id: string): boolean {
    return this.ctx.ownedModifiers.includes(id);
  }

  private get powers(): OwnedPowerUp[] {
    return this.ctx.ownedPowerUps;
  }

  private activePowers(): OwnedPowerUp[] {
    return this.powers.filter(p => {
      const def = getPowerUpDef(p.powerUpId);
      return def?.category === 'activePower';
    });
  }

  private powerForId(id: string): OwnedPowerUp | undefined {
    return this.powers.find(p => p.powerUpId === id);
  }

  private lowestChargedPower(): OwnedPowerUp | undefined {
    const active = this.activePowers();
    if (active.length === 0) return undefined;
    return active.reduce((min, p) => p.base < min.base ? p : min);
  }

  private highestChargedPower(): OwnedPowerUp | undefined {
    const active = this.activePowers();
    if (active.length === 0) return undefined;
    return active.reduce((max, p) => {
      const dmg = p.base * Math.max(1, p.multiplierPool);
      const maxDmg = max.base * Math.max(1, max.multiplierPool);
      return dmg > maxDmg ? p : max;
    });
  }

  private randomPower(exclude?: string): OwnedPowerUp | undefined {
    const candidates = this.activePowers().filter(p => p.powerUpId !== exclude);
    if (candidates.length === 0) return undefined;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // ──────────────── ROUND START ────────────────

  /**
   * Call once at the start of each round (after power charges are zeroed).
   * Applies: Kindling, Cold Snap, Seismic, Charged, Headwind, Headstart, Synergy.
   */
  onRoundStart(): void {
    // Element-specific starting base (+10)
    const startingBase: Record<string, string> = {
      fireball:    'fire_kindling',
      icelance:    'ice_cold_snap',
      earthquake:  'earth_seismic',
      chainstrike: 'lightning_charged',
      gust:        'air_headwind',
    };
    for (const [powerId, modId] of Object.entries(startingBase)) {
      if (this.has(modId)) {
        const p = this.powerForId(powerId);
        if (p) p.base += 10;
      }
    }

    // Headstart: all powers +20 base
    if (this.has('neutral_headstart')) {
      for (const p of this.activePowers()) p.base += 20;
    }

    // Synergy: +1 mult to all powers per distinct element owned
    if (this.has('neutral_synergy')) {
      const elements = new Set(this.activePowers().map(p => getPowerUpDef(p.powerUpId)?.element ?? ''));
      const bonus = elements.size;
      if (bonus > 0) {
        for (const p of this.activePowers()) p.multiplierPool += bonus;
      }
    }

    // Reset per-round state
    this.doubleTapFiredThisRound = false;
    this.faradayShieldUsedThisRound = false;
    this.elementalSurgeMatchCount = 0;
    this.killsThisRound = 0;
  }

  // ──────────────── MATCH COMPLETED ────────────────

  /**
   * Called for each match group. Returns an adjusted match size (for Match Memory)
   * and handles Efficiency and element-specific bonus base modifiers.
   */
  onMatchCompleted(element: string, matchLength: number): { effectiveSize: number } {
    // Match Memory: treat match-3 as match-4
    const effectiveSize = (matchLength === 3 && this.has('neutral_match_memory')) ? 4 : matchLength;

    // Elemental Surge: count match-3s (before Match Memory override)
    if (matchLength === 3) {
      this.elementalSurgeMatchCount++;
    }

    // Element-specific bonus base
    const elementBonus: Record<string, string> = {
      fire:      'fire_embers',
      ice:       'ice_permafrost',
      earth:     'earth_slow_build',
      lightning: 'lightning_static_buildup',
    };
    const modId = elementBonus[element];
    if (modId && this.has(modId)) {
      const bonus = element === 'fire' ? 10 : element === 'lightning' ? 10 : element === 'ice' ? 1 : 10; // Embers +10, Static Buildup +10, Slow Build +10, Permafrost +1
      const elementPowerMap: Record<string, string> = {
        fire:      'fireball',
        ice:       'icelance',
        earth:     'earthquake',
        lightning: 'chainstrike',
      };
      const p = this.powerForId(elementPowerMap[element]);
      if (p) p.base += bonus;
    }

    // Efficiency: match-4+ → +30 base to lowest-charged power
    if (effectiveSize >= 4 && this.has('neutral_efficiency')) {
      const lowest = this.lowestChargedPower();
      if (lowest) lowest.base += 30;
    }

    return { effectiveSize };
  }

  // ──────────────── CASCADE ────────────────

  /** Returns the per-cascade multiplier bonus for the air power (Gust). */
  getAirCascadeBonus(): number {
    return this.has('air_turbulence') ? 2 : 1.2;
  }

  // ──────────────── HAZARD DESTROYED ────────────────

  async onHazardDestroyed(_hazardRow: number, _hazardCol: number): Promise<void> {
    // Scavenger: +10 base to a random owned power
    if (this.has('neutral_scavenger')) {
      const p = this.randomPower();
      if (p) p.base += 10;
    }
  }

  // ──────────────── TURN CONSUMED ────────────────

  onTurnConsumed(): { turnSaved: boolean; bonusTurn: boolean } {
    return { turnSaved: false, bonusTurn: false };
  }

  // ──────────────── POWER FIRED ────────────────

  /**
   * Call immediately after a power fires (before resetting its charges).
   * Returns whether a Double Tap second fire should happen.
   */
  onPowerFired(powerId: string): { doubleTap: boolean; chainReactionBonus: { target: OwnedPowerUp; amount: number } | null } {
    // Momentum: +5 base to all OTHER powers
    if (this.has('neutral_momentum')) {
      for (const p of this.activePowers()) {
        if (p.powerUpId !== powerId) p.base += 5;
      }
    }

    // Chain Reaction: 25% chance +25 base to random other power
    let chainReactionBonus: { target: OwnedPowerUp; amount: number } | null = null;
    if (this.has('neutral_chain_reaction') && Math.random() < 0.25) {
      const target = this.randomPower(powerId);
      if (target) {
        target.base += 25;
        chainReactionBonus = { target, amount: 25 };
      }
    }

    // Double Tap: first fire also fires at 30% (once per round)
    const doubleTap = this.has('neutral_double_tap') && !this.doubleTapFiredThisRound;
    if (doubleTap) this.doubleTapFiredThisRound = true;

    return { doubleTap, chainReactionBonus };
  }

  // ──────────────── ENEMY KILLED ────────────────

  onEnemyKilled(): void {
    this.killsThisRound++;

    // Opportunist: +10 base to highest-charged power
    if (this.has('neutral_opportunist')) {
      const p = this.highestChargedPower();
      if (p) p.base += 10;
    }

    // Power Surge: all powers get mult = kills × 2
    if (this.has('neutral_power_surge')) {
      const bonus = this.killsThisRound * 2;
      for (const p of this.activePowers()) p.multiplierPool += bonus;
    }
  }

  // ──────────────── DAMAGE DEALT ────────────────

  onDamageDealt(
    _damageElement: string | null,
    amount: number,
    _activePowerId?: string,
  ): { modifiedDamage: number } {
    let modifiedDamage = amount;

    // Elemental Harmony: own all 5 element powers → +50% damage
    if (this.has('neutral_elemental_harmony')) {
      const elements = new Set(this.activePowers().map(p => getPowerUpDef(p.powerUpId)?.element ?? ''));
      const allFive = ['fire', 'ice', 'earth', 'air', 'lightning'].every(e => elements.has(e));
      if (allFive) modifiedDamage = Math.floor(modifiedDamage * 1.5);
    }

    return { modifiedDamage };
  }

  // ──────────────── FARADAY SHIELD ────────────────

  /** Returns true if Faraday Shield should block a heal/shield intent this round. */
  shouldBlockIntentForFaraday(intentType: string): boolean {
    if (!this.has('lightning_faraday_shield')) return false;
    if (this.faradayShieldUsedThisRound) return false;
    if (intentType !== 'regenerate' && intentType !== 'shield') return false;

    this.faradayShieldUsedThisRound = true;
    // Grant +10 mult to Chain Strike
    const cs = this.powerForId('chainstrike');
    if (cs) cs.multiplierPool += 10;
    return true;
  }

  // ──────────────── ELEMENTAL SURGE ────────────────

  /**
   * Returns true if this match triggered an Elemental Surge auto-fire.
   * Called after onMatchCompleted increments the counter.
   */
  shouldTriggerElementalSurge(): boolean {
    return this.has('neutral_elemental_surge') && this.elementalSurgeMatchCount > 0 && this.elementalSurgeMatchCount % 5 === 0;
  }

  /** Returns the power ID of the highest-damage owned power for Elemental Surge to fire. */
  getElementalSurgePowerId(): string | undefined {
    return this.highestChargedPower()?.powerUpId;
  }

  // ──────────────── GEM DESTROYED ────────────────

  onGemDestroyed(_gemTypeName: string): { bonusEssence: number } {
    return { bonusEssence: 0 };
  }

  // ──────────────── ICE SHARDS ────────────────

  /** Returns true if Ice Shards modifier should trigger a shard hit this match. */
  shouldTriggerIceShards(): boolean {
    return this.has('ice_ice_shards') && Math.random() < 0.5;
  }

  // ──────────────── MISC ────────────────

  getCascadeEssenceBonus(): number {
    return 0;
  }

  flashCard(id: string): void {
    this.onFlashCard?.(id);
  }
}
