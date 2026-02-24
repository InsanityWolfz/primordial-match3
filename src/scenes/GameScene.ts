import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { GemType } from '../config/gameConfig.ts';
import type { RunState, OwnedPowerUp } from '../types/RunState.ts';
import type { GameContext } from '../types/GameContext.ts';
import { getPowerUpDef } from '../config/powerUps.ts';
import { Grid } from '../entities/Grid.ts';
import { Gem } from '../entities/Gem.ts';
import { CascadeSystem } from '../systems/CascadeSystem.ts';
import { DamageSystem } from '../systems/DamageSystem.ts';
import { HazardManager } from '../systems/HazardManager.ts';
import { PassiveManager } from '../systems/PassiveManager.ts';
import { PowerUpExecutor } from '../systems/PowerUpExecutor.ts';
import { HudManager } from '../ui/HudManager.ts';
import { InventoryBar } from '../ui/InventoryBar.ts';

export class GameScene extends Phaser.Scene implements GameContext {
  grid!: Grid;
  selectedGem: Gem | null = null;
  isSwapping = false;
  score = 0;
  round = 1;
  turnsRemaining = 0;
  essence = 0;
  ownedPowerUps: OwnedPowerUp[] = [];
  powerSlotCount = 4;
  passiveSlotCount = 2;

  // Hazard win condition
  private hazardsCleared = false;
  private hazardStatusText!: Phaser.GameObjects.Text;
  private hazardClearedBanner: Phaser.GameObjects.Text | null = null;

  // Systems
  private cascadeSystem!: CascadeSystem;
  private damageSystem!: DamageSystem;
  hazardManager!: HazardManager;
  private passiveManager!: PassiveManager;
  private powerUpExecutor!: PowerUpExecutor;
  private hudManager!: HudManager;
  private inventoryBar!: InventoryBar;

  // UI — HUD bar
  private turnDrainBar!: Phaser.GameObjects.Graphics;
  private scoreValueText!: Phaser.GameObjects.Text;
  private turnCountText!: Phaser.GameObjects.Text;
  // UI — essence pill
  private essenceValueText!: Phaser.GameObjects.Text;

  // Debug
  private debugGraphics: Phaser.GameObjects.Graphics | null = null;
  private debugVisible = false;

  // GameContext implementation
  get phaserScene(): Phaser.Scene { return this; }

  constructor() {
    super({ key: 'GameScene' });
  }

  create(data?: RunState): void {
    this.initializeGame(data);
    this.initializeSystems();
    this.renderGrid();
    this.hudManager.createPowerUpHUD();
    this.createDebugButtons();
    this.setupDebugKeys();
    this.cascadeSystem.clearInitialMatches().then(() => {
      // Place hazards after initial matches are cleared
      this.hazardManager.placeHazards(this.round);
      this.updateHazardStatus();
      // If no hazards were placed (shouldn't happen, but handle it), auto-clear
      if (this.hazardManager.getTotalPlaced() === 0) {
        this.hazardsCleared = true;
      }
    });
  }

  initializeGame(data?: RunState): void {
    this.grid = new Grid(
      GAME_CONFIG.gridRows,
      GAME_CONFIG.gridCols,
      [...GAME_CONFIG.gemTypes],
    );
    this.selectedGem = null;
    this.isSwapping = false;
    this.turnsRemaining = GAME_CONFIG.turnsPerRound;

    if (data && data.round > 0) {
      this.essence = data.essence;
      this.score = data.score;
      this.round = data.round;
      this.ownedPowerUps = data.ownedPowerUps.map(p => ({ ...p }));
      this.powerSlotCount = data.powerSlotCount ?? 4;
      this.passiveSlotCount = data.passiveSlotCount ?? 2;
    } else {
      this.essence = 0;
      this.score = 0;
      this.round = 1;
      this.ownedPowerUps = [];
      this.powerSlotCount = 4;
      this.passiveSlotCount = 2;
    }

    // Draw scene background, grid panel, HUD bar and essence pill
    this.drawBackground();
    this.drawGridPanel();
    this.drawHUDBar();
    this.drawEssencePill();

    // Hazard status display (below grid)
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    const gridBottom = GAME_CONFIG.gridOffsetY + GAME_CONFIG.gridRows * cellSize;
    this.hazardsCleared = false;
    this.hazardClearedBanner = null;
    this.hazardStatusText = this.add.text(GAME_CONFIG.width / 2, gridBottom + 28, '', {
      fontSize: '18px',
      color: '#ff8844',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
  }

  private initializeSystems(): void {
    // HudManager
    this.hudManager = new HudManager(this, this.ownedPowerUps, {
      onActivate: (id: string, needsTarget: boolean) => {
        if (!needsTarget) {
          this.powerUpExecutor.executeNonTargetedPowerUp(id);
        }
      },
      getIsSwapping: () => this.isSwapping,
      getSelectedGem: () => this.selectedGem,
      clearSelectedGem: () => { this.selectedGem = null; },
    });

    // CascadeSystem (post-match passives wired through powerUpExecutor)
    this.cascadeSystem = new CascadeSystem(
      this,
      () => this.powerUpExecutor.executePostMatchPassives(),
    );

    this.powerUpExecutor = new PowerUpExecutor(this, this.cascadeSystem, {
      updateHudCharges: () => this.hudManager.updateHudCharges(),
      cancelTargeting: () => this.hudManager.cancelTargeting(),
      endRound: () => this.endRound(),
      onActionComplete: () => {
        this.updateHazardStatus();
        this.checkHazardsCleared();
      },
    });

    // HazardManager
    this.hazardManager = new HazardManager(this, this.grid);

    // PassiveManager - stat passive hooks
    this.passiveManager = new PassiveManager(this);

    // DamageSystem - central damage pipeline
    this.damageSystem = new DamageSystem(this);
    this.cascadeSystem.setDamageSystem(this.damageSystem);

    // PassiveManager needs DamageSystem for Combustion
    this.passiveManager.setDamageSystem(this.damageSystem);

    // DamageSystem needs PassiveManager for element essence bonuses
    this.damageSystem.setPassiveManager(this.passiveManager);

    // Initialize all element executors with systems
    this.powerUpExecutor.initExecutors(this.cascadeSystem, this.damageSystem, this.passiveManager);

    // Wire CascadeSystem to PassiveManager for match hooks
    this.cascadeSystem.setPassiveManager(this.passiveManager);

    // Inventory bar at bottom of screen
    this.inventoryBar = new InventoryBar(this, this.ownedPowerUps);
    this.inventoryBar.create();
  }

  // ──────────────── GameContext UI updates ────────────────

  updateEssenceDisplay(): void {
    this.essenceValueText.setText(`${this.essence}`);
  }

  updateScoreDisplay(): void {
    this.scoreValueText.setText(`${this.score}`);
  }

  updateTurnsDisplay(): void {
    const ratio = Math.max(0, this.turnsRemaining) / GAME_CONFIG.turnsPerRound;
    let color = '#ffffff';
    if (ratio <= 0.15) color = '#ff4444';
    else if (ratio <= 0.25) color = '#ff8844';
    else if (ratio <= 0.5) color = '#ffcc44';
    this.turnCountText.setText(`${this.turnsRemaining} / ${GAME_CONFIG.turnsPerRound}`);
    this.turnCountText.setColor(color);
    this.redrawTurnDrainBar();
  }

  getRandomGemType(): GemType {
    const types = GAME_CONFIG.gemTypes;
    return types[Math.floor(Math.random() * types.length)];
  }

  findMatches(): { row: number; col: number }[] {
    return this.grid.findMatches((r, c) => this.hazardManager.hasHazard(r, c));
  }

  delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(ms, resolve);
    });
  }

  // ──────────────── HAZARD STATUS ────────────────

  updateHazardStatus(): void {
    const remaining = this.hazardManager.getRemainingCount();
    const total = this.hazardManager.getTotalPlaced();

    if (this.hazardsCleared || remaining === 0) {
      this.hazardStatusText.setText('\u2713 Hazards Cleared!');
      this.hazardStatusText.setColor('#44cc44');
    } else {
      this.hazardStatusText.setText(`Hazards: ${remaining} / ${total}`);
      this.hazardStatusText.setColor('#ff8844');
    }
  }

  checkHazardsCleared(): void {
    if (this.hazardsCleared) return;
    if (this.hazardManager.getRemainingCount() > 0) return;

    this.hazardsCleared = true;
    this.updateHazardStatus();

    // Show a brief "Cleared!" banner
    if (this.hazardClearedBanner) this.hazardClearedBanner.destroy();
    this.hazardClearedBanner = this.add.text(
      GAME_CONFIG.width / 2,
      GAME_CONFIG.gridOffsetY + (GAME_CONFIG.gridRows * (GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding)) / 2,
      'HAZARDS CLEARED!',
      {
        fontSize: '36px',
        color: '#44ff44',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      },
    ).setOrigin(0.5, 0.5);

    // Fade out the banner
    this.tweens.add({
      targets: this.hazardClearedBanner,
      alpha: 0,
      y: this.hazardClearedBanner.y - 60,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => {
        if (this.hazardClearedBanner) {
          this.hazardClearedBanner.destroy();
          this.hazardClearedBanner = null;
        }
      },
    });
  }

  // ──────────────── HUD DRAW METHODS ────────────────

  private drawBackground(): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x0d0d1a, 1);
    bg.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height / 2);
    bg.fillStyle(0x060610, 1);
    bg.fillRect(0, GAME_CONFIG.height / 2, GAME_CONFIG.width, GAME_CONFIG.height / 2);
    bg.setDepth(-10);
  }

  private drawGridPanel(): void {
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    const gridW = GAME_CONFIG.gridCols * cellSize;
    const gridH = GAME_CONFIG.gridRows * cellSize;
    const margin = 8;
    const panel = this.add.graphics();
    panel.fillStyle(0x0a0a18, 0.6);
    panel.fillRoundedRect(
      GAME_CONFIG.gridOffsetX - margin,
      GAME_CONFIG.gridOffsetY - margin,
      gridW + margin * 2,
      gridH + margin * 2,
      8,
    );
    panel.lineStyle(1, 0x222244, 0.5);
    panel.strokeRoundedRect(
      GAME_CONFIG.gridOffsetX - margin,
      GAME_CONFIG.gridOffsetY - margin,
      gridW + margin * 2,
      gridH + margin * 2,
      8,
    );
    panel.setDepth(-1);
  }

  private drawHUDBar(): void {
    // Background panel (local var — drawn once, never redrawn)
    const hudBar = this.add.graphics();
    hudBar.fillStyle(0x111122, 1);
    hudBar.fillRect(0, 0, GAME_CONFIG.width, 80);
    hudBar.lineStyle(1, 0x333355, 0.7);
    hudBar.lineBetween(0, 80, GAME_CONFIG.width, 80);
    hudBar.setDepth(10);

    // Turn drain bar (drawn separately so it can be redrawn)
    this.turnDrainBar = this.add.graphics();
    this.turnDrainBar.setDepth(11);

    // ROUND section (left)
    this.add.text(120, 12, 'ROUND', {
      fontSize: '11px',
      color: '#6666aa',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(11);

    // Round value — never changes mid-game, no need to store as class property
    this.add.text(120, 28, `${this.round}`, {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(11);

    // SCORE section (center)
    this.add.text(360, 12, 'SCORE', {
      fontSize: '11px',
      color: '#6666aa',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(11);

    this.scoreValueText = this.add.text(360, 28, `${this.score}`, {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(11);

    // TURNS section (right)
    this.add.text(600, 12, 'TURNS', {
      fontSize: '11px',
      color: '#6666aa',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(11);

    this.turnCountText = this.add.text(600, 28, `${this.turnsRemaining} / ${GAME_CONFIG.turnsPerRound}`, {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(11);

    // Draw initial drain bar
    this.redrawTurnDrainBar();
  }

  private drawEssencePill(): void {
    const cx = GAME_CONFIG.width / 2;
    const pillW = 200;
    const pillH = 28;
    const pillX = cx - pillW / 2;
    const pillY = 88;

    const pill = this.add.graphics();
    pill.fillStyle(0x1a1a33, 0.9);
    pill.fillRoundedRect(pillX, pillY, pillW, pillH, 14);
    pill.lineStyle(1, 0x4444aa, 0.8);
    pill.strokeRoundedRect(pillX, pillY, pillW, pillH, 14);
    pill.setDepth(10);

    // Diamond icon (two triangles forming a diamond shape)
    const iconX = pillX + 22;
    const iconY = pillY + 14;
    const ds = 6;
    const diamond = this.add.graphics();
    diamond.fillStyle(0x88aaff, 1);
    diamond.fillTriangle(iconX, iconY - ds, iconX + ds, iconY, iconX, iconY + ds);
    diamond.fillTriangle(iconX - ds, iconY, iconX, iconY - ds, iconX, iconY + ds);
    diamond.setDepth(11);

    // "ESSENCE" label
    this.add.text(iconX + 10, pillY + 14, 'ESSENCE', {
      fontSize: '10px',
      color: '#8888cc',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(11);

    // Value (right-aligned inside pill)
    this.essenceValueText = this.add.text(pillX + pillW - 12, pillY + 14, `${this.essence}`, {
      fontSize: '16px',
      color: '#aabbff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(11);
  }

  private redrawTurnDrainBar(): void {
    const ratio = Math.max(0, this.turnsRemaining) / GAME_CONFIG.turnsPerRound;
    let barColor = 0xffffff;
    if (ratio <= 0.15) barColor = 0xff4444;
    else if (ratio <= 0.25) barColor = 0xff8844;
    else if (ratio <= 0.5) barColor = 0xffcc44;

    this.turnDrainBar.clear();
    // Track background
    this.turnDrainBar.fillStyle(0x222233, 1);
    this.turnDrainBar.fillRect(0, 76, GAME_CONFIG.width, 4);
    // Colored fill
    this.turnDrainBar.fillStyle(barColor, 0.85);
    this.turnDrainBar.fillRect(0, 76, GAME_CONFIG.width * ratio, 4);
  }

  // ──────────────── GRID RENDERING ────────────────

  renderGrid(): void {
    for (let row = 0; row < this.grid.rows; row++) {
      for (let col = 0; col < this.grid.cols; col++) {
        const gemType = this.getRandomGemType();
        const gem = new Gem(this, row, col, gemType, GAME_CONFIG.gemSize);
        this.grid.setGem(row, col, gem);
        gem.sprite.on('pointerdown', () => this.onGemClick(gem));
      }
    }
  }

  // ──────────────── INPUT ────────────────

  onGemClick(gem: Gem): void {
    if (this.isSwapping) return;

    // Power-up targeting mode
    const activePowerUpId = this.hudManager.getActivePowerUpId();
    if (activePowerUpId) {
      const def = getPowerUpDef(activePowerUpId);
      if (def?.needsTarget) {
        this.powerUpExecutor.executeTargetedPowerUp(activePowerUpId, gem.gridRow, gem.gridCol);
        return;
      }
    }

    if (this.turnsRemaining <= 0) return;

    if (!this.selectedGem) {
      gem.select();
      this.selectedGem = gem;
      return;
    }

    if (this.selectedGem === gem) {
      gem.deselect();
      this.selectedGem = null;
      return;
    }

    if (this.grid.areAdjacent(this.selectedGem.gridRow, this.selectedGem.gridCol, gem.gridRow, gem.gridCol)) {
      // Block swap if either gem has a blocking hazard (e.g., Ancient Ward)
      if (
        this.hazardManager.hasBlockingHazard(this.selectedGem.gridRow, this.selectedGem.gridCol) ||
        this.hazardManager.hasBlockingHazard(gem.gridRow, gem.gridCol)
      ) {
        // Can't swap — deselect and give visual feedback
        this.selectedGem.deselect();
        this.selectedGem = null;
        return;
      }
      this.handleSwap(this.selectedGem, gem);
    } else {
      this.selectedGem.deselect();
      gem.select();
      this.selectedGem = gem;
    }
  }

  async handleSwap(gem1: Gem, gem2: Gem): Promise<void> {
    this.isSwapping = true;
    gem1.deselect();
    gem2.deselect();
    this.selectedGem = null;

    await this.animateSwap(gem1, gem2);

    const matches = this.findMatches();

    if (matches.length === 0) {
      await this.animateSwap(gem1, gem2);
      this.isSwapping = false;
      return;
    }

    // Valid match — consume a turn (unless Sturdy saves it)
    const turnResult = this.passiveManager.onTurnConsumed();
    if (!turnResult.turnSaved) {
      this.turnsRemaining--;
    }
    if (turnResult.bonusTurn) {
      this.turnsRemaining++;
    }
    this.updateTurnsDisplay();

    await this.cascadeSystem.processCascade(matches, 1);

    // Check if hazards were cleared during this cascade
    this.updateHazardStatus();
    this.checkHazardsCleared();

    // Process turn-end hazard behaviors (thorn vine spreading)
    const newHazards = await this.hazardManager.processTurnEnd();
    if (newHazards > 0) {
      this.updateHazardStatus();
    }

    // Refresh power-up HUD (Energy Siphon may have drained charges)
    this.hudManager.updateHudCharges();

    this.isSwapping = false;

    if (this.turnsRemaining <= 0) {
      await this.endRound();
    }
  }

  async animateSwap(gem1: Gem, gem2: Gem): Promise<void> {
    const pos1 = gem1.getWorldPosition();
    const pos2 = gem2.getWorldPosition();

    this.grid.swap(gem1.gridRow, gem1.gridCol, gem2.gridRow, gem2.gridCol);

    await Promise.all([
      gem1.moveTo(pos2.x, pos2.y, GAME_CONFIG.swapDuration),
      gem2.moveTo(pos1.x, pos1.y, GAME_CONFIG.swapDuration),
    ]);
  }

  // ──────────────── ROUND ────────────────

  async endRound(): Promise<void> {
    await this.delay(500);

    const runState: RunState = {
      essence: this.essence,
      round: this.round,
      score: this.score,
      ownedPowerUps: this.ownedPowerUps.map(p => ({ ...p })),
      powerSlotCount: this.powerSlotCount,
      passiveSlotCount: this.passiveSlotCount,
    };

    if (this.hazardsCleared) {
      // Success — advance to shop
      this.scene.start('ShopScene', runState);
    } else {
      // Failure — hazards remain
      this.scene.start('FailScene', runState);
    }
  }

  // ──────────────── DEBUG ────────────────

  setupDebugKeys(): void {
    if (!this.input.keyboard) return;

    this.input.keyboard.on('keydown-D', () => {
      this.toggleDebugGrid();
    });

    this.input.keyboard.on('keydown-R', () => {
      this.resetGame();
    });

    this.input.keyboard.on('keydown-ESC', () => {
      if (this.hudManager.getActivePowerUpId()) {
        this.hudManager.cancelTargeting();
      }
    });
  }

  toggleDebugGrid(): void {
    if (!this.debugGraphics) {
      this.debugGraphics = this.add.graphics();
    }

    this.debugVisible = !this.debugVisible;
    this.debugGraphics.clear();

    if (!this.debugVisible) return;

    this.debugGraphics.lineStyle(1, 0x00ff00, 0.5);
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;

    for (let row = 0; row <= GAME_CONFIG.gridRows; row++) {
      const y = GAME_CONFIG.gridOffsetY + row * cellSize;
      this.debugGraphics.lineBetween(
        GAME_CONFIG.gridOffsetX, y,
        GAME_CONFIG.gridOffsetX + GAME_CONFIG.gridCols * cellSize, y,
      );
    }

    for (let col = 0; col <= GAME_CONFIG.gridCols; col++) {
      const x = GAME_CONFIG.gridOffsetX + col * cellSize;
      this.debugGraphics.lineBetween(
        x, GAME_CONFIG.gridOffsetY,
        x, GAME_CONFIG.gridOffsetY + GAME_CONFIG.gridRows * cellSize,
      );
    }
  }

  createDebugButtons(): void {
    const btnY = GAME_CONFIG.height - 30;

    // "+100" button
    const addText = this.add.text(GAME_CONFIG.width - 130, btnY, '+100', {
      fontSize: '14px',
      color: '#888888',
      fontFamily: 'Arial',
      backgroundColor: '#222222',
      padding: { x: 6, y: 4 },
    }).setOrigin(0.5, 0.5);
    addText.setInteractive({ useHandCursor: true });
    addText.on('pointerdown', () => {
      this.essence += 100;
      this.updateEssenceDisplay();
    });
    addText.on('pointerover', () => addText.setColor('#ffffff'));
    addText.on('pointerout', () => addText.setColor('#888888'));

    // "Shop" button
    const shopText = this.add.text(GAME_CONFIG.width - 50, btnY, 'Shop', {
      fontSize: '14px',
      color: '#888888',
      fontFamily: 'Arial',
      backgroundColor: '#222222',
      padding: { x: 6, y: 4 },
    }).setOrigin(0.5, 0.5);
    shopText.setInteractive({ useHandCursor: true });
    shopText.on('pointerdown', () => {
      this.turnsRemaining = 0;
      this.hazardsCleared = true; // Debug: skip hazard check
      this.endRound();
    });
    shopText.on('pointerover', () => shopText.setColor('#ffffff'));
    shopText.on('pointerout', () => shopText.setColor('#888888'));
  }

  resetGame(): void {
    // Explicitly pass fresh run state to ensure full reset
    this.scene.start('GameScene', {
      essence: 0,
      score: 0,
      round: 0,       // round <= 0 triggers reset path in initializeGame
      ownedPowerUps: [],
      powerSlotCount: 4,
      passiveSlotCount: 2,
    });
  }
}
