/**
 * Turn-Based Battle Scene
 *
 * X-Wing Miniatures style tactical combat:
 * 1. Planning Phase - Select maneuvers for all your ships
 * 2. Activation Phase - Ships move in pilot skill order (low to high)
 * 3. Combat Phase - Ships attack in pilot skill order (high to low)
 * 4. End Phase - Cleanup and start next turn
 */

import Phaser from 'phaser';
import seedrandom from 'seedrandom';
import { ShipStatCard } from '../ui/ShipStatCard';
import type { ShipState, ManeuverDefinition } from '../core/types';
import { OnlineTurnManager, type ManeuverPacket } from '../multiplayer/OnlineTurnManager';
import { networkService } from '../services/NetworkService';
import type { FactionId } from '../config';
import { BATTLEFIELD_SIZE, FACTION_COLORS, SHIP_SIZES } from '../config';
import { getShipDefinition, getShipDial } from '../data/ShipDefinitions';
import {
  getModeCombatStats,
  resolveTurnBasedAttack,
  type ModeCombatStats,
} from '../data/ModeBalancing';
import {
  createTurnState,
  planManeuver,
  startActivationPhase,
  getCurrentActivatingShip,
  revealManeuver,
  nextActivation,
  getCurrentCombatShip,
  nextCombat,
  endTurn,
  allShipsPlanned,
  getDifficultyColor,
  type TurnState,
} from '../systems/TurnManager';
import {
  getManeuverTemplate,
  applyManeuver,
  generateManeuverPath,
} from '../systems/ManeuverTemplates';
import { HealthBar } from '../ui/HealthBar';
import { Minimap, type MinimapShip } from '../ui/Minimap';
import { PauseMenu } from '../ui/PauseMenu';
import { GameOverScreen, type GameOverStats } from '../ui/GameOverScreen';
import { EffectsManager } from '../rendering/EffectsManager';
import { ParallaxBackground } from '../rendering/ParallaxBackground';
import { audioManager } from '../audio/AudioManager';
import {
  type AIDifficultyLevel,
  DIFFICULTY_SETTINGS,
  shouldPickOptimalManeuver,
} from '../ai/AIDifficulty';
import { renderBattleStarfield } from '../rendering/Starfield';
import {
  createPerformanceState,
  updateFPS,
  evaluateQuality,
  type PerformanceState,
} from '../systems/PerformanceSystem';

interface BattleShip extends ShipState {
  pilotSkill: number;
  initiative: number;
  combatStats: ModeCombatStats;
}

interface ShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
  shipBody: Phaser.GameObjects.Graphics;
  thruster: Phaser.GameObjects.Graphics;
}

export class TurnBasedBattleScene extends Phaser.Scene {
  private ships: Map<string, BattleShip> = new Map();
  private shipSprites: Map<string, ShipSprite> = new Map();
  private healthBars: Map<string, HealthBar> = new Map();
  private minimap!: Minimap;
  private rng: () => number = Math.random;

  private turnState!: TurnState;
  private playerShipIds: string[] = [];
  private enemyShipIds: string[] = [];
  private aiDifficulty: AIDifficultyLevel = 'normal';

  // UI Elements
  private phaseText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;
  private dialPanel!: Phaser.GameObjects.Container;
  private selectedShipId: string | null = null;

  // Animation state
  private isAnimating = false;
  private animationQueue: Array<() => Promise<void>> = [];
  private isPaused = false;
  private pauseMenu: PauseMenu | null = null;

  // Stats tracking
  private stats = {
    shipsDestroyed: 0,
    shipsLost: 0,
    damageDealt: 0,
  };

  // Visual effects
  private effectsManager!: EffectsManager;
  private background!: ParallaxBackground;
  private performanceState: PerformanceState = createPerformanceState();

  // Online multiplayer
  private onlineTurnManager: OnlineTurnManager | null = null;
  private onlineWaitingOverlay: Phaser.GameObjects.Container | null = null;
  private onlineDisconnectOverlay: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'TurnBasedBattleScene' });
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, BATTLEFIELD_SIZE, BATTLEFIELD_SIZE);
    this.cameras.main.setBackgroundColor(0x050510);

    // Initialize audio system
    audioManager.initialize();
    audioManager.playMusic('combat_low');

    // Initialize visual effects systems
    this.effectsManager = new EffectsManager(this);

    const savedSettings = this.registry.get('settings') as
      | { cameraShake: boolean; showDamageNumbers: boolean }
      | undefined;
    if (savedSettings) {
      this.effectsManager.setUserSettings({
        cameraShake: savedSettings.cameraShake,
        showDamageNumbers: savedSettings.showDamageNumbers,
      });
    }
    this.background = new ParallaxBackground(this, BATTLEFIELD_SIZE, BATTLEFIELD_SIZE);
    this.background.startShootingStars(8000, 20000); // Less frequent shooting stars in turn-based
    this.background.addDistantPlanet(BATTLEFIELD_SIZE * 0.7, BATTLEFIELD_SIZE * 0.2, 100, 0x664488);
    this.background.addSpaceStation(BATTLEFIELD_SIZE * 0.3, BATTLEFIELD_SIZE * 0.1, 0.6);

    this.createStarfield(); // Keep the simpler starfield as an additional layer
    this.spawnShips();
    this.createHealthBars();
    this.createMinimap();
    this.createHUD();
    this.setupInput();

    // Initialize turn system
    this.turnState = createTurnState();
    this.updatePhaseDisplay();

    // Reset stats
    this.stats = { shipsDestroyed: 0, shipsLost: 0, damageDealt: 0 };

    // Create pause menu
    this.createPauseMenu();

    // Center camera on battlefield
    this.cameras.main.centerOn(BATTLEFIELD_SIZE / 2, BATTLEFIELD_SIZE / 2);
    this.cameras.main.setZoom(0.8);
  }

  private createPauseMenu(): void {
    this.pauseMenu = new PauseMenu({
      scene: this,
      onResume: () => {
        this.isPaused = false;
      },
      onRestart: () => {
        this.scene.restart();
      },
      onQuit: () => {
        this.scene.start('MainMenuScene');
      },
    });
  }

  /** Remove all network listeners on scene shutdown. */
  shutdown(): void {
    this.onlineTurnManager?.destroy();
    this.onlineTurnManager = null;
    this.onlineDisconnectOverlay?.destroy();
    this.onlineDisconnectOverlay = null;
  }

  update(time: number, delta: number): void {
    if (this.isPaused) return;
    this.performanceState = updateFPS(this.performanceState, delta);
    this.performanceState = evaluateQuality(this.performanceState, time);
    this.effectsManager.setQualitySettings(this.performanceState.effectSettings);
    this.updateSprites();
    this.updateMinimap();
  }

  // ==========================================
  // SETUP
  // ==========================================

  private createStarfield(): void {
    renderBattleStarfield(this, BATTLEFIELD_SIZE);
  }

  private spawnShips(): void {
    // Check for battle config from squad builder
    const battleConfig = this.registry.get('battleConfig') as {
      factions: Array<{
        factionId: FactionId;
        controller: 'player' | 'ai';
        ships: string[];
      }>;
      aiDifficulty?: AIDifficultyLevel;
      seed?: number;
      isOnlineMode?: boolean;
    } | undefined;

    // Initialize seeded RNG for deterministic pilot skill assignment
    if (battleConfig?.seed !== undefined) {
      this.rng = seedrandom(String(battleConfig.seed));
    }

    if (battleConfig?.isOnlineMode) {
      this.onlineTurnManager = new OnlineTurnManager(networkService);
      this.onlineTurnManager.onDisconnect(() => {
        this.showDisconnectOverlay();
        this.onlineTurnManager?.destroy();
        this.onlineTurnManager = null;
      });
    }

    // Set AI difficulty from config
    if (battleConfig?.aiDifficulty) {
      this.aiDifficulty = battleConfig.aiDifficulty;
    }

    if (battleConfig && battleConfig.factions.length > 0) {
      this.spawnFromConfig(battleConfig);
    } else {
      this.spawnDefaultShips();
    }

    // Create sprites for all ships
    for (const ship of this.ships.values()) {
      this.createShipSprite(ship);
    }
  }

  private spawnFromConfig(config: {
    factions: Array<{
      factionId: FactionId;
      controller: 'player' | 'ai';
      ships: string[];
    }>;
  }): void {
    const numFactions = config.factions.length;
    const centerX = BATTLEFIELD_SIZE / 2;
    const centerY = BATTLEFIELD_SIZE / 2;
    const spawnRadius = 300;
    let initiativeCounter = 1;

    config.factions.forEach((faction, factionIndex) => {
      // Calculate spawn position for this faction (spread around center)
      const factionAngle = (factionIndex / numFactions) * Math.PI * 2;
      const factionX = centerX + Math.cos(factionAngle) * spawnRadius;
      const factionY = centerY + Math.sin(factionAngle) * spawnRadius;
      const facingAngle = (factionAngle * 180 / Math.PI + 180) % 360; // Face center

      faction.ships.forEach((shipDefId, shipIndex) => {
        // Spread ships within faction
        const shipOffset = (shipIndex - (faction.ships.length - 1) / 2) * 60;
        const perpAngle = factionAngle + Math.PI / 2;
        const shipX = factionX + Math.cos(perpAngle) * shipOffset;
        const shipY = factionY + Math.sin(perpAngle) * shipOffset;

        const ship = this.createShip(
          `${faction.factionId}_${shipIndex}`,
          shipDefId,
          faction.factionId,
          faction.controller,
          shipX,
          shipY,
          facingAngle,
          3 + Math.floor(this.rng() * 4), // Pilot skill 3-6 (seeded for determinism)
          initiativeCounter++
        );

        this.ships.set(ship.id, ship);

        if (faction.controller === 'player') {
          this.playerShipIds.push(ship.id);
        } else {
          this.enemyShipIds.push(ship.id);
        }
      });
    });
  }

  private spawnDefaultShips(): void {
    const centerX = BATTLEFIELD_SIZE / 2;
    const centerY = BATTLEFIELD_SIZE / 2;

    // Player ships (Free Confederation)
    const playerShip = this.createShip(
      'player_0',
      'confed_falcon',
      'free_confederation',
      'player',
      centerX,
      centerY + 200,
      0,
      5, // Pilot skill
      1
    );
    this.ships.set(playerShip.id, playerShip);
    this.playerShipIds.push(playerShip.id);

    for (let i = 0; i < 2; i++) {
      const ally = this.createShip(
        `ally_${i}`,
        'confed_sparrow',
        'free_confederation',
        'player',
        centerX + (i - 0.5) * 100,
        centerY + 280,
        0,
        3, // Lower pilot skill
        i + 2
      );
      this.ships.set(ally.id, ally);
      this.playerShipIds.push(ally.id);
    }

    // Enemy ships (Terran Hegemony)
    for (let i = 0; i < 3; i++) {
      const angle = ((i - 1) / 3) * Math.PI * 0.5;
      const enemy = this.createShip(
        `enemy_${i}`,
        i === 1 ? 'terran_gladius' : 'terran_viper',
        'terran_hegemony',
        'ai',
        centerX + Math.sin(angle) * 250,
        centerY - 200 + Math.cos(angle) * 50,
        180,
        i === 1 ? 4 : 2, // Middle ship is ace
        i + 10
      );
      this.ships.set(enemy.id, enemy);
      this.enemyShipIds.push(enemy.id);
    }
  }

  private createShip(
    id: string,
    defId: string,
    faction: FactionId,
    owner: 'player' | 'ai',
    x: number,
    y: number,
    angle: number,
    pilotSkill: number,
    initiative: number
  ): BattleShip {
    // Get mode-specific combat stats for turn-based play
    const combatStats = getModeCombatStats(defId, 'turn_based');

    return {
      id,
      definitionId: defId,
      faction,
      owner,
      x,
      y,
      angle,
      // Use mode-balanced stats (higher HP for turn-based)
      hull: combatStats.hull,
      maxHull: combatStats.maxHull,
      shields: combatStats.shields,
      maxShields: combatStats.maxShields,
      isStressed: false,
      hasFocus: false,
      hasEvade: false,
      hasTargetLock: null,
      isCloaked: false,
      mobileArcDirection: 'front',
      charges: 0,
      maxCharges: 0,
      currentManeuver: null,
      maneuverProgress: 0,
      pilotSkill,
      initiative,
      combatStats,
    };
  }

  private createShipSprite(ship: BattleShip): void {
    const container = this.add.container(ship.x, ship.y) as unknown as ShipSprite;
    container.shipId = ship.id;

    const color = FACTION_COLORS[ship.faction as FactionId] ?? 0xffffff;
    const shipDef = getShipDefinition(ship.definitionId);
    const size = SHIP_SIZES[shipDef?.baseStats.size ?? 'small'];

    // Thruster glow
    const thruster = this.add.graphics();
    thruster.fillStyle(0xff4400, 0.6);
    thruster.fillTriangle(-6, size / 2, 6, size / 2, 0, size / 2 + 12);
    container.add(thruster);
    container.thruster = thruster;

    // Ship body
    const body = this.add.graphics();
    body.fillStyle(color, 1);
    body.beginPath();
    body.moveTo(0, -size / 2);
    body.lineTo(-size / 3, size / 2);
    body.lineTo(0, size / 3);
    body.lineTo(size / 3, size / 2);
    body.closePath();
    body.fillPath();

    body.lineStyle(2, 0xffffff, 0.8);
    body.strokePath();

    // Pilot skill indicator
    const skillText = this.add.text(0, -size / 2 - 12, `${ship.pilotSkill}`, {
      fontSize: '12px',
      color: '#ffff00',
    });
    skillText.setOrigin(0.5, 0.5);
    container.add(skillText);

    container.add(body);
    container.shipBody = body;

    container.setAngle(ship.angle);
    container.setDepth(10);
    container.setSize(size * 2, size * 2);
    container.setInteractive();
    ShipStatCard.attachHoverCard(this, container, ship.definitionId);

    this.shipSprites.set(ship.id, container);
  }

  private createHealthBars(): void {
    for (const [id, ship] of this.ships) {
      const healthBar = new HealthBar({
        scene: this,
        x: ship.x,
        y: ship.y - 40,
        faction: ship.faction as FactionId,
        maxHull: ship.maxHull,
        maxShields: ship.maxShields,
        currentHull: ship.hull,
        currentShields: ship.shields,
      });
      this.healthBars.set(id, healthBar);
    }
  }

  private createMinimap(): void {
    this.minimap = new Minimap({
      scene: this,
      x: this.scale.width - 160,
      y: this.scale.height - 160,
      width: 150,
      height: 150,
    });
  }

  private createHUD(): void {
    const style = { font: 'bold 20px monospace', color: '#ffffff' };

    this.turnText = this.add
      .text(this.scale.width / 2, 20, 'TURN 1', style)
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    this.phaseText = this.add
      .text(this.scale.width / 2, 50, 'PLANNING PHASE', {
        font: 'bold 24px monospace',
        color: '#00ff00',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    this.instructionText = this.add
      .text(
        this.scale.width / 2,
        this.scale.height - 30,
        'Click a ship to select, then choose a maneuver',
        { font: '16px monospace', color: '#888888' }
      )
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(1000);

    // Create dial panel (hidden initially)
    this.dialPanel = this.add.container(0, 0);
    this.dialPanel.setScrollFactor(0);
    this.dialPanel.setDepth(1001);
    this.dialPanel.setVisible(false);
  }

  private setupInput(): void {
    // Click on ships to select them
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isAnimating) return;
      if (this.turnState.phase !== 'planning') return;

      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

      // Check if clicked on a player ship
      for (const shipId of this.playerShipIds) {
        const ship = this.ships.get(shipId);
        if (!ship || ship.hull <= 0) continue;

        const dist = Phaser.Math.Distance.Between(worldPoint.x, worldPoint.y, ship.x, ship.y);
        if (dist < 30) {
          this.selectShip(shipId);
          return;
        }
      }

      // Clicked elsewhere - deselect
      this.deselectShip();
    });

    // Camera controls
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.turnState.phase === 'planning') {
        this.tryStartActivation();
      }
    });

    // Camera pan with arrow keys
    const cursors = this.input.keyboard?.createCursorKeys();
    if (cursors) {
      this.events.on('update', () => {
        const speed = 10;
        if (cursors.left?.isDown) this.cameras.main.scrollX -= speed;
        if (cursors.right?.isDown) this.cameras.main.scrollX += speed;
        if (cursors.up?.isDown) this.cameras.main.scrollY -= speed;
        if (cursors.down?.isDown) this.cameras.main.scrollY += speed;
      });
    }

    // Zoom with mouse wheel
    this.input.on('wheel', (_pointer: unknown, _gameObjects: unknown, _deltaX: number, deltaY: number) => {
      const zoom = this.cameras.main.zoom - deltaY * 0.001;
      this.cameras.main.setZoom(Phaser.Math.Clamp(zoom, 0.5, 2));
    });

    // Pause with ESC
    this.input.keyboard?.on('keydown-ESC', () => {
      this.togglePause();
    });
  }

  private togglePause(): void {
    if (this.isAnimating) return; // Don't pause during animations

    this.isPaused = !this.isPaused;

    if (this.isPaused && this.pauseMenu) {
      this.pauseMenu.show();
    }
  }

  // ==========================================
  // PLANNING PHASE
  // ==========================================

  private selectShip(shipId: string): void {
    this.selectedShipId = shipId;

    // Highlight selected ship
    for (const [id, sprite] of this.shipSprites) {
      if (id === shipId) {
        sprite.setScale(1.2);
      } else {
        sprite.setScale(1);
      }
    }

    this.showManeuverDial(shipId);
  }

  private deselectShip(): void {
    this.selectedShipId = null;
    this.dialPanel.setVisible(false);

    for (const sprite of this.shipSprites.values()) {
      sprite.setScale(1);
    }
  }

  private showManeuverDial(shipId: string): void {
    const ship = this.ships.get(shipId);
    if (!ship) return;

    // Clear existing dial
    this.dialPanel.removeAll(true);

    const dial = getShipDial(ship.definitionId);

    // Create dial background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.9);
    bg.fillRoundedRect(10, 80, 200, 400, 10);
    bg.lineStyle(2, 0x444444);
    bg.strokeRoundedRect(10, 80, 200, 400, 10);
    this.dialPanel.add(bg);

    // Title
    const title = this.add.text(110, 95, 'MANEUVER DIAL', {
      font: 'bold 14px monospace',
      color: '#ffffff',
    });
    title.setOrigin(0.5, 0);
    this.dialPanel.add(title);

    // Group maneuvers by speed
    const bySpeed: Map<number, ManeuverDefinition[]> = new Map();
    for (const m of dial) {
      const speedManeuvers = bySpeed.get(m.speed) ?? [];
      speedManeuvers.push(m);
      bySpeed.set(m.speed, speedManeuvers);
    }

    let y = 125;
    const speeds = [...bySpeed.keys()].sort((a, b) => b - a); // High to low

    for (const speed of speeds) {
      const maneuvers = bySpeed.get(speed)!;

      // Speed label
      const speedLabel = this.add.text(25, y, `Speed ${speed}`, {
        font: '12px monospace',
        color: '#888888',
      });
      this.dialPanel.add(speedLabel);
      y += 20;

      // Maneuver buttons
      let x = 25;
      for (const maneuver of maneuvers) {
        const btn = this.createManeuverButton(x, y, maneuver, shipId);
        this.dialPanel.add(btn);
        x += 35;
        if (x > 180) {
          x = 25;
          y += 30;
        }
      }
      y += 35;
    }

    this.dialPanel.setVisible(true);
  }

  private createManeuverButton(
    x: number,
    y: number,
    maneuver: ManeuverDefinition,
    shipId: string
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const color = getDifficultyColor(maneuver.difficulty);
    const symbol = this.getManeuverSymbol(maneuver.direction);

    const bg = this.add.graphics();
    bg.fillStyle(color, 0.3);
    bg.fillRoundedRect(0, 0, 30, 25, 5);
    bg.lineStyle(1, color);
    bg.strokeRoundedRect(0, 0, 30, 25, 5);
    container.add(bg);

    const text = this.add.text(15, 12, symbol, {
      font: '14px monospace',
      color: `#${color.toString(16).padStart(6, '0')}`,
    });
    text.setOrigin(0.5, 0.5);
    container.add(text);

    // Make interactive
    container.setSize(30, 25);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(color, 0.6);
      bg.fillRoundedRect(0, 0, 30, 25, 5);
      bg.lineStyle(2, color);
      bg.strokeRoundedRect(0, 0, 30, 25, 5);

      // Show preview
      this.showManeuverPreview(shipId, maneuver);
    });

    container.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(color, 0.3);
      bg.fillRoundedRect(0, 0, 30, 25, 5);
      bg.lineStyle(1, color);
      bg.strokeRoundedRect(0, 0, 30, 25, 5);

      this.hideManeuverPreview();
    });

    container.on('pointerdown', () => {
      this.selectManeuver(shipId, maneuver);
    });

    return container;
  }

  private getManeuverSymbol(direction: string): string {
    switch (direction) {
      case 'straight':
        return '↑';
      case 'bank_left':
        return '↖';
      case 'bank_right':
        return '↗';
      case 'turn_left':
        return '←';
      case 'turn_right':
        return '→';
      case 'kturn':
        return '↩';
      case 'segnor_left':
        return '⟲';
      case 'segnor_right':
        return '⟳';
      case 'tallon_left':
        return '⤺';
      case 'tallon_right':
        return '⤻';
      default:
        return '?';
    }
  }

  private previewGraphics: Phaser.GameObjects.Graphics | null = null;

  private showManeuverPreview(shipId: string, maneuver: ManeuverDefinition): void {
    const ship = this.ships.get(shipId);
    if (!ship) return;

    if (this.previewGraphics) {
      this.previewGraphics.destroy();
    }

    this.previewGraphics = this.add.graphics();
    this.previewGraphics.setDepth(5);

    const path = generateManeuverPath(ship.x, ship.y, ship.angle, maneuver.direction, maneuver.speed);

    const color = getDifficultyColor(maneuver.difficulty);
    this.previewGraphics.lineStyle(3, color, 0.7);

    this.previewGraphics.beginPath();
    const startPos = path[0];
    if (startPos) {
      this.previewGraphics.moveTo(startPos.x, startPos.y);
      for (let i = 1; i < path.length; i++) {
        const pathPos = path[i];
        if (pathPos) {
          this.previewGraphics.lineTo(pathPos.x, pathPos.y);
        }
      }
    }
    this.previewGraphics.strokePath();

    // Draw end position indicator
    const end = path[path.length - 1];
    if (end) {
      this.previewGraphics.lineStyle(2, color, 0.5);
      this.previewGraphics.strokeCircle(end.x, end.y, 15);
    }
  }

  private hideManeuverPreview(): void {
    if (this.previewGraphics) {
      this.previewGraphics.destroy();
      this.previewGraphics = null;
    }
  }

  private selectManeuver(shipId: string, maneuver: ManeuverDefinition): void {
    this.turnState = planManeuver(this.turnState, shipId, maneuver);
    this.hideManeuverPreview();
    this.deselectShip();

    // Visual feedback - mark ship as planned
    const sprite = this.shipSprites.get(shipId);
    if (sprite) {
      const marker = this.add.graphics();
      marker.fillStyle(getDifficultyColor(maneuver.difficulty), 0.5);
      marker.fillCircle(0, 0, 25);
      sprite.add(marker);
      sprite.sendToBack(marker);
    }

    this.updateInstructions();
  }

  private async tryStartActivation(): Promise<void> {
    if (this.onlineTurnManager) {
      await this.tryStartActivationOnline();
    } else {
      this.planAIManeuvers();
      this.tryAdvanceToActivation();
    }
  }

  /** Submit local maneuvers over the network, wait for opponent's, then proceed. */
  private async tryStartActivationOnline(): Promise<void> {
    const allLocalPlanned = this.playerShipIds.every(
      (id) => this.ships.get(id)?.hull === 0 || this.turnState.plannedManeuvers.has(id),
    );
    if (!allLocalPlanned) {
      this.instructionText.setText('Plan all your ships before confirming!');
      return;
    }
    const myManeuvers = this.buildManeuverPackets(this.playerShipIds);
    this.showWaitingOverlay();
    const opponentManeuvers = await this.onlineTurnManager!.submitAndWait(
      myManeuvers,
      () => {},
    );
    this.applyOpponentManeuvers(opponentManeuvers);
    // If opponent disconnected (onlineTurnManager nulled by onDisconnect callback),
    // fill in AI maneuvers so activation can proceed without a planning stall.
    if (!this.onlineTurnManager) {
      this.planAIManeuvers();
    }
    this.hideWaitingOverlay();
    this.tryAdvanceToActivation();
  }

  /** Auto-plan maneuvers for all AI-controlled enemy ships. */
  private planAIManeuvers(): void {
    for (const shipId of this.enemyShipIds) {
      const ship = this.ships.get(shipId);
      if (!ship || ship.hull <= 0) continue;
      if (this.turnState.plannedManeuvers.has(shipId)) continue;

      const dial = getShipDial(ship.definitionId);
      let maneuver: ManeuverDefinition;

      if (shouldPickOptimalManeuver(this.aiDifficulty)) {
        maneuver = this.pickOptimalManeuver(ship, dial);
      } else {
        maneuver = dial[Math.floor(this.rng() * dial.length)]!;
      }

      this.turnState = planManeuver(this.turnState, shipId, maneuver);
    }
  }

  /**
   * Pick the best maneuver for an AI ship by turning toward the nearest enemy.
   *
   * @param ship - The AI ship choosing a maneuver.
   * @param dial - Full set of available maneuvers for this ship type.
   * @returns The chosen maneuver.
   */
  private pickOptimalManeuver(ship: BattleShip, dial: readonly ManeuverDefinition[]): ManeuverDefinition {
    const target = this.findClosestEnemy(ship);
    const randomFallback = (): ManeuverDefinition => dial[Math.floor(this.rng() * dial.length)]!;
    if (!target) return randomFallback();

    const angleToTarget = Phaser.Math.Angle.Between(ship.x, ship.y, target.x, target.y) * Phaser.Math.RAD_TO_DEG;
    const shipFacing = ship.angle - 90;
    let angleDiff = angleToTarget - shipFacing;
    if (angleDiff > 180) angleDiff -= 360;
    if (angleDiff < -180) angleDiff += 360;

    if (Math.abs(angleDiff) < 30) {
      return dial.find((m) => m.direction === 'straight' && m.speed >= 2) ?? randomFallback();
    }
    if (angleDiff > 0) {
      return dial.find((m) => m.direction === 'bank_right' || m.direction === 'turn_right') ?? randomFallback();
    }
    return dial.find((m) => m.direction === 'bank_left' || m.direction === 'turn_left') ?? randomFallback();
  }

  /** Proceed to activation if all living ships have been planned. */
  private tryAdvanceToActivation(): void {
    const livingShips = [...this.ships.values()].filter((s) => s.hull > 0);
    const allShipIds = livingShips.map((s) => s.id);

    if (allShipsPlanned(this.turnState, allShipIds)) {
      const shipsForOrder = livingShips.map((s) => ({
        id: s.id,
        pilotSkill: s.pilotSkill,
        initiative: s.initiative,
      }));
      this.turnState = startActivationPhase(this.turnState, shipsForOrder);
      this.updatePhaseDisplay();
      this.runActivationPhase();
    } else {
      this.instructionText.setText('Select all your ships and choose maneuvers first!');
    }
  }

  /**
   * Build ManeuverPacket list from the current planning state for the given ship IDs.
   *
   * @param shipIds - Ship IDs whose planned maneuvers to extract.
   * @returns Array of packets ready to send over the network.
   */
  private buildManeuverPackets(shipIds: string[]): ManeuverPacket[] {
    const packets: ManeuverPacket[] = [];
    for (const shipId of shipIds) {
      const planned = this.turnState.plannedManeuvers.get(shipId);
      if (!planned) continue;
      packets.push({
        shipId,
        direction: planned.maneuver.direction,
        speed: planned.maneuver.speed,
        difficulty: planned.maneuver.difficulty,
      });
    }
    return packets;
  }

  /**
   * Apply opponent's received maneuver packets into the local turn state.
   *
   * @param packets - Opponent's planned maneuvers received from the network.
   */
  private applyOpponentManeuvers(packets: ManeuverPacket[]): void {
    for (const packet of packets) {
      const maneuver = {
        direction: packet.direction,
        speed: packet.speed,
        difficulty: packet.difficulty,
      } as ManeuverDefinition;
      this.turnState = planManeuver(this.turnState, packet.shipId, maneuver);
    }
  }

  /** Show a "Waiting for opponent..." overlay during online maneuver sync. */
  private showWaitingOverlay(): void {
    const overlay = this.add.container(640, 360);
    overlay.setScrollFactor(0);
    const bg = this.add.rectangle(0, 0, 400, 60, 0x000000, 0.85);
    const label = this.add.text(0, 0, 'Waiting for opponent...', {
      font: 'bold 18px monospace',
      color: '#ffff00',
    });
    label.setOrigin(0.5, 0.5);
    overlay.add([bg, label]);
    this.onlineWaitingOverlay = overlay;
  }

  /** Remove the opponent-wait overlay. */
  private hideWaitingOverlay(): void {
    this.onlineWaitingOverlay?.destroy();
    this.onlineWaitingOverlay = null;
  }

  /**
   * Show a persistent banner informing the player their opponent disconnected.
   * Displayed at the top of the HUD; dismissed at end of battle.
   */
  private showDisconnectOverlay(): void {
    this.onlineDisconnectOverlay?.destroy();
    const overlay = this.add.container(640, 30);
    overlay.setScrollFactor(0);
    overlay.setDepth(100);
    const bg = this.add.rectangle(0, 0, 480, 40, 0x880000, 0.9);
    const label = this.add.text(0, 0, 'Opponent disconnected — continuing with AI', {
      font: 'bold 14px monospace',
      color: '#ffffff',
    });
    label.setOrigin(0.5, 0.5);
    overlay.add([bg, label]);
    this.onlineDisconnectOverlay = overlay;
  }

  // ==========================================
  // ACTIVATION PHASE
  // ==========================================

  private async runActivationPhase(): Promise<void> {
    this.isAnimating = true;

    while (this.turnState.phase === 'activation') {
      const shipId = getCurrentActivatingShip(this.turnState);
      if (!shipId) break;

      const ship = this.ships.get(shipId);
      if (ship && ship.hull > 0) {
        await this.activateShip(shipId);
      }

      this.turnState = nextActivation(this.turnState);
    }

    this.isAnimating = false;

    if (this.turnState.phase === 'combat') {
      this.updatePhaseDisplay();
      this.runCombatPhase();
    }
  }

  private async activateShip(shipId: string): Promise<void> {
    const ship = this.ships.get(shipId);
    const planned = this.turnState.plannedManeuvers.get(shipId);
    if (!ship || !planned) return;

    // Reveal maneuver
    this.turnState = revealManeuver(this.turnState, shipId);

    // Highlight activating ship
    this.instructionText.setText(`${ship.faction} ship activating...`);

    // Animate the movement
    await this.animateManeuver(ship, planned.maneuver);

    // Handle stress from red maneuvers
    if (planned.maneuver.difficulty === 'red') {
      ship.isStressed = true;
    } else if (planned.maneuver.difficulty === 'green' && ship.isStressed) {
      ship.isStressed = false;
    }

    // Brief pause between activations
    await this.delay(300);
  }

  private async animateManeuver(ship: BattleShip, maneuver: ManeuverDefinition): Promise<void> {
    const sprite = this.shipSprites.get(ship.id);
    if (!sprite) return;

    const path = generateManeuverPath(ship.x, ship.y, ship.angle, maneuver.direction, maneuver.speed);
    const duration = 800; // Total animation time
    const stepTime = duration / path.length;

    for (let i = 1; i < path.length; i++) {
      const pos = path[i];
      if (!pos) continue;

      await new Promise<void>((resolve) => {
        this.tweens.add({
          targets: sprite,
          x: pos.x,
          y: pos.y,
          angle: pos.angle,
          duration: stepTime,
          ease: 'Linear',
          onComplete: () => resolve(),
        });
      });
    }

    // Update ship state
    const finalPos = path[path.length - 1];
    if (finalPos) {
      ship.x = finalPos.x;
      ship.y = finalPos.y;
      ship.angle = finalPos.angle;
    }

    // Wrap around battlefield
    ship.x = ((ship.x % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) % BATTLEFIELD_SIZE;
    ship.y = ((ship.y % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) % BATTLEFIELD_SIZE;
  }

  // ==========================================
  // COMBAT PHASE
  // ==========================================

  private async runCombatPhase(): Promise<void> {
    this.isAnimating = true;

    while (this.turnState.phase === 'combat') {
      const shipId = getCurrentCombatShip(this.turnState);
      if (!shipId) break;

      const ship = this.ships.get(shipId);
      if (ship && ship.hull > 0) {
        await this.shipCombat(shipId);
      }

      this.turnState = nextCombat(this.turnState);
    }

    this.isAnimating = false;

    if (this.turnState.phase === 'end') {
      this.updatePhaseDisplay();
      this.runEndPhase();
    }
  }

  private async shipCombat(attackerId: string): Promise<void> {
    const attacker = this.ships.get(attackerId);
    if (!attacker) return;

    // Find closest enemy in arc
    const target = this.findBestTarget(attacker);
    if (!target) return;

    this.instructionText.setText(`${attacker.faction} ship attacking!`);

    // Apply difficulty modifiers to dice counts
    const isAIAttacking = attacker.owner === 'ai';
    const isAIDefending = target.owner === 'ai';
    const diffMods = DIFFICULTY_SETTINGS[this.aiDifficulty];

    // Modify attack dice based on difficulty
    let attackDice = attacker.combatStats.attackDice;
    let defenseDice = target.combatStats.agilityDice;

    if (isAIAttacking) {
      // AI attacking: scale accuracy
      attackDice = Math.max(1, Math.round(attackDice * diffMods.accuracyMultiplier));
    }
    if (isAIDefending) {
      // AI defending: scale defense inversely
      defenseDice = Math.max(1, Math.round(defenseDice * (2 - diffMods.damageTakenMultiplier)));
    }

    // Use proper X-Wing style dice resolution with mode-balanced stats
    const result = resolveTurnBasedAttack(
      attackDice,
      defenseDice,
      target.shields,
      target.hull,
      attacker.hasFocus,
      target.hasFocus,
      target.hasEvade,
      this.rng,
    );

    if (result.hitsLanded > 0) {
      // Apply damage with difficulty scaling
      let shieldDmg = result.shieldsDamaged;
      let hullDmg = result.hullDamaged;

      if (isAIAttacking) {
        // AI damage output
        shieldDmg = Math.round(shieldDmg * diffMods.damageMultiplier);
        hullDmg = Math.round(hullDmg * diffMods.damageMultiplier);
      } else if (isAIDefending) {
        // Player damage to AI
        shieldDmg = Math.round(shieldDmg * diffMods.damageTakenMultiplier);
        hullDmg = Math.round(hullDmg * diffMods.damageTakenMultiplier);
      }

      target.shields -= shieldDmg;
      target.hull -= hullDmg;

      // Track damage dealt by player ships
      if (attacker.owner === 'player') {
        this.stats.damageDealt += result.hitsLanded;
      }

      // Visual feedback using effects manager
      this.effectsManager.fireLaser(
        attacker.x, attacker.y, target.x, target.y,
        attacker.faction as FactionId, true
      );
      this.effectsManager.showDamageNumber(
        target.x, target.y, result.hitsLanded, result.critsLanded > 0
      );

      // Shield impact effect if shields were hit
      if (result.shieldsDamaged > 0) {
        this.effectsManager.shieldImpact(target.x, target.y, 0, target.faction as FactionId);
      }

      this.cameras.main.shake(50 + result.critsLanded * 30, 0.005 + result.critsLanded * 0.003);

      // Update health bar
      const healthBar = this.healthBars.get(target.id);
      healthBar?.update(target.hull, target.shields);

      // Check if target destroyed (recalculate since we modified damage)
      if (target.hull <= 0) {
        await this.destroyShip(target.id, attacker.id);
      }
    } else {
      // Show miss using effects manager
      this.effectsManager.fireLaser(
        attacker.x, attacker.y, target.x, target.y,
        attacker.faction as FactionId, false
      );
      this.showEvade(target.x, target.y);
    }

    // Clear tokens after use
    attacker.hasFocus = false;
    target.hasEvade = false;

    await this.delay(500);
  }

  private showEvade(x: number, y: number): void {
    const text = this.add.text(x, y, 'EVADE', {
      font: 'bold 16px monospace',
      color: '#44ff44',
      stroke: '#000000',
      strokeThickness: 2,
    });
    text.setOrigin(0.5, 0.5);

    this.tweens.add({
      targets: text,
      y: y - 30,
      alpha: 0,
      duration: 800,
      onComplete: () => text.destroy(),
    });
  }

  private findBestTarget(attacker: BattleShip): BattleShip | null {
    let best: BattleShip | null = null;
    let bestDist = Infinity;

    // Use ship's mode-balanced range and arc
    const maxRange = attacker.combatStats.weaponRange;
    const maxArcRad = (attacker.combatStats.firingArc / 2) * Phaser.Math.DEG_TO_RAD;

    for (const ship of this.ships.values()) {
      if (ship.faction === attacker.faction) continue;
      if (ship.hull <= 0) continue;

      const dist = Phaser.Math.Distance.Between(attacker.x, attacker.y, ship.x, ship.y);

      // Check if in arc using ship's arc stat
      const angleToTarget = Phaser.Math.Angle.Between(attacker.x, attacker.y, ship.x, ship.y);
      const attackerFacing = (attacker.angle - 90) * Phaser.Math.DEG_TO_RAD;
      let angleDiff = Math.abs(angleToTarget - attackerFacing);
      if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

      if (dist < maxRange && angleDiff < maxArcRad && dist < bestDist) {
        best = ship;
        bestDist = dist;
      }
    }

    return best;
  }

  private findClosestEnemy(ship: BattleShip): BattleShip | null {
    let closest: BattleShip | null = null;
    let closestDist = Infinity;

    for (const other of this.ships.values()) {
      if (other.faction === ship.faction || other.hull <= 0) continue;

      const dist = Phaser.Math.Distance.Between(ship.x, ship.y, other.x, other.y);
      if (dist < closestDist) {
        closest = other;
        closestDist = dist;
      }
    }

    return closest;
  }

  private async destroyShip(shipId: string, destroyerShipId?: string): Promise<void> {
    const ship = this.ships.get(shipId);
    const wasPlayerShip = ship?.owner === 'player';

    const sprite = this.shipSprites.get(shipId);
    if (sprite) {
      // Use EffectsManager for explosion
      this.effectsManager.createExplosion(sprite.x, sprite.y, 'large');
      sprite.destroy();
      this.shipSprites.delete(shipId);
    }

    const healthBar = this.healthBars.get(shipId);
    if (healthBar) {
      healthBar.destroy();
      this.healthBars.delete(shipId);
    }

    // Show kill notification
    if (destroyerShipId && ship) {
      const destroyerShip = this.ships.get(destroyerShipId);
      if (destroyerShip) {
        const killerName = destroyerShip.owner === 'player'
          ? destroyerShip.definitionId.replace(/_/g, ' ')
          : `Enemy ${destroyerShip.definitionId.replace(/_/g, ' ')}`;
        const victimName = ship.owner === 'player'
          ? ship.definitionId.replace(/_/g, ' ')
          : `Enemy ${ship.definitionId.replace(/_/g, ' ')}`;
        this.effectsManager.showKillNotification(killerName, victimName, 640, 60);
      }
    }

    // Track stats
    if (wasPlayerShip) {
      this.stats.shipsLost++;
    } else {
      this.stats.shipsDestroyed++;
    }

    // Remove from tracking
    this.playerShipIds = this.playerShipIds.filter((id) => id !== shipId);
    this.enemyShipIds = this.enemyShipIds.filter((id) => id !== shipId);

    await this.delay(500);
  }

  // ==========================================
  // END PHASE
  // ==========================================

  private runEndPhase(): void {
    // Check victory conditions
    const playerAlive = this.playerShipIds.some((id) => {
      const ship = this.ships.get(id);
      return ship && ship.hull > 0;
    });

    const enemyAlive = this.enemyShipIds.some((id) => {
      const ship = this.ships.get(id);
      return ship && ship.hull > 0;
    });

    if (!enemyAlive) {
      this.showGameOver(true, 'Player Forces');
      return;
    }

    if (!playerAlive) {
      this.showGameOver(false, 'Enemy Forces');
      return;
    }

    // Start next turn
    this.turnState = endTurn(this.turnState);
    this.updatePhaseDisplay();
    this.updateInstructions();

    if (this.onlineTurnManager) {
      const hash = this.onlineTurnManager.computeStateHash(this.ships as ReadonlyMap<string, ShipState>);
      this.onlineTurnManager.sendTurnSync(this.turnState.turnNumber - 1, hash);
    }

    // Clear planned maneuver markers
    for (const sprite of this.shipSprites.values()) {
      // Remove old markers
      sprite.each((child: Phaser.GameObjects.GameObject) => {
        if (child instanceof Phaser.GameObjects.Graphics && child !== sprite.shipBody && child !== sprite.thruster) {
          child.destroy();
        }
      });
    }
  }

  private showGameOver(isPlayerVictory: boolean, winner: string): void {
    this.isAnimating = true; // Prevent further input

    new GameOverScreen({
      scene: this,
      stats: {
        winner,
        isPlayerVictory,
        shipsDestroyed: this.stats.shipsDestroyed,
        shipsLost: this.stats.shipsLost,
        damageDealt: this.stats.damageDealt,
        turnCount: this.turnState.turnNumber,
      },
      onRestart: () => {
        this.scene.restart();
      },
      onQuit: () => {
        this.scene.start('MainMenuScene');
      },
    });
  }

  // ==========================================
  // UTILITIES
  // ==========================================

  private updatePhaseDisplay(): void {
    this.turnText.setText(`TURN ${this.turnState.turnNumber}`);

    const phaseNames: Record<string, string> = {
      planning: 'PLANNING PHASE',
      activation: 'ACTIVATION PHASE',
      combat: 'COMBAT PHASE',
      end: 'END PHASE',
    };

    const phaseColors: Record<string, string> = {
      planning: '#00ff00',
      activation: '#ffff00',
      combat: '#ff4444',
      end: '#8888ff',
    };

    this.phaseText.setText(phaseNames[this.turnState.phase] ?? 'UNKNOWN');
    this.phaseText.setColor(phaseColors[this.turnState.phase] ?? '#ffffff');

    this.updateInstructions();
  }

  private updateInstructions(): void {
    if (this.turnState.phase === 'planning') {
      const planned = this.turnState.plannedManeuvers.size;
      const needed = this.playerShipIds.filter((id) => {
        const ship = this.ships.get(id);
        return ship && ship.hull > 0;
      }).length;

      if (planned >= needed) {
        this.instructionText.setText('Press SPACE to start activation');
      } else {
        this.instructionText.setText(
          `Click ships to assign maneuvers (${planned}/${needed})`
        );
      }
    } else {
      this.instructionText.setText('');
    }
  }

  private updateSprites(): void {
    for (const [id, sprite] of this.shipSprites) {
      const ship = this.ships.get(id);
      if (!ship) continue;

      // Update health bar position
      const healthBar = this.healthBars.get(id);
      if (healthBar) {
        healthBar.setPosition(ship.x, ship.y - 40);
      }
    }
  }

  private updateMinimap(): void {
    const minimapShips: MinimapShip[] = [];

    for (const ship of this.ships.values()) {
      minimapShips.push({
        id: ship.id,
        x: ship.x,
        y: ship.y,
        faction: ship.faction as FactionId,
        isPlayer: ship.owner === 'player',
        isAlive: ship.hull > 0,
      });
    }

    this.minimap.updateShips(minimapShips);
    this.minimap.updateViewRect();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }
}
