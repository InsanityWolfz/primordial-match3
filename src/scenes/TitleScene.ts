import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';

const W = GAME_CONFIG.width;   // 720
const H = GAME_CONFIG.height;  // 1280
const CX = W / 2;

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    this.drawBackground();
    this.drawTitle();
    this.drawRules();
    this.drawPlayButton();
  }

  // ─── Background ───────────────────────────────────────────────────────────

  private drawBackground(): void {
    // Two-tone gradient via two overlapping rects
    const bg = this.add.graphics();
    bg.fillStyle(0x06060f, 1);
    bg.fillRect(0, 0, W, H);
    // Subtle vignette-style top glow
    bg.fillStyle(0x0a0a22, 1);
    bg.fillRect(0, 0, W, H * 0.45);
    bg.setDepth(-1);
  }

  // ─── Title ────────────────────────────────────────────────────────────────

  private drawTitle(): void {
    // Decorative gem diamond icon
    const iconY = 108;
    const ds = 18;
    const gem = this.add.graphics().setDepth(5);
    gem.fillStyle(0x88aaff, 1);
    gem.fillTriangle(CX, iconY - ds, CX + ds, iconY, CX, iconY + ds);
    gem.fillTriangle(CX - ds, iconY, CX, iconY - ds, CX, iconY + ds);
    gem.fillStyle(0xaaccff, 0.5);
    gem.fillTriangle(CX, iconY - ds * 0.6, CX + ds * 0.5, iconY - ds * 0.1, CX, iconY + ds * 0.2);

    // Game title
    this.add.text(CX, 155, 'PRIMORDIAL', {
      fontSize: '58px',
      color: '#ddeeff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      stroke: '#1122aa',
      strokeThickness: 6,
    }).setOrigin(0.5, 0.5).setDepth(5);

    // Subtitle
    this.add.text(CX, 205, 'MATCH · 3 · ROGUELIKE', {
      fontSize: '16px',
      color: '#6677bb',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      letterSpacing: 4,
    }).setOrigin(0.5, 0.5).setDepth(5);

    // Divider
    this.drawDivider(232);
  }

  // ─── Rules ────────────────────────────────────────────────────────────────

  private drawRules(): void {
    let y = 258;
    const sectionGap = 18;

    // ── THE BOARD ──
    y = this.drawSection('THE BOARD', y, [
      'Swap adjacent gems to match 3 or more of the same element.',
      'Each match costs 1 turn — you get 15 turns per round.',
      'Bigger matches earn bonus essence multipliers:',
      '     Match-4  +20%   ·   Match-5  +50%',
    ]);

    y += sectionGap;
    this.drawDivider(y);
    y += sectionGap + 4;

    // ── ENEMIES ──
    y = this.drawSection('ENEMIES', y, [
      'Enemies occupy tiles on the board as blocked squares.',
      'Only your powers can damage enemies — matches cannot.',
      'Defeat all enemies to complete the round.',
      'Enemies get larger and gain traits as rounds increase.',
    ]);

    y += sectionGap;
    this.drawDivider(y);
    y += sectionGap + 4;

    // ── POWERS ──
    y = this.drawSection('POWERS', y, [
      'Powers are free to use but have limited charges per round.',
      'Matching gems of your power\'s element refunds charges.',
      'Active powers deal damage. Passives trigger automatically.',
    ]);

    y += sectionGap;
    this.drawDivider(y);
    y += sectionGap + 4;

    // ── SHOP & ESSENCE ──
    y = this.drawSection('SHOP & ESSENCE', y, [
      'Essence is earned each round based on gems destroyed',
      'and match multipliers — it is your shop currency.',
      'Between rounds, buy and upgrade powers or passives.',
    ]);

    y += sectionGap;
    this.drawDivider(y);
    y += sectionGap + 4;

    // ── WIN / LOSE ──
    this.drawSection('WIN & LOSE', y, [
      'Win: defeat all enemies before running out of turns.',
      'Lose: turns reach zero with enemies still alive.',
      'Survive as many rounds as you can!',
    ]);
  }

  // ─── Play Button ──────────────────────────────────────────────────────────

  private drawPlayButton(): void {
    const btnW = 320, btnH = 64, btnX = CX - btnW / 2, btnY = H - 120;

    const bg = this.add.graphics().setDepth(10);
    bg.fillStyle(0x1a4428, 1);
    bg.fillRoundedRect(btnX, btnY, btnW, btnH, 14);
    bg.lineStyle(2, 0x44cc88, 0.9);
    bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 14);

    const label = this.add.text(CX, btnY + btnH / 2, 'PLAY  ▶', {
      fontSize: '26px',
      color: '#66ffaa',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(11);

    // Hover + click
    const zone = this.add.zone(CX, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true }).setDepth(12);

    zone.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x226633, 1);
      bg.fillRoundedRect(btnX, btnY, btnW, btnH, 14);
      bg.lineStyle(2, 0x55ffaa, 1);
      bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 14);
      label.setColor('#aaffcc');
    });

    zone.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x1a4428, 1);
      bg.fillRoundedRect(btnX, btnY, btnW, btnH, 14);
      bg.lineStyle(2, 0x44cc88, 0.9);
      bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 14);
      label.setColor('#66ffaa');
    });

    zone.on('pointerdown', () => this.scene.start('StarterScene'));

    // Gentle pulse on the button border
    this.tweens.add({
      targets: label,
      alpha: 0.75,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private drawSection(title: string, startY: number, lines: string[]): number {
    const DEPTH = 5;
    const lineH = 28;

    // Section header with accent dot
    const dot = this.add.graphics().setDepth(DEPTH);
    dot.fillStyle(0x4466cc, 1);
    dot.fillCircle(52, startY + 8, 4);

    this.add.text(62, startY, title, {
      fontSize: '13px',
      color: '#7799dd',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0, 0).setDepth(DEPTH);

    let y = startY + 26;
    for (const line of lines) {
      const isSub = line.startsWith('     ');
      this.add.text(isSub ? 72 : 56, y, line.trimStart(), {
        fontSize: isSub ? '13px' : '14px',
        color: isSub ? '#8899cc' : '#aabbdd',
        fontFamily: 'Arial',
        wordWrap: { width: W - 80 },
      }).setOrigin(0, 0).setDepth(DEPTH);
      y += lineH;
    }

    return y;
  }

  private drawDivider(y: number): void {
    const g = this.add.graphics().setDepth(4);
    g.lineStyle(1, 0x1a2244, 1);
    g.lineBetween(40, y, W - 40, y);
  }
}
