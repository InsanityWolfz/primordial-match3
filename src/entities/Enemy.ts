import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { EnemyTrait } from '../config/enemyTraits.ts';
import { TRAIT_BADGE_COLOR, TRAIT_BADGE_USED_COLOR } from '../config/enemyTraits.ts';

// Element name → color map for warded badge
const ELEMENT_COLORS: Record<string, number> = {
  fire:      0xff4444,
  water:     0x4488ff,
  earth:     0x8b6914,
  air:       0xe8e8e8,
  lightning: 0xffdd00,
  nature:    0x44bb44,
};

/**
 * Enemy occupies widthInCells × heightInCells grid tiles.
 * Rendered as a colored rectangle with an HP bar.
 * Gems can fall through enemy tiles but never rest inside them.
 * Only powers can damage enemies.
 */
export class Enemy {
  readonly gridRow: number;    // top-left row
  readonly gridCol: number;    // top-left col
  readonly widthInCells: number;
  readonly heightInCells: number;
  readonly maxHp: number;
  hp: number;
  readonly color: number;

  // Trait state
  trait?: EnemyTrait;
  wardedElement?: string;   // only for 'warded' trait
  shieldActive = false;     // only for 'shielded' trait

  private scene: Phaser.Scene;
  private body: Phaser.GameObjects.Graphics;
  private hpBarBg: Phaser.GameObjects.Graphics;
  private hpBarFill: Phaser.GameObjects.Graphics;
  private badgeGraphic?: Phaser.GameObjects.Graphics;

  // World pixel coords (top-left of enemy rectangle)
  readonly worldX: number;
  readonly worldY: number;
  readonly worldW: number;
  readonly worldH: number;

  constructor(
    scene: Phaser.Scene,
    gridRow: number,
    gridCol: number,
    widthInCells: number,
    heightInCells: number,
    color: number,
  ) {
    this.scene = scene;
    this.gridRow = gridRow;
    this.gridCol = gridCol;
    this.widthInCells = widthInCells;
    this.heightInCells = heightInCells;
    this.color = color;

    // HP = total tiles covered × 2 HP per tile
    this.maxHp = widthInCells * heightInCells * 2;
    this.hp = this.maxHp;

    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    const padding = GAME_CONFIG.gemPadding;

    this.worldX = GAME_CONFIG.gridOffsetX + gridCol * cellSize;
    this.worldY = GAME_CONFIG.gridOffsetY + gridRow * cellSize;
    this.worldW = widthInCells * cellSize - padding;
    this.worldH = heightInCells * cellSize - padding;

    // Body rectangle
    this.body = scene.add.graphics();
    this.body.setDepth(5); // above gems (depth 0) but below HUD (depth 10)
    this.drawBody();

    // HP bar background (dark strip above the enemy)
    const barH = 6;
    const barY = this.worldY - barH - 3;
    this.hpBarBg = scene.add.graphics();
    this.hpBarBg.setDepth(6);
    this.hpBarBg.fillStyle(0x222222, 0.9);
    this.hpBarBg.fillRect(this.worldX, barY, this.worldW, barH);

    // HP bar fill (starts full)
    this.hpBarFill = scene.add.graphics();
    this.hpBarFill.setDepth(6);
    this.drawHpBar();
  }

  // ──────────────── TRAIT ────────────────

  /**
   * Assign a trait. Call this after construction, before first damage.
   * @param trait      The trait to assign
   * @param wardedElem For 'warded' only: the element this enemy is immune to
   */
  setTrait(trait: EnemyTrait, wardedElem?: string): void {
    this.trait = trait;
    if (trait === 'warded') this.wardedElement = wardedElem;
    if (trait === 'shielded') this.shieldActive = true;
    this.drawBadge();
  }

  private drawBadge(): void {
    if (!this.trait) return;

    // Destroy existing badge if redrawing
    this.badgeGraphic?.destroy();
    this.badgeGraphic = this.scene.add.graphics();
    this.badgeGraphic.setDepth(7);

    const bx = this.worldX + this.worldW - 10;
    const by = this.worldY + 10;
    const r = 8;

    // Determine badge color
    let color = TRAIT_BADGE_COLOR[this.trait];
    if (this.trait === 'shielded' && !this.shieldActive) {
      color = TRAIT_BADGE_USED_COLOR['shielded'];
    }
    if (this.trait === 'warded' && this.wardedElement) {
      color = ELEMENT_COLORS[this.wardedElement] ?? TRAIT_BADGE_COLOR['warded'];
    }

    this.badgeGraphic.fillStyle(color, 0.95);
    this.badgeGraphic.fillCircle(bx, by, r);
    this.badgeGraphic.lineStyle(1, 0xffffff, 0.6);
    this.badgeGraphic.strokeCircle(bx, by, r);
  }

  // ──────────────── DAMAGE / HEAL ────────────────

  /**
   * Deal damage to this enemy, applying trait modifiers.
   * @param amount  Raw damage amount
   * @param element Element of the attacking power (null = no element)
   * @returns true if the enemy is now dead (hp ≤ 0)
   */
  takeDamage(amount: number, element?: string | null): boolean {
    // Warded: immune to a specific element
    if (this.trait === 'warded' && element && element === this.wardedElement) {
      return false;
    }

    // Shielded: absorb the first hit entirely
    if (this.trait === 'shielded' && this.shieldActive) {
      this.shieldActive = false;
      this.drawBadge(); // update badge color to "used"
      return false;
    }

    // Armored: take 1 less damage per hit, minimum 1
    let effective = amount;
    if (this.trait === 'armored') {
      effective = Math.max(1, amount - 1);
    }

    this.hp = Math.max(0, this.hp - effective);
    this.drawHpBar();

    // Flash the body red briefly, then restore
    this.body.setAlpha(0.4);
    this.scene.time.delayedCall(120, () => {
      if (this.hp > 0) this.body.setAlpha(0.85);
    });

    return this.hp <= 0;
  }

  /**
   * Heal this enemy (used by 'regenerating' trait).
   * @param amount HP to restore (capped at maxHp)
   */
  heal(amount: number): void {
    if (this.hp <= 0) return; // don't heal dead enemies
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.drawHpBar();
  }

  // ──────────────── RENDERING ────────────────

  private drawBody(): void {
    this.body.clear();
    // Main fill
    this.body.fillStyle(this.color, 0.85);
    this.body.fillRect(this.worldX, this.worldY, this.worldW, this.worldH);
    // Border
    this.body.lineStyle(2, 0xffffff, 0.5);
    this.body.strokeRect(this.worldX, this.worldY, this.worldW, this.worldH);
    // Simple cross-hatch pattern to distinguish from gems
    this.body.lineStyle(1, 0x000000, 0.2);
    const step = 16;
    for (let x = this.worldX; x < this.worldX + this.worldW; x += step) {
      this.body.lineBetween(x, this.worldY, x, this.worldY + this.worldH);
    }
    for (let y = this.worldY; y < this.worldY + this.worldH; y += step) {
      this.body.lineBetween(this.worldX, y, this.worldX + this.worldW, y);
    }
  }

  private drawHpBar(): void {
    this.hpBarFill.clear();
    const ratio = Math.max(0, this.hp / this.maxHp);
    const barH = 6;
    const barY = this.worldY - barH - 3;

    // Color: green → yellow → red
    let barColor = 0x44cc44;
    if (ratio <= 0.25) barColor = 0xcc4444;
    else if (ratio <= 0.5) barColor = 0xccaa22;

    this.hpBarFill.fillStyle(barColor, 1);
    this.hpBarFill.fillRect(this.worldX, barY, this.worldW * ratio, barH);
  }

  // ──────────────── ANIMATIONS ────────────────

  /**
   * Play a death animation and resolve when done.
   */
  playDeathAnimation(scene: Phaser.Scene): Promise<void> {
    const targets = [this.body, this.hpBarBg, this.hpBarFill];
    if (this.badgeGraphic) targets.push(this.badgeGraphic);
    return new Promise(resolve => {
      scene.tweens.add({
        targets,
        alpha: 0,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 300,
        ease: 'Power2',
        onComplete: () => resolve(),
      });
    });
  }

  /**
   * Destroy all Phaser objects.
   */
  destroy(): void {
    this.body.destroy();
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
    this.badgeGraphic?.destroy();
  }
}
