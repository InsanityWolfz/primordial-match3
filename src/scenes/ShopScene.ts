import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { RunState, OwnedPowerUp } from '../types/RunState.ts';
import { POWER_UPS, getPowerUpDef } from '../config/powerUps.ts';
import type { PowerUpDefinition } from '../config/powerUpConfig.ts';
import { SHOP_CONFIG, getPowerSlotCost, getPassiveSlotCost } from '../config/shopConfig.ts';
import { ShopCardRenderer } from '../ui/ShopCardRenderer.ts';
import { InventoryBar } from '../ui/InventoryBar.ts';
import { rollModifier } from '../config/roundModifiers.ts';

export class ShopScene extends Phaser.Scene {
  runState!: RunState;
  private cardRenderer!: ShopCardRenderer;
  private inventoryBar!: InventoryBar;
  private essenceValueText!: Phaser.GameObjects.Text;
  private hudEssenceText!: Phaser.GameObjects.Text;

  // Discover offerings (new/unowned powers from all categories)
  private discoverItemIds: string[] = [];
  private seenDiscoverIds: Set<string> = new Set();

  // Sell cost: 500 + (round - 1) * 100
  private sellCost: number = 500;

  // Reroll cost escalates ×1.5 per reroll; resets each visit
  private rerollCost = SHOP_CONFIG.rerollCost;

  // Managed game objects for cleanup
  private discoverSectionObjects: Phaser.GameObjects.GameObject[] = [];
  private ownedPowerSectionObjects: Phaser.GameObjects.GameObject[] = [];
  private slotButtonObjects: Phaser.GameObjects.GameObject[] = [];
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
    this.seenDiscoverIds = new Set();
    this.rerollCost = SHOP_CONFIG.rerollCost;
    this.sellCost = 500 + (this.runState.round - 1) * 100;

    // Roll the modifier for the next round
    const rolledMod = rollModifier(this.runState.round);
    this.runState.currentModifier = rolledMod
      ? { id: rolledMod.id, name: rolledMod.name, description: rolledMod.description }
      : null;

    this.drawBackground();
    this.drawHUDBar();
    this.drawEssencePill();
    this.rollDiscoverItems();
    this.drawAllSections();

    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    const gridBottom = GAME_CONFIG.gridOffsetY + GAME_CONFIG.gridRows * cellSize;
    this.inventoryBar = new InventoryBar(this, this.runState.ownedPowerUps, gridBottom + 8);
    this.inventoryBar.create();
  }

  // ── BACKGROUND ──────────────────────────────────────────────────────────────

  private drawBackground(): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x0d0d1a, 1);
    bg.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height / 2);
    bg.fillStyle(0x060610, 1);
    bg.fillRect(0, GAME_CONFIG.height / 2, GAME_CONFIG.width, GAME_CONFIG.height / 2);
    bg.setDepth(-10);
  }

  // ── SECTION HEADER ──────────────────────────────────────────────────────────

  private drawSectionHeader(
    objects: Phaser.GameObjects.GameObject[],
    y: number,
    label: string,
    infoText: string,
    accentColor: number,
  ): number {
    const headerH = 28;
    const hexColor = '#' + accentColor.toString(16).padStart(6, '0');

    const strip = this.add.graphics();
    strip.fillStyle(0x0d0d22, 0.95);
    strip.fillRect(0, y, GAME_CONFIG.width, headerH);
    strip.lineStyle(1, accentColor, 0.25);
    strip.lineBetween(0, y, GAME_CONFIG.width, y);
    strip.lineBetween(0, y + headerH, GAME_CONFIG.width, y + headerH);
    strip.setDepth(5);
    objects.push(strip);

    const dot = this.add.graphics();
    dot.fillStyle(accentColor, 0.85);
    dot.fillCircle(28, y + headerH / 2, 4);
    dot.setDepth(6);
    objects.push(dot);

    objects.push(
      this.add.text(42, y + headerH / 2, label, {
        fontSize: '13px', color: hexColor, fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(0, 0.5).setDepth(6),
    );

    objects.push(
      this.add.text(GAME_CONFIG.width - 16, y + headerH / 2, infoText, {
        fontSize: '11px', color: '#888899', fontFamily: 'Arial',
      }).setOrigin(1, 0.5).setDepth(6),
    );

    return headerH;
  }

  // ── HUD BAR ─────────────────────────────────────────────────────────────────

  private drawHUDBar(): void {
    const hudBar = this.add.graphics();
    hudBar.fillStyle(0x111122, 1);
    hudBar.fillRect(0, 0, GAME_CONFIG.width, 80);
    hudBar.lineStyle(1, 0x333355, 0.7);
    hudBar.lineBetween(0, 80, GAME_CONFIG.width, 80);
    hudBar.setDepth(10);

    const drainBar = this.add.graphics();
    drainBar.fillStyle(0x222233, 1);
    drainBar.fillRect(0, 76, GAME_CONFIG.width, 4);
    drainBar.fillStyle(0xffaa44, 0.85);
    drainBar.fillRect(0, 76, GAME_CONFIG.width, 4);
    drainBar.setDepth(11);

    this.add.text(120, 12, 'ROUND', {
      fontSize: '11px', color: '#6666aa', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(11);
    this.add.text(120, 28, `${this.runState.round}`, {
      fontSize: '32px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(11);

    this.add.text(360, 12, 'ESSENCE', {
      fontSize: '11px', color: '#6666aa', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(11);
    this.hudEssenceText = this.add.text(360, 28, `${this.runState.essence}`, {
      fontSize: '32px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(11);

    this.add.text(600, 12, 'PHASE', {
      fontSize: '11px', color: '#6666aa', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(11);
    this.add.text(600, 28, 'SHOP', {
      fontSize: '28px', color: '#ffaa44', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(11);
  }

  private drawEssencePill(): void {
    const cx = GAME_CONFIG.width / 2;
    const pillW = 200;
    const pillH = 28;
    const pillX = cx - pillW / 2;
    const pillY = 88;

    const pill = this.add.graphics();
    pill.fillStyle(0x1a1a33, 0.9);
    pill.fillRoundedRect(pillX, pillY, pillW, pillH, 14);
    pill.lineStyle(1, 0x4444aa, 0.8);
    pill.strokeRoundedRect(pillX, pillY, pillW, pillH, 14);
    pill.setDepth(10);

    const iconX = pillX + 22;
    const iconY = pillY + 14;
    const ds = 6;
    const diamond = this.add.graphics();
    diamond.fillStyle(0x88aaff, 1);
    diamond.fillTriangle(iconX, iconY - ds, iconX + ds, iconY, iconX, iconY + ds);
    diamond.fillTriangle(iconX - ds, iconY, iconX, iconY - ds, iconX, iconY + ds);
    diamond.setDepth(11);

    this.add.text(iconX + 10, pillY + 14, 'ESSENCE', {
      fontSize: '10px', color: '#8888cc', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(11);

    this.essenceValueText = this.add.text(pillX + pillW - 12, pillY + 14, `${this.runState.essence}`, {
      fontSize: '16px', color: '#aabbff', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(11);
  }

  // ── ROLLING ─────────────────────────────────────────────────────────────────

  private rollDiscoverItems(): void {
    const available = POWER_UPS.filter(def => {
      if (this.seenDiscoverIds.has(def.id)) return false;
      if (def.requires && !this.runState.ownedPowerUps.find(p => p.powerUpId === def.requires)) return false;
      // Only show powers not yet owned
      return !this.runState.ownedPowerUps.find(p => p.powerUpId === def.id);
    });
    this.shuffle(available);
    this.discoverItemIds = available.slice(0, 3).map(d => d.id);
    for (const id of this.discoverItemIds) this.seenDiscoverIds.add(id);
  }

  // ── SLOT COUNTS ─────────────────────────────────────────────────────────────

  private getOwnedPowerCount(): number {
    return this.runState.ownedPowerUps.filter(p => {
      const def = getPowerUpDef(p.powerUpId);
      return def && (def.category === 'activePower' || def.category === 'passivePower');
    }).length;
  }

  private getOwnedActivePowerCount(): number {
    return this.runState.ownedPowerUps.filter(p => {
      const def = getPowerUpDef(p.powerUpId);
      return def && def.category === 'activePower';
    }).length;
  }

  private getOwnedPassivePowerCount(): number {
    return this.runState.ownedPowerUps.filter(p => {
      const def = getPowerUpDef(p.powerUpId);
      return def && def.category === 'passivePower';
    }).length;
  }

  private getOwnedPassiveCount(): number {
    return this.runState.ownedPowerUps.filter(p => {
      const def = getPowerUpDef(p.powerUpId);
      return def && def.category === 'passive';
    }).length;
  }

  // ── DRAW ALL SECTIONS ───────────────────────────────────────────────────────

  private drawAllSections(): void {
    const cardW = SHOP_CONFIG.layout.cardWidth;
    const gap = SHOP_CONFIG.layout.cardGap;
    const startX = (GAME_CONFIG.width - cardW) / 2;
    let curY = 120;

    const discoverH = this.drawDiscoverSection(startX, curY, cardW, gap);
    curY += discoverH + 8;

    const ownedH = this.drawOwnedPowersGrid(curY);
    curY += ownedH + 8;

    this.drawSlotButtons(curY);
    curY += 52;

    this.drawNextRoundButton(curY);
  }

  // ── DISCOVER SECTION ─────────────────────────────────────────────────────────

  private drawDiscoverSection(startX: number, startY: number, cardW: number, gap: number): number {
    this.destroyGroup(this.discoverSectionObjects);
    this.discoverSectionObjects = [];

    const powerCount = this.getOwnedPowerCount();
    const passiveCount = this.getOwnedPassiveCount();

    const headerH = this.drawSectionHeader(
      this.discoverSectionObjects, startY,
      'DISCOVER',
      `Powers ${powerCount}/${this.runState.powerSlotCount} · Passives ${passiveCount}/${this.runState.passiveSlotCount}`,
      0xffaa44,
    );

    let curY = startY + headerH + 8;
    let totalH = headerH + 8;

    if (this.discoverItemIds.length === 0) {
      this.discoverSectionObjects.push(
        this.add.text(GAME_CONFIG.width / 2, curY + 20, 'Nothing left to discover — reroll to see more', {
          fontSize: '13px', color: '#555566', fontFamily: 'Arial',
        }).setOrigin(0.5, 0.5),
      );
      totalH += 48;
      curY += 48;
    } else {
      const activePowerCount = this.getOwnedActivePowerCount();
      const passivePowerCount = this.getOwnedPassivePowerCount();
      const powerSlotsFull = powerCount >= this.runState.powerSlotCount;
      const passiveSlotsFull = passiveCount >= this.runState.passiveSlotCount;
      const { maxActivePowers, maxPassivePowers } = SHOP_CONFIG.powerSlots;

      for (let i = 0; i < this.discoverItemIds.length; i++) {
        const def = POWER_UPS.find(p => p.id === this.discoverItemIds[i]);
        if (!def) continue;

        let slotBlocked = false;
        if (def.category === 'passive') {
          slotBlocked = passiveSlotsFull;
        } else {
          const categoryFull =
            (def.category === 'activePower' && activePowerCount >= maxActivePowers) ||
            (def.category === 'passivePower' && passivePowerCount >= maxPassivePowers);
          slotBlocked = powerSlotsFull || categoryFull;
        }

        const cost = def.levels[0].cost;
        const canAfford = !slotBlocked && this.runState.essence >= cost;
        const cardH = this.cardRenderer.measureCardHeight(def, undefined, cardW);
        const objects = this.cardRenderer.drawCard(
          def, undefined, startX, curY, cardW, cardH,
          canAfford, slotBlocked,
          () => this.purchasePowerUp(def.id, cost),
        );
        this.discoverSectionObjects.push(...objects);

        curY += cardH + gap;
        totalH += cardH + gap;
      }
    }

    totalH += this.drawRerollButton(curY);
    return totalH;
  }

  // ── OWNED POWERS GRID ────────────────────────────────────────────────────────

  private drawOwnedPowersGrid(startY: number): number {
    this.destroyGroup(this.ownedPowerSectionObjects);
    this.ownedPowerSectionObjects = [];

    const owned = this.runState.ownedPowerUps;

    if (owned.length === 0) {
      const headerH = this.drawSectionHeader(
        this.ownedPowerSectionObjects, startY, 'YOUR POWERS', '', 0x6688ff,
      );
      this.ownedPowerSectionObjects.push(
        this.add.text(GAME_CONFIG.width / 2, startY + headerH + 24, 'No powers owned yet', {
          fontSize: '13px', color: '#555566', fontFamily: 'Arial',
        }).setOrigin(0.5, 0.5),
      );
      return headerH + 48;
    }

    const totalPower = this.getOwnedPowerCount();
    const totalPassive = this.getOwnedPassiveCount();
    const headerH = this.drawSectionHeader(
      this.ownedPowerSectionObjects, startY,
      'YOUR POWERS',
      `${totalPower} power · ${totalPassive} passive · sell cost ◆ ${this.sellCost}`,
      0x6688ff,
    );

    const colW = 185;
    const colGap = 10;
    const centerX = GAME_CONFIG.width / 2;
    const col0X = centerX - colW - colGap / 2;
    const col1X = centerX + colGap / 2;
    const cardH = 108;
    const rowGap = 8;

    const curY = startY + headerH + 8;
    const activeCount = this.getOwnedActivePowerCount();

    for (let i = 0; i < owned.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = col === 0 ? col0X : col1X;
      const cy = curY + row * (cardH + rowGap);

      const ownedEntry = owned[i];
      const def = getPowerUpDef(ownedEntry.powerUpId);
      if (!def) continue;

      const isMaxLevel = ownedEntry.level >= def.maxLevel;
      const upgradeCost = isMaxLevel ? 0 : def.levels[ownedEntry.level].cost;
      const canAffordUpgrade = !isMaxLevel && this.runState.essence >= upgradeCost;
      const canAffordSell = this.runState.essence >= this.sellCost;
      const isLastActive = def.category === 'activePower' && activeCount <= 1;

      this.drawOwnedPowerCard(
        cx, cy, colW, cardH,
        ownedEntry, def,
        isMaxLevel, upgradeCost, canAffordUpgrade,
        canAffordSell, isLastActive,
      );
    }

    const rowCount = Math.ceil(owned.length / 2);
    const gridH = rowCount * (cardH + rowGap) - rowGap;
    return headerH + 8 + gridH + 8;
  }

  private drawOwnedPowerCard(
    x: number, y: number, w: number, h: number,
    ownedEntry: OwnedPowerUp,
    def: PowerUpDefinition,
    isMaxLevel: boolean, upgradeCost: number, canAffordUpgrade: boolean,
    canAffordSell: boolean, isLastActive: boolean,
  ): void {
    const objects = this.ownedPowerSectionObjects;
    const gemType = GAME_CONFIG.gemTypes.find(g => g.name === def.element);
    const elementColor = gemType ? gemType.color : 0x888888;
    const hexElement = '#' + elementColor.toString(16).padStart(6, '0');

    // Card background
    const bg = this.add.graphics();
    bg.fillStyle(elementColor, 0.07);
    bg.fillRoundedRect(x, y, w, h, 8);
    bg.lineStyle(1, elementColor, 0.35);
    bg.strokeRoundedRect(x, y, w, h, 8);
    objects.push(bg);

    // Left accent bar
    const accent = this.add.graphics();
    accent.fillStyle(elementColor, 0.9);
    accent.fillRoundedRect(x, y, 4, h, { tl: 8, tr: 0, bl: 8, br: 0 });
    objects.push(accent);

    // Power name
    objects.push(this.add.text(x + 12, y + 8, def.name, {
      fontSize: '13px', color: hexElement, fontFamily: 'Arial', fontStyle: 'bold',
    }));

    // Category label (top-right)
    const catLabels: Record<string, string> = {
      activePower: 'Active', passivePower: 'Passive', passive: 'Stat',
    };
    objects.push(this.add.text(x + w - 6, y + 8, catLabels[def.category] ?? '', {
      fontSize: '9px', color: '#666677', fontFamily: 'Arial',
    }).setOrigin(1, 0));

    // Level text
    const levelStr = isMaxLevel
      ? `LVL ${def.maxLevel}  ★ MAX`
      : `LVL ${ownedEntry.level} / ${def.maxLevel}`;
    objects.push(this.add.text(x + 12, y + 26, levelStr, {
      fontSize: '11px', color: isMaxLevel ? '#ffcc00' : '#888899', fontFamily: 'Arial',
    }));

    // Charges info (right of level row, active powers only)
    if (def.category === 'activePower') {
      objects.push(this.add.text(x + w - 6, y + 26, `${ownedEntry.maxCharges} charges`, {
        fontSize: '10px', color: '#666677', fontFamily: 'Arial',
      }).setOrigin(1, 0));
    }

    // ── Upgrade pill ──────────────────────────────────────────────
    const pillW = w - 12;
    const pillH = 26;
    const pillX = x + 6;
    const upgradePillY = y + 44;

    let upFill: number, upBorder: number, upBorderA: number, upTextColor: string, upLabel: string;
    if (isMaxLevel) {
      upFill = 0x443300; upBorder = 0xffcc00; upBorderA = 0.7;
      upTextColor = '#ffcc00'; upLabel = '★ MAX LEVEL';
    } else if (canAffordUpgrade) {
      upFill = 0x1a1a33; upBorder = 0x4444aa; upBorderA = 0.9;
      upTextColor = '#aabbff'; upLabel = `UPGRADE  ◆ ${upgradeCost}`;
    } else {
      upFill = 0x111122; upBorder = 0x222244; upBorderA = 0.5;
      upTextColor = '#333355'; upLabel = `UPGRADE  ◆ ${upgradeCost}`;
    }

    const upgradeBg = this.add.graphics();
    upgradeBg.fillStyle(upFill, 1);
    upgradeBg.fillRoundedRect(pillX, upgradePillY, pillW, pillH, 12);
    upgradeBg.lineStyle(1, upBorder, upBorderA);
    upgradeBg.strokeRoundedRect(pillX, upgradePillY, pillW, pillH, 12);
    objects.push(upgradeBg);

    objects.push(this.add.text(pillX + pillW / 2, upgradePillY + pillH / 2, upLabel, {
      fontSize: '12px', color: upTextColor, fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));

    if (canAffordUpgrade) {
      const upgradeZone = this.add.zone(pillX + pillW / 2, upgradePillY + pillH / 2, pillW, pillH);
      upgradeZone.setInteractive({ useHandCursor: true });
      objects.push(upgradeZone);

      upgradeZone.on('pointerover', () => {
        upgradeBg.clear();
        upgradeBg.fillStyle(0x222244, 1);
        upgradeBg.fillRoundedRect(pillX, upgradePillY, pillW, pillH, 12);
        upgradeBg.lineStyle(1, 0x6688ff, 1);
        upgradeBg.strokeRoundedRect(pillX, upgradePillY, pillW, pillH, 12);
      });
      upgradeZone.on('pointerout', () => {
        upgradeBg.clear();
        upgradeBg.fillStyle(0x1a1a33, 1);
        upgradeBg.fillRoundedRect(pillX, upgradePillY, pillW, pillH, 12);
        upgradeBg.lineStyle(1, 0x4444aa, 0.9);
        upgradeBg.strokeRoundedRect(pillX, upgradePillY, pillW, pillH, 12);
      });
      upgradeZone.on('pointerdown', () => this.purchasePowerUp(def.id, upgradeCost));
    }

    // ── Sell pill ─────────────────────────────────────────────────
    const sellPillY = upgradePillY + pillH + 6;
    const sellPillH = 22;

    let sellFill: number, sellBorder: number, sellBorderA: number, sellTextColor: string;
    const sellEnabled = !isLastActive && canAffordSell;
    if (isLastActive) {
      sellFill = 0x1a1a1a; sellBorder = 0x333333; sellBorderA = 0.3;
      sellTextColor = '#333333';
    } else if (canAffordSell) {
      sellFill = 0x2a0011; sellBorder = 0xaa2244; sellBorderA = 0.8;
      sellTextColor = '#ff4466';
    } else {
      sellFill = 0x1a1a1a; sellBorder = 0x333333; sellBorderA = 0.4;
      sellTextColor = '#444444';
    }

    const sellBg = this.add.graphics();
    sellBg.fillStyle(sellFill, 1);
    sellBg.fillRoundedRect(pillX, sellPillY, pillW, sellPillH, 10);
    sellBg.lineStyle(1, sellBorder, sellBorderA);
    sellBg.strokeRoundedRect(pillX, sellPillY, pillW, sellPillH, 10);
    objects.push(sellBg);

    const sellLabel = isLastActive
      ? 'SELL (keep 1 active)'
      : `SELL  ◆ ${this.sellCost}`;
    objects.push(this.add.text(pillX + pillW / 2, sellPillY + sellPillH / 2, sellLabel, {
      fontSize: '11px', color: sellTextColor, fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));

    if (sellEnabled) {
      const sellZone = this.add.zone(pillX + pillW / 2, sellPillY + sellPillH / 2, pillW, sellPillH);
      sellZone.setInteractive({ useHandCursor: true });
      objects.push(sellZone);

      sellZone.on('pointerover', () => {
        sellBg.clear();
        sellBg.fillStyle(0x4a0022, 1);
        sellBg.fillRoundedRect(pillX, sellPillY, pillW, sellPillH, 10);
        sellBg.lineStyle(1, 0xff4466, 1);
        sellBg.strokeRoundedRect(pillX, sellPillY, pillW, sellPillH, 10);
      });
      sellZone.on('pointerout', () => {
        sellBg.clear();
        sellBg.fillStyle(0x2a0011, 1);
        sellBg.fillRoundedRect(pillX, sellPillY, pillW, sellPillH, 10);
        sellBg.lineStyle(1, 0xaa2244, 0.8);
        sellBg.strokeRoundedRect(pillX, sellPillY, pillW, sellPillH, 10);
      });
      sellZone.on('pointerdown', () => this.sellPower(def.id));
    }
  }

  // ── SLOT BUTTONS ─────────────────────────────────────────────────────────────

  private drawSlotButtons(startY: number): void {
    this.destroyGroup(this.slotButtonObjects);
    this.slotButtonObjects = [];

    const btnW = 190;
    const btnH = 36;
    const gap = 12;
    const centerX = GAME_CONFIG.width / 2;

    const powerSlotCost = getPowerSlotCost(this.runState.powerSlotCount);
    {
      const bx = centerX - gap / 2 - btnW;
      if (powerSlotCost !== null) {
        const canAfford = this.runState.essence >= powerSlotCost;
        this.drawSlotButton(bx, startY, btnW, btnH,
          `+1 Power Slot  ◆ ${powerSlotCost}`, canAfford, 0xffaa44,
          () => this.buyPowerSlot(powerSlotCost));
      } else {
        this.drawSlotButton(bx, startY, btnW, btnH, 'Power Slots MAX', false, 0x444444, () => {});
      }
    }

    const passiveSlotCost = getPassiveSlotCost(this.runState.passiveSlotCount);
    {
      const bx = centerX + gap / 2;
      if (passiveSlotCost !== null) {
        const canAfford = this.runState.essence >= passiveSlotCost;
        this.drawSlotButton(bx, startY, btnW, btnH,
          `+1 Passive Slot  ◆ ${passiveSlotCost}`, canAfford, 0x66aaff,
          () => this.buyPassiveSlot(passiveSlotCost));
      } else {
        this.drawSlotButton(bx, startY, btnW, btnH, 'Passive Slots MAX', false, 0x444444, () => {});
      }
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
      fontSize: '11px', color: enabled ? '#cccccc' : '#555555', fontFamily: 'Arial',
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

  // ── REROLL BUTTON (part of discover section) ─────────────────────────────────

  /** Returns height consumed (button + margin). */
  private drawRerollButton(y: number): number {
    const cost = this.rerollCost;
    const canReroll = this.runState.essence >= cost;
    const cx = GAME_CONFIG.width / 2;
    const btnW = 240;
    const btnH = 32;
    const btnX = cx - btnW / 2;

    const bg = this.add.graphics();
    bg.fillStyle(canReroll ? 0x1a1a33 : 0x111122, 1);
    bg.lineStyle(1, canReroll ? 0x4444aa : 0x222233, canReroll ? 0.8 : 0.4);
    bg.fillRoundedRect(btnX, y, btnW, btnH, 13);
    bg.strokeRoundedRect(btnX, y, btnW, btnH, 13);
    this.discoverSectionObjects.push(bg);

    this.discoverSectionObjects.push(
      this.add.text(cx, y + btnH / 2, `↻  REROLL DISCOVER  ◆ ${cost}`, {
        fontSize: '13px', color: canReroll ? '#aabbff' : '#444466',
        fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5),
    );

    if (canReroll) {
      const hitArea = this.add.zone(cx, y + btnH / 2, btnW, btnH);
      hitArea.setInteractive({ useHandCursor: true });
      this.discoverSectionObjects.push(hitArea);

      hitArea.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(0x222244, 1);
        bg.lineStyle(1, 0x6688ff, 1);
        bg.fillRoundedRect(btnX, y, btnW, btnH, 13);
        bg.strokeRoundedRect(btnX, y, btnW, btnH, 13);
      });
      hitArea.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(0x1a1a33, 1);
        bg.lineStyle(1, 0x4444aa, 0.8);
        bg.fillRoundedRect(btnX, y, btnW, btnH, 13);
        bg.strokeRoundedRect(btnX, y, btnW, btnH, 13);
      });
      hitArea.on('pointerdown', () => this.doReroll(cost));
    }

    return btnH + 8;
  }

  // ── NEXT ROUND BUTTON (includes modifier preview) ────────────────────────────

  private drawNextRoundButton(y: number): void {
    this.destroyGroup(this.nextRoundObjects);
    this.nextRoundObjects = [];

    const cx = GAME_CONFIG.width / 2;
    const mod = this.runState.currentModifier;

    // Modifier preview
    if (mod) {
      this.nextRoundObjects.push(
        this.add.text(cx, y, `⚡ ${mod.name}`, {
          fontSize: '15px', color: '#ffcc44', fontFamily: 'Arial', fontStyle: 'bold',
        }).setOrigin(0.5, 0).setDepth(70),
      );
      this.nextRoundObjects.push(
        this.add.text(cx, y + 20, mod.description, {
          fontSize: '12px', color: '#ccaa44', fontFamily: 'Arial',
        }).setOrigin(0.5, 0).setDepth(70),
      );
    } else {
      this.nextRoundObjects.push(
        this.add.text(cx, y + 10, 'No special conditions next round', {
          fontSize: '12px', color: '#444455', fontFamily: 'Arial',
        }).setOrigin(0.5, 0).setDepth(70),
      );
    }

    // Button
    const btnY = y + 44;
    const btnW = 280;
    const btnH = 48;

    const bg = this.add.graphics();
    bg.fillStyle(0x338833, 1);
    bg.fillRoundedRect(cx - btnW / 2, btnY, btnW, btnH, 10);
    bg.setDepth(70);
    this.nextRoundObjects.push(bg);

    this.nextRoundObjects.push(
      this.add.text(cx, btnY + btnH / 2, 'Next Round  ▶', {
        fontSize: '22px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setDepth(71),
    );

    const hitArea = this.add.zone(cx, btnY + btnH / 2, btnW, btnH);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.setDepth(72);
    this.nextRoundObjects.push(hitArea);

    hitArea.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x44aa44, 1);
      bg.fillRoundedRect(cx - btnW / 2, btnY, btnW, btnH, 10);
    });
    hitArea.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x338833, 1);
      bg.fillRoundedRect(cx - btnW / 2, btnY, btnW, btnH, 10);
    });
    hitArea.on('pointerdown', () => this.startNextRound());
  }

  // ── ACTIONS ──────────────────────────────────────────────────────────────────

  private purchasePowerUp(powerUpId: string, cost: number): void {
    if (this.runState.essence < cost) return;

    const def = getPowerUpDef(powerUpId)!;
    const owned = this.runState.ownedPowerUps.find(p => p.powerUpId === powerUpId);

    if (!owned) {
      if (def.category === 'passive') {
        if (this.getOwnedPassiveCount() >= this.runState.passiveSlotCount) return;
      } else {
        if (this.getOwnedPowerCount() >= this.runState.powerSlotCount) return;
        const { maxActivePowers, maxPassivePowers } = SHOP_CONFIG.powerSlots;
        if (def.category === 'activePower' && this.getOwnedActivePowerCount() >= maxActivePowers) return;
        if (def.category === 'passivePower' && this.getOwnedPassivePowerCount() >= maxPassivePowers) return;
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

    // Remove from discover offerings if it was there
    this.discoverItemIds = this.discoverItemIds.filter(id => id !== powerUpId);
    this.refreshShop();
  }

  private sellPower(powerUpId: string): void {
    if (this.runState.essence < this.sellCost) return;

    const def = getPowerUpDef(powerUpId);
    if (!def) return;

    // Must keep at least 1 active power
    if (def.category === 'activePower' && this.getOwnedActivePowerCount() <= 1) return;

    this.runState.essence -= this.sellCost;
    this.runState.ownedPowerUps = this.runState.ownedPowerUps.filter(p => p.powerUpId !== powerUpId);
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
    this.rerollCost = Math.ceil(this.rerollCost * 1.5);
    this.rollDiscoverItems();
    this.refreshShop();
  }

  private startNextRound(): void {
    const refreshedPowerUps = this.runState.ownedPowerUps.map(p => ({
      ...p,
      charges: p.maxCharges,
    }));

    this.scene.start('GameScene', {
      essence: this.runState.essence,
      round: this.runState.round + 1,
      ownedPowerUps: refreshedPowerUps,
      powerSlotCount: this.runState.powerSlotCount,
      passiveSlotCount: this.runState.passiveSlotCount,
      runId: this.runState.runId,
      currentModifier: this.runState.currentModifier,
    } satisfies RunState);
  }

  // ── REFRESH ──────────────────────────────────────────────────────────────────

  private refreshShop(): void {
    this.hudEssenceText.setText(`${this.runState.essence}`);
    this.essenceValueText.setText(`${this.runState.essence}`);

    this.destroyGroup(this.discoverSectionObjects);
    this.destroyGroup(this.ownedPowerSectionObjects);
    this.destroyGroup(this.slotButtonObjects);
    this.destroyGroup(this.nextRoundObjects);
    this.discoverSectionObjects = [];
    this.ownedPowerSectionObjects = [];
    this.slotButtonObjects = [];
    this.nextRoundObjects = [];

    this.drawAllSections();
    this.inventoryBar.refresh(this.runState.ownedPowerUps);
  }

  // ── HELPERS ──────────────────────────────────────────────────────────────────

  private clearAllGroups(): void {
    this.destroyGroup(this.discoverSectionObjects);
    this.destroyGroup(this.ownedPowerSectionObjects);
    this.destroyGroup(this.slotButtonObjects);
    this.destroyGroup(this.nextRoundObjects);
    this.discoverSectionObjects = [];
    this.ownedPowerSectionObjects = [];
    this.slotButtonObjects = [];
    this.nextRoundObjects = [];
  }

  private destroyGroup(objects: Phaser.GameObjects.GameObject[]): void {
    for (const obj of objects) obj.destroy();
  }

  private shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
