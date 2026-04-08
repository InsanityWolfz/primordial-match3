import Phaser from 'phaser';
import { GAME_CONFIG, DEBUG_CONFIG } from '../config/gameConfig.ts';
import type { GemType } from '../config/gameConfig.ts';
import type { RunState, OwnedPowerUp } from '../types/RunState.ts';
import { StatsLogger } from '../utils/StatsLogger.ts';
import type { GameContext } from '../types/GameContext.ts';
import { getPowerUpDef } from '../config/powerUps.ts';
import { Grid } from '../entities/Grid.ts';
import { Gem } from '../entities/Gem.ts';
import { CascadeSystem } from '../systems/CascadeSystem.ts';
import { DamageSystem } from '../systems/DamageSystem.ts';
import { HazardManager } from '../systems/HazardManager.ts';
import { EnemyManager, type FiredIntent } from '../systems/EnemyManager.ts';
import { PassiveManager } from '../systems/PassiveManager.ts';
import { PowerUpExecutor } from '../systems/PowerUpExecutor.ts';
import { HudManager } from '../ui/HudManager.ts';
import { InventoryBar } from '../ui/InventoryBar.ts';
import { PowerDrawer } from '../ui/PowerDrawer.ts';

export class GameScene extends Phaser.Scene implements GameContext {
  grid!: Grid;
  selectedGem: Gem | null = null;
  isSwapping = false;
  round = 1;
  turnsRemaining = 0;
  ownedPowerUps: OwnedPowerUp[] = [];
  ownedModifiers: string[] = [];

  // Per-round balance stats (only used when DEBUG_CONFIG.debugStats is true)
  private runId = '';
  private roundEnemiesKilled = 0;
  private roundHazardsCleared = 0;
  private roundPowerUses: Record<string, number> = {};

  // Per-round modifier runtime state (public so power executors can read/write via GameContext)
  fireStreakCount = 0;
  hadFireMatchThisTurn = false;
  private fireStreakMissedTurns = 0;  // for Heat Retention grace period
  earthquakeFiredThisTurn = false;
  empFiredThisRound = false;  // for EMP (first Chain Strike cancels all intents)
  novaFiredThisRound = false; // for Nova (once per round)
  private bedrockUsedThisRound = false;

  // Systems
  private cascadeSystem!: CascadeSystem;
  private damageSystem!: DamageSystem;
  hazardManager!: HazardManager;
  enemyManager!: EnemyManager;
  private passiveManager!: PassiveManager;
  private powerUpExecutor!: PowerUpExecutor;
  private hudManager!: HudManager;
  private inventoryBar!: InventoryBar;
  private powerDrawer!: PowerDrawer;

  // UI — HUD bar
  private turnDrainBar!: Phaser.GameObjects.Graphics;
  private enemyValueText!: Phaser.GameObjects.Text;
  private turnCountText!: Phaser.GameObjects.Text;
  // UI — shop button
  private shopButtonBg!: Phaser.GameObjects.Graphics;
  private shopButtonLabel!: Phaser.GameObjects.Text;
  private shopButtonSub!: Phaser.GameObjects.Text;
  private shopButtonZone!: Phaser.GameObjects.Zone;

  // Y position where the inventory panel starts (below the grid)
  private inventoryPanelY = 0;

  // Drag-to-swap state
  private dragStartGem: Gem | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private static readonly DRAG_THRESHOLD = 20;

  // Debug
  private debugGraphics: Phaser.GameObjects.Graphics | null = null;
  private debugVisible = false;

  get phaserScene(): Phaser.Scene { return this; }

  constructor() {
    super({ key: 'GameScene' });
  }

  create(data?: RunState): void {
    this.initializeGame(data);
    this.initializeSystems();
    this.renderGrid();
    this.createDebugButtons();
    this.setupDebugKeys();
    this.setupDragInput();

    this.cascadeSystem.clearInitialMatches().then(() => {
      this.enemyManager.placeEnemies(this.round);
      this.updateEnemyDisplay();
    });
  }


  initializeGame(data?: RunState): void {
    this.grid = new Grid(GAME_CONFIG.gridRows, GAME_CONFIG.gridCols, [...GAME_CONFIG.gemTypes]);
    this.selectedGem = null;
    this.isSwapping = false;
    this.turnsRemaining = GAME_CONFIG.turnsPerRound;
    this.resetRoundCounters();

    if (data && data.round > 0) {
      this.round = data.round;
      this.ownedPowerUps = data.ownedPowerUps.map(p => ({ ...p }));
      this.ownedModifiers = data.ownedModifiers ?? [];
      this.runId = data.runId ?? String(Date.now());
    } else {
      this.round = 1;
      this.ownedPowerUps = [];
      this.ownedModifiers = [];
      this.runId = String(Date.now());
    }

    this.drawBackground();
    this.drawGridPanel();
    this.drawHUDBar();
  }

  private resetRoundCounters(): void {
    this.roundEnemiesKilled = 0;
    this.roundHazardsCleared = 0;
    this.roundPowerUses = {};
    this.fireStreakCount = 0;
    this.hadFireMatchThisTurn = false;
    this.fireStreakMissedTurns = 0;
    this.earthquakeFiredThisTurn = false;
    this.empFiredThisRound = false;
    this.novaFiredThisRound = false;
    this.bedrockUsedThisRound = false;
  }

  private initializeSystems(): void {
    this.enemyManager = new EnemyManager(this, this.grid);
    this.enemyManager.setOnEnemyDied(() => {
      this.roundEnemiesKilled++;
      this.passiveManager?.onEnemyKilled();
      this.updateEnemyDisplay();
      this.updateShopButton();
    });

    this.hudManager = new HudManager(this, this.ownedPowerUps, {
      onActivate: (id: string, needsTarget: boolean) => {
        if (!needsTarget) {
          this.trackPowerUse(id);
          this.powerUpExecutor.executeNonTargetedPowerUp(id);
        }
      },
      getIsSwapping: () => this.isSwapping,
      getSelectedGem: () => this.selectedGem,
      clearSelectedGem: () => { this.selectedGem = null; },
    });

    this.cascadeSystem = new CascadeSystem(
      this,
      (matchPositions) => this.powerUpExecutor.executePostMatchPassives(matchPositions),
    );

    this.powerUpExecutor = new PowerUpExecutor(this, this.cascadeSystem, {
      cancelTargeting: () => this.hudManager.cancelTargeting(),
      endRound: () => this.endRound(),
      onActionComplete: () => {
        this.hudManager.updateHudCharges();
        this.updateEnemyDisplay();
        this.updateShopButton();
        this.flashPowerActivation();
      },
      onFlashCard: (id) => this.hudManager.flashCard(id),
    });

    this.hazardManager = new HazardManager(this, this.grid);

    this.passiveManager = new PassiveManager(this);
    this.passiveManager.setFlashCardCallback((id) => this.hudManager.flashCard(id));

    this.damageSystem = new DamageSystem(this);
    this.cascadeSystem.setDamageSystem(this.damageSystem);
    this.passiveManager.setDamageSystem(this.damageSystem);
    this.damageSystem.setPassiveManager(this.passiveManager);

    this.cascadeSystem.setOnPowerAccumulated(() => {
      this.hudManager.updateHudCharges();
    });
    this.cascadeSystem.setOnMatchGroup((element, _size) => {
      if (element === 'fire') this.hadFireMatchThisTurn = true;
    });
    this.damageSystem.setOnHazardsDestroyed((count) => {
      this.roundHazardsCleared += count;
    });

    this.powerUpExecutor.initExecutors(this.cascadeSystem, this.damageSystem, this.passiveManager);
    this.cascadeSystem.setPassiveManager(this.passiveManager);

    // Apply round-start modifier bonuses (Kindling, Headstart, Synergy, etc.)
    this.passiveManager.onRoundStart();

    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    const barY = GAME_CONFIG.gridOffsetY + GAME_CONFIG.gridRows * cellSize + 8;
    this.inventoryPanelY = barY;

    // Power drawer (slides up from bottom with full detail)
    this.powerDrawer = new PowerDrawer(this, this.ownedPowerUps, {
      onActivatePowerUp: (id) => this.hudManager.activateById(id),
    });
    this.hudManager.setDrawer(this.powerDrawer);

    // Power panel (circles + passive lists below grid)
    this.inventoryBar = new InventoryBar(this, this.ownedPowerUps, barY, {
      onActivatePowerUp: (id) => this.hudManager.activateById(id),
      onOpenDrawer: () => this.hudManager.openDrawer(),
    });
    this.inventoryBar.create();
    this.hudManager.setInventoryBar(this.inventoryBar);

    // Explicitly destroy the inventory bar when this scene shuts down,
    // so its objects don't bleed into ShopScene or FailScene.
    this.events.once('shutdown', () => {
      this.inventoryBar.destroy();
    });
  }

  // ──────────────── GameContext UI ────────────────

  updateTurnsDisplay(): void {
    const ratio = Math.max(0, this.turnsRemaining) / GAME_CONFIG.turnsPerRound;
    let color = '#ffffff';
    if (ratio <= 0.15) color = '#ff4444';
    else if (ratio <= 0.25) color = '#ff8844';
    else if (ratio <= 0.5) color = '#ffcc44';
    this.turnCountText.setText(`${this.turnsRemaining} / ${GAME_CONFIG.turnsPerRound}`);
    this.turnCountText.setColor(color);
    this.redrawTurnDrainBar();
    this.updateShopButton();

    // Pulse at low turns
    if (this.turnsRemaining <= 2 && this.turnsRemaining > 0) {
      this.tweens.add({
        targets: this.turnCountText,
        scaleX: 1.2, scaleY: 1.2,
        duration: 100,
        yoyo: true,
        ease: 'Power1',
      });
    }
  }

  // ──────────────── FEEDBACK ────────────────

  /**
   * Spawn a floating damage number at a world position that floats upward and fades out.
   * element: the attacking element for color coding (null = match/no element).
   * isEnemy: true when hitting an enemy — uses a larger font.
   */
  showDamageNumber(worldX: number, worldY: number, amount: number, element: string | null = null, isEnemy = false): void {
    const ELEMENT_COLORS: Record<string, string> = {
      fire:      '#ff4422',
      water:     '#44aaff',
      earth:     '#cc8833',
      air:       '#cceeff',
      lightning: '#ffee00',
    };

    const color = element ? (ELEMENT_COLORS[element] ?? '#ffffff') : '#ffffff';
    const fontSize = isEnemy ? '30px' : '20px';
    const strokeThickness = isEnemy ? 4 : 3;
    const floatDist = isEnemy ? 70 : 50;
    const duration = isEnemy ? 1100 : 850;

    // Slight random horizontal drift so stacked numbers don't overlap
    const driftX = (Math.random() - 0.5) * 20;

    const text = this.add.text(worldX, worldY, `-${amount}`, {
      fontSize,
      color,
      fontFamily: 'Arial',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness,
    }).setOrigin(0.5, 0.5).setDepth(50);

    // Pop scale then float up and fade
    this.tweens.add({
      targets: text,
      scaleX: { from: 1.4, to: 1 },
      scaleY: { from: 1.4, to: 1 },
      duration: 120,
      ease: 'Back.easeOut',
    });

    this.tweens.add({
      targets: text,
      x: worldX + driftX,
      y: worldY - floatDist,
      alpha: { from: 1, to: 0 },
      duration,
      ease: 'Power2',
      delay: 100,
      onComplete: () => text.destroy(),
    });
  }

  flashPowerActivation(): void {
    // flash removed
  }

  updateEnemyDisplay(): void {
    if (!this.enemyValueText) return;
    const remaining = this.enemyManager.getRemainingCount();
    this.enemyValueText.setText(`${remaining}`);
    this.enemyValueText.setColor(remaining === 0 ? '#44cc44' : '#ff6644');
  }

  getRandomGemType(): GemType {
    const types = GAME_CONFIG.gemTypes;
    return types[Math.floor(Math.random() * types.length)];
  }

  findMatches(): { row: number; col: number }[] {
    return this.grid.findMatches((r, c) => this.hazardManager.hasHazard(r, c));
  }

  delay(ms: number): Promise<void> {
    return new Promise(resolve => this.time.delayedCall(ms, resolve));
  }

  // ──────────────── HUD ────────────────

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
    panel.fillRoundedRect(GAME_CONFIG.gridOffsetX - margin, GAME_CONFIG.gridOffsetY - margin, gridW + margin * 2, gridH + margin * 2, 8);
    panel.lineStyle(1, 0x222244, 0.5);
    panel.strokeRoundedRect(GAME_CONFIG.gridOffsetX - margin, GAME_CONFIG.gridOffsetY - margin, gridW + margin * 2, gridH + margin * 2, 8);
    panel.setDepth(-1);
  }

  private drawHUDBar(): void {
    const hudBar = this.add.graphics();
    hudBar.fillStyle(0x111122, 1);
    hudBar.fillRect(0, 0, GAME_CONFIG.width, 80);
    hudBar.lineStyle(1, 0x333355, 0.7);
    hudBar.lineBetween(0, 80, GAME_CONFIG.width, 80);
    hudBar.setDepth(10);

    this.turnDrainBar = this.add.graphics();
    this.turnDrainBar.setDepth(11);

    // ROUND
    this.add.text(75, 12, 'ROUND', { fontSize: '11px', color: '#6666aa', fontFamily: 'Arial', fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(11);
    this.add.text(75, 28, `${this.round}`, { fontSize: '32px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(11);

    // ENEMIES
    this.add.text(225, 12, 'ENEMIES', { fontSize: '11px', color: '#6666aa', fontFamily: 'Arial', fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(11);
    this.enemyValueText = this.add.text(225, 28, '?', { fontSize: '32px', color: '#ff6644', fontFamily: 'Arial', fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(11);

    // TURNS
    this.add.text(375, 12, 'TURNS', { fontSize: '11px', color: '#6666aa', fontFamily: 'Arial', fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(11);
    this.turnCountText = this.add.text(375, 28, `${this.turnsRemaining} / ${GAME_CONFIG.turnsPerRound}`, { fontSize: '28px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(11);

    // Shop button
    this.shopButtonBg = this.add.graphics();
    this.shopButtonBg.setDepth(12);
    this.drawShopButtonBg(false);

    this.shopButtonLabel = this.add.text(586, 22, 'GO TO SHOP', { fontSize: '14px', color: '#555577', fontFamily: 'Arial', fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(13);
    this.shopButtonSub = this.add.text(586, 44, 'KILL ALL ENEMIES', { fontSize: '11px', color: '#444466', fontFamily: 'Arial' }).setOrigin(0.5, 0).setDepth(13);

    this.shopButtonZone = this.add.zone(586, 40, 258, 68).setDepth(13).disableInteractive();
    this.shopButtonZone.on('pointerdown', () => this.onShopButtonClick());

    this.redrawTurnDrainBar();
  }

  private drawShopButtonBg(active: boolean): void {
    this.shopButtonBg.clear();
    if (active) {
      this.shopButtonBg.fillStyle(0x0d2218, 1);
      this.shopButtonBg.fillRoundedRect(452, 6, 258, 68, 8);
      this.shopButtonBg.lineStyle(1, 0x44cc88, 0.9);
      this.shopButtonBg.strokeRoundedRect(452, 6, 258, 68, 8);
    } else {
      this.shopButtonBg.fillStyle(0x151520, 0.7);
      this.shopButtonBg.fillRoundedRect(452, 6, 258, 68, 8);
      this.shopButtonBg.lineStyle(1, 0x333355, 0.5);
      this.shopButtonBg.strokeRoundedRect(452, 6, 258, 68, 8);
    }
  }

  updateShopButton(): void {
    if (!this.shopButtonBg) return;
    const enemiesDead = this.enemyManager?.allEnemiesDead() ?? false;
    if (enemiesDead) {
      this.drawShopButtonBg(true);
      this.shopButtonLabel.setColor('#44cc88');
      this.shopButtonSub.setText('Enemies Cleared!').setColor('#aaffcc');
      this.shopButtonZone.setInteractive({ useHandCursor: true });
    } else {
      this.drawShopButtonBg(false);
      this.shopButtonLabel.setColor('#555577');
      this.shopButtonSub.setText('KILL ALL ENEMIES').setColor('#444466');
      this.shopButtonZone.disableInteractive();
    }
  }

  private onShopButtonClick(): void {
    // Hard guard — never allow endRound unless enemies are truly cleared
    if (!this.enemyManager.allEnemiesDead()) return;
    if (this.isSwapping) return;
    this.endRound();
  }

  private redrawTurnDrainBar(): void {
    const ratio = Math.max(0, this.turnsRemaining) / GAME_CONFIG.turnsPerRound;
    let barColor = 0xffffff;
    if (ratio <= 0.15) barColor = 0xff4444;
    else if (ratio <= 0.25) barColor = 0xff8844;
    else if (ratio <= 0.5) barColor = 0xffcc44;
    this.turnDrainBar.clear();
    this.turnDrainBar.fillStyle(0x222233, 1);
    this.turnDrainBar.fillRect(0, 76, GAME_CONFIG.width, 4);
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
        gem.sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onGemPointerDown(gem, pointer));
      }
    }
  }

  // ──────────────── INPUT ────────────────

  onGemClick(gem: Gem): void {
    if (this.isSwapping) return;
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
      if (
        this.hazardManager.hasHazard(this.selectedGem.gridRow, this.selectedGem.gridCol) ||
        this.hazardManager.hasHazard(gem.gridRow, gem.gridCol)
      ) {
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

    // Valid match — consume a turn (Sturdy passive may save it)
    const turnResult = this.passiveManager.onTurnConsumed();
    if (!turnResult.turnSaved) this.turnsRemaining--;
    if (turnResult.bonusTurn) this.turnsRemaining++;
    this.updateTurnsDisplay();

    await this.cascadeSystem.processCascade(matches, 1);

    // Fire streak update
    if (this.hadFireMatchThisTurn) {
      this.fireStreakCount++;
      this.fireStreakMissedTurns = 0;
    } else if (this.ownedModifiers.includes('fire_heat_retention') && this.fireStreakMissedTurns < 1) {
      this.fireStreakMissedTurns++;
      // streak preserved by grace period
    } else if (this.ownedModifiers.includes('fire_wildfire') && this.fireStreakCount > 0) {
      this.fireStreakCount = Math.max(1, this.fireStreakCount - 1);
      this.fireStreakMissedTurns = 0;
    } else {
      this.fireStreakCount = 0;
      this.fireStreakMissedTurns = 0;
    }
    this.hadFireMatchThisTurn = false;

    // Earth patience: +1 (or +2 with Patient Earth) per turn without firing earthquake
    if (!this.earthquakeFiredThisTurn) {
      const eq = this.ownedPowerUps.find(p => p.powerUpId === 'earthquake');
      if (eq) {
        const gain = this.ownedModifiers.includes('earth_patient_earth') ? 2 : 1;
        eq.multiplierPool += gain;
      }
    }
    this.earthquakeFiredThisTurn = false;


    const firedIntents = await this.enemyManager.processTurnEnd();
    await this.processEnemyIntents(firedIntents);
    await this.hazardManager.processTurnEnd();

    // Bedrock: if last turn and earthquake has 10+ mult, grant 5 more turns (once per round)
    if (this.turnsRemaining <= 0 && !this.bedrockUsedThisRound && this.ownedModifiers.includes('earth_bedrock')) {
      const eq = this.ownedPowerUps.find(p => p.powerUpId === 'earthquake');
      if (eq && Math.max(1, eq.multiplierPool) >= 10) {
        this.turnsRemaining = 5;
        this.bedrockUsedThisRound = true;
        this.updateTurnsDisplay();
      }
    }

    this.hudManager.updateHudCharges();
    this.updateEnemyDisplay();
    this.updateShopButton();

    this.isSwapping = false;

    if (this.turnsRemaining <= 0) {
      await this.checkEndCondition();
    }
  }

  /**
   * Route fired enemy intents to their effects.
   * Handles: shock (halve effect), discharge (backfire), faraday shield (block heal/shield).
   */
  private async processEnemyIntents(firedIntents: FiredIntent[]): Promise<void> {
    if (firedIntents.length > 0) {
      // Lightning: +2 multiplier per intent fired
      const lightningPower = this.ownedPowerUps.find(p => p.powerUpId === 'chainstrike');
      if (lightningPower) lightningPower.multiplierPool += 2 * firedIntents.length;
    }

    for (const { enemy, intent } of firedIntents) {
      // Faraday Shield: block the first heal or shield intent
      if (this.passiveManager.shouldBlockIntentForFaraday(intent.id)) {
        this.hudManager.updateHudCharges();
        continue;
      }

      // Discharge: backfire this intent
      if (enemy.discharged) {
        enemy.discharged = false;
        await this.processDischargedIntent(enemy, intent.id);
        continue;
      }

      // Shock: halve effect (round down); clear shock after use
      const shocked = enemy.shocked;
      if (shocked) enemy.shocked = false;

      switch (intent.id) {
        case 'spawnIce':
        case 'spawnStone':
        case 'spreadVines': {
          if (shocked) break; // floor(1 × 0.5) = 0, skip spawn
          const typeMap: Record<string, string> = { spawnIce: 'ice', spawnStone: 'stone', spreadVines: 'thornVine' };
          this.hazardManager.spawnHazardNearEnemy(enemy, typeMap[intent.id]);
          break;
        }
        case 'regenerate': {
          const healAmt = shocked
            ? Math.floor(enemy.maxHp * 0.125) // 50% of normal 25%
            : Math.ceil(enemy.maxHp * 0.25);
          enemy.heal(healAmt);
          break;
        }
        case 'drainCharge': {
          const activePowers = this.ownedPowerUps.filter(p => {
            const def = getPowerUpDef(p.powerUpId);
            return def?.category === 'activePower' && p.base > 0;
          });
          if (activePowers.length > 0) {
            const target = activePowers[Math.floor(Math.random() * activePowers.length)];
            if (shocked) {
              // Halve drain: remove 50% of base only
              target.base = Math.floor(target.base * 0.5);
            } else {
              target.base = 0;
              target.multiplierPool = 0;
            }
            this.hudManager.updateHudCharges();
            this.hudManager.shakeCard(target.powerUpId);
          }
          break;
        }
        case 'shield': {
          if (shocked) break; // shock cancels shield intent
          const shieldTarget = this.enemyManager.getAdjacentEnemy(enemy) ?? enemy;
          shieldTarget.applyShield();
          break;
        }
      }
    }
  }

  /** Backfire a discharged enemy's intent (spawn→destroy hazard, heal→damage self). */
  private async processDischargedIntent(enemy: import('../entities/Enemy.ts').Enemy, intentId: string): Promise<void> {
    switch (intentId) {
      case 'spawnIce':
      case 'spawnStone':
      case 'spreadVines': {
        // Destroy a random existing hazard
        const hazardPositions: { row: number; col: number }[] = [];
        for (let r = 0; r < this.grid.rows; r++) {
          for (let c = 0; c < this.grid.cols; c++) {
            if (this.hazardManager.hasHazard(r, c)) hazardPositions.push({ row: r, col: c });
          }
        }
        if (hazardPositions.length > 0) {
          const pos = hazardPositions[Math.floor(Math.random() * hazardPositions.length)];
          await this.hazardManager.destroyHazardAt(pos.row, pos.col);
        }
        break;
      }
      case 'regenerate': {
        // Heal intent backfires: deal 25% maxHP damage to the enemy instead
        const dmg = Math.ceil(enemy.maxHp * 0.25);
        await this.enemyManager.damageEnemy(enemy, dmg, null);
        break;
      }
      default:
        break;
    }
  }

  private async checkEndCondition(): Promise<void> {
    if (this.enemyManager.allEnemiesDead()) {
      await this.endRound();
      return;
    }
    // Turns exhausted with enemies still alive = lose
    await this.endRound();
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

    const success = this.enemyManager.allEnemiesDead();

    if (DEBUG_CONFIG.debugStats) {
      StatsLogger.logRound({
        runId: this.runId,
        round: this.round,
        timestamp: Date.now(),
        win: success,
        modifier: null,
        essenceEarned: 0,
        gemsDestroyed: 0,
        match3Count: 0,
        match4Count: 0,
        match5Count: 0,
        hazardsCleared: this.roundHazardsCleared,
        enemiesKilled: this.roundEnemiesKilled,
        turnsUsed: GAME_CONFIG.turnsPerRound - Math.max(0, this.turnsRemaining),
        powerUsesByPower: { ...this.roundPowerUses },
      });
    }

    const runState: RunState = {
      round: this.round,
      ownedPowerUps: this.ownedPowerUps.map(p => ({ ...p })),
      ownedModifiers: this.ownedModifiers,
      runId: this.runId,
    };

    if (success) {
      this.scene.start('ShopScene', { ...runState, round: this.round + 1 });
    } else {
      this.scene.start('FailScene', runState);
    }
  }

  private trackPowerUse(id: string): void {
    if (!DEBUG_CONFIG.debugStats) return;
    this.roundPowerUses[id] = (this.roundPowerUses[id] ?? 0) + 1;
  }

  // ──────────────── DRAG INPUT ────────────────

  setupDragInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onScenePointerDown(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onScenePointerMove(pointer));
    this.input.on('pointerup',   (pointer: Phaser.Input.Pointer) => this.onScenePointerUp(pointer));
  }

  onScenePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.powerDrawer?.isVisible) return;
    if (pointer.y >= this.inventoryPanelY) return;  // inventory panel area
    if (this.isSwapping) return;
    const activePowerUpId = this.hudManager.getActivePowerUpId();
    if (!activePowerUpId) return;
    const def = getPowerUpDef(activePowerUpId);
    if (!def?.needsTarget) return;

    // Calculate grid cell from screen position
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    const col = Math.floor((pointer.x - GAME_CONFIG.gridOffsetX) / cellSize);
    const row = Math.floor((pointer.y - GAME_CONFIG.gridOffsetY) / cellSize);

    if (row < 0 || row >= this.grid.rows || col < 0 || col >= this.grid.cols) return;
    if (!this.grid.isEnemyTile(row, col)) return; // gem clicks are handled by gem sprites

    this.trackPowerUse(activePowerUpId);
    this.powerUpExecutor.executeTargetedPowerUp(activePowerUpId, row, col);
  }

  onGemPointerDown(gem: Gem, pointer: Phaser.Input.Pointer): void {
    if (this.powerDrawer?.isVisible) return;
    if (pointer.y >= this.inventoryPanelY) return;  // inventory panel area
    if (this.isSwapping) return;

    const activePowerUpId = this.hudManager.getActivePowerUpId();
    if (activePowerUpId) {
      const def = getPowerUpDef(activePowerUpId);
      if (def?.needsTarget) {
        this.trackPowerUse(activePowerUpId);
        this.powerUpExecutor.executeTargetedPowerUp(activePowerUpId, gem.gridRow, gem.gridCol);
        return;
      }
    }

    this.dragStartGem = gem;
    this.dragStartX = pointer.x;
    this.dragStartY = pointer.y;
  }

  onScenePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.powerDrawer?.isVisible) return;
    if (!this.dragStartGem || this.isSwapping || this.turnsRemaining <= 0) return;

    const dx = pointer.x - this.dragStartX;
    const dy = pointer.y - this.dragStartY;
    if (Math.sqrt(dx * dx + dy * dy) < GameScene.DRAG_THRESHOLD) return;

    const gem = this.dragStartGem;
    this.dragStartGem = null;

    let targetRow = gem.gridRow;
    let targetCol = gem.gridCol;
    if (Math.abs(dx) >= Math.abs(dy)) targetCol += dx > 0 ? 1 : -1;
    else targetRow += dy > 0 ? 1 : -1;

    if (targetRow < 0 || targetRow >= this.grid.rows || targetCol < 0 || targetCol >= this.grid.cols) return;
    if (this.grid.isEnemyTile(targetRow, targetCol)) return;

    const targetGem = this.grid.getGem(targetRow, targetCol);
    if (!targetGem) return;

    if (
      this.hazardManager.hasHazard(gem.gridRow, gem.gridCol) ||
      this.hazardManager.hasHazard(targetRow, targetCol)
    ) return;

    if (this.selectedGem) { this.selectedGem.deselect(); this.selectedGem = null; }
    this.handleSwap(gem, targetGem);
  }

  onScenePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.powerDrawer?.isVisible) return;
    if (pointer.y >= this.inventoryPanelY) return;  // inventory panel area
    if (!this.dragStartGem) return;
    const gem = this.dragStartGem;
    this.dragStartGem = null;
    const dx = pointer.x - this.dragStartX;
    const dy = pointer.y - this.dragStartY;
    if (Math.sqrt(dx * dx + dy * dy) < GameScene.DRAG_THRESHOLD) this.onGemClick(gem);
  }

  // ──────────────── DEBUG ────────────────

  setupDebugKeys(): void {
    if (!this.input.keyboard) return;
    this.input.keyboard.on('keydown-D', () => this.toggleDebugGrid());
    this.input.keyboard.on('keydown-R', () => this.resetGame());
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.hudManager.getActivePowerUpId()) this.hudManager.cancelTargeting();
    });
  }

  toggleDebugGrid(): void {
    if (!this.debugGraphics) this.debugGraphics = this.add.graphics();
    this.debugVisible = !this.debugVisible;
    this.debugGraphics.clear();
    if (!this.debugVisible) return;

    this.debugGraphics.lineStyle(1, 0x00ff00, 0.5);
    const cellSize = GAME_CONFIG.gemSize + GAME_CONFIG.gemPadding;
    for (let row = 0; row <= GAME_CONFIG.gridRows; row++) {
      const y = GAME_CONFIG.gridOffsetY + row * cellSize;
      this.debugGraphics.lineBetween(GAME_CONFIG.gridOffsetX, y, GAME_CONFIG.gridOffsetX + GAME_CONFIG.gridCols * cellSize, y);
    }
    for (let col = 0; col <= GAME_CONFIG.gridCols; col++) {
      const x = GAME_CONFIG.gridOffsetX + col * cellSize;
      this.debugGraphics.lineBetween(x, GAME_CONFIG.gridOffsetY, x, GAME_CONFIG.gridOffsetY + GAME_CONFIG.gridRows * cellSize);
    }
  }

  createDebugButtons(): void {
    const btnY = 90;

    const shopText = this.add.text(GAME_CONFIG.width - 50, btnY, 'Shop', {
      fontSize: '14px', color: '#888888', fontFamily: 'Arial', backgroundColor: '#222222', padding: { x: 6, y: 4 },
    }).setOrigin(0.5, 0.5).setDepth(12);
    shopText.setInteractive({ useHandCursor: true });
    shopText.on('pointerdown', () => {
      // Debug: force-kill all enemies and end round
      this.enemyManager.destroyAll();
      this.updateEnemyDisplay();
      this.endRound();
    });
    shopText.on('pointerover', () => shopText.setColor('#ffffff'));
    shopText.on('pointerout',  () => shopText.setColor('#888888'));

    if (DEBUG_CONFIG.debugStats) {
      const statsText = this.add.text(GAME_CONFIG.width - 210, btnY, 'Stats', {
        fontSize: '14px', color: '#aaaaaa', fontFamily: 'Arial', backgroundColor: '#1a1a2e', padding: { x: 6, y: 4 },
      }).setOrigin(0.5, 0.5).setDepth(12);
      statsText.setInteractive({ useHandCursor: true });
      statsText.on('pointerdown', () => {
        const json = StatsLogger.exportStats();
        // Open in a prompt so the user can copy the JSON
        window.prompt('Copy stats JSON:', json);
      });
      statsText.on('pointerover', () => statsText.setColor('#ffffff'));
      statsText.on('pointerout',  () => statsText.setColor('#aaaaaa'));
    }
  }

  resetGame(): void {
    this.scene.start('GameScene', {
      round: 0, ownedPowerUps: [], ownedModifiers: [],
    } satisfies RunState);
  }
}
