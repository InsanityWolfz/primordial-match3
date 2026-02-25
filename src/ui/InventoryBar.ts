import type Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import { getPowerUpDef } from '../config/powerUps.ts';
import type { OwnedPowerUp } from '../types/RunState.ts';

// ── Layout constants ──────────────────────────────────────────────────────────
const CARD_GAP   = 4;
const CARD_MAX_H = 90;
const CARD_MIN_H = 36;
const H_MARGIN   = 10;   // left/right margin inside bar
const V_MARGIN   = 8;    // top/bottom margin inside bar

// Right-side columns on active-power cards (measured from card right edge)
const BTN_W  = 128;   // activate button column width
const PIP_W  = 80;    // charge-pips column width
const NAME_W = 150;   // name + level column width (left side)

export interface InventoryBarOptions {
  onActivatePowerUp?: (id: string) => void;
}

interface CardData {
  bg: Phaser.GameObjects.Graphics;
  btnBg: Phaser.GameObjects.Graphics | null;
  btnText: Phaser.GameObjects.Text | null;
  btnX: number;
  btnY: number;
  btnW: number;
  btnH: number;
  color: number;
  x: number;
  y: number;
  w: number;
  h: number;
  isActive: boolean;
  hasCharges: boolean;
}

/**
 * InventoryBar — horizontal row layout.
 *
 * Each owned power-up gets one full-width row:
 *   [accent strip] [Name + Level] | [Description] | [Pips] [▶ ACTIVATE]
 *
 * Active-power cards show charge pips and an ACTIVATE button docked to the
 * right. Passive cards fill the entire middle with description text.
 *
 * setActiveCard() flips card borders and button state without rebuilding.
 */
export class InventoryBar {
  private scene: Phaser.Scene;
  private ownedPowerUps: OwnedPowerUp[];
  private barY: number;
  private barHeight: number;
  private options: InventoryBarOptions;

  private elements: Phaser.GameObjects.GameObject[] = [];
  private cardDataMap = new Map<string, CardData>();

  constructor(
    scene: Phaser.Scene,
    ownedPowerUps: OwnedPowerUp[],
    barY: number,
    options: InventoryBarOptions = {},
  ) {
    this.scene = scene;
    this.ownedPowerUps = ownedPowerUps;
    this.barY = barY;
    this.barHeight = GAME_CONFIG.height - barY;
    this.options = options;
  }

  create(): void { this.renderBar(); }

  refresh(ownedPowerUps: OwnedPowerUp[]): void {
    this.ownedPowerUps = ownedPowerUps;
    this.destroyElements();
    this.cardDataMap.clear();
    this.renderBar();
  }

  destroy(): void {
    this.destroyElements();
    this.cardDataMap.clear();
  }

  /** Flip card borders and button states without a full rebuild. */
  setActiveCard(id: string | null): void {
    for (const [cardId, data] of this.cardDataMap) {
      const active = cardId === id;
      data.isActive = active;

      data.bg.clear();
      data.bg.fillStyle(active ? 0x1a1a33 : 0x111122, active ? 0.98 : 0.95);
      data.bg.fillRoundedRect(data.x, data.y, data.w, data.h, 4);
      data.bg.lineStyle(active ? 2 : 1, data.color, active ? 0.9 : 0.28);
      data.bg.strokeRoundedRect(data.x, data.y, data.w, data.h, 4);

      if (data.btnBg && data.btnText) {
        this.drawBtn(data.btnBg, data.btnText,
          data.btnX, data.btnY, data.btnW, data.btnH,
          data.color, data.hasCharges, active);
      }
    }
  }

  // ── RENDER ────────────────────────────────────────────────────────────────

  private renderBar(): void {
    const W = GAME_CONFIG.width;

    // Background strip + top border glow
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a1a, 0.97);
    bg.fillRect(0, this.barY, W, this.barHeight);
    bg.lineStyle(2, 0x4444aa, 0.9);
    bg.lineBetween(0, this.barY, W, this.barY);
    bg.lineStyle(1, 0x3333aa, 0.3);
    bg.lineBetween(0, this.barY + 2, W, this.barY + 2);
    bg.setDepth(50);
    this.elements.push(bg);

    if (this.ownedPowerUps.length === 0) {
      const t = this.scene.add.text(W / 2, this.barY + this.barHeight / 2,
        'No power-ups yet — clear hazards to visit the shop!',
        { fontSize: '14px', color: '#555566', fontFamily: 'Arial', fontStyle: 'italic' });
      t.setOrigin(0.5, 0.5).setDepth(51);
      this.elements.push(t);
      return;
    }

    // Sort: primary by element order, secondary by category (Active → Passive → Stat)
    const ELEMENT_ORDER = ['fire', 'water', 'air', 'earth', 'lightning', 'nature'];
    const CATEGORY_ORDER: Record<string, number> = { activePower: 0, passivePower: 1, passive: 2 };
    const sorted = [...this.ownedPowerUps].sort((a, b) => {
      const defA = getPowerUpDef(a.powerUpId);
      const defB = getPowerUpDef(b.powerUpId);
      if (!defA || !defB) return 0;
      const eA = ELEMENT_ORDER.indexOf(defA.element);
      const eB = ELEMENT_ORDER.indexOf(defB.element);
      if (eA !== eB) return eA - eB;
      return (CATEGORY_ORDER[defA.category] ?? 99) - (CATEGORY_ORDER[defB.category] ?? 99);
    });

    const n   = sorted.length;
    const avH = this.barHeight - V_MARGIN * 2 - (n - 1) * CARD_GAP;
    const cardH = Math.max(CARD_MIN_H, Math.min(CARD_MAX_H, Math.floor(avH / n)));
    const totalH = n * cardH + (n - 1) * CARD_GAP;
    // Centre the stack vertically if cards don't fill the whole bar
    const startY = this.barY + V_MARGIN +
      Math.floor((this.barHeight - V_MARGIN * 2 - totalH) / 2);

    const cardW = W - H_MARGIN * 2;
    for (let i = 0; i < n; i++) {
      this.renderCard(
        sorted[i],
        H_MARGIN,
        startY + i * (cardH + CARD_GAP),
        cardW,
        cardH,
      );
    }
  }

  private renderCard(
    owned: OwnedPowerUp,
    x: number, y: number,
    w: number, h: number,
  ): void {
    const def = getPowerUpDef(owned.powerUpId);
    if (!def) return;

    const gemType    = GAME_CONFIG.gemTypes.find(g => g.name === def.element);
    const color      = gemType ? gemType.color : 0x888888;
    const levelData  = def.levels[Math.min(owned.level, def.maxLevel) - 1];
    const isActive   = def.category === 'activePower';
    const hasCharges = isActive && (owned.charges ?? 0) > 0;

    // ── Card background ──
    const card = this.scene.add.graphics();
    card.fillStyle(0x111122, 0.95);
    card.fillRoundedRect(x, y, w, h, 4);
    card.lineStyle(1, color, 0.28);
    card.strokeRoundedRect(x, y, w, h, 4);
    card.setDepth(51);
    this.elements.push(card);

    // Left accent strip (element colour)
    const accent = this.scene.add.graphics();
    accent.fillStyle(color, 0.9);
    accent.fillRect(x, y + 3, 4, h - 6);
    accent.setDepth(52);
    this.elements.push(accent);

    // Subtle tint behind name section
    const tint = this.scene.add.graphics();
    tint.fillStyle(color, 0.05);
    tint.fillRect(x + 4, y, NAME_W + 12, h);
    tint.setDepth(52);
    this.elements.push(tint);

    // ── X positions ──
    const contentX = x + 14;           // after accent (4px) + gap (10px)
    const descX    = contentX + NAME_W + 8;  // description column start

    // ── Active: pips + button on the right ──
    let btnBg: Phaser.GameObjects.Graphics | null = null;
    let btnText: Phaser.GameObjects.Text  | null = null;
    let btnX = 0, btnY = 0, btnW = 0, btnH = 0;
    let descMaxX = x + w - 8;          // right edge of description (passive)

    if (isActive) {
      btnX = x + w - BTN_W + 2;
      btnY = y + 3;
      btnW = BTN_W - 6;
      btnH = h - 6;

      const pipsX    = btnX - PIP_W - 4;
      descMaxX       = pipsX - 8;

      // ── Charge pips ──
      if (owned.charges !== undefined && owned.maxCharges !== undefined) {
        const maxPips  = Math.min(owned.maxCharges, 8);
        const pipR     = Math.min(4, Math.max(2, Math.floor((h - 22) / 2)));
        const pipDiam  = pipR * 2;
        const pipGap   = 3;
        const totalPW  = maxPips * pipDiam + (maxPips - 1) * pipGap;
        const pCX      = pipsX + Math.floor(PIP_W / 2);
        const pCY      = y + Math.floor(h / 2) - pipR - 6;
        let px = pCX - Math.floor(totalPW / 2);

        for (let i = 0; i < maxPips; i++) {
          const filled = i < owned.charges;
          const pip = this.scene.add.graphics();
          pip.fillStyle(filled ? color : 0x222233, filled ? 0.9 : 0.55);
          pip.fillCircle(px + pipR, pCY + pipR, pipR);
          if (filled) { pip.lineStyle(1, 0xffffff, 0.18); pip.strokeCircle(px + pipR, pCY + pipR, pipR); }
          pip.setDepth(54);
          this.elements.push(pip);
          px += pipDiam + pipGap;
        }

        const cLbl = this.scene.add.text(pCX, pCY + pipDiam + 2,
          `${owned.charges}/${owned.maxCharges}`,
          { fontSize: '9px', color: hasCharges ? '#ffdd88' : '#555566', fontFamily: 'Arial' });
        cLbl.setOrigin(0.5, 0).setDepth(54);
        this.elements.push(cLbl);
      }

      // ── ACTIVATE button ──
      btnBg  = this.scene.add.graphics();
      btnBg.setDepth(54);
      this.elements.push(btnBg);

      btnText = this.scene.add.text(
        btnX + Math.floor(btnW / 2),
        y + Math.floor(h / 2),
        '',
        { fontSize: '13px', fontFamily: 'Arial', fontStyle: 'bold' },
      );
      btnText.setOrigin(0.5, 0.5).setDepth(55);
      this.elements.push(btnText);

      this.drawBtn(btnBg, btnText, btnX, btnY, btnW, btnH, color, hasCharges, false);

      // Vertical divider before button column
      const vd2 = this.scene.add.graphics();
      vd2.lineStyle(1, color, 0.18);
      vd2.lineBetween(pipsX - 2, y + 5, pipsX - 2, y + h - 5);
      vd2.setDepth(52);
      this.elements.push(vd2);
    }

    // ── Name + Level (left column) ──
    const nSize   = h >= 60 ? 16 : (h >= 46 ? 14 : 12);
    const lvSize  = h >= 50 ? 12 : 10;
    const nLineH  = nSize + 3;
    const lLineH  = lvSize + 2;
    const blockH  = nLineH + lLineH;
    const blockY  = y + Math.floor((h - blockH) / 2);

    const nameT = this.scene.add.text(contentX, blockY, def.name, {
      fontSize: `${nSize}px`,
      color: '#e8e8ff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      wordWrap: { width: NAME_W - 4 },
    });
    nameT.setDepth(53);
    this.elements.push(nameT);

    const catLabel = def.category === 'activePower' ? 'Active'
      : def.category === 'passivePower' ? 'Passive'
      : 'Stat';
    const lvlT = this.scene.add.text(contentX, blockY + nLineH, `Lv ${owned.level}  ·  ${catLabel}`, {
      fontSize: `${lvSize}px`,
      color: '#5555aa',
      fontFamily: 'Arial',
    });
    lvlT.setDepth(53);
    this.elements.push(lvlT);

    // Vertical divider after name column
    const vd1 = this.scene.add.graphics();
    vd1.lineStyle(1, color, 0.18);
    vd1.lineBetween(descX - 5, y + 5, descX - 5, y + h - 5);
    vd1.setDepth(52);
    this.elements.push(vd1);

    // ── Description (middle column) ──
    const descSize = h >= 60 ? 13 : (h >= 44 ? 12 : 10);
    const descW    = Math.max(40, descMaxX - descX);
    const desc     = levelData?.description ?? '';
    const descT = this.scene.add.text(descX, y + 7, desc, {
      fontSize: `${descSize}px`,
      color: '#8888cc',
      fontFamily: 'Arial',
      wordWrap: { width: descW },
    });
    descT.setDepth(53);
    this.elements.push(descT);

    // ── Store card data for setActiveCard() ──
    this.cardDataMap.set(owned.powerUpId, {
      bg: card, btnBg, btnText,
      btnX, btnY, btnW, btnH,
      color, x, y, w, h,
      isActive: false, hasCharges,
    });

    // ── Interactive zone ──
    const zone = this.scene.add.zone(x + Math.floor(w / 2), y + Math.floor(h / 2), w, h);
    zone.setInteractive({ useHandCursor: isActive && hasCharges });
    zone.setDepth(56);
    this.elements.push(zone);

    zone.on('pointerover', () => {
      if (this.cardDataMap.get(owned.powerUpId)?.isActive) return;
      if (isActive && !hasCharges) return;
      card.clear();
      card.fillStyle(0x1a1a2e, 0.98);
      card.fillRoundedRect(x, y, w, h, 4);
      card.lineStyle(1.5, color, 0.55);
      card.strokeRoundedRect(x, y, w, h, 4);
    });

    zone.on('pointerout', () => {
      if (this.cardDataMap.get(owned.powerUpId)?.isActive) return;
      card.clear();
      card.fillStyle(0x111122, 0.95);
      card.fillRoundedRect(x, y, w, h, 4);
      card.lineStyle(1, color, 0.28);
      card.strokeRoundedRect(x, y, w, h, 4);
    });

    zone.on('pointerdown', () => {
      if (isActive) this.options.onActivatePowerUp?.(owned.powerUpId);
    });
  }

  // ── Flash highlight ───────────────────────────────────────────────────────

  /**
   * Briefly flash a card to show a power-up fired (active or passive).
   * Creates a bright element-coloured overlay that fades out over ~600ms.
   */
  flashCard(id: string): void {
    const data = this.cardDataMap.get(id);
    if (!data) return;

    const flash = this.scene.add.graphics();
    flash.fillStyle(data.color, 0.45);
    flash.fillRoundedRect(data.x, data.y, data.w, data.h, 4);
    flash.lineStyle(2, data.color, 1.0);
    flash.strokeRoundedRect(data.x, data.y, data.w, data.h, 4);
    flash.setDepth(57); // above all card content (max depth 56)

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => flash.destroy(),
    });
  }

  // ── Button drawing ────────────────────────────────────────────────────────

  private drawBtn(
    bg: Phaser.GameObjects.Graphics,
    text: Phaser.GameObjects.Text,
    x: number, y: number, w: number, h: number,
    color: number, hasCharges: boolean, isActive: boolean,
  ): void {
    bg.clear();
    if (isActive) {
      bg.fillStyle(color, 0.28); bg.lineStyle(2, 0xffffff, 0.8);
      bg.fillRoundedRect(x, y, w, h, 4); bg.strokeRoundedRect(x, y, w, h, 4);
      text.setText('◉ TARGETING'); text.setColor('#ffffff');
    } else if (hasCharges) {
      bg.fillStyle(color, 0.1); bg.lineStyle(1.5, color, 0.7);
      bg.fillRoundedRect(x, y, w, h, 4); bg.strokeRoundedRect(x, y, w, h, 4);
      text.setText('▶ ACTIVATE');
      text.setColor('#' + color.toString(16).padStart(6, '0'));
    } else {
      bg.fillStyle(0x1a1a28, 0.6); bg.lineStyle(1, 0x333344, 0.4);
      bg.fillRoundedRect(x, y, w, h, 4); bg.strokeRoundedRect(x, y, w, h, 4);
      text.setText('NO CHARGES'); text.setColor('#444455');
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  private destroyElements(): void {
    for (const el of this.elements) el.destroy();
    this.elements = [];
  }
}
