import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { EnemyTrait } from '../config/enemyTraits.ts';

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
  private spriteImage?: Phaser.GameObjects.Image;
  private hpBarBg: Phaser.GameObjects.Graphics;
  private hpBarFill: Phaser.GameObjects.Graphics;
  private badgeText?: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;

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

    // Body rectangle (background behind sprite)
    this.body = scene.add.graphics();
    this.body.setDepth(4);
    this.drawBody();

    // Sprite image (scaled to fill the enemy area)
    const spriteKey = Enemy.spriteKeyForSize(widthInCells, heightInCells);
    if (spriteKey && scene.textures.exists(spriteKey)) {
      const cx = this.worldX + this.worldW / 2;
      const cy = this.worldY + this.worldH / 2;
      this.spriteImage = scene.add.image(cx, cy, spriteKey);
      this.spriteImage.setDisplaySize(this.worldW, this.worldH);
      this.spriteImage.setDepth(5);
    }

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

    // HP text centered on enemy
    const cx = this.worldX + this.worldW / 2;
    const cy = this.worldY + this.worldH / 2;
    this.hpText = scene.add.text(cx, cy, `${this.hp}/${this.maxHp}`, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    });
    this.hpText.setOrigin(0.5, 0.5);
    this.hpText.setDepth(7);

    this.drawHpBar();
  }

  // ──────────────── STATIC HELPERS ────────────────

  /** Map widthInCells × heightInCells to a loaded sprite key, or null if no sprite exists. */
  static spriteKeyForSize(w: number, h: number): string | null {
    const map: Record<string, string> = {
      '1x2': 'enemy-fireImp',
      '2x2': 'enemy-iceWhelp',
      '2x3': 'enemy-lightningWraith',
      '3x3': 'enemy-vineMonster',
      '3x4': 'enemy-earthGolem',
    };
    return map[`${w}x${h}`] ?? null;
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

    this.badgeText?.destroy();

    const cx = this.worldX + this.worldW / 2;
    const cy = this.worldY + this.worldH / 2;

    let label: string = this.trait;
    let color = '#ffffff';

    if (this.trait === 'warded' && this.wardedElement) {
      label = `warded\n${this.wardedElement}`;
      const elemColor = ELEMENT_COLORS[this.wardedElement];
      if (elemColor !== undefined) {
        color = '#' + elemColor.toString(16).padStart(6, '0');
      }
    } else if (this.trait === 'shielded' && !this.shieldActive) {
      color = '#888888';
    }

    // Shift HP text up to make room for the trait label below
    this.hpText.setY(cy - 9);

    this.badgeText = this.scene.add.text(cx, cy + 9, label, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color,
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    });
    this.badgeText.setOrigin(0.5, 0.5);
    this.badgeText.setDepth(7);
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

    // Flash briefly on hit
    this.body.setAlpha(0.4);
    this.spriteImage?.setAlpha(0.4);
    this.scene.time.delayedCall(120, () => {
      if (this.hp > 0) {
        this.body.setAlpha(0.85);
        this.spriteImage?.setAlpha(1);
      }
    });

    if (this.hp > 0) this.playShakeAnimation();

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
    const hasSpriteKey = Enemy.spriteKeyForSize(this.widthInCells, this.heightInCells) !== null;
    if (hasSpriteKey) {
      // Dark backing panel behind the sprite
      this.body.fillStyle(0x000000, 0.45);
      this.body.fillRect(this.worldX, this.worldY, this.worldW, this.worldH);
    } else {
      // Fallback: colored rectangle with crosshatch for unknown sizes
      this.body.fillStyle(this.color, 0.85);
      this.body.fillRect(this.worldX, this.worldY, this.worldW, this.worldH);
      this.body.lineStyle(2, 0xffffff, 0.5);
      this.body.strokeRect(this.worldX, this.worldY, this.worldW, this.worldH);
      this.body.lineStyle(1, 0x000000, 0.2);
      const step = 16;
      for (let x = this.worldX; x < this.worldX + this.worldW; x += step) {
        this.body.lineBetween(x, this.worldY, x, this.worldY + this.worldH);
      }
      for (let y = this.worldY; y < this.worldY + this.worldH; y += step) {
        this.body.lineBetween(this.worldX, y, this.worldX + this.worldW, y);
      }
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

    if (this.hpText) this.hpText.setText(`${this.hp}/${this.maxHp}`);
  }

  // ──────────────── ANIMATIONS ────────────────

  /**
   * Quick horizontal shake on hit.
   */
  private playShakeAnimation(): void {
    const targets: Array<Phaser.GameObjects.Graphics | Phaser.GameObjects.Text | Phaser.GameObjects.Image> = [
      this.body, this.hpBarBg, this.hpBarFill, this.hpText,
    ];
    if (this.spriteImage) targets.push(this.spriteImage);
    if (this.badgeText) targets.push(this.badgeText);

    // Capture each object's original x so we offset relative to it
    const originX = targets.map(obj => obj.x);

    const offsets = [5, -5, 3, -3, 1, 0];
    offsets.forEach((dx, i) => {
      this.scene.time.delayedCall(i * 35, () => {
        targets.forEach((obj, j) => { obj.x = originX[j] + dx; });
      });
    });
  }

  /**
   * Play a death animation and resolve when done.
   */
  playDeathAnimation(scene: Phaser.Scene): Promise<void> {
    const targets: Phaser.GameObjects.GameObject[] = [this.body, this.hpBarBg, this.hpBarFill, this.hpText];
    if (this.spriteImage) targets.push(this.spriteImage);
    if (this.badgeText) targets.push(this.badgeText);
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
    this.spriteImage?.destroy();
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
    this.hpText.destroy();
    this.badgeText?.destroy();
  }
}
