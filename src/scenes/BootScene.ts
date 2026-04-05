import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.createLoadingBar();

    // Hazard sprites
    this.load.image('hazard-ice',         'assets/sprites/hazard-ice.png');
    this.load.image('hazard-stone',       'assets/sprites/hazard-stone.png');
    this.load.image('hazard-thornVine',   'assets/sprites/hazard-vines.png');
    this.load.image('hazard-energySiphon','assets/sprites/hazard-energysiphon.png');

    // Enemy sprites
    this.load.image('enemy-fireImp',        'assets/sprites/enemy_fireImp.png');
    this.load.image('enemy-iceWhelp',       'assets/sprites/enemy_iceWhelp.png');
    this.load.image('enemy-lightningWraith','assets/sprites/enemy_lightningWraith.png');
    this.load.image('enemy-vineMonster',    'assets/sprites/enemy_vineMonster.png');
    this.load.image('enemy-earthGolem',     'assets/sprites/enemy_earthGolem.png');

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
    this.scene.start('TitleScene');
  }
}
