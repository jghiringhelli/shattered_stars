/**
 * Dogfight Scene - 1v1 Quick Duels
 *
 * Intense 1v1 battles with:
 * - Best-of-3 or Best-of-5 format
 * - Small squads (50 points, typically 1-2 ships)
 * - 3 minute round time limit
 * - Closer spawn distance for faster engagement
 * - Tighter camera zoom
 */

import Phaser from 'phaser';
import type { FactionId } from '../config';
import { BATTLEFIELD_SIZE, FACTION_COLORS, SHIP_SIZES } from '../config';
import { getShipDefinition, getShipsByFaction, getShipDial } from '../data/ShipDefinitions';
import { getModeCombatStats, calculateHitChance, type ModeCombatStats } from '../data/ModeBalancing';
import { getManeuverTemplate, applyManeuver } from '../systems/ManeuverTemplates';
import { HealthBar } from '../ui/HealthBar';
import { EffectsManager } from '../rendering/EffectsManager';
import { ParallaxBackground } from '../rendering/ParallaxBackground';
import { audioManager } from '../audio/AudioManager';
import type { ManeuverDirection } from '../core/types';

interface DogfightShip {
  id: string;
  definitionId: string;
  faction: FactionId;
  owner: 'player' | 'ai';
  x: number;
  y: number;
  angle: number;
  hull: number;
  maxHull: number;
  shields: number;
  maxShields: number;
  combatStats: ModeCombatStats;
  currentManeuverDir: ManeuverDirection;
  currentSpeed: number;
  targetX: number;
  targetY: number;
  targetAngle: number;
  weaponCooldown: number;
}

interface ShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
}

type MatchFormat = 'best_of_3' | 'best_of_5';

export class DogfightScene extends Phaser.Scene {
  private ships: Map<string, DogfightShip> = new Map();
  private shipSprites: Map<string, ShipSprite> = new Map();
  private healthBars: Map<string, HealthBar> = new Map();

  private playerShipIds: string[] = [];
  private enemyShipIds: string[] = [];

  // Match state
  private matchFormat: MatchFormat = 'best_of_3';
  private playerWins = 0;
  private enemyWins = 0;
  private currentRound = 0;
  private roundTimeRemaining = 180; // 3 minutes in seconds
  private isRoundActive = false;
  private roundResult: 'none' | 'player_win' | 'enemy_win' | 'draw' = 'none';

  // Settings
  private playerFaction: FactionId = 'free_confederation';
  private enemyFaction: FactionId = 'terran_hegemony';
  private playerShipId = 'confed_falcon';
  private enemyShipId = 'heg_raptor';
  private difficulty: 'easy' | 'normal' | 'hard' | 'brutal' = 'normal';

  // Game state
  private isPaused = false;
  private isSetupPhase = true;
  private matchComplete = false;

  // Timing
  private lastManeuverTime = 0;
  private maneuverInterval = 300;
  private lastSecondTime = 0;

  // Effects
  private effectsManager!: EffectsManager;
  private background!: ParallaxBackground;

  // UI
  private roundText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private setupContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'DogfightScene' });
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, BATTLEFIELD_SIZE, BATTLEFIELD_SIZE);
    this.cameras.main.setBackgroundColor(0x050510);

    audioManager.initialize();

    this.effectsManager = new EffectsManager(this);
    this.background = new ParallaxBackground(this, BATTLEFIELD_SIZE, BATTLEFIELD_SIZE);
    this.background.startShootingStars();

    this.resetMatchState();
    this.showSetupScreen();

    this.cameras.main.centerOn(BATTLEFIELD_SIZE / 2, BATTLEFIELD_SIZE / 2);
    // Tighter zoom for dogfight
    this.cameras.main.setZoom(1.1);
  }

  private resetMatchState(): void {
    this.playerWins = 0;
    this.enemyWins = 0;
    this.currentRound = 0;
    this.isRoundActive = false;
    this.matchComplete = false;
  }

  private resetRoundState(): void {
    this.ships.clear();
    this.shipSprites.forEach(s => s.destroy());
    this.shipSprites.clear();
    this.healthBars.forEach(h => h.destroy());
    this.healthBars.clear();
    this.playerShipIds = [];
    this.enemyShipIds = [];
    this.roundTimeRemaining = 180;
    this.roundResult = 'none';
    this.isPaused = false;
  }

  private showSetupScreen(): void {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    this.setupContainer = this.add.container(0, 0);
    this.setupContainer.setScrollFactor(0);
    this.setupContainer.setDepth(2000);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.9);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);
    this.setupContainer.add(bg);

    // Title
    const title = this.add.text(centerX, 50, 'DOGFIGHT', {
      font: 'bold 48px Arial',
      color: '#ff8844',
    }).setOrigin(0.5);
    this.setupContainer.add(title);

    const subtitle = this.add.text(centerX, 95, '1v1 Quick Duels', {
      font: '20px Arial',
      color: '#aaaaaa',
    }).setOrigin(0.5);
    this.setupContainer.add(subtitle);

    // Format selection
    const formatLabel = this.add.text(centerX, 140, 'Match Format:', {
      font: 'bold 20px Arial',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.setupContainer.add(formatLabel);

    const formats: Array<{ id: MatchFormat; name: string }> = [
      { id: 'best_of_3', name: 'Best of 3' },
      { id: 'best_of_5', name: 'Best of 5' },
    ];

    formats.forEach((format, i) => {
      const btn = this.createSelectionButton(
        centerX - 100 + i * 200,
        180,
        format.name,
        format.id === this.matchFormat,
        () => {
          this.matchFormat = format.id;
          this.showSetupScreen();
        }
      );
      this.setupContainer.add(btn);
    });

    // Ship selection - Player
    const playerLabel = this.add.text(centerX - 200, 240, 'Your Ship:', {
      font: 'bold 20px Arial',
      color: '#44ff44',
    }).setOrigin(0.5);
    this.setupContainer.add(playerLabel);

    const playerShips = getShipsByFaction(this.playerFaction);
    let yPos = 280;
    playerShips.slice(0, 4).forEach((ship) => {
      const btn = this.createSelectionButton(
        centerX - 200,
        yPos,
        ship.name,
        ship.id === this.playerShipId,
        () => {
          this.playerShipId = ship.id;
          this.showSetupScreen();
        }
      );
      this.setupContainer.add(btn);
      yPos += 40;
    });

    // Ship selection - Enemy
    const enemyLabel = this.add.text(centerX + 200, 240, 'Enemy Ship:', {
      font: 'bold 20px Arial',
      color: '#ff4444',
    }).setOrigin(0.5);
    this.setupContainer.add(enemyLabel);

    const enemyShips = getShipsByFaction(this.enemyFaction);
    yPos = 280;
    enemyShips.slice(0, 4).forEach((ship) => {
      const btn = this.createSelectionButton(
        centerX + 200,
        yPos,
        ship.name,
        ship.id === this.enemyShipId,
        () => {
          this.enemyShipId = ship.id;
          this.showSetupScreen();
        }
      );
      this.setupContainer.add(btn);
      yPos += 40;
    });

    // Faction selection
    const factions: FactionId[] = ['terran_hegemony', 'free_confederation', 'synthetic_collective', 'void_corsairs', 'ascendant_empire'];
    const factionNames: Record<FactionId, string> = {
      terran_hegemony: 'Hegemony',
      free_confederation: 'Confederation',
      synthetic_collective: 'Collective',
      void_corsairs: 'Corsairs',
      ascendant_empire: 'Empire',
    };

    // Player faction
    const playerFactionLabel = this.add.text(centerX - 200, 460, 'Your Faction:', {
      font: '16px Arial',
      color: '#888888',
    }).setOrigin(0.5);
    this.setupContainer.add(playerFactionLabel);

    factions.forEach((faction, i) => {
      const btn = this.createSmallButton(
        centerX - 320 + i * 60,
        490,
        factionNames[faction].substring(0, 3),
        faction === this.playerFaction,
        () => {
          this.playerFaction = faction;
          const ships = getShipsByFaction(faction);
          this.playerShipId = ships[0]?.id ?? '';
          this.showSetupScreen();
        }
      );
      this.setupContainer.add(btn);
    });

    // Enemy faction
    const enemyFactionLabel = this.add.text(centerX + 200, 460, 'Enemy Faction:', {
      font: '16px Arial',
      color: '#888888',
    }).setOrigin(0.5);
    this.setupContainer.add(enemyFactionLabel);

    factions.forEach((faction, i) => {
      const btn = this.createSmallButton(
        centerX + 80 + i * 60,
        490,
        factionNames[faction].substring(0, 3),
        faction === this.enemyFaction,
        () => {
          this.enemyFaction = faction;
          const ships = getShipsByFaction(faction);
          this.enemyShipId = ships[0]?.id ?? '';
          this.showSetupScreen();
        }
      );
      this.setupContainer.add(btn);
    });

    // Difficulty
    const diffLabel = this.add.text(centerX, 540, 'AI Difficulty:', {
      font: '16px Arial',
      color: '#888888',
    }).setOrigin(0.5);
    this.setupContainer.add(diffLabel);

    const difficulties: Array<'easy' | 'normal' | 'hard' | 'brutal'> = ['easy', 'normal', 'hard', 'brutal'];
    difficulties.forEach((diff, i) => {
      const btn = this.createSmallButton(
        centerX - 120 + i * 80,
        570,
        diff.toUpperCase(),
        diff === this.difficulty,
        () => {
          this.difficulty = diff;
          this.showSetupScreen();
        }
      );
      this.setupContainer.add(btn);
    });

    // Start button
    const startBtn = this.add.container(centerX, this.scale.height - 80);
    const startBg = this.add.graphics();
    startBg.fillStyle(0x884422, 1);
    startBg.fillRoundedRect(-80, -25, 160, 50, 10);
    startBtn.add(startBg);

    const startText = this.add.text(0, 0, 'FIGHT!', {
      font: 'bold 28px Arial',
      color: '#ffffff',
    }).setOrigin(0.5);
    startBtn.add(startText);

    const startHit = this.add.rectangle(0, 0, 160, 50).setInteractive({ useHandCursor: true });
    startBtn.add(startHit);

    startHit.on('pointerover', () => {
      startBg.clear();
      startBg.fillStyle(0xaa6633, 1);
      startBg.fillRoundedRect(-80, -25, 160, 50, 10);
    });

    startHit.on('pointerout', () => {
      startBg.clear();
      startBg.fillStyle(0x884422, 1);
      startBg.fillRoundedRect(-80, -25, 160, 50, 10);
    });

    startHit.on('pointerdown', () => {
      this.startMatch();
    });

    this.setupContainer.add(startBtn);

    // Back button
    const backBtn = this.add.text(50, 40, '< BACK', {
      font: 'bold 20px Arial',
      color: '#aaaaaa',
    }).setInteractive({ useHandCursor: true });

    backBtn.on('pointerover', () => backBtn.setColor('#ffffff'));
    backBtn.on('pointerout', () => backBtn.setColor('#aaaaaa'));
    backBtn.on('pointerdown', () => {
      this.scene.start('MainMenuScene');
    });

    this.setupContainer.add(backBtn);
  }

  private createSelectionButton(
    x: number,
    y: number,
    label: string,
    selected: boolean,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    if (selected) {
      bg.fillStyle(0x446688, 1);
      bg.lineStyle(2, 0x66aaff, 1);
    } else {
      bg.fillStyle(0x222233, 0.8);
    }
    bg.fillRoundedRect(-80, -15, 160, 30, 5);
    if (selected) {
      bg.strokeRoundedRect(-80, -15, 160, 30, 5);
    }
    container.add(bg);

    const text = this.add.text(0, 0, label, {
      font: selected ? 'bold 14px Arial' : '14px Arial',
      color: selected ? '#44ffaa' : '#888888',
    }).setOrigin(0.5);
    container.add(text);

    const hitArea = this.add.rectangle(0, 0, 160, 30).setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerdown', onClick);

    return container;
  }

  private createSmallButton(
    x: number,
    y: number,
    label: string,
    selected: boolean,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    if (selected) {
      bg.fillStyle(0x446688, 1);
      bg.lineStyle(2, 0x66aaff, 1);
    } else {
      bg.fillStyle(0x222233, 0.8);
    }
    bg.fillRoundedRect(-25, -12, 50, 24, 4);
    if (selected) {
      bg.strokeRoundedRect(-25, -12, 50, 24, 4);
    }
    container.add(bg);

    const text = this.add.text(0, 0, label, {
      font: selected ? 'bold 11px Arial' : '11px Arial',
      color: selected ? '#44ffaa' : '#666666',
    }).setOrigin(0.5);
    container.add(text);

    const hitArea = this.add.rectangle(0, 0, 50, 24).setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerdown', onClick);

    return container;
  }

  private startMatch(): void {
    this.setupContainer.destroy();
    this.isSetupPhase = false;

    audioManager.playMusic('combat_high');

    this.createHUD();
    this.setupInput();
    this.startNextRound();
  }

  private startNextRound(): void {
    this.resetRoundState();
    this.currentRound++;

    this.roundText.setText(`ROUND ${this.currentRound}`);
    this.updateScoreDisplay();

    // Spawn ships closer together for faster engagement
    const centerX = BATTLEFIELD_SIZE / 2;
    const centerY = BATTLEFIELD_SIZE / 2;
    const spawnDistance = 200; // Closer than skirmish

    this.spawnShip(this.playerShipId, this.playerFaction, 'player', centerX, centerY + spawnDistance, 0);
    this.spawnShip(this.enemyShipId, this.enemyFaction, 'ai', centerX, centerY - spawnDistance, 180);

    this.showRoundStart();
  }

  private showRoundStart(): void {
    const text = this.add.text(this.scale.width / 2, this.scale.height / 2, `ROUND ${this.currentRound}`, {
      font: 'bold 48px Arial',
      color: '#ffaa00',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

    this.tweens.add({
      targets: text,
      scale: 1.5,
      alpha: 0,
      duration: 1500,
      onComplete: () => {
        text.destroy();
        this.isRoundActive = true;
      },
    });
  }

  update(time: number, delta: number): void {
    if (this.isSetupPhase || this.isPaused || this.matchComplete) return;

    this.background.update();

    // Update timer
    if (this.isRoundActive) {
      if (time - this.lastSecondTime >= 1000) {
        this.roundTimeRemaining--;
        this.updateTimerDisplay();
        this.lastSecondTime = time;

        if (this.roundTimeRemaining <= 0) {
          this.endRound('draw');
          return;
        }
      }
    }

    if (time - this.lastManeuverTime >= this.maneuverInterval) {
      this.processManeuvers();
      this.lastManeuverTime = time;
    }

    this.interpolatePositions(delta);
    this.processCombat(delta);
    this.updateAI();
    this.updateSprites();
    this.checkRoundEnd();
  }

  private createHUD(): void {
    this.roundText = this.add
      .text(this.scale.width / 2, 25, 'ROUND 1', {
        font: 'bold 24px Arial',
        color: '#ffaa00',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);

    this.timerText = this.add
      .text(this.scale.width / 2, 55, '3:00', {
        font: 'bold 32px monospace',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);

    this.scoreText = this.add
      .text(this.scale.width / 2, 90, '0 - 0', {
        font: 'bold 28px Arial',
        color: '#888888',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);

    this.add
      .text(this.scale.width / 2, this.scale.height - 25, 'Arrow keys: Move | ESC: Pause', {
        font: '14px monospace',
        color: '#666666',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);
  }

  private updateTimerDisplay(): void {
    const minutes = Math.floor(this.roundTimeRemaining / 60);
    const seconds = this.roundTimeRemaining % 60;
    this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);

    // Change color when low on time
    if (this.roundTimeRemaining <= 30) {
      this.timerText.setColor('#ff4444');
    } else if (this.roundTimeRemaining <= 60) {
      this.timerText.setColor('#ffaa44');
    }
  }

  private updateScoreDisplay(): void {
    const winsNeeded = this.matchFormat === 'best_of_3' ? 2 : 3;
    this.scoreText.setText(`${this.playerWins} - ${this.enemyWins}`);

    // Show how many wins needed
    const remaining = winsNeeded - Math.max(this.playerWins, this.enemyWins);
    if (remaining === 1) {
      this.scoreText.setColor('#ffdd00');
    }
  }

  private setupInput(): void {
    this.input.keyboard!.on('keydown-ESC', () => {
      this.isPaused = !this.isPaused;
    });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gos: unknown, _dx: number, deltaY: number) => {
      const zoom = this.cameras.main.zoom - deltaY * 0.001;
      this.cameras.main.setZoom(Phaser.Math.Clamp(zoom, 0.8, 2));
    });
  }

  private spawnShip(defId: string, faction: FactionId, owner: 'player' | 'ai', x: number, y: number, angle: number): void {
    const id = `${owner}_0`;
    const combatStats = getModeCombatStats(defId, 'continuous');

    const ship: DogfightShip = {
      id,
      definitionId: defId,
      faction,
      owner,
      x,
      y,
      angle,
      hull: combatStats.hull,
      maxHull: combatStats.maxHull,
      shields: combatStats.shields,
      maxShields: combatStats.maxShields,
      combatStats,
      currentManeuverDir: 'straight',
      currentSpeed: 2,
      targetX: x,
      targetY: y,
      targetAngle: angle,
      weaponCooldown: 0,
    };

    this.ships.set(id, ship);

    if (owner === 'player') {
      this.playerShipIds.push(id);
    } else {
      this.enemyShipIds.push(id);
    }

    this.createShipSprite(ship);
    this.createHealthBar(ship);
  }

  private createShipSprite(ship: DogfightShip): void {
    const container = this.add.container(ship.x, ship.y) as unknown as ShipSprite;
    container.shipId = ship.id;

    const color = FACTION_COLORS[ship.faction] ?? 0xffffff;
    const size = SHIP_SIZES.medium; // Slightly larger for dogfight visibility

    const body = this.add.graphics();
    body.fillStyle(color, 1);
    body.beginPath();
    body.moveTo(0, -size / 2);
    body.lineTo(-size / 3, size / 2);
    body.lineTo(0, size / 3);
    body.lineTo(size / 3, size / 2);
    body.closePath();
    body.fillPath();
    body.lineStyle(2, 0xffffff, 0.9);
    body.strokePath();
    container.add(body);

    container.setAngle(ship.angle);
    container.setDepth(10);

    this.shipSprites.set(ship.id, container);
  }

  private createHealthBar(ship: DogfightShip): void {
    const healthBar = new HealthBar({
      scene: this,
      x: ship.x,
      y: ship.y - 50,
      faction: ship.faction,
      maxHull: ship.maxHull,
      maxShields: ship.maxShields,
      currentHull: ship.hull,
      currentShields: ship.shields,
    });
    this.healthBars.set(ship.id, healthBar);
  }

  private processManeuvers(): void {
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;

      const template = getManeuverTemplate(ship.currentManeuverDir, ship.currentSpeed);
      const result = applyManeuver(ship.x, ship.y, ship.angle, template);

      ship.targetX = result.x;
      ship.targetY = result.y;
      ship.targetAngle = result.angle;
    }
  }

  private interpolatePositions(delta: number): void {
    const t = Math.min(1, delta / 280);

    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;

      ship.x = Phaser.Math.Linear(ship.x, ship.targetX, t * 3);
      ship.y = Phaser.Math.Linear(ship.y, ship.targetY, t * 3);

      let angleDiff = ship.targetAngle - ship.angle;
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;
      ship.angle += angleDiff * t * 3;
      ship.angle = ((ship.angle % 360) + 360) % 360;

      // Wrap around
      ship.x = ((ship.x % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) % BATTLEFIELD_SIZE;
      ship.y = ((ship.y % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) % BATTLEFIELD_SIZE;

      const sprite = this.shipSprites.get(ship.id);
      if (sprite) {
        sprite.setPosition(ship.x, ship.y);
        sprite.setAngle(ship.angle);
      }
    }
  }

  private processCombat(delta: number): void {
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;

      ship.weaponCooldown = Math.max(0, ship.weaponCooldown - delta);

      if (ship.weaponCooldown <= 0) {
        const target = this.findTarget(ship);
        if (target) {
          this.fireAt(ship, target);
          ship.weaponCooldown = ship.combatStats.weaponCooldown;
        }
      }
    }
  }

  private findTarget(ship: DogfightShip): DogfightShip | null {
    const maxRange = ship.combatStats.weaponRange;
    const maxArcRad = (ship.combatStats.firingArc / 2) * Phaser.Math.DEG_TO_RAD;

    for (const other of this.ships.values()) {
      if (other.faction === ship.faction || other.hull <= 0) continue;

      const dist = Phaser.Math.Distance.Between(ship.x, ship.y, other.x, other.y);
      const angleToTarget = Phaser.Math.Angle.Between(ship.x, ship.y, other.x, other.y);
      const shipFacing = (ship.angle - 90) * Phaser.Math.DEG_TO_RAD;
      let angleDiff = Math.abs(angleToTarget - shipFacing);
      if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

      if (dist < maxRange && angleDiff < maxArcRad) {
        return other;
      }
    }

    return null;
  }

  private fireAt(attacker: DogfightShip, target: DogfightShip): void {
    // Apply difficulty modifier to AI
    let hitChance = calculateHitChance(attacker.combatStats.attackDice, target.combatStats.agilityDice);

    if (attacker.owner === 'ai') {
      const diffMod = { easy: 0.7, normal: 1, hard: 1.1, brutal: 1.2 }[this.difficulty];
      hitChance *= diffMod;
    }

    const hit = Math.random() < hitChance;

    if (hit) {
      let damage = attacker.combatStats.attackDice;

      if (target.shields > 0) {
        const shieldDmg = Math.min(target.shields, damage);
        target.shields -= shieldDmg;
        damage -= shieldDmg;
      }
      if (damage > 0) {
        target.hull = Math.max(0, target.hull - damage);
      }

      this.effectsManager.fireLaser(attacker.x, attacker.y, target.x, target.y, attacker.faction, true);

      const healthBar = this.healthBars.get(target.id);
      healthBar?.update(target.hull, target.shields);
    } else {
      this.effectsManager.fireLaser(attacker.x, attacker.y, target.x, target.y, attacker.faction, false);
    }
  }

  private updateAI(): void {
    for (const shipId of this.enemyShipIds) {
      const ship = this.ships.get(shipId);
      if (!ship || ship.hull <= 0) continue;

      const target = this.ships.get(this.playerShipIds[0] ?? '');
      if (!target || target.hull <= 0) continue;

      const angleToTarget = Phaser.Math.Angle.Between(ship.x, ship.y, target.x, target.y) * Phaser.Math.RAD_TO_DEG;
      const shipFacing = ship.angle - 90;
      let angleDiff = angleToTarget - shipFacing;
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;

      const dial = getShipDial(ship.definitionId);

      // AI decision quality based on difficulty
      const optimalChance = { easy: 0.5, normal: 0.7, hard: 0.9, brutal: 1 }[this.difficulty];

      if (Math.random() < optimalChance) {
        // Optimal decision
        if (Math.abs(angleDiff) < 15) {
          ship.currentManeuverDir = 'straight';
          ship.currentSpeed = 2;
        } else if (angleDiff > 0) {
          const turn = dial.find(m => m.direction === 'bank_right' || m.direction === 'turn_right');
          if (turn) {
            ship.currentManeuverDir = turn.direction;
            ship.currentSpeed = turn.speed;
          }
        } else {
          const turn = dial.find(m => m.direction === 'bank_left' || m.direction === 'turn_left');
          if (turn) {
            ship.currentManeuverDir = turn.direction;
            ship.currentSpeed = turn.speed;
          }
        }
      } else {
        // Random suboptimal decision
        const maneuvers = dial.filter(m => ['straight', 'bank_left', 'bank_right'].includes(m.direction));
        const chosen = maneuvers[Math.floor(Math.random() * maneuvers.length)];
        if (chosen) {
          ship.currentManeuverDir = chosen.direction;
          ship.currentSpeed = chosen.speed;
        }
      }
    }

    // Simple player AI for now
    for (const shipId of this.playerShipIds) {
      const ship = this.ships.get(shipId);
      if (!ship || ship.hull <= 0) continue;

      const target = this.ships.get(this.enemyShipIds[0] ?? '');
      if (!target || target.hull <= 0) continue;

      const angleToTarget = Phaser.Math.Angle.Between(ship.x, ship.y, target.x, target.y) * Phaser.Math.RAD_TO_DEG;
      const shipFacing = ship.angle - 90;
      let angleDiff = angleToTarget - shipFacing;
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;

      const dial = getShipDial(ship.definitionId);

      if (Math.abs(angleDiff) < 20) {
        ship.currentManeuverDir = 'straight';
        ship.currentSpeed = 2;
      } else if (angleDiff > 0) {
        const turn = dial.find(m => m.direction === 'bank_right');
        if (turn) {
          ship.currentManeuverDir = 'bank_right';
          ship.currentSpeed = turn.speed;
        }
      } else {
        const turn = dial.find(m => m.direction === 'bank_left');
        if (turn) {
          ship.currentManeuverDir = 'bank_left';
          ship.currentSpeed = turn.speed;
        }
      }
    }
  }

  private updateSprites(): void {
    for (const [id, ship] of this.ships) {
      const healthBar = this.healthBars.get(id);
      if (healthBar) {
        healthBar.setPosition(ship.x, ship.y - 50);
      }
    }
  }

  private checkRoundEnd(): void {
    if (!this.isRoundActive) return;

    const playerAlive = this.playerShipIds.some(id => {
      const ship = this.ships.get(id);
      return ship && ship.hull > 0;
    });

    const enemyAlive = this.enemyShipIds.some(id => {
      const ship = this.ships.get(id);
      return ship && ship.hull > 0;
    });

    if (!enemyAlive) {
      this.endRound('player_win');
    } else if (!playerAlive) {
      this.endRound('enemy_win');
    }
  }

  private endRound(result: 'player_win' | 'enemy_win' | 'draw'): void {
    this.isRoundActive = false;
    this.roundResult = result;

    if (result === 'player_win') {
      this.playerWins++;
      this.showRoundResult('VICTORY!', '#44ff44');
    } else if (result === 'enemy_win') {
      this.enemyWins++;
      this.showRoundResult('DEFEAT', '#ff4444');
    } else {
      this.showRoundResult('DRAW', '#ffaa44');
    }

    this.updateScoreDisplay();

    // Check match end
    const winsNeeded = this.matchFormat === 'best_of_3' ? 2 : 3;

    if (this.playerWins >= winsNeeded || this.enemyWins >= winsNeeded) {
      this.time.delayedCall(2000, () => this.endMatch());
    } else {
      this.time.delayedCall(2000, () => this.startNextRound());
    }
  }

  private showRoundResult(message: string, color: string): void {
    const text = this.add.text(this.scale.width / 2, this.scale.height / 2, message, {
      font: 'bold 48px Arial',
      color,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

    this.tweens.add({
      targets: text,
      alpha: 0,
      y: this.scale.height / 2 - 50,
      delay: 1500,
      duration: 500,
      onComplete: () => text.destroy(),
    });
  }

  private endMatch(): void {
    this.matchComplete = true;

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);
    bg.setScrollFactor(0);
    bg.setDepth(2000);

    const playerWon = this.playerWins > this.enemyWins;
    const title = playerWon ? 'MATCH WON!' : 'MATCH LOST';
    const color = playerWon ? '#44ff44' : '#ff4444';

    this.add.text(centerX, centerY - 80, title, {
      font: 'bold 56px Arial',
      color,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001);

    this.add.text(centerX, centerY - 20, `Final Score: ${this.playerWins} - ${this.enemyWins}`, {
      font: '28px Arial',
      color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001);

    // Sweep bonus indicator
    if ((playerWon && this.enemyWins === 0) || (!playerWon && this.playerWins === 0)) {
      this.add.text(centerX, centerY + 20, 'SWEEP!', {
        font: 'bold 24px Arial',
        color: '#ffdd00',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2001);
    }

    // Buttons
    const retryBtn = this.add.text(centerX - 100, centerY + 80, 'REMATCH', {
      font: 'bold 24px Arial',
      color: '#44ff44',
      backgroundColor: '#224422',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setInteractive({ useHandCursor: true });

    retryBtn.on('pointerdown', () => {
      this.scene.restart();
    });

    const menuBtn = this.add.text(centerX + 100, centerY + 80, 'MENU', {
      font: 'bold 24px Arial',
      color: '#ffffff',
      backgroundColor: '#444444',
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerdown', () => {
      this.scene.start('MainMenuScene');
    });
  }
}
