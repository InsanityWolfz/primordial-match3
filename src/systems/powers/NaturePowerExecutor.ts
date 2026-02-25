import { GAME_CONFIG } from '../../config/gameConfig.ts';
import type { GemType } from '../../config/gameConfig.ts';
import { Gem } from '../../entities/Gem.ts';
import type { GameContext } from '../../types/GameContext.ts';
import type { CascadeSystem } from '../CascadeSystem.ts';

export class NaturePowerExecutor {
  private ctx: GameContext;
  private cascadeSystem: CascadeSystem;

  // Element picker UI elements (need cleanup on cancel)
  private pickerElements: Phaser.GameObjects.GameObject[] = [];

  constructor(ctx: GameContext, cascadeSystem: CascadeSystem) {
    this.ctx = ctx;
    this.cascadeSystem = cascadeSystem;
  }

  /**
   * Transmute: click a gem → show element picker → change to chosen element.
   * Returns false if the player cancelled (charge should be refunded).
   */
  async executeTransmute(_level: number, targetRow: number, targetCol: number): Promise<boolean> {
    const gem = this.ctx.grid.getGem(targetRow, targetCol);
    if (!gem) return false;

    // Show element picker and wait for selection
    const chosenType = await this.showElementPicker(targetRow, targetCol, gem.type);
    if (!chosenType) {
      // Player cancelled — refund charge
      return false;
    }

    // Animate the transmutation of the single gem
    await this.animateTransmute(targetRow, targetCol, chosenType);

    // Check for new matches
    await this.ctx.delay(200);
    const matches = this.ctx.findMatches();
    if (matches.length > 0) {
      await this.cascadeSystem.processCascade(matches, 1);
    }

    return true;
  }

  /**
   * Show a ring of 6 element buttons around the target gem.
   * Returns the chosen GemType, or null if cancelled.
   */
  private showElementPicker(row: number, col: number, _currentType: GemType): Promise<GemType | null> {
    return new Promise((resolve) => {
      const scene = this.ctx.phaserScene;
      this.cleanupPicker();

      const gem = this.ctx.grid.getGem(row, col);
      if (!gem) { resolve(null); return; }

      const worldPos = gem.getWorldPosition();
      const cx = worldPos.x;
      const cy = worldPos.y;

      // Semi-transparent backdrop to catch cancel clicks
      const backdrop = scene.add.graphics();
      backdrop.fillStyle(0x000000, 0.4);
      backdrop.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
      backdrop.setDepth(100);
      backdrop.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, GAME_CONFIG.width, GAME_CONFIG.height),
        Phaser.Geom.Rectangle.Contains,
      );
      this.pickerElements.push(backdrop);

      // "Choose Element" label
      const label = scene.add.text(cx, cy - 95, 'Choose Element', {
        fontSize: '18px',
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      });
      label.setOrigin(0.5, 0.5);
      label.setDepth(102);
      this.pickerElements.push(label);

      // Highlight the target gem
      const highlight = scene.add.graphics();
      highlight.lineStyle(3, 0xffffff, 0.8);
      highlight.strokeCircle(cx, cy, GAME_CONFIG.gemSize / 2 + 4);
      highlight.setDepth(101);
      this.pickerElements.push(highlight);

      // Place 6 element buttons in a ring around the gem
      const types = GAME_CONFIG.gemTypes;
      const radius = 70;
      const buttonRadius = 22;
      const startAngle = -Math.PI / 2; // Start from top

      for (let i = 0; i < types.length; i++) {
        const gemType = types[i];
        const angle = startAngle + (i / types.length) * Math.PI * 2;
        const bx = cx + Math.cos(angle) * radius;
        const by = cy + Math.sin(angle) * radius;

        // Button background circle
        const btnBg = scene.add.graphics();
        btnBg.setDepth(102);
        this.pickerElements.push(btnBg);

        // Draw normal state
        const drawNormal = () => {
          btnBg.clear();
          btnBg.fillStyle(0x222222, 0.9);
          btnBg.fillCircle(bx, by, buttonRadius);
          btnBg.lineStyle(2, gemType.color, 0.8);
          btnBg.strokeCircle(bx, by, buttonRadius);
        };

        // Draw hover state
        const drawHover = () => {
          btnBg.clear();
          btnBg.fillStyle(gemType.color, 0.4);
          btnBg.fillCircle(bx, by, buttonRadius + 2);
          btnBg.lineStyle(3, gemType.color, 1);
          btnBg.strokeCircle(bx, by, buttonRadius + 2);
        };

        drawNormal();

        // Colored gem icon inside
        const icon = scene.add.graphics();
        icon.fillStyle(gemType.color, 1);
        icon.fillCircle(bx, by, 14);
        icon.setDepth(103);
        this.pickerElements.push(icon);

        // Element name below button
        const nameText = scene.add.text(bx, by + buttonRadius + 10, gemType.name, {
          fontSize: '10px',
          color: '#cccccc',
          fontFamily: 'Arial',
        });
        nameText.setOrigin(0.5, 0.5);
        nameText.setDepth(103);
        this.pickerElements.push(nameText);

        // Interactive zone
        const zone = scene.add.zone(bx, by, buttonRadius * 2 + 8, buttonRadius * 2 + 8);
        zone.setInteractive({ useHandCursor: true });
        zone.setDepth(104);
        this.pickerElements.push(zone);

        zone.on('pointerover', () => drawHover());
        zone.on('pointerout', () => drawNormal());

        zone.on('pointerdown', () => {
          this.cleanupPicker();
          resolve(gemType);
        });
      }

      // Cancel on backdrop click
      backdrop.on('pointerdown', () => {
        this.cleanupPicker();
        resolve(null);
      });

      // Cancel on ESC
      const escHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          this.cleanupPicker();
          resolve(null);
          scene.input.keyboard?.off('keydown-ESC', escHandler);
        }
      };
      scene.input.keyboard?.on('keydown-ESC', escHandler);
      // Store ref so cleanup can remove it
      (this as Record<string, unknown>)._escHandler = escHandler;
    });
  }

  /**
   * Cleanup all picker UI elements.
   */
  private cleanupPicker(): void {
    const scene = this.ctx.phaserScene;
    for (const el of this.pickerElements) {
      el.destroy();
    }
    this.pickerElements = [];

    // Remove ESC handler if stored
    const escHandler = (this as Record<string, unknown>)._escHandler as ((...args: unknown[]) => void) | undefined;
    if (escHandler) {
      scene.input.keyboard?.off('keydown-ESC', escHandler);
      delete (this as Record<string, unknown>)._escHandler;
    }
  }

  /**
   * Animate changing a single gem to a new type.
   */
  private animateTransmute(row: number, col: number, newType: GemType): Promise<void> {
    return new Promise((resolve) => {
      const scene = this.ctx.phaserScene;
      const oldGem = this.ctx.grid.getGem(row, col);
      if (!oldGem) { resolve(); return; }

      // Capture display scale set by setDisplaySize in createSprite
      const oldScaleX = oldGem.sprite.scaleX;
      const oldScaleY = oldGem.sprite.scaleY;

      scene.tweens.add({
        targets: oldGem.sprite,
        alpha: 0,
        scaleX: oldScaleX * 0.5,
        scaleY: oldScaleY * 0.5,
        duration: 150,
        onComplete: () => {
          oldGem.destroy();

          const newGem = new Gem(scene, row, col, newType, GAME_CONFIG.gemSize);
          // Capture correct display scale after setDisplaySize (inside createSprite)
          const targetScaleX = newGem.sprite.scaleX;
          const targetScaleY = newGem.sprite.scaleY;
          newGem.sprite.setAlpha(0);
          // Start at half the correct display size, not absolute scale 0.5
          newGem.sprite.setScale(targetScaleX * 0.5, targetScaleY * 0.5);
          this.ctx.grid.setGem(row, col, newGem);
          newGem.sprite.on('pointerdown', () => this.ctx.onGemClick(newGem));

          scene.tweens.add({
            targets: newGem.sprite,
            alpha: 1,
            scaleX: targetScaleX,
            scaleY: targetScaleY,
            duration: 200,
            onComplete: () => resolve(),
          });
        },
      });
    });
  }
}
