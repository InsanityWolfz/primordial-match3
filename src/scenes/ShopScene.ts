import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { RunState } from '../types/RunState.ts';
import { POWER_UPS, getPowerUpDef } from '../config/powerUps.ts';
import { SHOP_CONFIG, getPowerSlotCost, getPassiveSlotCost } from '../config/shopConfig.ts';
import { ShopCardRenderer } from '../ui/ShopCardRenderer.ts';
import { InventoryBar } from '../ui/InventoryBar.ts';

export class ShopScene extends Phaser.Scene {
  runState!: RunState;
  private cardRenderer!: ShopCardRenderer;
  private inventoryBar!: InventoryBar;

  // Current offering IDs
  private powerItemIds: string[] = [];    // activePower + passivePower offerings
  private passiveItemIds: string[] = [];  // stat passive offerings

  // Track IDs already shown (excluded from rerolls)
  private seenPowerIds: Set<string> = new Set();
  private seenPassiveIds: Set<string> = new Set();

  // Managed game objects for cleanup
  private headerObjects: Phaser.GameObjects.GameObject[] = [];
  private essenceObjects: Phaser.GameObjects.GameObject[] = [];
  private powerSectionObjects: Phaser.GameObjects.GameObject[] = [];
  private passiveSectionObjects: Phaser.GameObjects.GameObject[] = [];
  private slotButtonObjects: Phaser.GameObjects.GameObject[] = [];
  private rerollObjects: Phaser.GameObjects.GameObject[] = [];
  private nextRoundObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'ShopScene' });
  }

  create(data: RunState): void {
    this.runState = {
      ...data,
      ownedPowerUps: data.ownedPowerUps ?? [],
      powerSlotCount: data.powerSlotCount ?? 4,
      passiveSlotCount: data.passiveSlotCount ?? 2,
    };

    this.cardRenderer = new ShopCardRenderer(this);
    this.clearAllGroups();
    this.seenPowerIds = new Set();
    this.seenPassiveIds = new Set();

    this.drawBackground();
    this.createHeader();
    this.createEssenceDisplay();
    this.rollShopItems();
    this.drawAllSections();

    // Inventory bar at bottom
    this.inventoryBar = new InventoryBar(this, this.runState.ownedPowerUps);
    this.inventoryBar.create();
  }

  // ──────────────── BACKGROUND ────────────────

  private drawBackground(): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x0d0d1a, 1);
    bg.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height / 2);
    bg.fillStyle(0x060610, 1);
    bg.fillRect(0, GAME_CONFIG.height / 2, GAME_CONFIG.width, GAME_CONFIG.height / 2);
    bg.setDepth(-10);
  }

  /**
   * Draw a full-width section divider header. Returns the header height.
   */
  private drawSectionHeader(
    objects: Phaser.GameObjects.GameObject[],
    y: number,
    label: string,
    slotsInfo: string,
    accentColor: number,
  ): number {
    const headerH = 32;
    const hexColor = '#' + accentColor.toString(16).padStart(6, '0');

    const strip = this.add.graphics();
    strip.fillStyle(0x0d0d22, 0.95);
    strip.fillRect(0, y, GAME_CONFIG.width, headerH);
    strip.lineStyle(1, accentColor, 0.25);
    strip.lineBetween(0, y, GAME_CONFIG.width, y);
    strip.lineBetween(0, y + headerH, GAME_CONFIG.width, y + headerH);
    strip.setDepth(5);
    objects.push(strip);

    // Accent dot
    const dot = this.add.graphics();
    dot.fillStyle(accentColor, 0.85);
    dot.fillCircle(28, y + headerH / 2, 4);
    dot.setDepth(6);
    objects.push(dot);

    // Section label (left)
    objects.push(
      this.add.text(42, y + headerH / 2, label, {
        fontSize: '13px',
        color: hexColor,
        fontFamily: 'Arial',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5).setDepth(6),
    );

    // Slots info (right)
    objects.push(
      this.add.text(GAME_CONFIG.width - 16, y + headerH / 2, slotsInfo, {
        fontSize: '12px',
        color: '#888899',
        fontFamily: 'Arial',
      }).setOrigin(1, 0.5).setDepth(6),
    );

    return headerH;
  }

  // ──────────────── HEADER ────────────────

  private createHeader(): void {
    this.headerObjects.push(
      this.add.text(GAME_CONFIG.width / 2, 80, `Round ${this.runState.round} Complete`, {
        fontSize: '36px',
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5),
    );

    this.headerObjects.push(
      this.add.text(GAME_CONFIG.width / 2, 130, `Score: ${this.runState.score}`, {
        fontSize: '24px',
        color: '#cccccc',
        fontFamily: 'Arial',
      }).setOrigin(0.5, 0.5),
    );
  }

  private createEssenceDisplay(): void {
    this.destroyGroup(this.essenceObjects);
    this.essenceObjects = [];

    this.essenceObjects.push(
      this.add.text(GAME_CONFIG.width / 2, 175, `Essence: ${this.runState.essence}`, {
        fontSize: '24px',
        color: '#cc88ff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5),
    );
  }

  // ──────────────── ROLLING ────────────────

  private rollShopItems(): void {
    this.rollPowerItems();
    this.rollPassiveItems();
  }

  private rollPowerItems(): void {
    // Power section rolls from activePower + passivePower categories
    const available = POWER_UPS.filter(def => {
      if (def.category === 'passive') return false;
      if (this.seenPowerIds.has(def.id)) return false;
      // Hide powers whose prerequisite active isn't owned yet
      if (def.requires && !this.runState.ownedPowerUps.find(p => p.powerUpId === def.requires)) return false;
      const owned = this.runState.ownedPowerUps.find(p => p.powerUpId === def.id);
      const currentLevel = owned ? owned.level : 0;
      return currentLevel < def.maxLevel;
    });

    this.shuffle(available);
    this.powerItemIds = available.slice(0, SHOP_CONFIG.shopOfferSlots.powers).map(d => d.id);
    this.seenPowerIds = new Set(this.powerItemIds);
  }

  private rollPassiveItems(): void {
    // Passive section rolls from passive category only
    const available = POWER_UPS.filter(def => {
      if (def.category !== 'passive') return false;
      if (this.seenPassiveIds.has(def.id)) return false;
      // Hide passives whose prerequisite active isn't owned yet
      if (def.requires && !this.runState.ownedPowerUps.find(p => p.powerUpId === def.requires)) return false;
      const owned = this.runState.ownedPowerUps.find(p => p.powerUpId === def.id);
      const currentLevel = owned ? owned.level : 0;
      return currentLevel < def.maxLevel;
    });

    this.shuffle(available);
    this.passiveItemIds = available.slice(0, SHOP_CONFIG.shopOfferSlots.passives).map(d => d.id);
    this.seenPassiveIds = new Set(this.passiveItemIds);
  }

  // ──────────────── SLOT COUNTS ────────────────

  private getOwnedPowerCount(): number {
    return this.runState.ownedPowerUps.filter(p => {
      const def = getPowerUpDef(p.powerUpId);
      return def && (def.category === 'activePower' || def.category === 'passivePower');
    }).length;
  }

  private getOwnedPassiveCount(): number {
    return this.runState.ownedPowerUps.filter(p => {
      const def = getPowerUpDef(p.powerUpId);
      return def && def.category === 'passive';
    }).length;
  }

  // ──────────────── DRAW ALL SECTIONS ────────────────

  private drawAllSections(): void {
    const cardW = SHOP_CONFIG.layout.cardWidth;
    const gap = SHOP_CONFIG.layout.cardGap;
    const startX = (GAME_CONFIG.width - cardW) / 2;

    let curY = 220;

    // ─── Power section ───
    const powerSectionHeight = this.drawPowerSection(startX, curY, cardW, gap);
    curY += 12 + powerSectionHeight;

    // ─── Passive section ───
    const passiveSectionHeight = this.drawPassiveSection(startX, curY, cardW, gap);
    curY += 12 + passiveSectionHeight;

    // ─── Slot buttons ───
    this.drawSlotButtons(curY);
    curY += 55;

    // ─── Reroll button ───
    this.drawRerollButton(curY);
    curY += 50;

    // ─── Next round button ───
    this.drawNextRoundButton(curY);
  }

  // ──────────────── POWER SECTION ────────────────

  private drawPowerSection(startX: number, startY: number, cardW: number, gap: number): number {
    this.destroyGroup(this.powerSectionObjects);
    this.powerSectionObjects = [];

    const powerCount = this.getOwnedPowerCount();
    const headerH = this.drawSectionHeader(
      this.powerSectionObjects, startY,
      'POWERS',
      `${powerCount} / ${this.runState.powerSlotCount} slots`,
      0xffaa44,
    );

    if (this.powerItemIds.length === 0) {
      this.powerSectionObjects.push(
        this.add.text(GAME_CONFIG.width / 2, startY + headerH + 24, 'No powers available — reroll', {
          fontSize: '14px',
          color: '#666666',
          fontFamily: 'Arial',
        }).setOrigin(0.5, 0.5),
      );
      return headerH + 48;
    }

    const powerSlotsFull = powerCount >= this.runState.powerSlotCount;

    let cardY = startY + headerH + 8;
    let totalHeight = headerH + 8;

    for (let i = 0; i < this.powerItemIds.length; i++) {
      const def = POWER_UPS.find(p => p.id === this.powerItemIds[i]);
      if (!def) continue;
      const owned = this.runState.ownedPowerUps.find(p => p.powerUpId === def.id);
      const currentLevel = owned ? owned.level : 0;
      const isMaxLevel = currentLevel >= def.maxLevel;
      const isNew = currentLevel === 0;
      const slotBlocked = powerSlotsFull && isNew;
      const cost = isMaxLevel ? 0 : def.levels[currentLevel].cost;
      const canAfford = !isMaxLevel && !slotBlocked && this.runState.essence >= cost;

      const cardH = this.cardRenderer.measureCardHeight(def, owned, cardW);
      const objects = this.cardRenderer.drawCard(
        def, owned, startX, cardY, cardW, cardH,
        canAfford, slotBlocked,
        () => this.purchasePowerUp(def.id, cost),
      );
      this.powerSectionObjects.push(...objects);

      cardY += cardH + gap;
      totalHeight += cardH + (i < this.powerItemIds.length - 1 ? gap : 0);
    }

    return totalHeight;
  }

  // ──────────────── PASSIVE SECTION ────────────────

  private drawPassiveSection(startX: number, startY: number, cardW: number, gap: number): number {
    this.destroyGroup(this.passiveSectionObjects);
    this.passiveSectionObjects = [];

    const passiveCount = this.getOwnedPassiveCount();
    const headerH = this.drawSectionHeader(
      this.passiveSectionObjects, startY,
      'STAT PASSIVES',
      `${passiveCount} / ${this.runState.passiveSlotCount} slots`,
      0x66aaff,
    );

    if (this.passiveItemIds.length === 0) {
      this.passiveSectionObjects.push(
        this.add.text(GAME_CONFIG.width / 2, startY + headerH + 24, 'No passives available — reroll', {
          fontSize: '14px',
          color: '#666666',
          fontFamily: 'Arial',
        }).setOrigin(0.5, 0.5),
      );
      return headerH + 48;
    }

    const passiveSlotsFull = passiveCount >= this.runState.passiveSlotCount;

    let cardY = startY + headerH + 8;
    let totalHeight = headerH + 8;

    for (let i = 0; i < this.passiveItemIds.length; i++) {
      const def = POWER_UPS.find(p => p.id === this.passiveItemIds[i]);
      if (!def) continue;
      const owned = this.runState.ownedPowerUps.find(p => p.powerUpId === def.id);
      const currentLevel = owned ? owned.level : 0;
      const isMaxLevel = currentLevel >= def.maxLevel;
      const isNew = currentLevel === 0;
      const slotBlocked = passiveSlotsFull && isNew;
      const cost = isMaxLevel ? 0 : def.levels[currentLevel].cost;
      const canAfford = !isMaxLevel && !slotBlocked && this.runState.essence >= cost;

      const cardH = this.cardRenderer.measureCardHeight(def, owned, cardW);
      const objects = this.cardRenderer.drawCard(
        def, owned, startX, cardY, cardW, cardH,
        canAfford, slotBlocked,
        () => this.purchasePowerUp(def.id, cost),
      );
      this.passiveSectionObjects.push(...objects);

      cardY += cardH + gap;
      totalHeight += cardH + (i < this.passiveItemIds.length - 1 ? gap : 0);
    }

    return totalHeight;
  }

  // ──────────────── SLOT BUTTONS ────────────────

  private drawSlotButtons(startY: number): void {
    this.destroyGroup(this.slotButtonObjects);
    this.slotButtonObjects = [];

    const btnW = 190;
    const btnH = 36;
    const gap = 12;
    const centerX = GAME_CONFIG.width / 2;

    // Power slot button (left)
    const powerSlotCost = getPowerSlotCost(this.runState.powerSlotCount);
    if (powerSlotCost !== null) {
      const bx = centerX - gap / 2 - btnW;
      const canAfford = this.runState.essence >= powerSlotCost;
      this.drawSlotButton(
        bx, startY, btnW, btnH,
        `+1 Power Slot (${powerSlotCost})`,
        canAfford, 0xffaa44,
        () => this.buyPowerSlot(powerSlotCost),
      );
    } else {
      const bx = centerX - gap / 2 - btnW;
      this.drawSlotButton(bx, startY, btnW, btnH, 'Power Slots MAX', false, 0x444444, () => {});
    }

    // Passive slot button (right)
    const passiveSlotCost = getPassiveSlotCost(this.runState.passiveSlotCount);
    if (passiveSlotCost !== null) {
      const bx = centerX + gap / 2;
      const canAfford = this.runState.essence >= passiveSlotCost;
      this.drawSlotButton(
        bx, startY, btnW, btnH,
        `+1 Passive Slot (${passiveSlotCost})`,
        canAfford, 0x66aaff,
        () => this.buyPassiveSlot(passiveSlotCost),
      );
    } else {
      const bx = centerX + gap / 2;
      this.drawSlotButton(bx, startY, btnW, btnH, 'Passive Slots MAX', false, 0x444444, () => {});
    }
  }

  private drawSlotButton(
    x: number, y: number, w: number, h: number,
    label: string, enabled: boolean, accentColor: number,
    onClick: () => void,
  ): void {
    const bg = this.add.graphics();
    bg.fillStyle(enabled ? 0x333333 : 0x1a1a1a, 1);
    bg.lineStyle(1, enabled ? accentColor : 0x333333, enabled ? 0.6 : 0.3);
    bg.fillRoundedRect(x, y, w, h, 6);
    bg.strokeRoundedRect(x, y, w, h, 6);
    this.slotButtonObjects.push(bg);

    const text = this.add.text(x + w / 2, y + h / 2, label, {
      fontSize: '12px',
      color: enabled ? '#cccccc' : '#555555',
      fontFamily: 'Arial',
    }).setOrigin(0.5, 0.5);
    this.slotButtonObjects.push(text);

    if (enabled) {
      const hitArea = this.add.zone(x + w / 2, y + h / 2, w, h);
      hitArea.setInteractive({ useHandCursor: true });
      this.slotButtonObjects.push(hitArea);

      hitArea.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(0x444444, 1);
        bg.lineStyle(1, accentColor, 1);
        bg.fillRoundedRect(x, y, w, h, 6);
        bg.strokeRoundedRect(x, y, w, h, 6);
        text.setColor('#ffffff');
      });

      hitArea.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(0x333333, 1);
        bg.lineStyle(1, accentColor, 0.6);
        bg.fillRoundedRect(x, y, w, h, 6);
        bg.strokeRoundedRect(x, y, w, h, 6);
        text.setColor('#cccccc');
      });

      hitArea.on('pointerdown', () => onClick());
    }
  }

  // ──────────────── REROLL BUTTON ────────────────

  private drawRerollButton(y: number): void {
    this.destroyGroup(this.rerollObjects);
    this.rerollObjects = [];

    const cost = SHOP_CONFIG.rerollCost;
    const canReroll = this.runState.essence >= cost;
    const btnX = GAME_CONFIG.width / 2;
    const btnW = 200;
    const btnH = 36;

    const bg = this.add.graphics();
    bg.fillStyle(canReroll ? 0x444444 : 0x222222, 1);
    bg.lineStyle(1, canReroll ? 0x666666 : 0x333333, 1);
    bg.fillRoundedRect(btnX - btnW / 2, y, btnW, btnH, 8);
    bg.strokeRoundedRect(btnX - btnW / 2, y, btnW, btnH, 8);
    this.rerollObjects.push(bg);

    const label = this.add.text(btnX, y + btnH / 2, `Reroll (${cost} essence)`, {
      fontSize: '14px',
      color: canReroll ? '#cccccc' : '#555555',
      fontFamily: 'Arial',
    }).setOrigin(0.5, 0.5);
    this.rerollObjects.push(label);

    if (canReroll) {
      const hitArea = this.add.zone(btnX, y + btnH / 2, btnW, btnH);
      hitArea.setInteractive({ useHandCursor: true });
      this.rerollObjects.push(hitArea);

      hitArea.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(0x555555, 1);
        bg.lineStyle(1, 0x888888, 1);
        bg.fillRoundedRect(btnX - btnW / 2, y, btnW, btnH, 8);
        bg.strokeRoundedRect(btnX - btnW / 2, y, btnW, btnH, 8);
        label.setColor('#ffffff');
      });

      hitArea.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(0x444444, 1);
        bg.lineStyle(1, 0x666666, 1);
        bg.fillRoundedRect(btnX - btnW / 2, y, btnW, btnH, 8);
        bg.strokeRoundedRect(btnX - btnW / 2, y, btnW, btnH, 8);
        label.setColor('#cccccc');
      });

      hitArea.on('pointerdown', () => this.doReroll(cost));
    }
  }

  // ──────────────── NEXT ROUND BUTTON ────────────────

  private drawNextRoundButton(y: number): void {
    this.destroyGroup(this.nextRoundObjects);
    this.nextRoundObjects = [];

    const btnX = GAME_CONFIG.width / 2;
    const btnW = 280;
    const btnH = 54;

    const bg = this.add.graphics();
    bg.fillStyle(0x338833, 1);
    bg.fillRoundedRect(btnX - btnW / 2, y, btnW, btnH, 12);
    this.nextRoundObjects.push(bg);

    const label = this.add.text(btnX, y + btnH / 2, 'Next Round', {
      fontSize: '26px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.nextRoundObjects.push(label);

    const hitArea = this.add.zone(btnX, y + btnH / 2, btnW, btnH);
    hitArea.setInteractive({ useHandCursor: true });
    this.nextRoundObjects.push(hitArea);

    hitArea.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x44aa44, 1);
      bg.fillRoundedRect(btnX - btnW / 2, y, btnW, btnH, 12);
    });

    hitArea.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x338833, 1);
      bg.fillRoundedRect(btnX - btnW / 2, y, btnW, btnH, 12);
    });

    hitArea.on('pointerdown', () => this.startNextRound());
  }

  // ──────────────── ACTIONS ────────────────

  private purchasePowerUp(powerUpId: string, cost: number): void {
    if (this.runState.essence < cost) return;

    const def = getPowerUpDef(powerUpId)!;

    // Slot enforcement for new purchases
    const owned = this.runState.ownedPowerUps.find(p => p.powerUpId === powerUpId);
    if (!owned) {
      if (def.category === 'passive') {
        if (this.getOwnedPassiveCount() >= this.runState.passiveSlotCount) return;
      } else {
        if (this.getOwnedPowerCount() >= this.runState.powerSlotCount) return;
      }
    }

    this.runState.essence -= cost;

    if (owned) {
      owned.level += 1;
      const levelDef = def.levels[owned.level - 1];
      owned.maxCharges = levelDef.charges ?? 0;
      owned.charges = levelDef.charges ?? 0;
    } else {
      const levelDef = def.levels[0];
      this.runState.ownedPowerUps.push({
        powerUpId,
        level: 1,
        charges: levelDef.charges ?? 0,
        maxCharges: levelDef.charges ?? 0,
      });
    }

    // Remove purchased item from offerings
    this.powerItemIds = this.powerItemIds.filter(id => id !== powerUpId);
    this.passiveItemIds = this.passiveItemIds.filter(id => id !== powerUpId);

    this.refreshShop();
  }

  private buyPowerSlot(cost: number): void {
    if (this.runState.essence < cost) return;
    if (this.runState.powerSlotCount >= SHOP_CONFIG.powerSlots.max) return;

    this.runState.essence -= cost;
    this.runState.powerSlotCount++;
    this.refreshShop();
  }

  private buyPassiveSlot(cost: number): void {
    if (this.runState.essence < cost) return;
    if (this.runState.passiveSlotCount >= SHOP_CONFIG.passiveSlots.max) return;

    this.runState.essence -= cost;
    this.runState.passiveSlotCount++;
    this.refreshShop();
  }

  private doReroll(cost: number): void {
    if (this.runState.essence < cost) return;

    this.runState.essence -= cost;
    this.rollShopItems();
    this.refreshShop();
  }

  private startNextRound(): void {
    const refreshedPowerUps = this.runState.ownedPowerUps.map(p => ({
      ...p,
      charges: p.maxCharges,
    }));

    const nextState: RunState = {
      essence: this.runState.essence,
      round: this.runState.round + 1,
      score: this.runState.score,
      ownedPowerUps: refreshedPowerUps,
      powerSlotCount: this.runState.powerSlotCount,
      passiveSlotCount: this.runState.passiveSlotCount,
    };

    this.scene.start('GameScene', nextState);
  }

  // ──────────────── REFRESH ────────────────

  private refreshShop(): void {
    this.createEssenceDisplay();
    this.destroyGroup(this.powerSectionObjects);
    this.destroyGroup(this.passiveSectionObjects);
    this.destroyGroup(this.slotButtonObjects);
    this.destroyGroup(this.rerollObjects);
    this.destroyGroup(this.nextRoundObjects);
    this.powerSectionObjects = [];
    this.passiveSectionObjects = [];
    this.slotButtonObjects = [];
    this.rerollObjects = [];
    this.nextRoundObjects = [];
    this.drawAllSections();

    // Update inventory bar after purchases
    this.inventoryBar.refresh(this.runState.ownedPowerUps);
  }

  // ──────────────── HELPERS ────────────────

  private clearAllGroups(): void {
    this.destroyGroup(this.headerObjects);
    this.destroyGroup(this.essenceObjects);
    this.destroyGroup(this.powerSectionObjects);
    this.destroyGroup(this.passiveSectionObjects);
    this.destroyGroup(this.slotButtonObjects);
    this.destroyGroup(this.rerollObjects);
    this.destroyGroup(this.nextRoundObjects);
    this.headerObjects = [];
    this.essenceObjects = [];
    this.powerSectionObjects = [];
    this.passiveSectionObjects = [];
    this.slotButtonObjects = [];
    this.rerollObjects = [];
    this.nextRoundObjects = [];
  }

  private destroyGroup(objects: Phaser.GameObjects.GameObject[]): void {
    for (const obj of objects) {
      obj.destroy();
    }
  }

  private shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
