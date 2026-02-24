import type Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import { getPowerUpDef } from '../config/powerUps.ts';
import type { PowerUpDefinition } from '../config/powerUps.ts';
import type { OwnedPowerUp } from '../types/RunState.ts';

export interface HudButton {
  bg: Phaser.GameObjects.Graphics;
  chargeText: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  owned: OwnedPowerUp;
  def: PowerUpDefinition;
}

export class HudManager {
  private scene: Phaser.Scene;
  private ownedPowerUps: OwnedPowerUp[];
  private hudButtons: HudButton[] = [];
  private activePowerUpId: string | null = null;
  private powerUpStatusText: Phaser.GameObjects.Text | null = null;
  private targetingOverlay: Phaser.GameObjects.Graphics | null = null;

  // Callbacks
  private onActivate: (id: string, needsTarget: boolean) => void;
  private getIsSwapping: () => boolean;
  private getSelectedGem: () => { deselect(): void } | null;
  private clearSelectedGem: () => void;

  constructor(
    scene: Phaser.Scene,
    ownedPowerUps: OwnedPowerUp[],
    callbacks: {
      onActivate: (id: string, needsTarget: boolean) => void;
      getIsSwapping: () => boolean;
      getSelectedGem: () => { deselect(): void } | null;
      clearSelectedGem: () => void;
    },
  ) {
    this.scene = scene;
    this.ownedPowerUps = ownedPowerUps;
    this.onActivate = callbacks.onActivate;
    this.getIsSwapping = callbacks.getIsSwapping;
    this.getSelectedGem = callbacks.getSelectedGem;
    this.clearSelectedGem = callbacks.clearSelectedGem;
  }

  getActivePowerUpId(): string | null {
    return this.activePowerUpId;
  }

  createPowerUpHUD(): void {
    const activePowerUps = this.ownedPowerUps.filter(p => {
      const def = getPowerUpDef(p.powerUpId);
      return def && def.category === 'activePower';
    });

    if (activePowerUps.length === 0) return;

    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    const gridBottom = GAME_CONFIG.gridOffsetY + GAME_CONFIG.gridRows * cellSize;
    const hudY = gridBottom + 90;
    const buttonSize = 56;
    const gap = 12;
    const totalWidth = activePowerUps.length * buttonSize + (activePowerUps.length - 1) * gap;
    const startX = GAME_CONFIG.width / 2 - totalWidth / 2;

    // "Power-ups" label
    this.scene.add.text(GAME_CONFIG.width / 2, hudY - 10, 'Power-Ups', {
      fontSize: '14px',
      color: '#888888',
      fontFamily: 'Arial',
    }).setOrigin(0.5, 1);

    for (let i = 0; i < activePowerUps.length; i++) {
      const owned = activePowerUps[i];
      const def = getPowerUpDef(owned.powerUpId)!;
      const gemType = GAME_CONFIG.gemTypes.find(g => g.name === def.element);
      const color = gemType ? gemType.color : 0x888888;

      const x = startX + i * (buttonSize + gap);
      const centerX = x + buttonSize / 2;
      const centerY = hudY + buttonSize / 2;

      // Button background
      const bg = this.scene.add.graphics();
      this.drawHudButton(bg, x, hudY, buttonSize, color, owned.charges > 0);

      // Element icon
      const icon = this.scene.add.graphics();
      icon.fillStyle(color, owned.charges > 0 ? 1 : 0.3);
      icon.fillCircle(centerX, centerY - 6, 10);

      // Charges text
      const chargeText = this.scene.add.text(centerX, centerY + 16, `${owned.charges}`, {
        fontSize: '14px',
        color: owned.charges > 0 ? '#ffffff' : '#555555',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      });
      chargeText.setOrigin(0.5, 0.5);

      // Name below
      this.scene.add.text(centerX, hudY + buttonSize + 8, def.name.slice(0, 6), {
        fontSize: '10px',
        color: '#777777',
        fontFamily: 'Arial',
      }).setOrigin(0.5, 0);

      // Interactive zone
      const zone = this.scene.add.zone(centerX, centerY, buttonSize, buttonSize);
      zone.setInteractive({ useHandCursor: true });

      const button: HudButton = { bg, chargeText, zone, owned, def };
      this.hudButtons.push(button);

      zone.on('pointerdown', () => {
        this.onPowerUpButtonClick(button);
      });

      zone.on('pointerover', () => {
        if (owned.charges > 0 && !this.getIsSwapping()) {
          this.drawHudButton(bg, x, hudY, buttonSize, color, true, true);
        }
      });

      zone.on('pointerout', () => {
        const isActive = this.activePowerUpId === owned.powerUpId;
        this.drawHudButton(bg, x, hudY, buttonSize, color, owned.charges > 0, isActive);
      });
    }
  }

  drawHudButton(
    bg: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    size: number,
    color: number,
    enabled: boolean,
    highlight = false,
  ): void {
    bg.clear();
    if (highlight) {
      bg.fillStyle(color, 0.3);
      bg.lineStyle(2, color, 1);
    } else if (enabled) {
      bg.fillStyle(color, 0.1);
      bg.lineStyle(2, color, 0.6);
    } else {
      bg.fillStyle(0x333333, 0.2);
      bg.lineStyle(1, 0x444444, 0.4);
    }
    bg.fillRoundedRect(x, y, size, size, 6);
    bg.strokeRoundedRect(x, y, size, size, 6);
  }

  onPowerUpButtonClick(button: HudButton): void {
    if (this.getIsSwapping()) return;
    if (button.owned.charges <= 0) return;

    const id = button.owned.powerUpId;

    // Toggle off if already active
    if (this.activePowerUpId === id) {
      this.cancelTargeting();
      return;
    }

    // Activate targeting mode
    this.activePowerUpId = id;

    // Deselect any selected gem
    const selected = this.getSelectedGem();
    if (selected) {
      selected.deselect();
      this.clearSelectedGem();
    }

    // Show status text
    if (this.powerUpStatusText) this.powerUpStatusText.destroy();

    const needsTarget = button.def.needsTarget ?? false;
    const message = needsTarget
      ? `${button.def.name}: Click a gem to target (ESC to cancel)`
      : `${button.def.name}: Activating...`;

    this.powerUpStatusText = this.scene.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.gridOffsetY - 30, message, {
      fontSize: '16px',
      color: '#ffcc00',
      fontFamily: 'Arial',
    });
    this.powerUpStatusText.setOrigin(0.5, 0.5);

    // Highlight the button
    this.refreshHudHighlights();

    // Notify the game scene
    this.onActivate(id, needsTarget);
  }

  refreshHudHighlights(): void {
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    const gridBottom = GAME_CONFIG.gridOffsetY + GAME_CONFIG.gridRows * cellSize;
    const hudY = gridBottom + 90;
    const buttonSize = 56;
    const gap = 12;

    const activePowerUps = this.ownedPowerUps.filter(p => {
      const def = getPowerUpDef(p.powerUpId);
      return def && def.category === 'activePower';
    });

    const totalWidth = activePowerUps.length * buttonSize + (activePowerUps.length - 1) * gap;
    const startX = GAME_CONFIG.width / 2 - totalWidth / 2;

    for (let i = 0; i < this.hudButtons.length; i++) {
      const btn = this.hudButtons[i];
      const x = startX + i * (buttonSize + gap);
      const gemType = GAME_CONFIG.gemTypes.find(g => g.name === btn.def.element);
      const color = gemType ? gemType.color : 0x888888;
      const isActive = this.activePowerUpId === btn.owned.powerUpId;
      this.drawHudButton(btn.bg, x, hudY, buttonSize, color, btn.owned.charges > 0, isActive);
    }
  }

  updateHudCharges(): void {
    for (const btn of this.hudButtons) {
      btn.chargeText.setText(`${btn.owned.charges}`);
      btn.chargeText.setColor(btn.owned.charges > 0 ? '#ffffff' : '#555555');
    }
    this.refreshHudHighlights();
  }

  cancelTargeting(): void {
    this.activePowerUpId = null;
    if (this.powerUpStatusText) {
      this.powerUpStatusText.destroy();
      this.powerUpStatusText = null;
    }
    if (this.targetingOverlay) {
      this.targetingOverlay.destroy();
      this.targetingOverlay = null;
    }
    this.refreshHudHighlights();
  }
}
