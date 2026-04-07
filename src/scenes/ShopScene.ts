import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { RunState, OwnedPowerUp } from '../types/RunState.ts';
import { POWER_UPS, getPowerUpDef } from '../config/powerUps.ts';
import type { PowerUpDefinition } from '../config/powerUps.ts';
import { rollModifier } from '../config/roundModifiers.ts';

export class ShopScene extends Phaser.Scene {
  private runState!: RunState;

  // Discover section state
  private offerIds: string[] = [];
  private choiceMade = false;
  private chosenId: string | null = null; // null = skipped
  private rerollUsed = false;

  // Managed game objects
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
    this.rerollUsed = false;

    // Roll modifier for the next round
    const rolledMod = rollModifier(this.runState.round);
    this.runState.currentModifier = rolledMod
      ? { id: rolledMod.id, name: rolledMod.name, description: rolledMod.description }
      : null;

    this.rollOffers();
    this.drawBackground();
    this.drawHUDBar();
    this.drawAll();
  }

  // ── SETUP ────────────────────────────────────────────────────────────────────

  private rollOffers(): void {
    const owned = new Set(this.runState.ownedPowerUps.map(p => p.powerUpId));
    const available = POWER_UPS.filter(def => !owned.has(def.id));
    this.shuffle(available);
    this.offerIds = available.slice(0, 3).map(d => d.id);
  }

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

  // ── LAYOUT ───────────────────────────────────────────────────────────────────

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
      this.discoverObjects, curY, 'CHOOSE A POWER', 'pick 1 — free', 0xffaa44,
    );
    curY += headerH + 8;
    let totalH = headerH + 8;

    if (this.choiceMade) {
      const msg = this.chosenId
        ? `✓  ${getPowerUpDef(this.chosenId)?.name ?? this.chosenId} added to your powers`
        : '✗  Skipped — no power taken';
      const msgColor = this.chosenId ? '#44ff88' : '#666677';
      this.discoverObjects.push(
        this.add.text(GAME_CONFIG.width / 2, curY + 18, msg, {
          fontSize: '14px', color: msgColor, fontFamily: 'Arial', fontStyle: 'bold',
        }).setOrigin(0.5, 0.5),
      );
      totalH += 44;
      return totalH;
    }

    // 3 horizontal offer cards
    const cardW = 200;
    const cardH = 180;
    const gap = 10;
    const totalCardsW = 3 * cardW + 2 * gap;
    const startX = (GAME_CONFIG.width - totalCardsW) / 2;

    for (let i = 0; i < this.offerIds.length; i++) {
      const def = getPowerUpDef(this.offerIds[i]);
      if (!def) continue;
      this.drawOfferCard(startX + i * (cardW + gap), curY, cardW, cardH, def);
    }

    totalH += cardH + 8;
    curY += cardH + 8;

    // Reroll button
    const rerollH = this.drawRerollButton(curY);
    totalH += rerollH;
    curY += rerollH;

    // Skip button
    totalH += this.drawSkipButton(curY);

    return totalH;
  }

  private drawOfferCard(x: number, y: number, w: number, h: number, def: PowerUpDefinition): void {
    const gemType = GAME_CONFIG.gemTypes.find(g => g.name === def.element);
    const color = gemType?.color ?? 0x888888;
    const hexColor = '#' + color.toString(16).padStart(6, '0');

    const bg = this.add.graphics();
    bg.fillStyle(color, 0.08);
    bg.fillRoundedRect(x, y, w, h, 10);
    bg.lineStyle(1.5, color, 0.5);
    bg.strokeRoundedRect(x, y, w, h, 10);
    this.discoverObjects.push(bg);

    // Element tag (top-right)
    this.discoverObjects.push(
      this.add.text(x + w - 8, y + 8, def.element.toUpperCase(), {
        fontSize: '9px', color: hexColor, fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(1, 0),
    );

    // Power name
    this.discoverObjects.push(
      this.add.text(x + w / 2, y + 34, def.name, {
        fontSize: '17px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
        align: 'center', wordWrap: { width: w - 16 },
      }).setOrigin(0.5, 0.5),
    );

    // Description
    const desc = def.description;
    this.discoverObjects.push(
      this.add.text(x + w / 2, y + 62, desc, {
        fontSize: '11px', color: '#aaaacc', fontFamily: 'Arial',
        align: 'center', wordWrap: { width: w - 16 },
      }).setOrigin(0.5, 0),
    );

    // TAKE button
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
    hitZone.on('pointerdown', () => this.takePower(def.id));
  }

  /** Returns height consumed. */
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

  /** Returns height consumed. */
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

  // ── OWNED POWERS SECTION ─────────────────────────────────────────────────────

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

    this.ownedObjects.push(this.add.text(x + 10, y + 28, def.category === 'activePower' ? 'ACTIVE' : 'PASSIVE', {
      fontSize: '11px', color: '#888899', fontFamily: 'Arial',
    }));

    if (def.category === 'activePower') {
      const mult = Math.max(1, entry.multiplierPool);
      this.ownedObjects.push(this.add.text(x + w - 8, y + 28, `${entry.base} × ${mult}`, {
        fontSize: '10px', color: '#666677', fontFamily: 'Arial',
      }).setOrigin(1, 0));
    }
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

  private takePower(powerUpId: string): void {
    if (this.choiceMade) return;
    this.chosenId = powerUpId;
    this.choiceMade = true;
    this.runState.ownedPowerUps.push({ powerUpId, base: 0, multiplierPool: 0 });
    this.refreshAll();
  }

  private skipChoice(): void {
    if (this.choiceMade) return;
    this.chosenId = null;
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

  // ── HELPERS ──────────────────────────────────────────────────────────────────

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
