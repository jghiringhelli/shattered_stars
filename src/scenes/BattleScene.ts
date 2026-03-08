/**
 * Main battle scene - where the tactical combat happens
 */

import Phaser from 'phaser';
import { GameClock } from '../core/GameClock';
import { BattleManager, type BattleState, type BattleConfig } from '../core/BattleManager';
import {
  BATTLEFIELD_SIZE,
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_SPEED,
  FACTION_COLORS,
  SHIP_SIZES,
  type FactionId,
} from '../config';
import type { ShipState, ManeuverDefinition } from '../core/types';
import { getShipDefinition } from '../data/ShipDefinitions';

interface ShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
  shipBody: Phaser.GameObjects.Graphics;
  healthBar: Phaser.GameObjects.Graphics;
  selectionRing?: Phaser.GameObjects.Graphics;
}

export class BattleScene extends Phaser.Scene {
  private shipSprites: Map<string, ShipSprite> = new Map();
  private battleManager!: BattleManager;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  // UI Elements
  private phaseText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;
  private maneuverButtons: Phaser.GameObjects.Container[] = [];
  private targetButtons: Phaser.GameObjects.Container[] = [];
  private actionButtons: Phaser.GameObjects.Container[] = [];

  constructor() {
    super({ key: 'BattleScene' });
  }

  create(): void {
    // Set up the battlefield
    this.cameras.main.setBounds(0, 0, BATTLEFIELD_SIZE, BATTLEFIELD_SIZE);
    this.cameras.main.setBackgroundColor(0x0a0a1a);

    this.createStarfield();
    this.createBattlefieldGrid();
    this.setupInput();
    this.createHUD();

    // Start battle
    const config: BattleConfig = {
      playerFaction: 'free_confederation',
      enemyFaction: 'terran_hegemony',
      playerShips: ['confed_falcon', 'confed_sparrow', 'confed_sparrow'],
      enemyShips: ['terran_gladius', 'terran_viper', 'terran_viper'],
      seed: Date.now(),
    };

    this.battleManager = new BattleManager(config);
    this.battleManager.setOnStateChange((state) => this.onBattleStateChange(state));
    this.battleManager.setOnLog((msg) => this.addLogMessage(msg));

    // Create initial ship sprites
    const state = this.battleManager.getState();
    for (const ship of state.ships.values()) {
      this.createShipSprite(ship);
    }

    // Center camera
    this.cameras.main.centerOn(500, 500);
    this.cameras.main.setZoom(0.9);

    // Initial UI update
    this.onBattleStateChange(state);

    // Start game clock
    GameClock.start();
  }

  update(_time: number): void {
    this.handleInput();
    this.updateShipSprites();
  }

  private createStarfield(): void {
    const graphics = this.add.graphics();

    for (let i = 0; i < 300; i++) {
      const x = Phaser.Math.Between(0, BATTLEFIELD_SIZE);
      const y = Phaser.Math.Between(0, BATTLEFIELD_SIZE);
      const size = Phaser.Math.Between(1, 2);
      const alpha = Phaser.Math.FloatBetween(0.2, 0.8);

      graphics.fillStyle(0xffffff, alpha);
      graphics.fillCircle(x, y, size / 2);
    }
  }

  private createBattlefieldGrid(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x1a1a2a, 0.2);

    const gridSize = 100;
    for (let x = 0; x <= BATTLEFIELD_SIZE; x += gridSize) {
      graphics.lineBetween(x, 0, x, BATTLEFIELD_SIZE);
    }
    for (let y = 0; y <= BATTLEFIELD_SIZE; y += gridSize) {
      graphics.lineBetween(0, y, BATTLEFIELD_SIZE, y);
    }
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _deltaX: number, deltaY: number) => {
      const camera = this.cameras.main;
      const newZoom = Phaser.Math.Clamp(
        camera.zoom - deltaY * CAMERA_ZOOM_SPEED * 0.01,
        CAMERA_ZOOM_MIN,
        CAMERA_ZOOM_MAX
      );
      camera.setZoom(newZoom);
    });
  }

  private handleInput(): void {
    const camera = this.cameras.main;
    const cameraSpeed = 8 / camera.zoom;

    if (this.cursors.left.isDown) camera.scrollX -= cameraSpeed;
    if (this.cursors.right.isDown) camera.scrollX += cameraSpeed;
    if (this.cursors.up.isDown) camera.scrollY -= cameraSpeed;
    if (this.cursors.down.isDown) camera.scrollY += cameraSpeed;
  }

  private createHUD(): void {
    // Turn/Phase display
    this.turnText = this.add.text(10, 10, 'Turn 1', {
      font: 'bold 18px Arial',
      color: '#ffffff',
    }).setScrollFactor(0).setDepth(1000);

    this.phaseText = this.add.text(10, 35, 'Planning Phase', {
      font: '14px Arial',
      color: '#88ff88',
    }).setScrollFactor(0).setDepth(1000);

    // Instructions
    this.instructionText = this.add.text(10, 65, '', {
      font: '14px Arial',
      color: '#ffff88',
      wordWrap: { width: 300 },
    }).setScrollFactor(0).setDepth(1000);

    // Battle log
    this.logText = this.add.text(10, this.scale.height - 120, '', {
      font: '12px monospace',
      color: '#aaaaaa',
      wordWrap: { width: 400 },
    }).setScrollFactor(0).setDepth(1000);
  }

  private onBattleStateChange(state: BattleState): void {
    // Update turn/phase display
    this.turnText.setText(`Turn ${state.turnState.turnNumber}`);

    const phaseNames: Record<string, string> = {
      planning: 'Planning Phase',
      system: 'System Phase',
      activation: 'Activation Phase',
      engagement: 'Engagement Phase',
      end: 'End Phase',
    };
    this.phaseText.setText(phaseNames[state.turnState.currentPhase] ?? '');

    // Clear old UI
    this.clearManeuverUI();
    this.clearTargetUI();
    this.clearActionUI();

    // Show appropriate UI based on state
    if (state.waitingForPlayerInput === 'maneuver') {
      this.instructionText.setText('Select a maneuver for your ship:');
      this.showManeuverUI();
    } else if (state.waitingForPlayerInput === 'action') {
      this.instructionText.setText('Choose an action (or skip):');
      this.showActionUI();
    } else if (state.waitingForPlayerInput === 'target') {
      this.instructionText.setText('Select a target to attack:');
      this.showTargetUI();
    } else {
      this.instructionText.setText('');
    }

    // Update ship sprites
    this.updateShipSprites();
  }

  private addLogMessage(msg: string): void {
    const lines = this.logText.text.split('\n').slice(-5);
    lines.push(msg);
    this.logText.setText(lines.join('\n'));
  }

  private showManeuverUI(): void {
    const maneuvers = this.battleManager.getAvailableManeuvers();
    const grouped = this.groupManeuversBySpeed(maneuvers);

    let yOffset = 120;
    const xStart = 10;

    for (const [speed, speedManeuvers] of Object.entries(grouped)) {
      // Speed label
      this.add.text(xStart, yOffset, `Speed ${speed}:`, {
        font: 'bold 12px Arial',
        color: '#ffffff',
      }).setScrollFactor(0).setDepth(1000);

      yOffset += 20;
      let xOffset = xStart;

      for (const maneuver of speedManeuvers) {
        const btn = this.createButton(
          xOffset,
          yOffset,
          this.getManeuverLabel(maneuver),
          this.getManeuverColor(maneuver),
          () => {
            this.battleManager.selectManeuver(maneuver);
            this.battleManager.confirmManeuver();
          }
        );
        this.maneuverButtons.push(btn);
        xOffset += 70;
      }
      yOffset += 35;
    }
  }

  private groupManeuversBySpeed(maneuvers: ManeuverDefinition[]): Record<number, ManeuverDefinition[]> {
    const grouped: Record<number, ManeuverDefinition[]> = {};
    for (const m of maneuvers) {
      if (!grouped[m.speed]) grouped[m.speed] = [];
      grouped[m.speed]!.push(m);
    }
    return grouped;
  }

  private getManeuverLabel(m: ManeuverDefinition): string {
    const labels: Record<string, string> = {
      straight: '↑',
      bank_left: '↖',
      bank_right: '↗',
      turn_left: '←',
      turn_right: '→',
      kturn: '↩',
      segnor_left: '⤹',
      segnor_right: '⤸',
      tallon_left: '↰',
      tallon_right: '↱',
    };
    return labels[m.direction] ?? m.direction;
  }

  private getManeuverColor(m: ManeuverDefinition): number {
    switch (m.difficulty) {
      case 'green': return 0x44aa44;
      case 'white': return 0x888888;
      case 'red': return 0xaa4444;
      default: return 0x888888;
    }
  }

  private showActionUI(): void {
    const ship = this.battleManager.getPlayerShip();
    if (!ship) return;

    const def = getShipDefinition(ship.definitionId);
    if (!def) return;

    let yOffset = 120;
    const actions = def.baseStats.actions;

    for (const action of actions) {
      // Skip if already has token
      if (action === 'focus' && ship.hasFocus) continue;
      if (action === 'evade' && ship.hasEvade) continue;

      const btn = this.createButton(10, yOffset, action.toUpperCase(), 0x4488aa, () => {
        this.battleManager.performAction(action);
      });
      this.actionButtons.push(btn);
      yOffset += 35;
    }

    // Skip button
    const skipBtn = this.createButton(10, yOffset, 'SKIP', 0x666666, () => {
      this.battleManager.skipAction();
    });
    this.actionButtons.push(skipBtn);
  }

  private showTargetUI(): void {
    const targets = this.battleManager.getValidTargets();

    let yOffset = 120;

    for (const target of targets) {
      const def = getShipDefinition(target.definitionId);
      const label = `${def?.name ?? target.id} (${target.hull}/${target.maxHull})`;

      const btn = this.createButton(10, yOffset, label, 0xaa4444, () => {
        this.battleManager.selectTarget(target.id);
        this.battleManager.confirmAttack();
      });
      this.targetButtons.push(btn);
      yOffset += 35;
    }

    // Skip button
    const skipBtn = this.createButton(10, yOffset, 'SKIP ATTACK', 0x666666, () => {
      this.battleManager.skipAttack();
    });
    this.targetButtons.push(skipBtn);
  }

  private createButton(x: number, y: number, text: string, color: number, onClick: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    container.setScrollFactor(0);
    container.setDepth(1000);

    const bg = this.add.graphics();
    const width = Math.max(60, text.length * 8 + 16);
    bg.fillStyle(color, 0.8);
    bg.fillRoundedRect(0, 0, width, 28, 4);
    bg.lineStyle(2, 0xffffff, 0.5);
    bg.strokeRoundedRect(0, 0, width, 28, 4);

    const label = this.add.text(width / 2, 14, text, {
      font: 'bold 11px Arial',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);

    container.add([bg, label]);
    container.setSize(width, 28);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', onClick);
    container.on('pointerover', () => bg.setAlpha(1));
    container.on('pointerout', () => bg.setAlpha(0.8));

    return container;
  }

  private clearManeuverUI(): void {
    for (const btn of this.maneuverButtons) btn.destroy();
    this.maneuverButtons = [];
  }

  private clearTargetUI(): void {
    for (const btn of this.targetButtons) btn.destroy();
    this.targetButtons = [];
  }

  private clearActionUI(): void {
    for (const btn of this.actionButtons) btn.destroy();
    this.actionButtons = [];
  }

  private createShipSprite(ship: ShipState): void {
    const container = this.add.container(ship.x, ship.y) as ShipSprite;
    container.shipId = ship.id;

    // Ship body (triangle)
    const body = this.add.graphics();
    const color = FACTION_COLORS[ship.faction as FactionId] ?? 0xffffff;
    const size = SHIP_SIZES.small;

    body.fillStyle(color, 1);
    body.beginPath();
    body.moveTo(0, -size / 2);
    body.lineTo(-size / 3, size / 2);
    body.lineTo(size / 3, size / 2);
    body.closePath();
    body.fillPath();

    body.lineStyle(2, 0xffffff, 0.8);
    body.strokePath();

    container.shipBody = body;
    container.add(body);

    // Health bar
    const healthBar = this.add.graphics();
    container.healthBar = healthBar;
    container.add(healthBar);

    // Selection ring (hidden by default)
    if (ship.owner === 'player') {
      const ring = this.add.graphics();
      ring.lineStyle(2, 0xffff00, 0.8);
      ring.strokeCircle(0, 0, size * 0.8);
      ring.setVisible(true);
      container.selectionRing = ring;
      container.add(ring);
    }

    container.setAngle(ship.angle);
    container.setDepth(10);

    this.shipSprites.set(ship.id, container);
    this.updateShipHealthBar(ship, container);
  }

  private updateShipSprites(): void {
    const state = this.battleManager.getState();

    for (const [shipId, sprite] of this.shipSprites) {
      const ship = state.ships.get(shipId);

      if (!ship || ship.hull <= 0) {
        sprite.destroy();
        this.shipSprites.delete(shipId);
        continue;
      }

      // Lerp position for smooth movement
      const lerpFactor = 0.15;
      sprite.x += (ship.x - sprite.x) * lerpFactor;
      sprite.y += (ship.y - sprite.y) * lerpFactor;

      // Lerp angle
      let angleDiff = ship.angle - sprite.angle;
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;
      sprite.angle += angleDiff * lerpFactor;

      this.updateShipHealthBar(ship, sprite);

      // Highlight player ship
      if (sprite.selectionRing) {
        sprite.selectionRing.setVisible(ship.id === state.playerShipId);
      }
    }
  }

  private updateShipHealthBar(ship: ShipState, sprite: ShipSprite): void {
    const bar = sprite.healthBar;
    bar.clear();

    const barWidth = 36;
    const barHeight = 4;
    const barY = 24;

    // Background
    bar.fillStyle(0x333333, 0.9);
    bar.fillRect(-barWidth / 2, barY, barWidth, barHeight * 2 + 2);

    // Shields
    const shieldPct = ship.shields / ship.maxShields;
    bar.fillStyle(0x00bfff, 1);
    bar.fillRect(-barWidth / 2 + 1, barY + 1, (barWidth - 2) * shieldPct, barHeight);

    // Hull
    const hullPct = ship.hull / ship.maxHull;
    const hullColor = hullPct > 0.5 ? 0x44ff44 : hullPct > 0.25 ? 0xffff44 : 0xff4444;
    bar.fillStyle(hullColor, 1);
    bar.fillRect(-barWidth / 2 + 1, barY + barHeight + 2, (barWidth - 2) * hullPct, barHeight);

    // Token indicators
    let tokenX = -barWidth / 2;
    if (ship.hasFocus) {
      bar.fillStyle(0xff8800, 1);
      bar.fillCircle(tokenX, barY - 6, 4);
      tokenX += 10;
    }
    if (ship.hasEvade) {
      bar.fillStyle(0x00ff00, 1);
      bar.fillCircle(tokenX, barY - 6, 4);
      tokenX += 10;
    }
    if (ship.hasTargetLock) {
      bar.fillStyle(0xff0000, 1);
      bar.fillCircle(tokenX, barY - 6, 4);
    }
  }
}
