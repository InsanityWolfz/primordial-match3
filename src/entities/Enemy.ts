import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { EnemyTrait } from '../config/enemyTraits.ts';
import type { EnemyTypeDef, IntentDef } from '../config/enemyTypes.ts';

// Element name → color map for warded badge
const ELEMENT_COLORS: Record<string, number> = {
  fire:      0xff4444,
  water:     0x4488ff,
  earth:     0x8b6914,
  air:       0xe8e8e8,
  lightning: 0xffdd00,
};

// Intent urgency thresholds → badge background colors and text colors
const BADGE_BG: Record<'urgent' | 'warning' | 'normal', number> = {
  urgent:  0x991111,
  warning: 0x886600,
  normal:  0x334455,
};
const BADGE_TEXT: Record<'urgent' | 'warning' | 'normal', string> = {
  urgent:  '#ff4444',
  warning: '#ffcc44',
  normal:  '#aabbcc',
};

function urgency(countdown: number): 'urgent' | 'warning' | 'normal' {
  if (countdown <= 1) return 'urgent';
  if (countdown <= 3) return 'warning';
  return 'normal';
}

interface IntentInstance {
  def: IntentDef;
  countdown: number;
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  tooltip: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
}

/**
 * Enemy occupies widthInCells × heightInCells grid tiles.
 * Type determines sprite, color, and intent set.
 * Gems fall through enemy tiles; only powers deal damage.
 */
export class Enemy {
  readonly type: string;
  readonly gridRow: number;    // top-left row
  readonly gridCol: number;    // top-left col
  readonly widthInCells: number;
  readonly heightInCells: number;
  readonly maxHp: number;
  hp: number;
  readonly color: number;

  // Trait state
  trait?: EnemyTrait;
  wardedElement?: string;
  shieldActive = false;

  // Status effects
  burnDamage = 0;       // damage per turn (0 = not burning)
  burnTurns = 0;        // turns of burn remaining
  chillTurns = 0;       // turns of chill remaining (visual only; intents already delayed on apply)
  freezeTurns = 0;      // turns of freeze remaining (intents can't tick while > 0)
  stunnedTurns = 0;     // turns of stun remaining (intents skip a tick)
  shocked = false;      // next intent effect is halved
  discharged = false;   // next intent backfires (lightning Discharge modifier)

  private scene: Phaser.Scene;
  private body: Phaser.GameObjects.Graphics;
  private spriteImage?: Phaser.GameObjects.Image;
  private hpBarBg: Phaser.GameObjects.Graphics;
  private hpBarFill: Phaser.GameObjects.Graphics;
  private traitBadge?: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private intentInstances: IntentInstance[] = [];
  private shieldGraphic?: Phaser.GameObjects.Graphics;

  readonly worldX: number;
  readonly worldY: number;
  readonly worldW: number;
  readonly worldH: number;

  constructor(
    scene: Phaser.Scene,
    gridRow: number,
    gridCol: number,
    typeDef: EnemyTypeDef,
    hpMultiplier: number = 1,
  ) {
    this.scene = scene;
    this.type = typeDef.type;
    this.gridRow = gridRow;
    this.gridCol = gridCol;
    this.widthInCells = typeDef.widthInCells;
    this.heightInCells = typeDef.heightInCells;
    this.color = typeDef.color;

    this.maxHp = Math.ceil(typeDef.widthInCells * typeDef.heightInCells * 8 * hpMultiplier);
    this.hp = this.maxHp;

    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    const padding = GAME_CONFIG.gemPadding;

    this.worldX = GAME_CONFIG.gridOffsetX + gridCol * cellSize;
    this.worldY = GAME_CONFIG.gridOffsetY + gridRow * cellSize;
    this.worldW = typeDef.widthInCells * cellSize - padding;
    this.worldH = typeDef.heightInCells * cellSize - padding;

    // Body rectangle
    this.body = scene.add.graphics();
    this.body.setDepth(4);
    this.drawBody();

    // Sprite (keyed by type name)
    const spriteKey = `enemy-${typeDef.type}`;
    if (scene.textures.exists(spriteKey)) {
      const cx = this.worldX + this.worldW / 2;
      const cy = this.worldY + this.worldH / 2;
      this.spriteImage = scene.add.image(cx, cy, spriteKey);
      this.spriteImage.setDisplaySize(this.worldW, this.worldH);
      this.spriteImage.setDepth(5);
    }

    // HP bar
    const barH = 9;
    const barY = this.worldY - barH - 4;
    this.hpBarBg = scene.add.graphics();
    this.hpBarBg.setDepth(6);
    this.hpBarBg.fillStyle(0x222222, 0.9);
    this.hpBarBg.fillRect(this.worldX, barY, this.worldW, barH);

    this.hpBarFill = scene.add.graphics();
    this.hpBarFill.setDepth(6);

    const cx = this.worldX + this.worldW / 2;
    const cy = this.worldY + this.worldH / 2;
    this.hpText = scene.add.text(cx, cy, `${this.hp}/${this.maxHp}`, {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    });
    this.hpText.setOrigin(0.5, 0.5);
    this.hpText.setDepth(7);

    this.drawHpBar();

    // Intent badges — one per intent, stacked from the bottom of the enemy body
    this.intentInstances = typeDef.intents.map((def, i) => this.createIntentBadge(def, i));
  }

  // ──────────────── INTENT BADGES ────────────────

  private badgeWidth = 56;
  private badgeHeight = 26;
  private badgeGap = 4;

  /** Compute the center-x and bottom-y for a badge by index (0 = bottommost). */
  private badgePos(index: number): { cx: number; bottomY: number } {
    const cx = this.worldX + this.worldW / 2;
    const bottomY = this.worldY + this.worldH - 4 - index * (this.badgeHeight + this.badgeGap);
    return { cx, bottomY };
  }

  private createIntentBadge(def: IntentDef, index: number): IntentInstance {
    const countdown = Phaser.Math.Between(def.intervalMin, def.intervalMax);
    const { cx, bottomY } = this.badgePos(index);
    const bw = this.badgeWidth;
    const bh = this.badgeHeight;
    const urg = urgency(countdown);

    // Background
    const bg = this.scene.add.graphics();
    bg.setDepth(7);
    this.drawBadgeBg(bg, cx - bw / 2, bottomY - bh, bw, bh, BADGE_BG[urg]);

    // Label text: "vine 3"
    const label = this.scene.add.text(cx, bottomY - bh / 2, `${def.label} ${countdown}`, {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: BADGE_TEXT[urg],
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    });
    label.setOrigin(0.5, 0.5);
    label.setDepth(8);

    // Tooltip (hidden by default)
    const tooltipText = `${def.tooltip} in ${countdown} turn${countdown === 1 ? '' : 's'}`;
    const tooltip = this.scene.add.text(cx, bottomY - bh - 18, tooltipText, {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#ffffff',
      backgroundColor: '#000000cc',
      padding: { x: 5, y: 4 },
      align: 'center',
    });
    tooltip.setOrigin(0.5, 1);
    tooltip.setDepth(20);
    tooltip.setVisible(false);

    // Interactive zone over the badge
    const zone = this.scene.add.zone(cx, bottomY - bh / 2, bw, bh).setInteractive();
    zone.setDepth(9);
    zone.on('pointerover', () => tooltip.setVisible(true));
    zone.on('pointerout', () => tooltip.setVisible(false));

    return { def, countdown, bg, label, tooltip, zone };
  }

  private drawBadgeBg(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number): void {
    g.clear();
    g.fillStyle(color, 0.85);
    g.fillRoundedRect(x, y, w, h, 4);
    g.lineStyle(1, 0xffffff, 0.2);
    g.strokeRoundedRect(x, y, w, h, 4);
  }

  private redrawBadge(inst: IntentInstance, index: number): void {
    const { cx, bottomY } = this.badgePos(index);
    const bw = this.badgeWidth;
    const bh = this.badgeHeight;
    const urg = urgency(inst.countdown);

    this.drawBadgeBg(inst.bg, cx - bw / 2, bottomY - bh, bw, bh, BADGE_BG[urg]);

    inst.label.setText(`${inst.def.label} ${inst.countdown}`);
    inst.label.setStyle({ color: BADGE_TEXT[urg] });
    inst.label.setPosition(cx, bottomY - bh / 2);

    const tooltipText = `${inst.def.tooltip} in ${inst.countdown} turn${inst.countdown === 1 ? '' : 's'}`;
    inst.tooltip.setText(tooltipText);
    inst.tooltip.setPosition(cx, bottomY - bh - 18);

    inst.zone.setPosition(cx, bottomY - bh / 2);
  }

  // ──────────────── INTENT TICKING ────────────────

  /**
   * Decrement all intent countdowns by 1.
   * Returns the list of IntentDefs that fired (countdown reached 0).
   * Fired intents get a fresh countdown rolled from [intervalMin, intervalMax].
   */
  tickIntents(): IntentDef[] {
    const fired: IntentDef[] = [];
    for (let i = 0; i < this.intentInstances.length; i++) {
      const inst = this.intentInstances[i];
      inst.countdown--;
      if (inst.countdown <= 0) {
        fired.push(inst.def);
        inst.countdown = Phaser.Math.Between(inst.def.intervalMin, inst.def.intervalMax);
      }
      this.redrawBadge(inst, i);
    }
    return fired;
  }

  // ──────────────── STATUS EFFECTS ────────────────

  applyBurn(damagePerTurn: number, turns: number): void {
    // Stack: take the higher damage, extend duration
    this.burnDamage = Math.max(this.burnDamage, damagePerTurn);
    this.burnTurns = Math.max(this.burnTurns, turns);
  }

  /** Delay all intent countdowns by `turns`. Used for Chill and Freeze. */
  delayIntents(turns: number): void {
    for (const inst of this.intentInstances) {
      inst.countdown += turns;
    }
    // Redraw badges after delay
    for (let i = 0; i < this.intentInstances.length; i++) {
      this.redrawBadge(this.intentInstances[i], i);
    }
  }

  /** Speed up all intent countdowns by 1 (minimum 1). Used for Haste. */
  hasteIntents(): void {
    for (const inst of this.intentInstances) {
      inst.countdown = Math.max(1, inst.countdown - 1);
    }
    for (let i = 0; i < this.intentInstances.length; i++) {
      this.redrawBadge(this.intentInstances[i], i);
    }
  }

  /** Cancel all active intents (reset to max interval). Used for EMP. */
  cancelAllIntents(): void {
    for (const inst of this.intentInstances) {
      inst.countdown = inst.def.intervalMax;
    }
    for (let i = 0; i < this.intentInstances.length; i++) {
      this.redrawBadge(this.intentInstances[i], i);
    }
  }

  /** Strip the shield without absorbing a hit (used by lightning Conductor modifier). */
  stripShield(): void {
    this.clearShield();
  }

  /** Returns the number of distinct intents this enemy has (used by Overload modifier). */
  getIntentCount(): number {
    return this.intentInstances.length;
  }

  // ──────────────── TRAIT ────────────────

  setTrait(trait: EnemyTrait, wardedElem?: string): void {
    this.trait = trait;
    if (trait === 'warded') this.wardedElement = wardedElem;
    if (trait === 'shielded') this.shieldActive = true;
    this.drawTraitBadge();
  }

  private drawTraitBadge(): void {
    if (!this.trait) return;

    this.traitBadge?.destroy();

    const cx = this.worldX + this.worldW / 2;
    const cy = this.worldY + this.worldH / 2;

    let traitLabel: string = this.trait;
    let color = '#ffffff';

    if (this.trait === 'warded' && this.wardedElement) {
      traitLabel = `warded\n${this.wardedElement}`;
      const elemColor = ELEMENT_COLORS[this.wardedElement];
      if (elemColor !== undefined) {
        color = '#' + elemColor.toString(16).padStart(6, '0');
      }
    } else if (this.trait === 'shielded' && !this.shieldActive) {
      color = '#888888';
    }

    // Shift HP text up if trait badge is displayed
    this.hpText.setY(cy - 11);

    this.traitBadge = this.scene.add.text(cx, cy + 11, traitLabel, {
      fontSize: '13px',
      fontFamily: 'monospace',
      color,
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    });
    this.traitBadge.setOrigin(0.5, 0.5);
    this.traitBadge.setDepth(7);
  }

  // ──────────────── SHIELD ────────────────

  /**
   * Apply a temporary shield that absorbs the next instance of damage.
   * Works independently of the 'shielded' trait.
   */
  applyShield(): void {
    this.shieldActive = true;
    if (!this.shieldGraphic) {
      this.shieldGraphic = this.scene.add.graphics();
      this.shieldGraphic.setDepth(8);
    }
    this.shieldGraphic.clear();
    this.shieldGraphic.lineStyle(3, 0xffdd44, 0.95);
    this.shieldGraphic.strokeRect(this.worldX - 3, this.worldY - 3, this.worldW + 6, this.worldH + 6);
    this.shieldGraphic.lineStyle(1, 0xffdd44, 0.4);
    this.shieldGraphic.strokeRect(this.worldX - 6, this.worldY - 6, this.worldW + 12, this.worldH + 12);
  }

  private clearShield(): void {
    this.shieldActive = false;
    this.shieldGraphic?.destroy();
    this.shieldGraphic = undefined;
    // Refresh trait badge in case it was showing shielded state
    if (this.trait) this.drawTraitBadge();
  }

  // ──────────────── DAMAGE / HEAL ────────────────

  takeDamage(amount: number, element?: string | null): boolean {
    if (this.trait === 'warded' && element && element === this.wardedElement) {
      return false;
    }

    // Shield absorbs one hit regardless of source
    if (this.shieldActive) {
      this.clearShield();
      return false;
    }

    let effective = amount;
    if (this.trait === 'armored') {
      effective = Math.max(1, amount - 1);
    }

    this.hp = Math.max(0, this.hp - effective);
    this.drawHpBar();

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

  heal(amount: number): void {
    if (this.hp <= 0) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.drawHpBar();
  }

  // ──────────────── RENDERING ────────────────

  private drawBody(): void {
    this.body.clear();
    const spriteKey = `enemy-${this.type}`;
    const hasSpriteKey = this.scene.textures.exists(spriteKey);
    if (hasSpriteKey) {
      this.body.fillStyle(0x000000, 0.45);
      this.body.fillRect(this.worldX, this.worldY, this.worldW, this.worldH);
    } else {
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
    const barH = 9;
    const barY = this.worldY - barH - 4;

    let barColor = 0x44cc44;
    if (ratio <= 0.25) barColor = 0xcc4444;
    else if (ratio <= 0.5) barColor = 0xccaa22;

    this.hpBarFill.fillStyle(barColor, 1);
    this.hpBarFill.fillRect(this.worldX, barY, this.worldW * ratio, barH);

    if (this.hpText) this.hpText.setText(`${this.hp}/${this.maxHp}`);
  }

  // ──────────────── ANIMATIONS ────────────────

  private playShakeAnimation(): void {
    const targets: Array<Phaser.GameObjects.GameObject> = [
      this.body, this.hpBarBg, this.hpBarFill, this.hpText,
    ];
    if (this.spriteImage) targets.push(this.spriteImage);
    if (this.traitBadge) targets.push(this.traitBadge);
    if (this.shieldGraphic) targets.push(this.shieldGraphic);
    for (const inst of this.intentInstances) {
      targets.push(inst.bg, inst.label);
    }

    const originX = (targets as unknown as Array<{ x: number }>).map(obj => obj.x);

    const offsets = [5, -5, 3, -3, 1, 0];
    offsets.forEach((dx, i) => {
      this.scene.time.delayedCall(i * 35, () => {
        (targets as unknown as Array<{ x: number }>).forEach((obj, j) => { obj.x = originX[j] + dx; });
      });
    });
  }

  playDeathAnimation(scene: Phaser.Scene): Promise<void> {
    // Hide tooltips immediately
    for (const inst of this.intentInstances) {
      inst.tooltip.setVisible(false);
    }

    const targets: Phaser.GameObjects.GameObject[] = [
      this.body, this.hpBarBg, this.hpBarFill, this.hpText,
    ];
    if (this.spriteImage) targets.push(this.spriteImage);
    if (this.traitBadge) targets.push(this.traitBadge);
    if (this.shieldGraphic) targets.push(this.shieldGraphic);
    for (const inst of this.intentInstances) {
      targets.push(inst.bg, inst.label);
    }

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

  destroy(): void {
    this.body.destroy();
    this.spriteImage?.destroy();
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
    this.hpText.destroy();
    this.traitBadge?.destroy();
    this.shieldGraphic?.destroy();
    for (const inst of this.intentInstances) {
      inst.bg.destroy();
      inst.label.destroy();
      inst.tooltip.destroy();
      inst.zone.destroy();
    }
  }
}
