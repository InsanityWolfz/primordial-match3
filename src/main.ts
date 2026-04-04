import Phaser from 'phaser';
import { GAME_CONFIG } from './config/gameConfig.ts';
import { BootScene } from './scenes/BootScene.ts';
import { StarterScene } from './scenes/StarterScene.ts';
import { GameScene } from './scenes/GameScene.ts';
import { ShopScene } from './scenes/ShopScene.ts';
import { FailScene } from './scenes/FailScene.ts';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_CONFIG.width,
  height: GAME_CONFIG.height,
  parent: 'game-container',
  backgroundColor: GAME_CONFIG.backgroundColor,
  physics: GAME_CONFIG.physics,
  scene: [BootScene, StarterScene, GameScene, ShopScene, FailScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
