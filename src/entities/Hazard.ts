import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { HazardDefinition } from '../config/hazardConfig.ts';

export class Hazard {
  scene: Phaser.Scene;
  gridRow: number;
  gridCol: number;
  def: HazardDefinition;
  hp: number;
  maxHp: number;
  overlay: Phaser.GameObjects.Graphics;
  hpText: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene, row: number, col: number, def: HazardDefinition, initialHp?: number) {
    this.scene = scene;
    this.gridRow = row;
    this.gridCol = col;
    this.def = def;
    this.hp = initialHp !== undefined ? initialHp : def.hp;
    this.maxHp = def.hp;

    this.overlay = this.createOverlay();

    // Show HP text for multi-HP hazards
    if (this.maxHp > 1) {
      const pos = this.getWorldPosition();
      this.hpText = scene.add.text(pos.x, pos.y, `${this.hp}`, {
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      });
      this.hpText.setOrigin(0.5, 0.5);
      this.hpText.setDepth(10);
    }
  }

  private getWorldPosition(): { x: number; y: number } {
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    return {
      x: GAME_CONFIG.gridOffsetX + this.gridCol * cellSize + GAME_CONFIG.gemSize / 2,
      y: GAME_CONFIG.gridOffsetY + this.gridRow * cellSize + GAME_CONFIG.gemSize / 2,
    };
  }

  private createOverlay(): Phaser.GameObjects.Graphics {
    const pos = this.getWorldPosition();
    const graphics = this.scene.add.graphics();
    graphics.setPosition(pos.x, pos.y);
    graphics.setDepth(5);
    this.drawOverlay(graphics);
    return graphics;
  }

  private drawOverlay(graphics: Phaser.GameObjects.Graphics): void {
    graphics.clear();
    const half = GAME_CONFIG.gemSize / 2;

    if (this.def.id === 'ice') {
      // Ice: semi-transparent blue overlay with diagonal lines
      graphics.fillStyle(this.def.color, 0.25);
      graphics.fillRect(-half, -half, GAME_CONFIG.gemSize, GAME_CONFIG.gemSize);

      graphics.lineStyle(2, this.def.color, 0.6);
      // Diagonal lines from top-left to bottom-right
      const step = 12;
      for (let offset = -GAME_CONFIG.gemSize; offset < GAME_CONFIG.gemSize; offset += step) {
        const x1 = Math.max(-half, offset);
        const y1 = Math.max(-half, -offset);
        const x2 = Math.min(half, offset + GAME_CONFIG.gemSize);
        const y2 = Math.min(half, GAME_CONFIG.gemSize - offset);
        graphics.lineBetween(x1, y1, x2, y2);
      }

      // Border
      graphics.lineStyle(2, this.def.color, 0.8);
      graphics.strokeRect(-half, -half, GAME_CONFIG.gemSize, GAME_CONFIG.gemSize);
    } else if (this.def.id === 'stone') {
      // Stone: brownish overlay with spot pattern
      graphics.fillStyle(this.def.color, 0.35);
      graphics.fillRect(-half, -half, GAME_CONFIG.gemSize, GAME_CONFIG.gemSize);

      // Spots
      graphics.fillStyle(this.def.color, 0.7);
      const spotPositions = [
        { x: -12, y: -12 }, { x: 10, y: -8 }, { x: -5, y: 8 },
        { x: 15, y: 12 }, { x: -15, y: 5 }, { x: 5, y: -18 },
        { x: 18, y: -2 }, { x: -8, y: 18 },
      ];
      for (const spot of spotPositions) {
        graphics.fillCircle(spot.x, spot.y, 4);
      }

      // Thick border
      graphics.lineStyle(3, this.def.color, 0.9);
      graphics.strokeRect(-half, -half, GAME_CONFIG.gemSize, GAME_CONFIG.gemSize);

    } else if (this.def.id === 'ancientWard') {
      // Ancient Ward: mystical purple overlay with rune marks
      graphics.fillStyle(this.def.color, 0.2);
      graphics.fillRect(-half, -half, GAME_CONFIG.gemSize, GAME_CONFIG.gemSize);

      // Rune-like cross marks
      graphics.lineStyle(2, this.def.color, 0.7);
      const runeSize = 8;
      const runePositions = [
        { x: 0, y: 0 }, { x: -16, y: -14 }, { x: 16, y: -14 },
        { x: -16, y: 14 }, { x: 16, y: 14 },
      ];
      for (const rune of runePositions) {
        // Small X marks
        graphics.lineBetween(
          rune.x - runeSize / 2, rune.y - runeSize / 2,
          rune.x + runeSize / 2, rune.y + runeSize / 2,
        );
        graphics.lineBetween(
          rune.x + runeSize / 2, rune.y - runeSize / 2,
          rune.x - runeSize / 2, rune.y + runeSize / 2,
        );
      }

      // Glowing border
      graphics.lineStyle(2, this.def.color, 0.9);
      graphics.strokeRect(-half, -half, GAME_CONFIG.gemSize, GAME_CONFIG.gemSize);

    } else if (this.def.id === 'thornVine') {
      // Thorn Vine: green overlay with vine tendrils
      graphics.fillStyle(this.def.color, 0.2);
      graphics.fillRect(-half, -half, GAME_CONFIG.gemSize, GAME_CONFIG.gemSize);

      // Vine tendrils — curving lines from edges
      graphics.lineStyle(3, this.def.color, 0.7);
      // Left vine
      graphics.lineBetween(-half, -8, -10, -12);
      graphics.lineBetween(-10, -12, -4, 0);
      graphics.lineBetween(-4, 0, -12, 10);
      graphics.lineBetween(-12, 10, -half, 16);
      // Right vine
      graphics.lineBetween(half, -10, 12, -4);
      graphics.lineBetween(12, -4, 6, 8);
      graphics.lineBetween(6, 8, 14, 14);
      graphics.lineBetween(14, 14, half, 20);

      // Thorns (small triangles)
      graphics.fillStyle(this.def.color, 0.8);
      const thornPoints = [
        { x: -7, y: -6 }, { x: 9, y: -1 }, { x: -8, y: 5 }, { x: 10, y: 11 },
      ];
      for (const t of thornPoints) {
        graphics.fillTriangle(t.x - 3, t.y, t.x + 3, t.y, t.x, t.y - 5);
      }

      // Border
      graphics.lineStyle(2, this.def.color, 0.8);
      graphics.strokeRect(-half, -half, GAME_CONFIG.gemSize, GAME_CONFIG.gemSize);

    } else if (this.def.id === 'energySiphon') {
      // Energy Siphon: dark magenta overlay with drain spiral
      graphics.fillStyle(this.def.color, 0.25);
      graphics.fillRect(-half, -half, GAME_CONFIG.gemSize, GAME_CONFIG.gemSize);

      // Spiral/drain pattern — concentric arcs
      graphics.lineStyle(2, this.def.color, 0.7);
      // Inner ring
      graphics.strokeCircle(0, 0, 8);
      // Middle ring (partial arc via short line segments)
      const midR = 16;
      for (let a = 0; a < Math.PI * 1.5; a += 0.3) {
        const x1 = Math.cos(a) * midR;
        const y1 = Math.sin(a) * midR;
        const x2 = Math.cos(a + 0.3) * midR;
        const y2 = Math.sin(a + 0.3) * midR;
        graphics.lineBetween(x1, y1, x2, y2);
      }
      // Inward arrows
      graphics.lineStyle(2, this.def.color, 0.6);
      graphics.lineBetween(-20, 0, -10, 0);
      graphics.lineBetween(20, 0, 10, 0);
      graphics.lineBetween(0, -20, 0, -10);
      graphics.lineBetween(0, 20, 0, 10);

      // Border
      graphics.lineStyle(2, this.def.color, 0.9);
      graphics.strokeRect(-half, -half, GAME_CONFIG.gemSize, GAME_CONFIG.gemSize);
    }
  }

  /**
   * Apply damage to this hazard. Returns true if the hazard is destroyed.
   */
  takeDamage(amount: number): boolean {
    this.hp -= amount;
    if (this.hp <= 0) {
      return true;
    }
    // Update visuals
    this.updateHpDisplay();
    this.playDamageFlash();
    return false;
  }

  private updateHpDisplay(): void {
    if (this.hpText) {
      this.hpText.setText(`${this.hp}`);
    }
    // Fade overlay based on remaining HP
    const ratio = this.hp / this.maxHp;
    this.overlay.setAlpha(0.5 + 0.5 * ratio);
  }

  playDamageFlash(): void {
    const flash = this.scene.add.graphics();
    flash.setPosition(this.overlay.x, this.overlay.y);
    flash.setDepth(6);
    const half = GAME_CONFIG.gemSize / 2;
    flash.fillStyle(0xffffff, 0.5);
    flash.fillRect(-half, -half, GAME_CONFIG.gemSize, GAME_CONFIG.gemSize);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      onComplete: () => flash.destroy(),
    });
  }

  async playDestroyAnimation(duration: number): Promise<void> {
    return new Promise((resolve) => {
      const targets: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[] = [this.overlay];
      if (this.hpText) targets.push(this.hpText);

      this.scene.tweens.add({
        targets,
        alpha: 0,
        scaleX: 1.3,
        scaleY: 1.3,
        duration,
        ease: 'Power2',
        onComplete: () => {
          this.destroy();
          resolve();
        },
      });
    });
  }

  /**
   * Update position (used when gravity moves the gem underneath).
   */
  setGridPosition(row: number, col: number): void {
    this.gridRow = row;
    this.gridCol = col;
    const pos = this.getWorldPosition();
    this.overlay.setPosition(pos.x, pos.y);
    if (this.hpText) {
      this.hpText.setPosition(pos.x, pos.y);
    }
  }

  /**
   * Animate moving to a new position (follows gem during gravity).
   */
  moveTo(x: number, y: number, duration: number): Promise<void> {
    const promises: Promise<void>[] = [];

    promises.push(new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.overlay,
        x,
        y,
        duration,
        ease: 'Power2',
        onComplete: () => resolve(),
      });
    }));

    if (this.hpText) {
      promises.push(new Promise((resolve) => {
        this.scene.tweens.add({
          targets: this.hpText,
          x,
          y,
          duration,
          ease: 'Power2',
          onComplete: () => resolve(),
        });
      }));
    }

    return Promise.all(promises).then(() => {});
  }

  destroy(): void {
    this.overlay.destroy();
    if (this.hpText) {
      this.hpText.destroy();
      this.hpText = null;
    }
  }
}
