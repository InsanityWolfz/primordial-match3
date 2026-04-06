import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { PowerUpDefinition } from '../config/powerUpConfig.ts';
import type { OwnedPowerUp } from '../types/RunState.ts';

/**
 * ShopCardRenderer: draws individual power-up cards.
 * Card height is computed dynamically from description text so nothing gets clipped.
 */
export class ShopCardRenderer {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Measure how tall a card will be for this power-up at its current level.
   * Call before drawCard to know how much vertical space to reserve.
   */
  measureCardHeight(def: PowerUpDefinition, owned: OwnedPowerUp | undefined, w: number): number {
    const currentLevel = owned ? owned.level : 0;
    const isMaxLevel = currentLevel >= def.maxLevel;
    const descIndex = isMaxLevel ? currentLevel - 1 : currentLevel;
    const descText = def.levels[descIndex]?.description ?? '';

    const temp = this.scene.add.text(0, 0, descText, {
      fontSize: '11px',
      fontFamily: 'Arial',
      wordWrap: { width: w - 20 },
    });
    const descH = temp.height;
    temp.destroy();

    // top pad(8) + name(18) + level(18) + gap(4) + desc + gap(6) + pill(24) + bottom pad(8)
    return 8 + 18 + 18 + 4 + descH + 6 + 24 + 8;
  }

  /**
   * Draw a power-up card. Returns array of all created Phaser game objects for cleanup.
   * Pass h = measureCardHeight(...) for a perfectly fitting card.
   */
  drawCard(
    def: PowerUpDefinition,
    owned: OwnedPowerUp | undefined,
    x: number,
    y: number,
    w: number,
    h: number,
    canAfford: boolean,
    slotsFull: boolean,
    onPurchase: () => void,
  ): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const currentLevel = owned ? owned.level : 0;
    const isMaxLevel = currentLevel >= def.maxLevel;
    const blocked = slotsFull && currentLevel === 0;

    let cost = 0;
    let actionLabel = '';
    if (isMaxLevel) {
      actionLabel = 'MAX';
    } else if (blocked) {
      actionLabel = 'No slots';
    } else {
      cost = def.levels[currentLevel].cost;
      actionLabel = `◆ ${cost}`;
    }

    const affordable = canAfford && !isMaxLevel && !blocked;

    const gemType = GAME_CONFIG.gemTypes.find(g => g.name === def.element);
    const elementColor = gemType ? gemType.color : 0x888888;
    const borderColor = affordable ? elementColor : 0x444444;
    const fillAlpha = affordable ? 0.12 : 0.04;

    // Card background
    const bg = this.scene.add.graphics();
    bg.fillStyle(elementColor, fillAlpha);
    bg.fillRoundedRect(x, y, w, h, 8);
    bg.lineStyle(2, borderColor, affordable ? 0.8 : 0.3);
    bg.strokeRoundedRect(x, y, w, h, 8);
    objects.push(bg);

    // Two-tone header band (top 40px, slightly lighter)
    const headerBand = this.scene.add.graphics();
    headerBand.fillStyle(elementColor, affordable ? 0.1 : 0.03);
    headerBand.fillRoundedRect(x, y, w, 40, { tl: 8, tr: 8, bl: 0, br: 0 });
    objects.push(headerBand);

    // Left accent bar (4px wide, element color, rounded on left only)
    const accent = this.scene.add.graphics();
    accent.fillStyle(elementColor, affordable ? 0.9 : 0.3);
    accent.fillRoundedRect(x, y, 4, h, { tl: 8, tr: 0, bl: 8, br: 0 });
    objects.push(accent);

    // Name (row 1) — shifted right to clear accent bar
    objects.push(this.scene.add.text(x + 16, y + 8, def.name, {
      fontSize: '14px',
      color: affordable ? '#ffffff' : '#666666',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }));

    // Category label (top right)
    const categoryLabels: Record<string, string> = {
      activePower: 'Active',
      passivePower: 'Passive Power',
      passive: 'Stat',
    };
    const categoryLabel = categoryLabels[def.category] ?? def.category;
    const typeColor = def.category === 'passive' ? '#66aaff'
      : def.category === 'passivePower' ? '#88ccff'
      : '#ffaa44';
    objects.push(this.scene.add.text(x + w - 10, y + 8, categoryLabel, {
      fontSize: '10px',
      color: affordable ? typeColor : '#555555',
      fontFamily: 'Arial',
    }).setOrigin(1, 0));

    // Level text (row 2, no progress bar)
    let levelText: string;
    let levelColor: string;
    if (currentLevel === 0) {
      levelText = 'New!';
      levelColor = '#55cc55';
    } else if (isMaxLevel) {
      levelText = `Lv ${def.maxLevel} MAX`;
      levelColor = '#ffcc00';
    } else {
      levelText = `Lv ${currentLevel} / ${def.maxLevel}`;
      levelColor = '#aaaaaa';
    }
    objects.push(this.scene.add.text(x + 16, y + 26, levelText, {
      fontSize: '11px',
      color: affordable ? levelColor : '#555555',
      fontFamily: 'Arial',
    }));

    // Description (row 3, word-wrapped)
    const descIndex = isMaxLevel ? currentLevel - 1 : currentLevel;
    const descText = def.levels[descIndex]?.description ?? '';
    objects.push(this.scene.add.text(x + 10, y + 44, descText, {
      fontSize: '11px',
      color: affordable ? '#aaaaaa' : '#555555',
      fontFamily: 'Arial',
      wordWrap: { width: w - 20 },
    }));

    // Buy / state pill button (anchored to bottom of card)
    const pillH = 24;
    const pillW = w - 20;
    const pillX = x + 10;
    const pillBY = y + h - pillH - 6;

    let pillFill: number;
    let pillBorderColor: number;
    let pillBorderAlpha: number;
    let pillTextColor: string;

    if (isMaxLevel) {
      pillFill = 0x443300;
      pillBorderColor = 0xffcc00;
      pillBorderAlpha = 0.7;
      pillTextColor = '#ffcc00';
    } else if (blocked) {
      pillFill = 0x220000;
      pillBorderColor = 0x883333;
      pillBorderAlpha = 0.7;
      pillTextColor = '#883333';
    } else if (affordable) {
      pillFill = 0x1a1a33;
      pillBorderColor = 0x4444aa;
      pillBorderAlpha = 0.9;
      pillTextColor = '#aabbff';
    } else {
      pillFill = 0x1a1a1a;
      pillBorderColor = 0x333333;
      pillBorderAlpha = 0.6;
      pillTextColor = '#555555';
    }

    const pillBg = this.scene.add.graphics();
    pillBg.fillStyle(pillFill, 1);
    pillBg.fillRoundedRect(pillX, pillBY, pillW, pillH, 13);
    pillBg.lineStyle(1, pillBorderColor, pillBorderAlpha);
    pillBg.strokeRoundedRect(pillX, pillBY, pillW, pillH, 13);
    objects.push(pillBg);

    objects.push(this.scene.add.text(pillX + pillW / 2, pillBY + pillH / 2, actionLabel, {
      fontSize: '13px',
      color: pillTextColor,
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));

    // Interactive purchase zone
    if (affordable) {
      const hitArea = this.scene.add.zone(x + w / 2, y + h / 2, w, h);
      hitArea.setInteractive({ useHandCursor: true });
      objects.push(hitArea);

      hitArea.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(elementColor, 0.22);
        bg.fillRoundedRect(x, y, w, h, 8);
        bg.lineStyle(2, elementColor, 1);
        bg.strokeRoundedRect(x, y, w, h, 8);
        pillBg.clear();
        pillBg.fillStyle(0x222244, 1);
        pillBg.fillRoundedRect(pillX, pillBY, pillW, pillH, 13);
        pillBg.lineStyle(1, 0x6688ff, 1);
        pillBg.strokeRoundedRect(pillX, pillBY, pillW, pillH, 13);
      });

      hitArea.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(elementColor, fillAlpha);
        bg.fillRoundedRect(x, y, w, h, 8);
        bg.lineStyle(2, borderColor, 0.8);
        bg.strokeRoundedRect(x, y, w, h, 8);
        pillBg.clear();
        pillBg.fillStyle(0x1a1a33, 1);
        pillBg.fillRoundedRect(pillX, pillBY, pillW, pillH, 13);
        pillBg.lineStyle(1, 0x4444aa, 0.9);
        pillBg.strokeRoundedRect(pillX, pillBY, pillW, pillH, 13);
      });

      hitArea.on('pointerdown', () => {
        onPurchase();
      });
    }

    return objects;
  }
}
