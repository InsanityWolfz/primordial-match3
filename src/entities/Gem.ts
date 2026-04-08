import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { GemType } from '../config/gameConfig.ts';

export class Gem {
  scene: Phaser.Scene;
  gridRow: number;
  gridCol: number;
  type: GemType;
  gemSize: number;
  sprite: Phaser.GameObjects.Image;
  selectionRing: Phaser.GameObjects.Graphics | null;
  isSelected: boolean;
  isMatched: boolean;
  hp: number;
  maxHp: number;

  constructor(scene: Phaser.Scene, gridRow: number, gridCol: number, type: GemType, gemSize: number) {
    this.scene = scene;
    this.gridRow = gridRow;
    this.gridCol = gridCol;
    this.type = type;
    this.gemSize = gemSize;
    this.selectionRing = null;
    this.isSelected = false;
    this.isMatched = false;
    this.hp = GAME_CONFIG.defaultGemHp;
    this.maxHp = GAME_CONFIG.defaultGemHp;

    this.sprite = this.createSprite();
  }

  createSprite(): Phaser.GameObjects.Image {
    const pos = this.getWorldPosition();
    const key = `gem-${this.type.name}`;

    const image = this.scene.add.image(pos.x, pos.y, key);
    image.setDisplaySize(this.gemSize, this.gemSize);
    image.setInteractive({ useHandCursor: true });

    (image as Phaser.GameObjects.Image & { gemData: Gem }).gemData = this;

    return image;
  }

  getWorldPosition(): { x: number; y: number } {
    return {
      x: GAME_CONFIG.gridOffsetX + this.gridCol * (GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding) + GAME_CONFIG.gemSize / 2,
      y: GAME_CONFIG.gridOffsetY + this.gridRow * (GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding) + GAME_CONFIG.gemSize / 2,
    };
  }

  setGridPosition(row: number, col: number): void {
    this.gridRow = row;
    this.gridCol = col;
  }

  moveTo(x: number, y: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.sprite,
        x,
        y,
        duration,
        ease: 'Power2',
        onComplete: () => resolve(),
      });
    });
  }

  select(): void {
    this.isSelected = true;
    if (!this.selectionRing) {
      this.selectionRing = this.scene.add.graphics();
    }
    this.selectionRing.clear();
    this.selectionRing.lineStyle(3, 0xffffff, 1);
    const half = this.gemSize / 2 + 4;
    this.selectionRing.strokeRect(-half, -half, (half * 2), (half * 2));
    this.selectionRing.setPosition(this.sprite.x, this.sprite.y);
  }

  deselect(): void {
    this.isSelected = false;
    if (this.selectionRing) {
      this.selectionRing.clear();
    }
  }

  playDestroyAnimation(duration: number): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.sprite,
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        duration,
        ease: 'Power2',
        onComplete: () => {
          this.destroy();
          resolve();
        },
      });
      if (this.selectionRing) {
        this.scene.tweens.add({
          targets: this.selectionRing,
          alpha: 0,
          duration,
        });
      }
    });
  }

  /**
   * Apply damage to this gem. Returns true if the gem is killed (hp <= 0).
   */
  takeDamage(amount: number): boolean {
    this.hp -= amount;
    return this.hp <= 0;
  }

  /**
   * Brief red flash to indicate the gem took damage but survived.
   * Currently a no-op since all gems have 1 HP, but will be used
   * when hazards/high-HP gems are introduced.
   */
  playDamageFlash(): void {
    const flash = this.scene.add.graphics();
    flash.fillStyle(0xff0000, 0.5);
    flash.fillRect(-this.gemSize / 2, -this.gemSize / 2, this.gemSize, this.gemSize);
    flash.setPosition(this.sprite.x, this.sprite.y);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      onComplete: () => flash.destroy(),
    });
  }

  changeType(newType: GemType): void {
    this.type = newType;
    this.sprite.setTexture(`gem-${newType.name}`);
    this.sprite.setDisplaySize(this.gemSize, this.gemSize);
  }

  destroy(): void {
    this.sprite.destroy();
    if (this.selectionRing) {
      this.selectionRing.destroy();
      this.selectionRing = null;
    }
  }
}
