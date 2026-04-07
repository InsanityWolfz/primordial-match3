import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { RunState } from '../types/RunState.ts';
import { InventoryBar } from '../ui/InventoryBar.ts';

/**
 * FailScene: shown when the player runs out of turns without clearing all hazards.
 * The run is over — player must start from round 1.
 */
export class FailScene extends Phaser.Scene {
  private runState!: RunState;

  constructor() {
    super({ key: 'FailScene' });
  }

  create(data: RunState): void {
    this.runState = { ...data };

    const cx = GAME_CONFIG.width / 2;

    // Dark background
    const bg = this.add.graphics();
    bg.fillStyle(0x111111, 1);
    bg.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);

    // Failure header
    this.add.text(cx, 200, 'Run Over', {
      fontSize: '48px',
      color: '#ff4444',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    // Round info
    this.add.text(cx, 280, `Failed on Round ${this.runState.round}`, {
      fontSize: '28px',
      color: '#cccccc',
      fontFamily: 'Arial',
    }).setOrigin(0.5, 0.5);

    // Round reached
    this.add.text(cx, 350, `Round Reached: ${this.runState.round}`, {
      fontSize: '24px',
      color: '#aaaaaa',
      fontFamily: 'Arial',
    }).setOrigin(0.5, 0.5);

    // Failure message
    this.add.text(cx, 440, 'Enemies defeated you!', {
      fontSize: '20px',
      color: '#ff8844',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    this.add.text(cx, 480, 'Turns ran out before all enemies were defeated.', {
      fontSize: '16px',
      color: '#888888',
      fontFamily: 'Arial',
    }).setOrigin(0.5, 0.5);

    // ─── New Run Button ───
    const btnY = 580;
    const btnW = 280;
    const btnH = 54;

    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x338833, 1);
    btnBg.fillRoundedRect(cx - btnW / 2, btnY, btnW, btnH, 12);

    this.add.text(cx, btnY + btnH / 2, 'New Run', {
      fontSize: '26px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    const hitArea = this.add.zone(cx, btnY + btnH / 2, btnW, btnH);
    hitArea.setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0x44aa44, 1);
      btnBg.fillRoundedRect(cx - btnW / 2, btnY, btnW, btnH, 12);
    });

    hitArea.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0x338833, 1);
      btnBg.fillRoundedRect(cx - btnW / 2, btnY, btnW, btnH, 12);
    });

    hitArea.on('pointerdown', () => {
      // Explicitly pass fresh run state to ensure full reset
      this.scene.start('StarterScene');
    });

    // Inventory bar — shows what you had when you failed (compact mode)
    const failBarY = GAME_CONFIG.height - 160;
    const inventoryBar = new InventoryBar(this, this.runState.ownedPowerUps, failBarY);
    inventoryBar.create();
  }
}
