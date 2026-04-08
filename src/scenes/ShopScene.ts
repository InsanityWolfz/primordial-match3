import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { RunState, OwnedPowerUp } from '../types/RunState.ts';
import { POWER_UPS, getPowerUpDef } from '../config/powerUps.ts';
import type { PowerUpDefinition } from '../config/powerUps.ts';
import { rollModifier } from '../config/roundModifiers.ts';
import {
  getAllModifiers,
  getModifierDef,
  RARITY_WEIGHT,
  POWER_SHOP_WEIGHT,
} from '../config/modifierConfig.ts';
import type { ModifierDef } from '../config/modifierConfig.ts';

type OfferType = 'power' | 'modifier';

const RARITY_COLORS: Record<string, number> = {
  Common:    0xaaaaaa,
  Uncommon:  0x44cc44,
  Rare:      0x4488ff,
  Epic:      0xcc44ff,
  Legendary: 0xffaa00,
};

export class ShopScene extends Phaser.Scene {
  private runState!: RunState;

  private offerIds: string[] = [];
  private offerTypes: OfferType[] = [];
  private choiceMade = false;
  private chosenId: string | null = null;
  private chosenType: OfferType | null = null;
  private rerollUsed = false;

  private discoverObjects: Phaser.GameObjects.GameObject[] = [];
  private ownedObjects: Phaser.GameObjects.GameObject[] = [];
  private nextRoundObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'ShopScene' });
  }

  create(data: RunState): void {
    this.runState = {
      ...data,
      ownedPowerUps: data.ownedPowerUps ?? [],
      ownedModifiers: data.ownedModifiers ?? [],
    };
    this.choiceMade = false;
    this.chosenId = null;
    this.chosenType = null;
    this.rerollUsed = false;

    const rolledMod = rollModifier(this.runState.round);
    this.runState.currentModifier = rolledMod
      ? { id: rolledMod.id, name: rolledMod.name, description: rolledMod.description }
      : null;

    this.rollOffers();
    this.drawBackground();
    this.drawHUDBar();
    this.drawAll();
  }

  // ── OFFER ROLLING ────────────────────────────────────────────────────────────

  private rollOffers(): void {
    const ownedPowerIds = new Set(this.runState.ownedPowerUps.map(p => p.powerUpId));
    const ownedModifierIds = new Set(this.runState.ownedModifiers);

    // Powers not yet owned
    const availablePowers = POWER_UPS.filter(p => !ownedPowerIds.has(p.id));

    // Modifiers not yet owned, filtered by element ownership
    const availableModifiers = getAllModifiers().filter(m => {
      if (ownedModifierIds.has(m.id)) return false;
      if (m.element === 'neutral') return true;
      return ownedPowerIds.has(m.powerUpId);
    });

    type Entry = { type: OfferType; id: string; weight: number };
    const pool: Entry[] = [
      ...availablePowers.map(p => ({ type: 'power' as const, id: p.id, weight: POWER_SHOP_WEIGHT })),
      ...availableModifiers.map(m => ({ type: 'modifier' as const, id: m.id, weight: RARITY_WEIGHT[m.rarity] })),
    ];

    if (pool.length === 0) {
      this.offerIds = [];
      this.offerTypes = [];
      return;
    }

    const pickedIds: string[] = [];
    const pickedTypes: OfferType[] = [];
    let powersSelected = 0;
    const remaining = [...pool];

    for (let i = 0; i < 3 && remaining.length > 0; i++) {
      // At most 1 power per 3 offerings
      const candidates = powersSelected >= 1
        ? remaining.filter(e => e.type === 'modifier')
        : remaining;

      if (candidates.length === 0) break;

      const totalWeight = candidates.reduce((s, e) => s + e.weight, 0);
      let roll = Math.random() * totalWeight;
      let chosen = candidates[candidates.length - 1];
      for (const entry of candidates) {
        roll -= entry.weight;
        if (roll <= 0) { chosen = entry; break; }
      }

      pickedIds.push(chosen.id);
      pickedTypes.push(chosen.type);
      if (chosen.type === 'power') powersSelected++;

      const idx = remaining.findIndex(e => e.id === chosen.id);
      if (idx >= 0) remaining.splice(idx, 1);
    }

    this.offerIds = pickedIds;
    this.offerTypes = pickedTypes;
  }

  // ── LAYOUT ───────────────────────────────────────────────────────────────────

  private drawBackground(): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x0d0d1a, 1);
    bg.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
    bg.setDepth(-10);
  }

  private drawHUDBar(): void {
    const hudBar = this.add.graphics();
    hudBar.fillStyle(0x111122, 1);
    hudBar.fillRect(0, 0, GAME_CONFIG.width, 80);
    hudBar.lineStyle(1, 0x333355, 0.7);
    hudBar.lineBetween(0, 80, GAME_CONFIG.width, 80);
    hudBar.setDepth(10);

    const cx = GAME_CONFIG.width / 2;

    this.add.text(120, 12, 'ROUND', {
      fontSize: '11px', color: '#6666aa', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(11);
    this.add.text(120, 28, `${this.runState.round}`, {
      fontSize: '32px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(11);

    this.add.text(cx, 12, 'PHASE', {
      fontSize: '11px', color: '#6666aa', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(11);
    this.add.text(cx, 28, 'SHOP', {
      fontSize: '28px', color: '#ffaa44', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(11);
  }

  private drawAll(): void {
    let curY = 90;
    const discoverH = this.drawDiscoverSection(curY);
    curY += discoverH + 8;
    const ownedH = this.drawOwnedSection(curY);
    curY += ownedH + 8;
    this.drawNextRoundButton(curY);
  }

  // ── DISCOVER SECTION ─────────────────────────────────────────────────────────

  private drawDiscoverSection(startY: number): number {
    this.destroyGroup(this.discoverObjects);
    this.discoverObjects = [];

    let curY = startY;
    const headerH = this.drawSectionHeader(
      this.discoverObjects, curY, 'CHOOSE AN UPGRADE', 'pick 1 — free', 0xffaa44,
    );
    curY += headerH + 8;
    let totalH = headerH + 8;

    if (this.choiceMade) {
      let msg: string;
      let msgColor: string;
      if (this.chosenId && this.chosenType === 'power') {
        msg = `✓  ${getPowerUpDef(this.chosenId)?.name ?? this.chosenId} added to your powers`;
        msgColor = '#44ff88';
      } else if (this.chosenId && this.chosenType === 'modifier') {
        msg = `✓  ${getModifierDef(this.chosenId)?.name ?? this.chosenId} modifier unlocked`;
        msgColor = '#44ff88';
      } else {
        msg = '✗  Skipped — nothing taken';
        msgColor = '#666677';
      }
      this.discoverObjects.push(
        this.add.text(GAME_CONFIG.width / 2, curY + 18, msg, {
          fontSize: '14px', color: msgColor, fontFamily: 'Arial', fontStyle: 'bold',
        }).setOrigin(0.5, 0.5),
      );
      totalH += 44;
      return totalH;
    }

    const cardW = 200;
    const cardH = 190;
    const gap = 10;
    const totalCardsW = 3 * cardW + 2 * gap;
    const startX = (GAME_CONFIG.width - totalCardsW) / 2;

    for (let i = 0; i < this.offerIds.length; i++) {
      const id = this.offerIds[i];
      const type = this.offerTypes[i];
      if (type === 'power') {
        const def = getPowerUpDef(id);
        if (def) this.drawPowerCard(startX + i * (cardW + gap), curY, cardW, cardH, def);
      } else {
        const def = getModifierDef(id);
        if (def) this.drawModifierCard(startX + i * (cardW + gap), curY, cardW, cardH, def);
      }
    }

    totalH += cardH + 8;
    curY += cardH + 8;
    const rerollH = this.drawRerollButton(curY);
    totalH += rerollH;
    curY += rerollH;
    totalH += this.drawSkipButton(curY);

    return totalH;
  }

  private drawPowerCard(x: number, y: number, w: number, h: number, def: PowerUpDefinition): void {
    const gemType = GAME_CONFIG.gemTypes.find(g => g.name === def.element);
    const color = gemType?.color ?? 0x888888;
    const hexColor = '#' + color.toString(16).padStart(6, '0');

    const bg = this.add.graphics();
    bg.fillStyle(color, 0.08);
    bg.fillRoundedRect(x, y, w, h, 10);
    bg.lineStyle(1.5, color, 0.5);
    bg.strokeRoundedRect(x, y, w, h, 10);
    this.discoverObjects.push(bg);

    // "POWER" type tag at top-left
    this.discoverObjects.push(
      this.add.text(x + 8, y + 8, 'POWER', {
        fontSize: '9px', color: '#888899', fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(0, 0),
    );

    // Element tag (top-right)
    this.discoverObjects.push(
      this.add.text(x + w - 8, y + 8, def.element.toUpperCase(), {
        fontSize: '9px', color: hexColor, fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(1, 0),
    );

    this.discoverObjects.push(
      this.add.text(x + w / 2, y + 38, def.name, {
        fontSize: '17px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
        align: 'center', wordWrap: { width: w - 16 },
      }).setOrigin(0.5, 0.5),
    );

    this.discoverObjects.push(
      this.add.text(x + w / 2, y + 64, def.description, {
        fontSize: '11px', color: '#aaaacc', fontFamily: 'Arial',
        align: 'center', wordWrap: { width: w - 16 },
      }).setOrigin(0.5, 0),
    );

    this.addTakeButton(x, y, w, h, color, hexColor, () => this.takeOffer(def.id, 'power'));
  }

  private drawModifierCard(x: number, y: number, w: number, h: number, def: ModifierDef): void {
    const rarityColor = RARITY_COLORS[def.rarity] ?? 0xaaaaaa;
    const rarityHex = '#' + rarityColor.toString(16).padStart(6, '0');

    // Element color accent (or rarity color for neutral)
    const gemType = GAME_CONFIG.gemTypes.find(g => g.name === def.element);
    const accentColor = gemType?.color ?? rarityColor;
    const accentHex = '#' + accentColor.toString(16).padStart(6, '0');

    const bg = this.add.graphics();
    bg.fillStyle(accentColor, 0.06);
    bg.fillRoundedRect(x, y, w, h, 10);
    bg.lineStyle(1.5, accentColor, 0.4);
    bg.strokeRoundedRect(x, y, w, h, 10);
    // Rarity glow strip at top
    bg.fillStyle(rarityColor, 0.6);
    bg.fillRoundedRect(x, y, w, 3, { tl: 10, tr: 10, bl: 0, br: 0 });
    this.discoverObjects.push(bg);

    // Rarity label (top-left)
    this.discoverObjects.push(
      this.add.text(x + 8, y + 10, def.rarity.toUpperCase(), {
        fontSize: '9px', color: rarityHex, fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(0, 0),
    );

    // Element tag (top-right)
    const elementLabel = def.element === 'neutral' ? 'NEUTRAL' : def.element.toUpperCase();
    this.discoverObjects.push(
      this.add.text(x + w - 8, y + 10, elementLabel, {
        fontSize: '9px', color: accentHex, fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(1, 0),
    );

    // Modifier name
    this.discoverObjects.push(
      this.add.text(x + w / 2, y + 38, def.name, {
        fontSize: '17px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
        align: 'center', wordWrap: { width: w - 16 },
      }).setOrigin(0.5, 0.5),
    );

    // Description
    this.discoverObjects.push(
      this.add.text(x + w / 2, y + 64, def.description, {
        fontSize: '11px', color: '#aaaacc', fontFamily: 'Arial',
        align: 'center', wordWrap: { width: w - 16 },
      }).setOrigin(0.5, 0),
    );

    this.addTakeButton(x, y, w, h, accentColor, accentHex, () => this.takeOffer(def.id, 'modifier'));
  }

  private addTakeButton(
    x: number, y: number, w: number, h: number,
    color: number, hexColor: string,
    onTake: () => void,
  ): void {
    const btnH = 30;
    const btnY = y + h - btnH - 8;
    const btnX = x + 8;
    const btnW = w - 16;

    const btnBg = this.add.graphics();
    const drawBtn = (hover: boolean) => {
      btnBg.clear();
      btnBg.fillStyle(color, hover ? 0.35 : 0.2);
      btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 12);
      btnBg.lineStyle(1.5, color, hover ? 1 : 0.9);
      btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 12);
    };
    drawBtn(false);
    this.discoverObjects.push(btnBg);

    this.discoverObjects.push(
      this.add.text(btnX + btnW / 2, btnY + btnH / 2, 'TAKE  →', {
        fontSize: '13px', color: hexColor, fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5),
    );

    const hitZone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    this.discoverObjects.push(hitZone);
    hitZone.on('pointerover', () => drawBtn(true));
    hitZone.on('pointerout', () => drawBtn(false));
    hitZone.on('pointerdown', onTake);
  }

  private drawRerollButton(y: number): number {
    const cx = GAME_CONFIG.width / 2;
    const btnW = 220;
    const btnH = 32;
    const btnX = cx - btnW / 2;
    const used = this.rerollUsed;

    const bg = this.add.graphics();
    const drawBg = (hover: boolean) => {
      bg.clear();
      if (used) {
        bg.fillStyle(0x111111, 1);
        bg.lineStyle(1, 0x333333, 0.3);
      } else {
        bg.fillStyle(hover ? 0x222244 : 0x1a1a2a, 1);
        bg.lineStyle(1, hover ? 0x8888ff : 0x5555aa, hover ? 1 : 0.8);
      }
      bg.fillRoundedRect(btnX, y, btnW, btnH, 12);
      bg.strokeRoundedRect(btnX, y, btnW, btnH, 12);
    };
    drawBg(false);
    this.discoverObjects.push(bg);

    this.discoverObjects.push(
      this.add.text(cx, y + btnH / 2, used ? '↻  REROLL (used)' : '↻  REROLL — FREE', {
        fontSize: '13px', color: used ? '#444455' : '#8899cc',
        fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5),
    );

    if (!used) {
      const hitArea = this.add.zone(cx, y + btnH / 2, btnW, btnH)
        .setInteractive({ useHandCursor: true });
      this.discoverObjects.push(hitArea);
      hitArea.on('pointerover', () => drawBg(true));
      hitArea.on('pointerout', () => drawBg(false));
      hitArea.on('pointerdown', () => this.doReroll());
    }

    return btnH + 6;
  }

  private drawSkipButton(y: number): number {
    const cx = GAME_CONFIG.width / 2;
    const btnW = 180;
    const btnH = 28;
    const btnX = cx - btnW / 2;

    const bg = this.add.graphics();
    const drawBg = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(hover ? 0x1a1a1a : 0x111111, 1);
      bg.lineStyle(1, hover ? 0x666677 : 0x444444, hover ? 0.8 : 0.5);
      bg.fillRoundedRect(btnX, y, btnW, btnH, 10);
      bg.strokeRoundedRect(btnX, y, btnW, btnH, 10);
    };
    drawBg(false);
    this.discoverObjects.push(bg);

    this.discoverObjects.push(
      this.add.text(cx, y + btnH / 2, 'Skip — take nothing', {
        fontSize: '12px', color: '#666677', fontFamily: 'Arial',
      }).setOrigin(0.5, 0.5),
    );

    const hitArea = this.add.zone(cx, y + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    this.discoverObjects.push(hitArea);
    hitArea.on('pointerover', () => drawBg(true));
    hitArea.on('pointerout', () => drawBg(false));
    hitArea.on('pointerdown', () => this.skipChoice());

    return btnH + 6;
  }

  // ── OWNED SECTION ────────────────────────────────────────────────────────────

  private drawOwnedSection(startY: number): number {
    this.destroyGroup(this.ownedObjects);
    this.ownedObjects = [];

    const owned = this.runState.ownedPowerUps;
    const headerH = this.drawSectionHeader(
      this.ownedObjects, startY, 'YOUR POWERS', `${owned.length} owned`, 0x6688ff,
    );
    let totalH = headerH + 8;
    const curY = startY + headerH + 8;

    if (owned.length === 0) {
      this.ownedObjects.push(
        this.add.text(GAME_CONFIG.width / 2, curY + 20, 'No powers yet', {
          fontSize: '13px', color: '#555566', fontFamily: 'Arial',
        }).setOrigin(0.5, 0.5),
      );
      return totalH + 48;
    }

    const colW = 185;
    const colGap = 10;
    const centerX = GAME_CONFIG.width / 2;
    const col0X = centerX - colW - colGap / 2;
    const col1X = centerX + colGap / 2;
    const cardH = 60;
    const rowGap = 6;

    for (let i = 0; i < owned.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = col === 0 ? col0X : col1X;
      const cy = curY + row * (cardH + rowGap);
      this.drawOwnedMiniCard(cx, cy, colW, cardH, owned[i]);
    }

    const rowCount = Math.ceil(owned.length / 2);
    totalH += rowCount * (cardH + rowGap) - rowGap + 8;
    return totalH;
  }

  private drawOwnedMiniCard(x: number, y: number, w: number, h: number, entry: OwnedPowerUp): void {
    const def = getPowerUpDef(entry.powerUpId);
    if (!def) return;

    const gemType = GAME_CONFIG.gemTypes.find(g => g.name === def.element);
    const color = gemType?.color ?? 0x888888;
    const hexColor = '#' + color.toString(16).padStart(6, '0');

    const bg = this.add.graphics();
    bg.fillStyle(color, 0.06);
    bg.fillRoundedRect(x, y, w, h, 6);
    bg.lineStyle(1, color, 0.3);
    bg.strokeRoundedRect(x, y, w, h, 6);
    this.ownedObjects.push(bg);

    const accent = this.add.graphics();
    accent.fillStyle(color, 0.9);
    accent.fillRoundedRect(x, y, 3, h, { tl: 6, tr: 0, bl: 6, br: 0 });
    this.ownedObjects.push(accent);

    this.ownedObjects.push(this.add.text(x + 10, y + 8, def.name, {
      fontSize: '13px', color: hexColor, fontFamily: 'Arial', fontStyle: 'bold',
    }));

    this.ownedObjects.push(this.add.text(x + 10, y + 28, 'ACTIVE', {
      fontSize: '11px', color: '#888899', fontFamily: 'Arial',
    }));

    const mult = Math.max(1, entry.multiplierPool);
    this.ownedObjects.push(this.add.text(x + w - 8, y + 28, `${entry.base} × ${mult}`, {
      fontSize: '10px', color: '#666677', fontFamily: 'Arial',
    }).setOrigin(1, 0));
  }

  // ── NEXT ROUND BUTTON ────────────────────────────────────────────────────────

  private drawNextRoundButton(startY: number): void {
    this.destroyGroup(this.nextRoundObjects);
    this.nextRoundObjects = [];

    const cx = GAME_CONFIG.width / 2;
    const mod = this.runState.currentModifier;
    let y = startY;

    if (mod) {
      this.nextRoundObjects.push(
        this.add.text(cx, y, `⚡ ${mod.name}`, {
          fontSize: '14px', color: '#ffcc44', fontFamily: 'Arial', fontStyle: 'bold',
        }).setOrigin(0.5, 0).setDepth(70),
      );
      this.nextRoundObjects.push(
        this.add.text(cx, y + 18, mod.description, {
          fontSize: '11px', color: '#ccaa44', fontFamily: 'Arial',
        }).setOrigin(0.5, 0).setDepth(70),
      );
      y += 44;
    } else {
      this.nextRoundObjects.push(
        this.add.text(cx, y + 8, 'No special conditions next round', {
          fontSize: '11px', color: '#444455', fontFamily: 'Arial',
        }).setOrigin(0.5, 0).setDepth(70),
      );
      y += 28;
    }

    const btnW = 280;
    const btnH = 48;

    const bg = this.add.graphics();
    const drawBg = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(hover ? 0x44aa44 : 0x338833, 1);
      bg.fillRoundedRect(cx - btnW / 2, y, btnW, btnH, 10);
    };
    drawBg(false);
    bg.setDepth(70);
    this.nextRoundObjects.push(bg);

    this.nextRoundObjects.push(
      this.add.text(cx, y + btnH / 2, 'Next Round  ▶', {
        fontSize: '22px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setDepth(71),
    );

    const hitArea = this.add.zone(cx, y + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    hitArea.setDepth(72);
    this.nextRoundObjects.push(hitArea);
    hitArea.on('pointerover', () => drawBg(true));
    hitArea.on('pointerout', () => drawBg(false));
    hitArea.on('pointerdown', () => this.startNextRound());
  }

  // ── SECTION HEADER ───────────────────────────────────────────────────────────

  private drawSectionHeader(
    objects: Phaser.GameObjects.GameObject[],
    y: number, label: string, infoText: string, accentColor: number,
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

  // ── ACTIONS ──────────────────────────────────────────────────────────────────

  private takeOffer(id: string, type: OfferType): void {
    if (this.choiceMade) return;
    this.chosenId = id;
    this.chosenType = type;
    this.choiceMade = true;

    if (type === 'power') {
      this.runState.ownedPowerUps.push({ powerUpId: id, base: 0, multiplierPool: 0 });
    } else {
      this.runState.ownedModifiers.push(id);
    }

    this.refreshAll();
  }

  private skipChoice(): void {
    if (this.choiceMade) return;
    this.chosenId = null;
    this.chosenType = null;
    this.choiceMade = true;
    this.refreshAll();
  }

  private doReroll(): void {
    if (this.rerollUsed) return;
    this.rerollUsed = true;
    this.rollOffers();
    this.refreshAll();
  }

  private startNextRound(): void {
    const refreshedPowerUps = this.runState.ownedPowerUps.map(p => ({
      ...p,
      base: 0,
      multiplierPool: 0,
    }));
    this.scene.start('GameScene', {
      round: this.runState.round + 1,
      ownedPowerUps: refreshedPowerUps,
      ownedModifiers: this.runState.ownedModifiers ?? [],
      runId: this.runState.runId,
      currentModifier: this.runState.currentModifier,
    } satisfies RunState);
  }

  // ── REFRESH ──────────────────────────────────────────────────────────────────

  private refreshAll(): void {
    this.destroyGroup(this.discoverObjects);
    this.destroyGroup(this.ownedObjects);
    this.destroyGroup(this.nextRoundObjects);
    this.discoverObjects = [];
    this.ownedObjects = [];
    this.nextRoundObjects = [];
    this.drawAll();
  }

  private destroyGroup(objects: Phaser.GameObjects.GameObject[]): void {
    for (const obj of objects) obj.destroy();
  }
}
