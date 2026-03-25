/**
 * Continuous Tactical Battle Scene
 *
 * Hybrid between X-Wing style movement and smooth gameplay:
 * - Ships commit to maneuvers at short intervals (~300ms)
 * - Movement is smoothly animated over each interval
 * - Maneuver templates still determine distance and direction
 * - Ship maneuverability creates meaningful tactical differences
 * - Combat happens in real-time based on position and arc
 *
 * Key differences from full turn-based:
 * - No discrete planning/activation phases
 * - Ships can change maneuvers at each interval
 * - Faster, more arcade-like feel while maintaining tactical depth
 */

import Phaser from 'phaser';
import { ShipStatCard } from '../ui/ShipStatCard';
import type { ShipState, ManeuverDefinition, ManeuverDirection } from '../core/types';
import type { FactionId } from '../config';
import { BATTLEFIELD_SIZE, FACTION_COLORS, SHIP_SIZES } from '../config';
import { getShipDefinition, getShipDial } from '../data/ShipDefinitions';
import { getModeCombatStats, calculateHitChance, type ModeCombatStats } from '../data/ModeBalancing';
import {
  type AIDifficultyLevel,
  DIFFICULTY_SETTINGS,
  getModifiedHitChance,
  getModifiedDamage,
  getModifiedCooldown,
  shouldPickOptimalTarget,
  shouldPickOptimalManeuver,
} from '../ai/AIDifficulty';
import { getManeuverTemplate, applyManeuver } from '../systems/ManeuverTemplates';
import { HealthBar } from '../ui/HealthBar';
import { Minimap, type MinimapShip } from '../ui/Minimap';
import { PauseMenu } from '../ui/PauseMenu';
import { GameOverScreen, type GameOverStats } from '../ui/GameOverScreen';
import { EffectsManager } from '../rendering/EffectsManager';
import { headingDiffToTarget } from '../systems/MovementSystem';
import { renderBattleStarfield } from '../rendering/Starfield';
import { ParallaxBackground } from '../rendering/ParallaxBackground';
import { audioManager } from '../audio/AudioManager';
import {
  createPerformanceState,
  updateFPS,
  evaluateQuality,
  type PerformanceState,
} from '../systems/PerformanceSystem';

// Timing constants
const MANEUVER_INTERVAL = 300; // ms between maneuver commits
const MANEUVER_ANIMATION_DURATION = 280; // slightly less than interval for visual smoothness

interface TacticalShip extends ShipState {
  pilotSkill: number;
  // Current committed maneuver (executes over interval)
  currentManeuverDir: ManeuverDirection;
  currentSpeed: number;
  // Animation state
  targetX: number;
  targetY: number;
  targetAngle: number;
  // Combat state from mode balancing
  combatStats: ModeCombatStats;
  weaponCooldown: number;
  // Stress affects available maneuvers
  stressTokens: number;
}

interface ShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
  shipBody: Phaser.GameObjects.Graphics;
  thruster: Phaser.GameObjects.Graphics;
  speedIndicator: Phaser.GameObjects.Text;
}

export class ContinuousTacticalScene extends Phaser.Scene {
  private ships: Map<string, TacticalShip> = new Map();
  private shipSprites: Map<string, ShipSprite> = new Map();
  private healthBars: Map<string, HealthBar> = new Map();
  private minimap!: Minimap;

  private playerShipIds: string[] = [];
  private enemyShipIds: string[] = [];
  private aiDifficulty: AIDifficultyLevel = 'normal';

  // Player input state
  private selectedShipId: string | null = null;
  private selectedManeuverDir: ManeuverDirection = 'straight';
  private selectedSpeed: number = 2;
  private isPaused: boolean = false;

  // Timing
  private lastManeuverTime: number = 0;
  private battleStartTime: number = 0;

  // UI
  private speedText!: Phaser.GameObjects.Text;
  private maneuverText!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;
  private dialGraphics!: Phaser.GameObjects.Graphics;
  private pauseMenu: PauseMenu | null = null;

  // Stats tracking
  private stats = {
    shipsDestroyed: 0,
    shipsLost: 0,
    damageDealt: 0,
  };

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private previewGraphics: Phaser.GameObjects.Graphics | null = null;

  // Visual effects
  private effectsManager!: EffectsManager;
  private background!: ParallaxBackground;
  private performanceState: PerformanceState = createPerformanceState();

  constructor() {
    super({ key: 'ContinuousTacticalScene' });
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, BATTLEFIELD_SIZE, BATTLEFIELD_SIZE);
    this.cameras.main.setBackgroundColor(0x050510);

    // Initialize audio system
    audioManager.initialize();
    audioManager.playMusic('combat_medium');

    // Initialize effects and background systems
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
    this.background.startShootingStars();
    this.background.addDistantPlanet(BATTLEFIELD_SIZE * 0.8, BATTLEFIELD_SIZE * 0.3, 80, 0x446688);
    this.background.addSpaceStation(BATTLEFIELD_SIZE * 0.2, BATTLEFIELD_SIZE * 0.15, 0.8);

    this.createStarfield();
    this.spawnShips();
    this.createHealthBars();
    this.createMinimap();
    this.createHUD();
    this.setupInput();

    this.cameras.main.centerOn(BATTLEFIELD_SIZE / 2, BATTLEFIELD_SIZE / 2);
    this.cameras.main.setZoom(0.9);

    this.lastManeuverTime = this.time.now;
    this.battleStartTime = this.time.now;

    // Reset stats
    this.stats = { shipsDestroyed: 0, shipsLost: 0, damageDealt: 0 };

    // Create pause menu
    this.createPauseMenu();

    // Auto-select first player ship
    if (this.playerShipIds.length > 0) {
      this.selectShip(this.playerShipIds[0] as string);
    }
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

  update(time: number, delta: number): void {
    if (this.isPaused) return;
    this.performanceState = updateFPS(this.performanceState, delta);
    this.performanceState = evaluateQuality(this.performanceState, time);
    this.effectsManager.setQualitySettings(this.performanceState.effectSettings);

    // Update background parallax
    this.background.update();

    // Process maneuvers at fixed intervals
    if (time - this.lastManeuverTime >= MANEUVER_INTERVAL) {
      this.processManeuverInterval();
      this.lastManeuverTime = time;
    }

    // Smoothly interpolate ship positions
    this.interpolateShipPositions(delta);

    // Update engine trails
    for (const ship of this.ships.values()) {
      if (ship.hull > 0) {
        this.effectsManager.updateTrailPosition(ship.id, ship.x, ship.y, ship.angle);
      }
    }
    this.effectsManager.renderTrails();

    // Process combat (real-time)
    this.processCombat(delta);

    // AI decision making
    this.updateAI();

    // Update UI
    this.updateSprites();
    this.updateMinimap();
    this.updatePreview();
  }

  // ==========================================
  // SETUP
  // ==========================================

  private createStarfield(): void {
    renderBattleStarfield(this, BATTLEFIELD_SIZE, { includeNebula: false });
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
    } | undefined;

    // Set AI difficulty from config or default to normal
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
          3 + Math.floor(Math.random() * 4) // Random pilot skill 3-6
        );

        this.ships.set(ship.id, ship);

        // Register engine trail for this ship
        this.effectsManager.registerEngineTrail(ship.id, faction.factionId, ship.currentSpeed);

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

    // Player ship
    const playerShip = this.createShip(
      'player_0',
      'confed_falcon',
      'free_confederation',
      'player',
      centerX,
      centerY + 200,
      0,
      5
    );
    this.ships.set(playerShip.id, playerShip);
    this.effectsManager.registerEngineTrail(playerShip.id, 'free_confederation', playerShip.currentSpeed);
    this.playerShipIds.push(playerShip.id);

    // Wingmen
    for (let i = 0; i < 2; i++) {
      const ally = this.createShip(
        `ally_${i}`,
        'confed_sparrow',
        'free_confederation',
        'player',
        centerX + (i === 0 ? -100 : 100),
        centerY + 250,
        0,
        3
      );
      this.ships.set(ally.id, ally);
      this.effectsManager.registerEngineTrail(ally.id, 'free_confederation', ally.currentSpeed);
      this.playerShipIds.push(ally.id);
    }

    // Enemies
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
        i === 1 ? 4 : 2
      );
      this.ships.set(enemy.id, enemy);
      this.effectsManager.registerEngineTrail(enemy.id, 'terran_hegemony', enemy.currentSpeed);
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
    pilotSkill: number
  ): TacticalShip {
    // Get mode-specific combat stats
    const combatStats = getModeCombatStats(defId, 'continuous');

    return {
      id,
      definitionId: defId,
      faction,
      owner,
      x,
      y,
      angle,
      // Use mode-balanced stats instead of raw definition stats
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
      // Tactical additions
      combatStats,
      currentManeuverDir: 'straight',
      currentSpeed: 2,
      targetX: x,
      targetY: y,
      targetAngle: angle,
      weaponCooldown: 0,
      stressTokens: 0,
    };
  }

  private createShipSprite(ship: TacticalShip): void {
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

    // Speed indicator
    const speedIndicator = this.add.text(0, size / 2 + 10, `S${ship.currentSpeed}`, {
      fontSize: '10px',
      color: '#aaaaaa',
    });
    speedIndicator.setOrigin(0.5, 0.5);
    container.add(speedIndicator);
    container.speedIndicator = speedIndicator;

    container.add(body);
    container.shipBody = body;

    container.setAngle(ship.angle);
    container.setDepth(10);

    // Make player ships interactive
    if (ship.owner === 'player') {
      container.setInteractive(
        new Phaser.Geom.Circle(0, 0, size),
        Phaser.Geom.Circle.Contains
      );
      container.on('pointerdown', () => this.selectShip(ship.id));
    } else {
      container.setSize(size * 2, size * 2);
      container.setInteractive();
    }
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
    const style = { font: 'bold 18px monospace', color: '#ffffff' };

    this.add
      .text(this.scale.width / 2, 20, 'TACTICAL COMBAT', { font: 'bold 24px monospace', color: '#00ff88' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    // Maneuver controls display
    this.speedText = this.add
      .text(20, 100, 'Speed: 2', style)
      .setScrollFactor(0)
      .setDepth(1000);

    this.maneuverText = this.add
      .text(20, 130, 'Maneuver: STRAIGHT', style)
      .setScrollFactor(0)
      .setDepth(1000);

    this.instructionText = this.add
      .text(20, this.scale.height - 40, 'Arrow keys: Change maneuver | W/S: Speed | Click: Select ship | Space: Pause', {
        font: '14px monospace',
        color: '#888888',
      })
      .setScrollFactor(0)
      .setDepth(1000);

    // Maneuver dial visualization
    this.dialGraphics = this.add.graphics();
    this.dialGraphics.setScrollFactor(0);
    this.dialGraphics.setDepth(1000);
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();

    // Maneuver direction keys
    this.input.keyboard!.on('keydown-LEFT', () => {
      this.changeManeuverDirection(-1);
    });
    this.input.keyboard!.on('keydown-RIGHT', () => {
      this.changeManeuverDirection(1);
    });

    // Speed keys
    this.input.keyboard!.on('keydown-W', () => {
      this.changeSpeed(1);
    });
    this.input.keyboard!.on('keydown-S', () => {
      this.changeSpeed(-1);
    });
    this.input.keyboard!.on('keydown-UP', () => {
      this.changeSpeed(1);
    });
    this.input.keyboard!.on('keydown-DOWN', () => {
      this.changeSpeed(-1);
    });

    // Pause
    this.input.keyboard!.on('keydown-SPACE', () => {
      this.togglePause();
    });

    // ESC also pauses
    this.input.keyboard!.on('keydown-ESC', () => {
      this.togglePause();
    });

    // Camera controls
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: unknown, deltaX: number, deltaY: number) => {
      const zoom = this.cameras.main.zoom;
      this.cameras.main.setZoom(Phaser.Math.Clamp(zoom - deltaY * 0.001, 0.5, 2));
    });
  }

  // ==========================================
  // CORE GAME LOOP
  // ==========================================

  private processManeuverInterval(): void {
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;

      // Calculate target position based on current maneuver
      const template = getManeuverTemplate(ship.currentManeuverDir, ship.currentSpeed);
      const result = applyManeuver(ship.x, ship.y, ship.angle, template);

      // Set interpolation targets
      ship.targetX = result.x;
      ship.targetY = result.y;
      ship.targetAngle = result.angle;

      // Handle stress from red maneuvers
      const dial = getShipDial(ship.definitionId);
      const maneuver = dial.find(
        (m) => m.direction === ship.currentManeuverDir && m.speed === ship.currentSpeed
      );
      if (maneuver?.difficulty === 'red') {
        ship.stressTokens++;
      } else if (maneuver?.difficulty === 'green' && ship.stressTokens > 0) {
        ship.stressTokens--;
      }

      // Apply selected maneuver to selected player ship
      if (ship.id === this.selectedShipId && ship.owner === 'player') {
        ship.currentManeuverDir = this.selectedManeuverDir;
        ship.currentSpeed = this.selectedSpeed;
      }
    }
  }

  private interpolateShipPositions(delta: number): void {
    const t = Math.min(1, delta / MANEUVER_ANIMATION_DURATION);

    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;

      // Lerp position
      ship.x = Phaser.Math.Linear(ship.x, ship.targetX, t * 3);
      ship.y = Phaser.Math.Linear(ship.y, ship.targetY, t * 3);

      // Lerp angle (handle wrapping)
      let angleDiff = ship.targetAngle - ship.angle;
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;
      ship.angle += angleDiff * t * 3;

      // Normalize angle
      ship.angle = ((ship.angle % 360) + 360) % 360;

      // Wrap around battlefield
      ship.x = ((ship.x % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) % BATTLEFIELD_SIZE;
      ship.y = ((ship.y % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) % BATTLEFIELD_SIZE;
      ship.targetX = ((ship.targetX % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) % BATTLEFIELD_SIZE;
      ship.targetY = ((ship.targetY % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) % BATTLEFIELD_SIZE;

      // Update sprite
      const sprite = this.shipSprites.get(ship.id);
      if (sprite) {
        sprite.setPosition(ship.x, ship.y);
        sprite.setAngle(ship.angle);

        // Update speed indicator
        sprite.speedIndicator.setText(`S${ship.currentSpeed}`);

        // Thruster intensity based on speed
        sprite.thruster.setAlpha(0.3 + ship.currentSpeed * 0.15);
      }
    }
  }

  private processCombat(delta: number): void {
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;

      // Reduce weapon cooldown
      ship.weaponCooldown = Math.max(0, ship.weaponCooldown - delta);

      // Auto-fire at enemies in arc using mode-balanced cooldown
      if (ship.weaponCooldown <= 0) {
        const target = this.findTarget(ship);
        if (target) {
          this.fireAt(ship, target);
          // Use ship's mode-balanced weapon cooldown, modified by AI difficulty
          let cooldown = ship.combatStats.weaponCooldown;
          if (ship.owner === 'ai') {
            cooldown = getModifiedCooldown(cooldown, this.aiDifficulty);
          }
          ship.weaponCooldown = cooldown;
        }
      }
    }
  }

  private findTarget(ship: TacticalShip): TacticalShip | null {
    let best: TacticalShip | null = null;
    let bestDist = Infinity;

    // Use ship's mode-balanced range and arc
    const maxRange = ship.combatStats.weaponRange;
    const maxArcRad = (ship.combatStats.firingArc / 2) * Phaser.Math.DEG_TO_RAD;

    for (const other of this.ships.values()) {
      if (other.faction === ship.faction) continue;
      if (other.hull <= 0) continue;

      const dist = Phaser.Math.Distance.Between(ship.x, ship.y, other.x, other.y);

      // Check firing arc using ship's arc stat
      const angleToTarget = Phaser.Math.Angle.Between(ship.x, ship.y, other.x, other.y);
      const shipFacing = (ship.angle - 90) * Phaser.Math.DEG_TO_RAD;
      let angleDiff = Math.abs(angleToTarget - shipFacing);
      if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

      if (dist < maxRange && angleDiff < maxArcRad && dist < bestDist) {
        best = other;
        bestDist = dist;
      }
    }

    return best;
  }

  private fireAt(attacker: TacticalShip, target: TacticalShip): void {
    // Calculate hit chance using mode balancing system
    let hitChance = calculateHitChance(
      attacker.combatStats.attackDice,
      target.combatStats.agilityDice
    );

    // Apply AI difficulty modifiers
    const isAIAttacking = attacker.owner === 'ai';
    const isAIDefending = target.owner === 'ai';

    if (isAIAttacking) {
      hitChance = getModifiedHitChance(hitChance, this.aiDifficulty);
    }

    const hit = Math.random() < hitChance;

    if (hit) {
      // Damage is based on attacker's attack stat
      let damage = attacker.combatStats.attackDice;

      // Apply difficulty damage modifiers
      if (isAIAttacking) {
        damage = getModifiedDamage(damage, this.aiDifficulty, true);
      } else if (isAIDefending) {
        // Player attacking AI - AI takes modified damage
        damage = getModifiedDamage(damage, this.aiDifficulty, false);
      }
      let shieldDamage = 0;
      if (target.shields > 0) {
        shieldDamage = Math.min(target.shields, damage);
        target.shields -= shieldDamage;
        const hullDamage = damage - shieldDamage;
        if (hullDamage > 0) {
          target.hull = Math.max(0, target.hull - hullDamage);
        }
      } else {
        target.hull = Math.max(0, target.hull - damage);
      }

      // Track damage dealt by player ships
      if (attacker.owner === 'player') {
        this.stats.damageDealt += damage;
      }

      // Visual feedback using effects manager
      this.effectsManager.fireLaser(attacker.x, attacker.y, target.x, target.y, attacker.faction as FactionId, true);
      this.effectsManager.showDamageNumber(target.x, target.y, damage, damage >= 3);

      // Shield impact effect if shields were hit
      if (shieldDamage > 0) {
        this.effectsManager.shieldImpact(target.x, target.y, 0, target.faction as FactionId);
      }

      // Update health bar
      const healthBar = this.healthBars.get(target.id);
      healthBar?.update(target.hull, target.shields);

      // Check destruction
      if (target.hull <= 0) {
        this.destroyShip(target.id, attacker.id);
      }
    } else {
      // Show miss using effects manager
      this.effectsManager.fireLaser(attacker.x, attacker.y, target.x, target.y, attacker.faction as FactionId, false);
    }
  }

  private destroyShip(shipId: string, destroyerShipId?: string): void {
    const ship = this.ships.get(shipId);
    const wasPlayerShip = ship?.owner === 'player';

    const sprite = this.shipSprites.get(shipId);
    if (sprite) {
      // Use EffectsManager for explosion
      this.effectsManager.createExplosion(sprite.x, sprite.y, 'medium');
      sprite.destroy();
      this.shipSprites.delete(shipId);
    }

    // Remove engine trail
    this.effectsManager.removeEngineTrail(shipId);

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
        // Show notification in top-center of screen
        this.effectsManager.showKillNotification(killerName, victimName, 640, 60);
      }
    }

    // Track stats
    if (wasPlayerShip) {
      this.stats.shipsLost++;
    } else {
      this.stats.shipsDestroyed++;
    }

    this.playerShipIds = this.playerShipIds.filter((id) => id !== shipId);
    this.enemyShipIds = this.enemyShipIds.filter((id) => id !== shipId);

    if (shipId === this.selectedShipId) {
      this.selectedShipId = this.playerShipIds[0] ?? null;
    }

    this.checkVictory();
  }

  private checkVictory(): void {
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
    } else if (!playerAlive) {
      this.showGameOver(false, 'Enemy Forces');
    }
  }

  private showGameOver(isPlayerVictory: boolean, winner: string): void {
    this.isPaused = true;

    const battleDuration = this.time.now - this.battleStartTime;

    new GameOverScreen({
      scene: this,
      stats: {
        winner,
        isPlayerVictory,
        shipsDestroyed: this.stats.shipsDestroyed,
        shipsLost: this.stats.shipsLost,
        damageDealt: this.stats.damageDealt,
        battleDuration,
      },
      onRestart: () => {
        this.scene.restart();
      },
      onQuit: () => {
        this.scene.start('MainMenuScene');
      },
    });
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    this.instructionText.setColor(this.isPaused ? '#ff4444' : '#888888');

    if (this.isPaused && this.pauseMenu) {
      this.pauseMenu.show();
    }
  }

  // ==========================================
  // AI
  // ==========================================

  private updateAI(): void {
    for (const shipId of this.enemyShipIds) {
      const ship = this.ships.get(shipId);
      if (!ship || ship.hull <= 0) continue;

      // AI target selection affected by difficulty
      let target: TacticalShip | null;
      if (shouldPickOptimalTarget(this.aiDifficulty)) {
        // Optimal: pick closest enemy
        target = this.findClosestEnemy(ship);
      } else {
        // Suboptimal: pick random enemy
        target = this.findRandomEnemy(ship);
      }
      if (!target) continue;

      const angleDiff = headingDiffToTarget(ship.x, ship.y, ship.angle, target.x, target.y);

      // Choose maneuver based on angle difference
      const dial = getShipDial(ship.definitionId);

      // Filter out red maneuvers if stressed
      const available = ship.stressTokens > 0
        ? dial.filter((m) => m.difficulty !== 'red')
        : dial;

      // Difficulty affects maneuver quality
      if (shouldPickOptimalManeuver(this.aiDifficulty)) {
        // Optimal maneuver selection
        if (Math.abs(angleDiff) < 20) {
          // Go straight
          const straight = available.find((m) => m.direction === 'straight');
          if (straight) {
            ship.currentManeuverDir = 'straight';
            ship.currentSpeed = straight.speed;
          }
        } else if (angleDiff > 0) {
          // Turn right
          const turn = available.find((m) => m.direction === 'bank_right' || m.direction === 'turn_right');
          if (turn) {
            ship.currentManeuverDir = turn.direction;
            ship.currentSpeed = turn.speed;
          }
        } else {
          // Turn left
          const turn = available.find((m) => m.direction === 'bank_left' || m.direction === 'turn_left');
          if (turn) {
            ship.currentManeuverDir = turn.direction;
            ship.currentSpeed = turn.speed;
          }
        }
      } else {
        // Random maneuver selection (suboptimal on lower difficulty)
        const randomManeuver = available[Math.floor(Math.random() * available.length)];
        if (randomManeuver) {
          ship.currentManeuverDir = randomManeuver.direction;
          ship.currentSpeed = randomManeuver.speed;
        }
      }
    }
  }

  private findRandomEnemy(ship: TacticalShip): TacticalShip | null {
    const enemies: TacticalShip[] = [];

    for (const other of this.ships.values()) {
      if (other.faction === ship.faction || other.hull <= 0) continue;
      enemies.push(other);
    }

    if (enemies.length === 0) return null;
    return enemies[Math.floor(Math.random() * enemies.length)] ?? null;
  }

  private findClosestEnemy(ship: TacticalShip): TacticalShip | null {
    let closest: TacticalShip | null = null;
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

  // ==========================================
  // PLAYER INPUT
  // ==========================================

  private selectShip(shipId: string): void {
    this.selectedShipId = shipId;
    const ship = this.ships.get(shipId);
    if (ship) {
      this.selectedManeuverDir = ship.currentManeuverDir;
      this.selectedSpeed = ship.currentSpeed;
      this.updateHUD();

      // Camera follow
      this.cameras.main.startFollow(
        this.shipSprites.get(shipId) as Phaser.GameObjects.Container,
        true,
        0.1,
        0.1
      );
    }
  }

  private changeManeuverDirection(delta: number): void {
    if (!this.selectedShipId) return;
    const ship = this.ships.get(this.selectedShipId);
    if (!ship) return;

    const dial = getShipDial(ship.definitionId);
    const directions: ManeuverDirection[] = [
      'turn_left',
      'bank_left',
      'straight',
      'bank_right',
      'turn_right',
    ];

    let currentIdx = directions.indexOf(this.selectedManeuverDir);
    if (currentIdx === -1) currentIdx = 2; // Default to straight

    const newIdx = Phaser.Math.Clamp(currentIdx + delta, 0, directions.length - 1);
    const newDir = directions[newIdx];

    // Check if this direction is available in the dial at current speed
    const available = dial.find((m) => m.direction === newDir && m.speed === this.selectedSpeed);
    if (available) {
      // Check stress restrictions
      if (ship.stressTokens > 0 && available.difficulty === 'red') {
        return; // Can't do red maneuvers while stressed
      }
      this.selectedManeuverDir = newDir as ManeuverDirection;
    } else {
      // Try to find any available maneuver in this direction
      const anyAvailable = dial.find((m) => m.direction === newDir);
      if (anyAvailable) {
        if (ship.stressTokens > 0 && anyAvailable.difficulty === 'red') {
          return;
        }
        this.selectedManeuverDir = newDir as ManeuverDirection;
        this.selectedSpeed = anyAvailable.speed;
      }
    }

    this.updateHUD();
  }

  private changeSpeed(delta: number): void {
    if (!this.selectedShipId) return;
    const ship = this.ships.get(this.selectedShipId);
    if (!ship) return;

    const dial = getShipDial(ship.definitionId);

    // Find available speeds for current direction
    const available = dial
      .filter((m) => m.direction === this.selectedManeuverDir)
      .map((m) => m.speed)
      .sort((a, b) => a - b);

    if (available.length === 0) return;

    let currentIdx = available.indexOf(this.selectedSpeed);
    if (currentIdx === -1) currentIdx = 0;

    const newIdx = Phaser.Math.Clamp(currentIdx + delta, 0, available.length - 1);
    const newSpeed = available[newIdx];
    if (newSpeed !== undefined) {
      const maneuver = dial.find((m) => m.direction === this.selectedManeuverDir && m.speed === newSpeed);
      if (maneuver && !(ship.stressTokens > 0 && maneuver.difficulty === 'red')) {
        this.selectedSpeed = newSpeed;
      }
    }

    this.updateHUD();
  }

  // ==========================================
  // UI UPDATES
  // ==========================================

  private updateHUD(): void {
    const dirNames: Record<ManeuverDirection, string> = {
      straight: 'STRAIGHT',
      bank_left: 'BANK LEFT',
      bank_right: 'BANK RIGHT',
      turn_left: 'TURN LEFT',
      turn_right: 'TURN RIGHT',
      kturn: 'K-TURN',
      segnor_left: 'SEGNOR L',
      segnor_right: 'SEGNOR R',
      tallon_left: 'TALLON L',
      tallon_right: 'TALLON R',
    };

    this.speedText.setText(`Speed: ${this.selectedSpeed}`);
    this.maneuverText.setText(`Maneuver: ${dirNames[this.selectedManeuverDir]}`);

    // Update dial visualization
    this.updateDialDisplay();
  }

  private updateDialDisplay(): void {
    this.dialGraphics.clear();

    if (!this.selectedShipId) return;
    const ship = this.ships.get(this.selectedShipId);
    if (!ship) return;

    const dial = getShipDial(ship.definitionId);
    const cx = 100;
    const cy = 200;
    const radius = 40;

    // Background
    this.dialGraphics.fillStyle(0x000000, 0.6);
    this.dialGraphics.fillCircle(cx, cy, radius + 10);

    // Draw maneuver options
    const positions: Record<ManeuverDirection, { angle: number }> = {
      turn_left: { angle: -90 },
      bank_left: { angle: -45 },
      straight: { angle: 0 },
      bank_right: { angle: 45 },
      turn_right: { angle: 90 },
      kturn: { angle: 180 },
      segnor_left: { angle: 135 },
      segnor_right: { angle: -135 },
      tallon_left: { angle: -135 },
      tallon_right: { angle: 135 },
    };

    for (const m of dial) {
      if (m.speed !== this.selectedSpeed) continue;

      const pos = positions[m.direction];
      if (!pos) continue;

      const angle = (pos.angle - 90) * Phaser.Math.DEG_TO_RAD;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      const isSelected = m.direction === this.selectedManeuverDir;
      const color =
        m.difficulty === 'green' ? 0x44ff44 : m.difficulty === 'red' ? 0xff4444 : 0xffffff;

      this.dialGraphics.fillStyle(color, isSelected ? 1 : 0.5);
      this.dialGraphics.fillCircle(x, y, isSelected ? 8 : 5);
    }
  }

  private updatePreview(): void {
    if (this.previewGraphics) {
      this.previewGraphics.destroy();
      this.previewGraphics = null;
    }

    if (!this.selectedShipId) return;
    const ship = this.ships.get(this.selectedShipId);
    if (!ship) return;

    const template = getManeuverTemplate(this.selectedManeuverDir, this.selectedSpeed);
    const result = applyManeuver(ship.x, ship.y, ship.angle, template);

    this.previewGraphics = this.add.graphics();
    this.previewGraphics.setDepth(5);

    // Draw path preview
    const dial = getShipDial(ship.definitionId);
    const maneuver = dial.find((m) => m.direction === this.selectedManeuverDir && m.speed === this.selectedSpeed);
    const color = maneuver?.difficulty === 'green' ? 0x44ff44 : maneuver?.difficulty === 'red' ? 0xff4444 : 0xffffff;

    this.previewGraphics.lineStyle(2, color, 0.5);
    this.previewGraphics.lineBetween(ship.x, ship.y, result.x, result.y);

    this.previewGraphics.lineStyle(1, color, 0.3);
    this.previewGraphics.strokeCircle(result.x, result.y, 15);
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

      // Highlight selected ship
      if (id === this.selectedShipId) {
        sprite.shipBody.setAlpha(1);
      } else {
        sprite.shipBody.setAlpha(0.8);
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

    this.minimap.update(minimapShips);
  }
}
