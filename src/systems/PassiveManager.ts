/**
 * PassiveManager handles passive power hooks.
 * Currently all passives are removed — modifier system will re-populate these hooks.
 * Method signatures are preserved as extension points.
 */
export class PassiveManager {
  private onFlashCard: ((id: string) => void) | null = null;

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(_ctx: unknown) {}

  // Reserved for future modifier system hooks
  setDamageSystem(_damageSystem: unknown): void {}

  setFlashCardCallback(cb: (id: string) => void): void {
    this.onFlashCard = cb;
  }

  // ──────────────── HOOKS ────────────────

  onGemDestroyed(_gemElement: string): { bonusEssence: number } {
    return { bonusEssence: 0 };
  }

  onDamageDealt(
    _damageElement: string | null,
    amount: number,
    _activePowerId?: string,
  ): { modifiedDamage: number } {
    return { modifiedDamage: amount };
  }

  onMatchCompleted(_matchElement: string, _matchLength: number): { bonusEssence: number; bonusScore: number } {
    return { bonusEssence: 0, bonusScore: 0 };
  }

  onTurnConsumed(): { turnSaved: boolean; bonusTurn: boolean } {
    return { turnSaved: false, bonusTurn: false };
  }

  async onHazardDestroyed(_hazardRow: number, _hazardCol: number): Promise<void> {
    // No passive effects on hazard destruction currently
  }

  onEarthquakeUsed(): { bonusTurns: number; bonusDamage: number } {
    return { bonusTurns: 0, bonusDamage: 0 };
  }

  getCascadeEssenceBonus(): number {
    return 0;
  }

  flashCard(id: string): void {
    this.onFlashCard?.(id);
  }
}
