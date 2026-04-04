import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import { getPowerUpDef } from '../config/powerUps.ts';
import type { RunState } from '../types/RunState.ts';

const STARTER_POOL = ['fireball', 'watergun', 'earthquake', 'gust', 'chainstrike'];

const DESCRIPTIONS: Record<string, string> = {
  fireball:    'Blast a target area,\ndamaging all tiles in range.',
  watergun:    'Drench random targets\nacross the board.',
  earthquake:  'Shuffle the board and\nstrike multiple targets.',
  gust:        'Sweep entire rows,\nhitting everything in them.',
  chainstrike: 'Chain lightning through\nmultiple targets in sequence.',
};

export class StarterScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StarterScene' });
  }

  create(): void {
    const cx = GAME_CONFIG.width / 2;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x111122, 1);
    bg.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);

    // Title
    this.add.text(cx, 180, 'Choose Your\nStarter Power', {
      fontSize: '36px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);

    this.add.text(cx, 280, 'This will be your only power for Round 1.', {
      fontSize: '16px',
      color: '#888888',
      fontFamily: 'Arial',
      align: 'center',
    }).setOrigin(0.5, 0.5);

    // Pick 3 random starters
    const pool = [...STARTER_POOL];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const choices = pool.slice(0, 3);

    // Layout: 3 cards centered
    const cardW = 180;
    const cardH = 240;
    const gap = 20;
    const totalW = 3 * cardW + 2 * gap;
    const startX = cx - totalW / 2;
    const cardY = 420;

    choices.forEach((id, i) => {
      const def = getPowerUpDef(id)!;
      const gemType = GAME_CONFIG.gemTypes.find(g => g.name === def.element);
      const color = gemType?.color ?? 0x888888;
      const x = startX + i * (cardW + gap);

      this.createCard(x, cardY - cardH / 2, cardW, cardH, color, def.name, DESCRIPTIONS[id] ?? '', () => {
        const runState: RunState = {
          essence: 0,
          round: 1,
          ownedPowerUps: [{ powerUpId: id, level: 1, charges: 1, maxCharges: 1 }],
          powerSlotCount: 4,
          passiveSlotCount: 2,
        };
        this.scene.start('GameScene', runState);
      });
    });
  }

  private createCard(
    x: number, y: number, w: number, h: number,
    color: number, name: string, description: string,
    onClick: () => void,
  ): void {
    const bg = this.add.graphics();
    const drawCard = (bright: boolean) => {
      bg.clear();
      bg.fillStyle(bright ? color : Phaser.Display.Color.IntegerToColor(color).darken(40).color, 1);
      bg.fillRoundedRect(x, y, w, h, 14);
      bg.lineStyle(2, bright ? 0xffffff : color, bright ? 0.8 : 0.4);
      bg.strokeRoundedRect(x, y, w, h, 14);
    };
    drawCard(false);

    this.add.text(x + w / 2, y + 40, name, {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);

    this.add.text(x + w / 2, y + h / 2 + 20, description, {
      fontSize: '14px',
      color: '#dddddd',
      fontFamily: 'Arial',
      align: 'center',
      wordWrap: { width: w - 20 },
    }).setOrigin(0.5, 0.5);

    this.add.text(x + w / 2, y + h - 30, 'SELECT', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    const hitZone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    hitZone.on('pointerover', () => drawCard(true));
    hitZone.on('pointerout', () => drawCard(false));
    hitZone.on('pointerdown', onClick);
  }
}
