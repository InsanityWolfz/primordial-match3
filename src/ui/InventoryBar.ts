import type Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import { getPowerUpDef } from '../config/powerUps.ts';
import type { OwnedPowerUp } from '../types/RunState.ts';

/**
 * InventoryBar: persistent bottom-of-screen display showing all owned
 * power-ups and passives with levels. Click for tooltip. Used in
 * GameScene, ShopScene, and FailScene.
 */
export class InventoryBar {
  private scene: Phaser.Scene;
  private ownedPowerUps: OwnedPowerUp[];
  private barY: number;

  // Rendered elements (destroyed on refresh)
  private elements: Phaser.GameObjects.GameObject[] = [];
  private tooltipElements: Phaser.GameObjects.GameObject[] = [];
  private activeTooltipId: string | null = null;

  constructor(scene: Phaser.Scene, ownedPowerUps: OwnedPowerUp[], barY = 1190) {
    this.scene = scene;
    this.ownedPowerUps = ownedPowerUps;
    this.barY = barY;
  }

  create(): void {
    this.renderBar();
  }

  refresh(ownedPowerUps: OwnedPowerUp[]): void {
    this.ownedPowerUps = ownedPowerUps;
    this.hideTooltip();
    this.destroyElements();
    this.renderBar();
  }

  destroy(): void {
    this.hideTooltip();
    this.destroyElements();
  }

  // ──────────────── RENDER ────────────────

  private renderBar(): void {
    const width = GAME_CONFIG.width;

    // Background strip
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a1a, 0.85);
    bg.fillRect(0, this.barY, width, 90);
    // Top border — bright line + subtle glow beneath
    bg.lineStyle(2, 0x4444aa, 0.9);
    bg.lineBetween(0, this.barY, width, this.barY);
    bg.lineStyle(1, 0x3333aa, 0.3);
    bg.lineBetween(0, this.barY + 2, width, this.barY + 2);
    bg.setDepth(50);
    this.elements.push(bg);

    // Group owned items by category
    const actives: { owned: OwnedPowerUp; defId: string }[] = [];
    const passivePowers: { owned: OwnedPowerUp; defId: string }[] = [];
    const passives: { owned: OwnedPowerUp; defId: string }[] = [];

    for (const owned of this.ownedPowerUps) {
      const def = getPowerUpDef(owned.powerUpId);
      if (!def) continue;
      const entry = { owned, defId: owned.powerUpId };
      if (def.category === 'activePower') actives.push(entry);
      else if (def.category === 'passivePower') passivePowers.push(entry);
      else passives.push(entry);
    }

    // If nothing owned, show placeholder text
    if (actives.length === 0 && passivePowers.length === 0 && passives.length === 0) {
      const empty = this.scene.add.text(width / 2, this.barY + 45, 'No power-ups yet', {
        fontSize: '14px',
        color: '#555566',
        fontFamily: 'Arial',
        fontStyle: 'italic',
      });
      empty.setOrigin(0.5, 0.5);
      empty.setDepth(51);
      this.elements.push(empty);
      return;
    }

    // Build groups with labels
    const groups: { label: string; items: { owned: OwnedPowerUp; defId: string }[] }[] = [];
    if (actives.length > 0) groups.push({ label: 'Active', items: actives });
    if (passivePowers.length > 0) groups.push({ label: 'Passive', items: passivePowers });
    if (passives.length > 0) groups.push({ label: 'Stat', items: passives });

    // Calculate total width needed
    const iconSize = 28;
    const iconGap = 10;
    const groupGap = 20;
    const dividerWidth = 1;

    let totalWidth = 0;
    for (let g = 0; g < groups.length; g++) {
      totalWidth += groups[g].items.length * (iconSize + iconGap) - iconGap;
      if (g < groups.length - 1) totalWidth += groupGap + dividerWidth + groupGap;
    }

    let curX = width / 2 - totalWidth / 2 + iconSize / 2;
    const iconCenterY = this.barY + 50;

    for (let g = 0; g < groups.length; g++) {
      const group = groups[g];

      // Group label
      const groupStartX = curX;
      const groupEndX = curX + (group.items.length - 1) * (iconSize + iconGap);
      const labelX = (groupStartX + groupEndX) / 2;

      const label = this.scene.add.text(labelX, this.barY + 12, group.label, {
        fontSize: '10px',
        color: '#666688',
        fontFamily: 'Arial',
      });
      label.setOrigin(0.5, 0);
      label.setDepth(51);
      this.elements.push(label);

      // Render each item
      for (const item of group.items) {
        this.renderIcon(item.owned, curX, iconCenterY);
        curX += iconSize + iconGap;
      }

      // Divider between groups
      if (g < groups.length - 1) {
        curX -= iconGap; // remove last item gap
        curX += groupGap;
        const divider = this.scene.add.graphics();
        divider.lineStyle(1, 0x444466, 0.5);
        divider.lineBetween(curX, this.barY + 10, curX, this.barY + 80);
        divider.setDepth(51);
        this.elements.push(divider);
        curX += dividerWidth + groupGap;
      }
    }
  }

  private renderIcon(owned: OwnedPowerUp, cx: number, cy: number): void {
    const def = getPowerUpDef(owned.powerUpId);
    if (!def) return;

    const gemType = GAME_CONFIG.gemTypes.find(g => g.name === def.element);
    const color = gemType ? gemType.color : 0x888888;
    const radius = 14;

    // Icon background + border
    const icon = this.scene.add.graphics();
    icon.setDepth(52);

    // Fill
    icon.fillStyle(color, 0.85);
    icon.fillCircle(cx, cy, radius);

    // Border style varies by category
    if (def.category === 'activePower') {
      icon.lineStyle(2, color, 1);
      icon.strokeCircle(cx, cy, radius);
    } else if (def.category === 'passivePower') {
      icon.lineStyle(2, color, 0.8);
      icon.strokeCircle(cx, cy, radius);
      icon.lineStyle(1, color, 0.4);
      icon.strokeCircle(cx, cy, radius + 3);
    } else {
      // passive — subtle border
      icon.lineStyle(1, color, 0.5);
      icon.strokeCircle(cx, cy, radius);
    }

    this.elements.push(icon);

    // Level number
    const lvlText = this.scene.add.text(cx, cy, `${owned.level}`, {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    });
    lvlText.setOrigin(0.5, 0.5);
    lvlText.setDepth(53);
    this.elements.push(lvlText);

    // Interactive zone
    const zone = this.scene.add.zone(cx, cy, radius * 2 + 8, radius * 2 + 8);
    zone.setInteractive({ useHandCursor: true });
    zone.setDepth(54);
    this.elements.push(zone);

    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      if (this.activeTooltipId === owned.powerUpId) {
        this.hideTooltip();
      } else {
        this.showTooltip(owned, cx);
      }
    });
  }

  // ──────────────── TOOLTIP ────────────────

  private showTooltip(owned: OwnedPowerUp, anchorX: number): void {
    this.hideTooltip();
    this.activeTooltipId = owned.powerUpId;

    const def = getPowerUpDef(owned.powerUpId);
    if (!def) return;

    const levelData = def.levels[Math.min(owned.level, def.maxLevel) - 1];
    const description = levelData?.description ?? '';
    const gemType = GAME_CONFIG.gemTypes.find(g => g.name === def.element);
    const color = gemType ? gemType.color : 0x888888;

    const categoryLabel = def.category === 'activePower' ? 'Active Power'
      : def.category === 'passivePower' ? 'Passive Power'
      : 'Stat Passive';

    // Measure description text to size the panel dynamically
    const panelW = 260;
    const padding = 12;

    // Create text elements offscreen first to measure
    const nameStr = `${def.name}  Lv ${owned.level}`;
    const descText = this.scene.add.text(0, 0, description, {
      fontSize: '12px',
      color: '#bbbbbb',
      fontFamily: 'Arial',
      wordWrap: { width: panelW - padding * 2 },
    });
    const descHeight = descText.height;
    descText.destroy();

    // Panel height: padding + name(18) + gap(4) + category(14) + gap(6) + descHeight + padding
    const panelH = padding + 18 + 4 + 14 + 6 + descHeight + padding;
    const panelX = Math.max(10, Math.min(anchorX - panelW / 2, GAME_CONFIG.width - panelW - 10));
    const panelY = this.barY - panelH - 8;

    const panel = this.scene.add.graphics();
    panel.fillStyle(0x1a1a2e, 0.95);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    panel.lineStyle(2, color, 0.7);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);
    panel.setDepth(60);
    this.tooltipElements.push(panel);

    // Name + level
    const nameText = this.scene.add.text(panelX + padding, panelY + padding, nameStr, {
      fontSize: '15px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    });
    nameText.setDepth(61);
    this.tooltipElements.push(nameText);

    // Category tag
    const catText = this.scene.add.text(panelX + padding, panelY + padding + 22, categoryLabel, {
      fontSize: '11px',
      color: '#999999',
      fontFamily: 'Arial',
    });
    catText.setDepth(61);
    this.tooltipElements.push(catText);

    // Description
    const descTextFinal = this.scene.add.text(panelX + padding, panelY + padding + 42, description, {
      fontSize: '12px',
      color: '#bbbbbb',
      fontFamily: 'Arial',
      wordWrap: { width: panelW - padding * 2 },
    });
    descTextFinal.setDepth(61);
    this.tooltipElements.push(descTextFinal);

    // Dismiss zone (covers screen behind tooltip)
    const dismiss = this.scene.add.zone(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2,
      GAME_CONFIG.width, GAME_CONFIG.height);
    dismiss.setInteractive();
    dismiss.setDepth(55); // below tooltip but above other elements
    dismiss.on('pointerdown', () => {
      this.hideTooltip();
    });
    this.tooltipElements.push(dismiss);
  }

  private hideTooltip(): void {
    for (const el of this.tooltipElements) {
      el.destroy();
    }
    this.tooltipElements = [];
    this.activeTooltipId = null;
  }

  // ──────────────── CLEANUP ────────────────

  private destroyElements(): void {
    for (const el of this.elements) {
      el.destroy();
    }
    this.elements = [];
  }
}
