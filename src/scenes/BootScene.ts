import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.createLoadingBar();

    // Hazard sprites
    this.load.image('hazard-ice', 'assets/sprites/hazard-ice.png');

    // Gem sprites
    this.load.image('gem-fire',      'assets/sprites/gem-fire.png');
    this.load.image('gem-water',     'assets/sprites/gem-water.png');
    this.load.image('gem-earth',     'assets/sprites/gem-earth.png');
    this.load.image('gem-air',       'assets/sprites/gem-air.png');
    this.load.image('gem-lightning', 'assets/sprites/gem-lightning.png');
    this.load.image('gem-nature',    'assets/sprites/gem-nature.png');
  }

  createLoadingBar(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    const progressBar = this.add.graphics();

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0xffffff, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });
  }

  create(): void {
    this.scene.start('StarterScene');
  }
}
