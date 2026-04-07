import type Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import { getPowerUpDef } from '../config/powerUps.ts';
import type { PowerUpDefinition } from '../config/powerUps.ts';
import type { OwnedPowerUp } from '../types/RunState.ts';

// ── Layout constants ──────────────────────────────────────────────────────────
const H_PAD    = 16;
const CIRCLE_R = 34;   // radius of each active-power circle
const LINE_H   = 22;   // height per passive text row

export interface InventoryBarOptions {
  onActivatePowerUp?: (id: string) => void;
  onOpenDrawer?: () => void;
}

interface CircleData {
  bg:            Phaser.GameObjects.Graphics;
  ring:          Phaser.GameObjects.Graphics;
  color:         number;
  cx:            number;
  cy:            number;
  isActiveTarget: boolean;
  hasBase:       boolean;
}

/**
 * InventoryBar — power display panel anchored directly below the grid.
 *
 * Active powers → coloured circles (element colour ring, name, level, charge pips).
 * Passive powers → left text column.
 * Stat passives  → right text column.
 * Tap any circle/row → open detail drawer (or activate if active + has charges).
 */
export class InventoryBar {
  private scene:         Phaser.Scene;
  private ownedPowerUps: OwnedPowerUp[];
  private panelY:        number;
  private options:       InventoryBarOptions;

  private elements:    Phaser.GameObjects.GameObject[] = [];
  private circleMap  = new Map<string, CircleData>();

  constructor(
    scene:         Phaser.Scene,
    ownedPowerUps: OwnedPowerUp[],
    panelY:        number,
    options:       InventoryBarOptions = {},
  ) {
    this.scene         = scene;
    this.ownedPowerUps = ownedPowerUps;
    this.panelY        = panelY;
    this.options       = options;
  }

  create(): void { this.renderPanel(); }

  refresh(ownedPowerUps: OwnedPowerUp[]): void {
    this.ownedPowerUps = ownedPowerUps;
    this.destroyElements();
    this.circleMap.clear();
    this.renderPanel();
  }

  destroy(): void {
    this.destroyElements();
    this.circleMap.clear();
  }

  /** Highlight the circle of the given active power (targeting mode). */
  setActiveCard(id: string | null): void {
    for (const [chipId, data] of this.circleMap) {
      const active = chipId === id;
      data.isActiveTarget = active;
      this.paintCircle(data.bg, data.ring, data.cx, data.cy, data.color, active, false);
    }
  }

  /** Shake a circle when its charge is drained to zero. */
  shakeCard(id: string): void {
    const data = this.circleMap.get(id);
    if (!data) return;
    const targets = [data.bg, data.ring];
    const originX = data.cx;
    const offsets = [6, -6, 4, -4, 2, -2, 0];
    offsets.forEach((dx, i) => {
      this.scene.time.delayedCall(i * 40, () => {
        for (const t of targets) t.x = originX + dx;
      });
    });
  }

  /** Flash a circle when a power fires. */
  flashCard(id: string): void {
    const data = this.circleMap.get(id);
    if (!data) return;

    const flash = this.scene.add.graphics();
    flash.fillStyle(data.color, 0.5);
    flash.fillCircle(data.cx, data.cy, CIRCLE_R + 8);
    flash.setDepth(57);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 550,
      ease: 'Power2',
      onComplete: () => flash.destroy(),
    });
  }

  // ── RENDER ────────────────────────────────────────────────────────────────

  private renderPanel(): void {
    const W        = GAME_CONFIG.width;
    const actives  = this.ownedPowerUps.filter(p => getPowerUpDef(p.powerUpId)?.category === 'activePower');
    const passives = this.ownedPowerUps.filter(p => getPowerUpDef(p.powerUpId)?.category === 'passivePower');
    const stats    = this.ownedPowerUps.filter(p => getPowerUpDef(p.powerUpId)?.category === 'passive');

    // ── Panel background (fills screen below grid) ──────────────────────────
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x07070f, 0.97);
    bg.fillRect(0, this.panelY, W, GAME_CONFIG.height - this.panelY);
    bg.lineStyle(2, 0x3333aa, 0.75);
    bg.lineBetween(0, this.panelY, W, this.panelY);
    bg.lineStyle(1, 0x1e1e44, 0.4);
    bg.lineBetween(0, this.panelY + 2, W, this.panelY + 2);
    bg.setDepth(50);
    this.elements.push(bg);

    if (this.ownedPowerUps.length === 0) {
      const t = this.scene.add.text(W / 2, this.panelY + 30, 'No powers yet — visit the shop!', {
        fontSize: '13px', color: '#333355', fontFamily: 'Arial', fontStyle: 'italic',
      });
      t.setOrigin(0.5, 0).setDepth(51);
      this.elements.push(t);
      return;
    }

    let curY = this.panelY + 10;

    // ── Active power circles ─────────────────────────────────────────────────
    if (actives.length > 0) {
      const circleTopLabel = this.scene.add.text(W / 2, curY, 'ACTIVE POWERS', {
        fontSize: '9px', color: '#333355', fontFamily: 'Arial', fontStyle: 'bold',
      });
      circleTopLabel.setOrigin(0.5, 0).setDepth(51);
      this.elements.push(circleTopLabel);
      curY += 13;

      const cy    = curY + CIRCLE_R;
      const n     = actives.length;
      const slotW = (W - H_PAD * 2) / n;

      for (let i = 0; i < n; i++) {
        const cx = H_PAD + slotW * i + slotW / 2;
        this.renderActiveCircle(actives[i], cx, cy, slotW);
      }

      // Labels below circles (name / level / pips)
      curY = cy + CIRCLE_R + 5;
      curY = this.renderActiveLabels(actives, curY, slotW);
    }

    // ── Passive section ──────────────────────────────────────────────────────
    const hasPassives = passives.length > 0 || stats.length > 0;
    if (hasPassives) {
      if (actives.length > 0) {
        const div = this.scene.add.graphics();
        div.lineStyle(1, 0x181830, 1);
        div.lineBetween(H_PAD, curY + 6, W - H_PAD, curY + 6);
        div.setDepth(51);
        this.elements.push(div);
        curY += 14;
      }
      curY = this.renderPassiveColumns(passives, stats, W, curY);
    }

    // ── Footer hint ──────────────────────────────────────────────────────────
    const hint = this.scene.add.text(W / 2, curY + 5, '▸ Tap any power for full details', {
      fontSize: '10px', color: '#252540', fontFamily: 'Arial',
    });
    hint.setOrigin(0.5, 0).setDepth(51);
    this.elements.push(hint);
  }

  // ── Active circles ────────────────────────────────────────────────────────

  private renderActiveCircle(
    owned: OwnedPowerUp,
    cx: number, cy: number, slotW: number,
  ): void {
    const def        = getPowerUpDef(owned.powerUpId);
    if (!def) return;

    const gemType  = GAME_CONFIG.gemTypes.find(g => g.name === def.element);
    const color    = gemType?.color ?? 0x888888;
    const hasBase  = owned.base > 0;
    const mult     = Math.max(1, owned.multiplierPool);

    // Circle fill
    const circleBg = this.scene.add.graphics();
    circleBg.setDepth(51);

    // Element ring
    const ring = this.scene.add.graphics();
    ring.setDepth(52);

    this.paintCircle(circleBg, ring, cx, cy, color, false, false);
    this.elements.push(circleBg, ring);

    // Dim overlay when no base damage
    if (!hasBase) {
      const overlay = this.scene.add.graphics().setDepth(53);
      overlay.fillStyle(0x000000, 0.55);
      overlay.fillCircle(cx, cy, CIRCLE_R);
      this.elements.push(overlay);
    }

    // Base damage inside the circle
    const hexColor = '#' + color.toString(16).padStart(6, '0');
    const baseText = this.scene.add.text(cx, cy - 6, `${owned.base}`, {
      fontSize: '22px',
      color: hasBase ? hexColor : '#555566',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0.5).setDepth(54);
    this.elements.push(baseText);

    // Multiplier below base
    const multText = this.scene.add.text(cx, cy + 12, `×${mult}`, {
      fontSize: '12px',
      color: mult > 1 ? '#ffdd88' : '#444455',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(54);
    this.elements.push(multText);

    // Store for setActiveCard / flashCard
    this.circleMap.set(owned.powerUpId, {
      bg: circleBg, ring, color, cx, cy,
      isActiveTarget: false, hasBase,
    });

    // Circle zone — activate only if base > 0
    const circleZone = this.scene.add.zone(cx, cy, slotW * 0.92, CIRCLE_R * 2);
    circleZone.setInteractive({ useHandCursor: hasBase });
    circleZone.setDepth(56);
    this.elements.push(circleZone);

    circleZone.on('pointerover', () => {
      const d = this.circleMap.get(owned.powerUpId);
      if (d && !d.isActiveTarget) this.paintCircle(d.bg, d.ring, d.cx, d.cy, d.color, false, true);
    });
    circleZone.on('pointerout', () => {
      const d = this.circleMap.get(owned.powerUpId);
      if (d && !d.isActiveTarget) this.paintCircle(d.bg, d.ring, d.cx, d.cy, d.color, false, false);
    });
    circleZone.on('pointerdown', () => {
      if (hasBase) this.options.onActivatePowerUp?.(owned.powerUpId);
    });
  }

  /** Renders name / level below circles. Returns new curY. */
  private renderActiveLabels(
    actives: OwnedPowerUp[],
    startY:  number,
    slotW:   number,
  ): number {
    let bottom = startY;

    for (let i = 0; i < actives.length; i++) {
      const owned = actives[i];
      const def   = getPowerUpDef(owned.powerUpId);
      if (!def) continue;

      const cx = H_PAD + slotW * i + slotW / 2;

      // Name
      const nameT = this.scene.add.text(cx, startY, def.name, {
        fontSize: '11px', color: '#c8c8ee', fontFamily: 'Arial', fontStyle: 'bold',
      });
      nameT.setOrigin(0.5, 0).setDepth(52);
      this.elements.push(nameT);

      // Category label
      const lvT = this.scene.add.text(cx, startY + 15, def.element.toUpperCase(), {
        fontSize: '10px', color: '#4a4a6a', fontFamily: 'Arial',
      });
      lvT.setOrigin(0.5, 0).setDepth(52);
      this.elements.push(lvT);

      // Tap zone — opens drawer
      const labelZone = this.scene.add.zone(cx, startY + 13, slotW * 0.9, 36);
      labelZone.setInteractive({ useHandCursor: true });
      labelZone.setDepth(56);
      labelZone.on('pointerdown', () => this.options.onOpenDrawer?.());
      this.elements.push(labelZone);

      bottom = Math.max(bottom, startY + 30);
    }

    return bottom;
  }

  // ── Passive columns ───────────────────────────────────────────────────────

  private renderPassiveColumns(
    passives: OwnedPowerUp[],
    stats:    OwnedPowerUp[],
    W:        number,
    startY:   number,
  ): number {
    const colW  = (W - H_PAD * 2) / 2;
    let leftY   = startY;
    let rightY  = startY;

    // Left column: passive powers
    if (passives.length > 0) {
      const lh = this.scene.add.text(H_PAD, leftY, 'PASSIVE POWERS', {
        fontSize: '9px', color: '#333355', fontFamily: 'Arial', fontStyle: 'bold',
      });
      lh.setOrigin(0, 0).setDepth(51);
      this.elements.push(lh);
      leftY += 14;

      for (const owned of passives) {
        const def = getPowerUpDef(owned.powerUpId);
        if (!def) continue;
        leftY = this.renderPassiveRow(owned, def, H_PAD, leftY, colW);
      }
    }

    // Right column: stat passives
    if (stats.length > 0) {
      const rh = this.scene.add.text(H_PAD + colW, rightY, 'STAT PASSIVES', {
        fontSize: '9px', color: '#333355', fontFamily: 'Arial', fontStyle: 'bold',
      });
      rh.setOrigin(0, 0).setDepth(51);
      this.elements.push(rh);
      rightY += 14;

      for (const owned of stats) {
        const def = getPowerUpDef(owned.powerUpId);
        if (!def) continue;
        rightY = this.renderPassiveRow(owned, def, H_PAD + colW, rightY, colW);
      }
    }

    return Math.max(leftY, rightY);
  }

  private renderPassiveRow(
    _owned:  OwnedPowerUp,
    def:     PowerUpDefinition,
    colX:    number,
    rowY:    number,
    colW:    number,
  ): number {
    const gemType = GAME_CONFIG.gemTypes.find(g => g.name === def.element);
    const color   = gemType?.color ?? 0x888888;

    // Element dot
    const dot = this.scene.add.graphics();
    dot.fillStyle(color, 0.85);
    dot.fillCircle(colX + 5, rowY + 8, 3);
    dot.setDepth(51);
    this.elements.push(dot);

    // Name
    const t = this.scene.add.text(colX + 14, rowY, def.name, {
      fontSize: '11px', color: '#5a5a88', fontFamily: 'Arial',
    });
    t.setOrigin(0, 0).setDepth(51);
    this.elements.push(t);

    // Tap zone
    const zone = this.scene.add.zone(colX + colW / 2, rowY + LINE_H / 2, colW - 4, LINE_H);
    zone.setInteractive({ useHandCursor: true });
    zone.setDepth(56);
    zone.on('pointerdown', () => this.options.onOpenDrawer?.());
    this.elements.push(zone);

    return rowY + LINE_H;
  }

  // ── Circle drawing ────────────────────────────────────────────────────────

  private paintCircle(
    bg:     Phaser.GameObjects.Graphics,
    ring:   Phaser.GameObjects.Graphics,
    cx:     number, cy: number,
    color:  number,
    active: boolean,
    hover:  boolean,
  ): void {
    bg.clear();
    ring.clear();

    if (active) {
      bg.fillStyle(color, 0.22);
      bg.fillCircle(cx, cy, CIRCLE_R);
      ring.lineStyle(3, color, 1.0);
      ring.strokeCircle(cx, cy, CIRCLE_R);
      // Inner glow dot
      ring.fillStyle(color, 0.4);
      ring.fillCircle(cx, cy, 8);
    } else if (hover) {
      bg.fillStyle(0x141428, 1);
      bg.fillCircle(cx, cy, CIRCLE_R);
      ring.lineStyle(2, color, 0.65);
      ring.strokeCircle(cx, cy, CIRCLE_R);
    } else {
      bg.fillStyle(0x0c0c1e, 1);
      bg.fillCircle(cx, cy, CIRCLE_R);
      ring.lineStyle(1.5, color, 0.3);
      ring.strokeCircle(cx, cy, CIRCLE_R);
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  private destroyElements(): void {
    for (const el of this.elements) el.destroy();
    this.elements = [];
  }
}
