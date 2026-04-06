import type Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import { getPowerUpDef } from '../config/powerUps.ts';
import type { OwnedPowerUp } from '../types/RunState.ts';
import { InventoryBar } from './InventoryBar.ts';
import { PowerDrawer } from './PowerDrawer.ts';

export class HudManager {
  private scene: Phaser.Scene;
  private ownedPowerUps: OwnedPowerUp[];
  private activePowerUpId: string | null = null;
  private powerUpStatusText: Phaser.GameObjects.Text | null = null;
  private targetingOverlay: Phaser.GameObjects.Graphics | null = null;
  private inventoryBar: InventoryBar | null = null;
  private drawer: PowerDrawer | null = null;

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

  /** Wire up the InventoryBar so this manager can update its visuals. */
  setInventoryBar(bar: InventoryBar): void {
    this.inventoryBar = bar;
  }

  /** Wire up the PowerDrawer so this manager can open/close it. */
  setDrawer(drawer: PowerDrawer): void {
    this.drawer = drawer;
  }

  getActivePowerUpId(): string | null {
    return this.activePowerUpId;
  }

  /** Open the detail drawer. */
  openDrawer(): void {
    this.drawer?.open();
  }

  /**
   * Activate or toggle a power-up by ID.
   * Called from chip tray taps and drawer ACTIVATE buttons.
   */
  activateById(id: string): void {
    if (this.getIsSwapping()) return;

    const owned = this.ownedPowerUps.find(p => p.powerUpId === id);
    if (!owned || owned.base <= 0) return;

    // Toggle off if already in targeting mode for this power
    if (this.activePowerUpId === id) {
      this.cancelTargeting();
      return;
    }

    this.activePowerUpId = id;

    // Deselect any gem that's currently selected
    const selected = this.getSelectedGem();
    if (selected) {
      selected.deselect();
      this.clearSelectedGem();
    }

    // Show status text above the grid
    if (this.powerUpStatusText) this.powerUpStatusText.destroy();
    const def = getPowerUpDef(id)!;
    const needsTarget = def.needsTarget ?? false;
    const message = needsTarget
      ? `${def.name}: Tap a tile to target  (tap again to cancel)`
      : `${def.name}: Activating...`;

    this.powerUpStatusText = this.scene.add.text(
      GAME_CONFIG.width / 2,
      GAME_CONFIG.gridOffsetY - 30,
      message,
      { fontSize: '15px', color: '#ffcc00', fontFamily: 'Arial' },
    );
    this.powerUpStatusText.setOrigin(0.5, 0.5);

    // Highlight the chip in the tray
    this.inventoryBar?.setActiveCard(id);

    // Notify GameScene (fires executeNonTargetedPowerUp if !needsTarget)
    this.onActivate(id, needsTarget);
  }

  /** Refresh charge display after a power-up is used or charges change. */
  updateHudCharges(): void {
    this.inventoryBar?.refresh(this.ownedPowerUps);
    this.drawer?.refreshData(this.ownedPowerUps);
  }

  /** Flash a chip/card briefly to show it just fired (active or passive). */
  flashCard(id: string): void {
    this.inventoryBar?.flashCard(id);
  }

  /** Exit targeting mode and reset all visuals. */
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
    this.inventoryBar?.setActiveCard(null);
  }
}
