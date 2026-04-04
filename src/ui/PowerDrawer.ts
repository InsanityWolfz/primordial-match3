import type Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import { getPowerUpDef } from '../config/powerUps.ts';
import type { OwnedPowerUp } from '../types/RunState.ts';

// ── Layout constants ──────────────────────────────────────────────────────────
const DRAWER_H      = 730;
const DRAWER_OPEN_Y = GAME_CONFIG.height - DRAWER_H;   // 550
const DRAWER_CLOSED_Y = GAME_CONFIG.height;             // 1280
const CARD_H        = 100;
const CARD_GAP      = 6;
const H_PAD         = 12;
const HEADER_H      = 58;
const CARD_START_Y  = HEADER_H + 6;

// Button dimensions (container-local)
const BTN_W = 135;
const BTN_H = 32;

interface BtnBounds {
  id: string;
  x: number;   // cardContainer-local X
  y: number;   // cardContainer-local Y
  w: number;
  h: number;
}

export interface PowerDrawerOptions {
  onActivatePowerUp: (id: string) => void;
}

/**
 * PowerDrawer — full-detail slide-up panel for all owned power-ups.
 *
 * Avoids putting interactive zones inside the Phaser Container (which is
 * unreliable for input). Instead uses a single scene-level pointerdown
 * handler + a full-screen blocker zone while open.
 */
export class PowerDrawer {
  private scene: Phaser.Scene;
  private ownedPowerUps: OwnedPowerUp[];
  private options: PowerDrawerOptions;

  private container: Phaser.GameObjects.Container | null = null;
  private cardContainer: Phaser.GameObjects.Container | null = null;
  private overlay: Phaser.GameObjects.Graphics | null = null;
  private blockerZone: Phaser.GameObjects.Zone | null = null;
  private maskGraphics: Phaser.GameObjects.Graphics | null = null;

  private inputHandler: ((ptr: Phaser.Input.Pointer) => void) | null = null;
  private moveHandler:  ((ptr: Phaser.Input.Pointer) => void) | null = null;
  private upHandler:    (() => void) | null = null;

  // Button bounds stored in cardContainer-local coords for hit-testing
  private closeBtnBounds = { x: 0, y: 0, w: 0, h: 0 };
  private activateBtnBounds: BtnBounds[] = [];

  // Scroll state
  private scrollOffset   = 0;
  private maxScrollOffset = 0;
  private isDragging     = false;
  private dragStartY     = 0;
  private dragStartScroll = 0;

  private _isOpen = false;
  private _blockFirstEvent = false;

  constructor(
    scene: Phaser.Scene,
    ownedPowerUps: OwnedPowerUp[],
    options: PowerDrawerOptions,
  ) {
    this.scene = scene;
    this.ownedPowerUps = [...ownedPowerUps];
    this.options = options;
  }

  get isVisible(): boolean { return this._isOpen; }

  /** Update data. If drawer is open, rebuild to reflect new charges. */
  refreshData(ownedPowerUps: OwnedPowerUp[]): void {
    this.ownedPowerUps = [...ownedPowerUps];
    if (this._isOpen) {
      this.destroyDrawer();
      this._isOpen = false;
      this.buildDrawer();
    }
  }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.buildDrawer();
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;

    this.removeHandlers();
    this.blockerZone?.destroy();
    this.blockerZone = null;
    this.resetCursor();

    if (this.container) {
      this.scene.tweens.add({
        targets: this.container,
        y: DRAWER_CLOSED_Y,
        duration: 250,
        ease: 'Power2.In',
        onComplete: () => this.destroyDrawer(),
      });
    }

    if (this.overlay) {
      this.scene.tweens.add({
        targets: this.overlay,
        alpha: 0,
        duration: 250,
        onComplete: () => {
          this.overlay?.destroy();
          this.overlay = null;
        },
      });
    }
  }

  destroy(): void {
    this.removeHandlers();
    this.destroyDrawer();
    this.blockerZone?.destroy();
    this.blockerZone = null;
    if (this.overlay) { this.overlay.destroy(); this.overlay = null; }
    this._isOpen = false;
    this.resetCursor();
  }

  // ── BUILD ─────────────────────────────────────────────────────────────────

  private buildDrawer(): void {
    const W = GAME_CONFIG.width;
    this.activateBtnBounds = [];
    this.scrollOffset = 0;

    // Semi-transparent overlay (visual only, no input)
    this.overlay = this.scene.add.graphics();
    this.overlay.fillStyle(0x000000, 0.65);
    this.overlay.fillRect(0, 0, W, GAME_CONFIG.height);
    this.overlay.setDepth(70);
    this.overlay.setAlpha(0);
    this.scene.tweens.add({ targets: this.overlay, alpha: 1, duration: 200 });

    // Full-screen input blocker
    this.blockerZone = this.scene.add.zone(W / 2, GAME_CONFIG.height / 2, W, GAME_CONFIG.height);
    this.blockerZone.setInteractive();
    this.blockerZone.setDepth(90);

    // Container for the drawer panel
    this.container = this.scene.add.container(0, DRAWER_CLOSED_Y);
    this.container.setDepth(91);

    // ── Drawer background ──
    const drawerBg = this.scene.add.graphics();
    drawerBg.fillStyle(0x0d0d1e, 1);
    drawerBg.fillRoundedRect(0, 0, W, DRAWER_H, { tl: 22, tr: 22, bl: 0, br: 0 });
    drawerBg.lineStyle(2, 0x4444aa, 0.85);
    drawerBg.strokeRoundedRect(0, 0, W, DRAWER_H, { tl: 22, tr: 22, bl: 0, br: 0 });
    this.container.add(drawerBg);

    // Title
    const title = this.scene.add.text(H_PAD + 4, 26, 'YOUR POWERS', {
      fontSize: '15px', color: '#8888cc', fontFamily: 'Arial', fontStyle: 'bold',
    });
    this.container.add(title);

    // Close button (visual only — hit-tested manually)
    const closeBg = this.scene.add.graphics();
    closeBg.fillStyle(0x222235, 0.9);
    closeBg.lineStyle(1, 0x4444aa, 0.5);
    closeBg.fillRoundedRect(W - 54, 18, 40, 28, 6);
    closeBg.strokeRoundedRect(W - 54, 18, 40, 28, 6);
    this.container.add(closeBg);

    const closeT = this.scene.add.text(W - 34, 22, '✕', {
      fontSize: '17px', color: '#aaaacc', fontFamily: 'Arial',
    });
    closeT.setOrigin(0.5, 0);
    this.container.add(closeT);

    // Store close button bounds (container-local)
    this.closeBtnBounds = { x: W - 56, y: 14, w: 48, h: 38 };

    // Horizontal divider
    const divider = this.scene.add.graphics();
    divider.lineStyle(1, 0x333355, 0.8);
    divider.lineBetween(H_PAD, HEADER_H, W - H_PAD, HEADER_H);
    this.container.add(divider);

    // ── Sort cards ──
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

    // Compute scroll limits
    const totalCardsH = sorted.length * (CARD_H + CARD_GAP);
    const visibleH    = DRAWER_H - CARD_START_Y;
    this.maxScrollOffset = Math.max(0, totalCardsH - visibleH);

    // Card sub-container (scrollable)
    this.cardContainer = this.scene.add.container(0, CARD_START_Y);
    this.container.add(this.cardContainer);

    let cardY = 0;
    for (const owned of sorted) {
      this.renderCard(owned, H_PAD, cardY, W - H_PAD * 2, CARD_H);
      cardY += CARD_H + CARD_GAP;
    }

    if (sorted.length === 0) {
      const empty = this.scene.add.text(W / 2, 40, 'No powers yet', {
        fontSize: '14px', color: '#555566', fontFamily: 'Arial', fontStyle: 'italic',
      });
      empty.setOrigin(0.5, 0);
      this.cardContainer.add(empty);
    }

    // Slide-in tween — apply mask after tween so it's in world coords
    this.scene.tweens.add({
      targets: this.container,
      y: DRAWER_OPEN_Y,
      duration: 300,
      ease: 'Power2.Out',
      onComplete: () => {
        if (this.cardContainer) {
          this.maskGraphics = this.scene.make.graphics({ add: false });
          this.maskGraphics.fillRect(0, DRAWER_OPEN_Y + HEADER_H, W, DRAWER_H - HEADER_H);
          this.cardContainer.setMask(this.maskGraphics.createGeometryMask());
        }
      },
    });

    // Attach scene-level input handlers
    this.attachHandlers();
  }

  private renderCard(
    owned: OwnedPowerUp,
    x: number, y: number,
    w: number, h: number,
  ): void {
    if (!this.cardContainer) return;
    const def = getPowerUpDef(owned.powerUpId);
    if (!def) return;

    const gemType   = GAME_CONFIG.gemTypes.find(g => g.name === def.element);
    const color     = gemType?.color ?? 0x888888;
    const levelData = def.levels[Math.min(owned.level, def.maxLevel) - 1];
    const isActive  = def.category === 'activePower';
    const hasCharges = isActive && (owned.charges ?? 0) > 0;

    // Card background
    const card = this.scene.add.graphics();
    card.fillStyle(0x111122, 0.96);
    card.fillRoundedRect(x, y, w, h, 5);
    card.lineStyle(1.5, color, 0.38);
    card.strokeRoundedRect(x, y, w, h, 5);
    this.cardContainer.add(card);

    // Left accent strip
    const accent = this.scene.add.graphics();
    accent.fillStyle(color, 0.9);
    accent.fillRect(x, y + 4, 4, h - 8);
    this.cardContainer.add(accent);

    // Name
    const nameT = this.scene.add.text(x + 12, y + 10, def.name, {
      fontSize: '15px', color: '#e8e8ff', fontFamily: 'Arial', fontStyle: 'bold',
    });
    this.cardContainer.add(nameT);

    // Level · Category
    const catLabel = isActive
      ? 'Active Power'
      : (def.category === 'passivePower' ? 'Passive Power' : 'Passive Stat');
    const lvlT = this.scene.add.text(x + 12, y + 28, `Lv ${owned.level}  ·  ${catLabel}`, {
      fontSize: '11px', color: '#555588', fontFamily: 'Arial',
    });
    this.cardContainer.add(lvlT);

    // Description
    const descRight = isActive ? w - 160 : w - 20;
    const desc      = levelData?.description ?? '';
    const descT = this.scene.add.text(x + 12, y + 46, desc, {
      fontSize: '12px', color: '#7777aa', fontFamily: 'Arial',
      wordWrap: { width: descRight },
    });
    this.cardContainer.add(descT);

    // Active powers: charge pips + activate button
    if (isActive && owned.charges !== undefined && owned.maxCharges !== undefined) {
      const maxPips = Math.min(owned.maxCharges, 8);
      const pipR    = 5;
      const pipGap  = 4;
      const totalPW = maxPips * (pipR * 2) + (maxPips - 1) * pipGap;
      let   px      = x + w - 10 - totalPW;
      const pipY    = y + 14;

      for (let i = 0; i < maxPips; i++) {
        const filled = i < owned.charges;
        const pip = this.scene.add.graphics();
        pip.fillStyle(filled ? color : 0x222233, filled ? 0.9 : 0.5);
        pip.fillCircle(px + pipR, pipY + pipR, pipR);
        if (filled) {
          pip.lineStyle(1, 0xffffff, 0.15);
          pip.strokeCircle(px + pipR, pipY + pipR, pipR);
        }
        this.cardContainer.add(pip);
        px += pipR * 2 + pipGap;
      }

      const pipCenterX = (x + w - 10 - totalPW) + totalPW / 2;
      const chargeLbl = this.scene.add.text(
        pipCenterX, pipY + pipR * 2 + 3,
        `${owned.charges}/${owned.maxCharges}`,
        { fontSize: '9px', color: hasCharges ? '#ffdd88' : '#555566', fontFamily: 'Arial' },
      );
      chargeLbl.setOrigin(0.5, 0);
      this.cardContainer.add(chargeLbl);

      // Activate button (visual only — hit-tested manually)
      const btnX = x + w - BTN_W - 6;
      const btnY = y + h - BTN_H - 8;

      const btnBg = this.scene.add.graphics();
      if (hasCharges) {
        btnBg.fillStyle(color, 0.14);
        btnBg.lineStyle(1.5, color, 0.85);
      } else {
        btnBg.fillStyle(0x1a1a28, 0.55);
        btnBg.lineStyle(1, 0x333344, 0.4);
      }
      btnBg.fillRoundedRect(btnX, btnY, BTN_W, BTN_H, 5);
      btnBg.strokeRoundedRect(btnX, btnY, BTN_W, BTN_H, 5);
      this.cardContainer.add(btnBg);

      const colorHex = '#' + color.toString(16).padStart(6, '0');
      const btnLabel = hasCharges ? '▶  ACTIVATE' : 'NO CHARGES';
      const btnText = this.scene.add.text(btnX + BTN_W / 2, btnY + BTN_H / 2, btnLabel, {
        fontSize: '13px',
        color: hasCharges ? colorHex : '#444455',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      });
      btnText.setOrigin(0.5, 0.5);
      this.cardContainer.add(btnText);

      if (hasCharges) {
        this.activateBtnBounds.push({ id: owned.powerUpId, x: btnX, y: btnY, w: BTN_W, h: BTN_H });
      }
    }
  }

  // ── Input handling ────────────────────────────────────────────────────────

  private attachHandlers(): void {
    this._blockFirstEvent = true;

    this.inputHandler = (ptr: Phaser.Input.Pointer) => {
      if (this._blockFirstEvent) { this._blockFirstEvent = false; return; }
      this.handlePointerDown(ptr);
    };

    this.moveHandler = (ptr: Phaser.Input.Pointer) => {
      this.handlePointerMove(ptr);
    };

    this.upHandler = () => { this.isDragging = false; };

    this.scene.input.on('pointerdown', this.inputHandler);
    this.scene.input.on('pointermove', this.moveHandler);
    this.scene.input.on('pointerup',   this.upHandler);
  }

  private removeHandlers(): void {
    if (this.inputHandler) { this.scene.input.off('pointerdown', this.inputHandler); this.inputHandler = null; }
    if (this.moveHandler)  { this.scene.input.off('pointermove', this.moveHandler);  this.moveHandler  = null; }
    if (this.upHandler)    { this.scene.input.off('pointerup',   this.upHandler);    this.upHandler    = null; }
    if (this.maskGraphics) { this.maskGraphics.destroy(); this.maskGraphics = null; }
    this.isDragging = false;
  }

  private resetCursor(): void {
    this.scene.input.manager.canvas.style.cursor = '';
  }

  private handlePointerMove(ptr: Phaser.Input.Pointer): void {
    if (!this._isOpen || !this.container) return;

    const containerY = this.container.y;
    const canvas     = this.scene.input.manager.canvas;

    // Cursor: pointer when over header strip or X button area
    if (ptr.y >= containerY && ptr.y <= containerY + HEADER_H) {
      canvas.style.cursor = 'pointer';
    } else {
      canvas.style.cursor = '';
    }

    // Drag scroll
    if (!this.isDragging || !this.cardContainer) return;
    const delta = ptr.y - this.dragStartY;
    this.scrollOffset = Phaser.Math.Clamp(
      this.dragStartScroll - delta,
      0,
      this.maxScrollOffset,
    );
    this.cardContainer.setY(CARD_START_Y - this.scrollOffset);
  }

  private handlePointerDown(ptr: Phaser.Input.Pointer): void {
    if (!this._isOpen || !this.container) return;

    const containerY = this.container.y;

    // Tap above the drawer → close
    if (ptr.y < containerY) {
      this.close();
      return;
    }

    // Convert to container-local coordinates
    const lx = ptr.x;
    const ly = ptr.y - containerY;

    // Close button / header area
    const cb = this.closeBtnBounds;
    if (lx >= cb.x && lx <= cb.x + cb.w && ly >= cb.y && ly <= cb.y + cb.h) {
      this.close();
      return;
    }

    // Activate buttons (cardContainer-local coords)
    const cardLy = ly - CARD_START_Y + this.scrollOffset;
    for (const btn of this.activateBtnBounds) {
      if (lx >= btn.x && lx <= btn.x + btn.w && cardLy >= btn.y && cardLy <= btn.y + btn.h) {
        this.close();
        this.options.onActivatePowerUp(btn.id);
        return;
      }
    }

    // Start drag if in scrollable card area and content overflows
    if (ly > HEADER_H && this.maxScrollOffset > 0) {
      this.isDragging      = true;
      this.dragStartY      = ptr.y;
      this.dragStartScroll = this.scrollOffset;
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  private destroyDrawer(): void {
    if (this.container) {
      this.container.destroy(true);
      this.container = null;
      this.cardContainer = null;
    }
    this.activateBtnBounds = [];
  }
}
