/**
 * Ace Duel Scene - Preset Iconic Matchups
 *
 * No squad building - just pick a matchup and fight.
 * Features:
 * - Preset iconic matchups with pre-built loadouts
 * - Best-of-3 rounds
 * - Thematic flavor text
 * - Difficulty selection for AI opponent
 * - Completion tracker for all matchups
 */

import Phaser from 'phaser';
import { ShipStatCard } from '../ui/ShipStatCard';
import { createHoverButton, createToggleButton } from '../ui/ButtonFactory';
import type { FactionId } from '../config';
import { BATTLEFIELD_SIZE, FACTION_COLORS, SHIP_SIZES } from '../config';
import { getShipDefinition, getShipDial } from '../data/ShipDefinitions';
import { getModeCombatStats, calculateHitChance, type ModeCombatStats } from '../data/ModeBalancing';
import { getManeuverTemplate, applyManeuver } from '../systems/ManeuverTemplates';
import { HealthBar } from '../ui/HealthBar';
import { EffectsManager } from '../rendering/EffectsManager';
import { ParallaxBackground } from '../rendering/ParallaxBackground';
import { audioManager } from '../audio/AudioManager';
import {
  createPerformanceState,
  updateFPS,
  evaluateQuality,
  type PerformanceState,
} from '../systems/PerformanceSystem';
import type { ManeuverDirection } from '../core/types';

interface AceDuelShip {
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

interface AceMatchup {
  id: string;
  name: string;
  description: string;
  flavorText: string;
  side1: {
    name: string;
    faction: FactionId;
    ships: string[];
  };
  side2: {
    name: string;
    faction: FactionId;
    ships: string[];
  };
}

// Preset matchups based on spec (translated from Star Wars to Shattered Stars factions)
const ACE_MATCHUPS: AceMatchup[] = [
  {
    id: 'elite_fighters',
    name: 'Elite Fighters',
    description: 'Admiral Kronos vs Phoenix Commander',
    flavorText: 'Two legendary aces clash in a battle of wits and reflexes. Only one will emerge victorious.',
    side1: {
      name: 'Admiral Kronos',
      faction: 'terran_hegemony',
      ships: ['terran_raptor'],
    },
    side2: {
      name: 'Phoenix Commander',
      faction: 'free_confederation',
      ships: ['confed_falcon'],
    },
  },
  {
    id: 'interceptor_duel',
    name: 'Interceptor Duel',
    description: 'Raptor Squadron vs Vortex Wing',
    flavorText: 'Speed versus agility. These interceptors dance through space at impossible velocities.',
    side1: {
      name: 'Raptor Squadron Leader',
      faction: 'terran_hegemony',
      ships: ['terran_viper'],
    },
    side2: {
      name: 'Vortex Ace',
      faction: 'void_corsairs',
      ships: ['corsair_fang'],
    },
  },
  {
    id: 'heavy_duel',
    name: 'Heavy Ship Duel',
    description: 'Corsair Captain vs Freighter Captain',
    flavorText: 'Massive ships trade devastating broadsides. Hull plating groans under the assault.',
    side1: {
      name: 'Corsair Captain Deathmark',
      faction: 'void_corsairs',
      ships: ['corsair_marauder'],
    },
    side2: {
      name: 'Confederation Freighter Captain',
      faction: 'free_confederation',
      ships: ['confed_hawk'],
    },
  },
  {
    id: 'gunship_duel',
    name: 'Gunship Showdown',
    description: 'Collective Prime Node vs Empire Archon',
    flavorText: 'Two capital-class vessels, each capable of leveling cities, face off in the void.',
    side1: {
      name: 'Collective Prime Node',
      faction: 'synthetic_collective',
      ships: ['synth_devastator'],
    },
    side2: {
      name: 'Empire Archon',
      faction: 'ascendant_empire',
      ships: ['ascendant_bastion'],
    },
  },
  {
    id: 'bomber_squadron',
    name: 'Bomber Squadron',
    description: 'Hegemony Bomber Wing vs Confederation Strike Team',
    flavorText: 'Heavy ordnance fills the void as bomber squadrons clash in a devastating exchange.',
    side1: {
      name: 'Hegemony Bomber Wing',
      faction: 'terran_hegemony',
      ships: ['terran_thunderbolt', 'terran_thunderbolt'],
    },
    side2: {
      name: 'Confederation Strike Team',
      faction: 'free_confederation',
      ships: ['confed_condor', 'confed_condor'],
    },
  },
  {
    id: 'hunter_hunted',
    name: 'Hunter vs Hunted',
    description: 'Corsair Bounty Hunter vs Collective Assassin',
    flavorText: 'A deadly game of cat and mouse. The hunter becomes the hunted.',
    side1: {
      name: 'Corsair Bounty Hunter',
      faction: 'void_corsairs',
      ships: ['corsair_talon'],
    },
    side2: {
      name: 'Collective Assassin Drone',
      faction: 'synthetic_collective',
      ships: ['synth_interceptor_drone'],
    },
  },
];

export class AceDuelScene extends Phaser.Scene {
  private ships: Map<string, AceDuelShip> = new Map();
  private shipSprites: Map<string, ShipSprite> = new Map();
  private healthBars: Map<string, HealthBar> = new Map();

  private side1ShipIds: string[] = [];
  private side2ShipIds: string[] = [];

  // Match state
  private selectedMatchup: AceMatchup = ACE_MATCHUPS[0]!;
  private playerSide: 1 | 2 = 1;
  private side1Wins = 0;
  private side2Wins = 0;
  private currentRound = 0;
  private isRoundActive = false;
  private matchComplete = false;

  // Settings
  private difficulty: 'easy' | 'normal' | 'hard' | 'brutal' = 'normal';

  // Game state
  private isPaused = false;
  private isSetupPhase = true;

  // Timing
  private lastManeuverTime = 0;
  private maneuverInterval = 300;

  // Effects
  private effectsManager!: EffectsManager;
  private background!: ParallaxBackground;
  private performanceState: PerformanceState = createPerformanceState();

  // UI
  private roundText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private setupContainer!: Phaser.GameObjects.Container;

  // Completion tracking
  private completedMatchups: Set<string> = new Set();

  constructor() {
    super({ key: 'AceDuelScene' });
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, BATTLEFIELD_SIZE, BATTLEFIELD_SIZE);
    this.cameras.main.setBackgroundColor(0x050510);

    audioManager.initialize();

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

    this.loadCompletedMatchups();
    this.resetMatchState();
    this.showSetupScreen();

    this.cameras.main.centerOn(BATTLEFIELD_SIZE / 2, BATTLEFIELD_SIZE / 2);
    this.cameras.main.setZoom(1.0);
  }

  private loadCompletedMatchups(): void {
    try {
      const saved = localStorage.getItem('shattered_stars_ace_duel');
      if (saved) {
        const ids: string[] = JSON.parse(saved);
        this.completedMatchups = new Set(ids);
      }
    } catch {
      // Use empty set on parse error
    }
  }

  private saveCompletedMatchups(): void {
    localStorage.setItem(
      'shattered_stars_ace_duel',
      JSON.stringify(Array.from(this.completedMatchups))
    );
  }

  private resetMatchState(): void {
    this.side1Wins = 0;
    this.side2Wins = 0;
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
    this.side1ShipIds = [];
    this.side2ShipIds = [];
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
    bg.fillStyle(0x000000, 0.92);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);
    this.setupContainer.add(bg);

    // Title
    const title = this.add.text(centerX, 40, 'ACE DUEL', {
      font: 'bold 48px Arial',
      color: '#ffdd00',
    }).setOrigin(0.5);
    this.setupContainer.add(title);

    const subtitle = this.add.text(centerX, 80, 'Legendary Matchups', {
      font: '18px Arial',
      color: '#aaaaaa',
    }).setOrigin(0.5);
    this.setupContainer.add(subtitle);

    // Matchup selection
    let yPos = 130;
    ACE_MATCHUPS.forEach((matchup, i) => {
      const isSelected = matchup.id === this.selectedMatchup.id;
      const isCompleted = this.completedMatchups.has(matchup.id);

      const btn = this.createMatchupButton(centerX, yPos, matchup, isSelected, isCompleted, () => {
        this.selectedMatchup = matchup;
        this.showSetupScreen();
      });
      this.setupContainer.add(btn);
      yPos += 55;
    });

    // Selected matchup details
    const detailsY = 480;
    const detailsBg = this.add.graphics();
    detailsBg.fillStyle(0x112233, 0.9);
    detailsBg.fillRoundedRect(centerX - 300, detailsY - 10, 600, 100, 8);
    this.setupContainer.add(detailsBg);

    const flavorText = this.add.text(centerX, detailsY + 10, `"${this.selectedMatchup.flavorText}"`, {
      font: 'italic 14px Arial',
      color: '#aaaaaa',
      wordWrap: { width: 560 },
      align: 'center',
    }).setOrigin(0.5, 0);
    this.setupContainer.add(flavorText);

    // Side selection
    const sideY = detailsY + 70;
    const side1Color = FACTION_COLORS[this.selectedMatchup.side1.faction];
    const side2Color = FACTION_COLORS[this.selectedMatchup.side2.faction];

    const side1Btn = this.createSideButton(
      centerX - 150,
      sideY,
      this.selectedMatchup.side1.name,
      side1Color,
      this.playerSide === 1,
      () => {
        this.playerSide = 1;
        this.showSetupScreen();
      }
    );
    this.setupContainer.add(side1Btn);

    const vsText = this.add.text(centerX, sideY, 'VS', {
      font: 'bold 24px Arial',
      color: '#666666',
    }).setOrigin(0.5);
    this.setupContainer.add(vsText);

    const side2Btn = this.createSideButton(
      centerX + 150,
      sideY,
      this.selectedMatchup.side2.name,
      side2Color,
      this.playerSide === 2,
      () => {
        this.playerSide = 2;
        this.showSetupScreen();
      }
    );
    this.setupContainer.add(side2Btn);

    // Difficulty selection
    const diffY = sideY + 60;
    const diffLabel = this.add.text(centerX, diffY, 'AI Difficulty:', {
      font: '14px Arial',
      color: '#888888',
    }).setOrigin(0.5);
    this.setupContainer.add(diffLabel);

    const difficulties: Array<'easy' | 'normal' | 'hard' | 'brutal'> = ['easy', 'normal', 'hard', 'brutal'];
    difficulties.forEach((diff, i) => {
      const btn = this.createSmallButton(
        centerX - 120 + i * 80,
        diffY + 30,
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
    const startBtn = createHoverButton(this, centerX, this.scale.height - 60, {
      width: 160, height: 50, radius: 10,
      color: 0x886622, hoverColor: 0xaa8833,
      label: 'DUEL!', font: 'bold 28px Arial',
    }, () => this.startDuel());
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

    // Completion counter
    const completed = this.completedMatchups.size;
    const total = ACE_MATCHUPS.length;
    const completionText = this.add.text(this.scale.width - 50, 40, `${completed}/${total} Completed`, {
      font: '14px Arial',
      color: completed === total ? '#44ff44' : '#888888',
    }).setOrigin(1, 0.5);
    this.setupContainer.add(completionText);
  }

  private createMatchupButton(
    x: number,
    y: number,
    matchup: AceMatchup,
    selected: boolean,
    completed: boolean,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    if (selected) {
      bg.fillStyle(0x446688, 0.95);
      bg.lineStyle(2, 0x66aaff, 1);
    } else {
      bg.fillStyle(0x222233, 0.8);
    }
    bg.fillRoundedRect(-280, -22, 560, 44, 6);
    if (selected) {
      bg.strokeRoundedRect(-280, -22, 560, 44, 6);
    }
    container.add(bg);

    // Completion indicator
    if (completed) {
      const checkmark = this.add.text(-260, 0, '✓', {
        font: 'bold 18px Arial',
        color: '#44ff44',
      }).setOrigin(0.5);
      container.add(checkmark);
    }

    // Matchup name
    const name = this.add.text(-230, -5, matchup.name, {
      font: selected ? 'bold 16px Arial' : '16px Arial',
      color: selected ? '#ffffff' : '#aaaaaa',
    }).setOrigin(0, 0.5);
    container.add(name);

    // Description
    const desc = this.add.text(-230, 10, matchup.description, {
      font: '12px Arial',
      color: '#666666',
    }).setOrigin(0, 0.5);
    container.add(desc);

    // Faction colors
    const color1 = FACTION_COLORS[matchup.side1.faction];
    const color2 = FACTION_COLORS[matchup.side2.faction];

    const indicator1 = this.add.graphics();
    indicator1.fillStyle(color1, 1);
    indicator1.fillCircle(220, 0, 8);
    container.add(indicator1);

    const vsIndicator = this.add.text(240, 0, 'vs', {
      font: '12px Arial',
      color: '#666666',
    }).setOrigin(0.5);
    container.add(vsIndicator);

    const indicator2 = this.add.graphics();
    indicator2.fillStyle(color2, 1);
    indicator2.fillCircle(260, 0, 8);
    container.add(indicator2);

    const hitArea = this.add.rectangle(0, 0, 560, 44).setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerdown', onClick);

    return container;
  }

  private createSideButton(
    x: number,
    y: number,
    label: string,
    color: number,
    selected: boolean,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    if (selected) {
      bg.fillStyle(color, 0.4);
      bg.lineStyle(3, color, 1);
    } else {
      bg.fillStyle(0x222233, 0.8);
    }
    bg.fillRoundedRect(-70, -20, 140, 40, 6);
    if (selected) {
      bg.strokeRoundedRect(-70, -20, 140, 40, 6);
    }
    container.add(bg);

    const text = this.add.text(0, 0, label, {
      font: selected ? 'bold 13px Arial' : '13px Arial',
      color: selected ? '#ffffff' : '#888888',
    }).setOrigin(0.5);
    container.add(text);

    const hitArea = this.add.rectangle(0, 0, 140, 40).setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerdown', onClick);

    return container;
  }

  private createSmallButton(
    x: number, y: number, label: string, selected: boolean, onClick: () => void,
  ): Phaser.GameObjects.Container {
    return createToggleButton(this, x, y, label, selected, {
      width: 60, height: 24,
      selectedColor: 0x446688, normalColor: 0x222233,
      selectedFont: 'bold 10px Arial', font: '10px Arial',
    }, onClick);
  }

  private startDuel(): void {
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

    const centerX = BATTLEFIELD_SIZE / 2;
    const centerY = BATTLEFIELD_SIZE / 2;
    const spawnDistance = 200;

    // Spawn side 1 ships
    const side1 = this.selectedMatchup.side1;
    side1.ships.forEach((shipId, i) => {
      const offsetX = (i - (side1.ships.length - 1) / 2) * 60;
      const owner: 'player' | 'ai' = this.playerSide === 1 ? 'player' : 'ai';
      this.spawnShip(
        `side1_${i}`,
        shipId,
        side1.faction,
        owner,
        centerX + offsetX,
        centerY + spawnDistance,
        0,
        1
      );
    });

    // Spawn side 2 ships
    const side2 = this.selectedMatchup.side2;
    side2.ships.forEach((shipId, i) => {
      const offsetX = (i - (side2.ships.length - 1) / 2) * 60;
      const owner: 'player' | 'ai' = this.playerSide === 2 ? 'player' : 'ai';
      this.spawnShip(
        `side2_${i}`,
        shipId,
        side2.faction,
        owner,
        centerX + offsetX,
        centerY - spawnDistance,
        180,
        2
      );
    });

    this.showRoundStart();
  }

  private showRoundStart(): void {
    const text = this.add.text(this.scale.width / 2, this.scale.height / 2, `ROUND ${this.currentRound}`, {
      font: 'bold 48px Arial',
      color: '#ffdd00',
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
    this.performanceState = updateFPS(this.performanceState, delta);
    this.performanceState = evaluateQuality(this.performanceState, time);
    this.effectsManager.setQualitySettings(this.performanceState.effectSettings);

    this.background.update();

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
      .text(this.scale.width / 2, 30, 'ROUND 1', {
        font: 'bold 24px Arial',
        color: '#ffdd00',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);

    // Show matchup name
    this.add
      .text(this.scale.width / 2, 60, this.selectedMatchup.name, {
        font: '18px Arial',
        color: '#888888',
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

    // Side indicators
    const side1Color = FACTION_COLORS[this.selectedMatchup.side1.faction];
    const side2Color = FACTION_COLORS[this.selectedMatchup.side2.faction];

    const side1Indicator = this.add.graphics();
    side1Indicator.fillStyle(side1Color, 1);
    side1Indicator.fillCircle(this.scale.width / 2 - 60, 90, 10);
    side1Indicator.setScrollFactor(0).setDepth(1000);

    const side2Indicator = this.add.graphics();
    side2Indicator.fillStyle(side2Color, 1);
    side2Indicator.fillCircle(this.scale.width / 2 + 60, 90, 10);
    side2Indicator.setScrollFactor(0).setDepth(1000);

    this.add
      .text(this.scale.width / 2, this.scale.height - 25, 'Scroll: Zoom | ESC: Pause', {
        font: '14px monospace',
        color: '#666666',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);
  }

  private updateScoreDisplay(): void {
    this.scoreText.setText(`${this.side1Wins} - ${this.side2Wins}`);
  }

  private setupInput(): void {
    this.input.keyboard!.on('keydown-ESC', () => {
      this.isPaused = !this.isPaused;
    });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gos: unknown, _dx: number, deltaY: number) => {
      const zoom = this.cameras.main.zoom - deltaY * 0.001;
      this.cameras.main.setZoom(Phaser.Math.Clamp(zoom, 0.7, 1.5));
    });
  }

  private spawnShip(
    id: string,
    defId: string,
    faction: FactionId,
    owner: 'player' | 'ai',
    x: number,
    y: number,
    angle: number,
    side: 1 | 2
  ): void {
    const combatStats = getModeCombatStats(defId, 'continuous');

    const ship: AceDuelShip = {
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

    if (side === 1) {
      this.side1ShipIds.push(id);
    } else {
      this.side2ShipIds.push(id);
    }

    this.createShipSprite(ship);
    this.createHealthBar(ship);
  }

  private createShipSprite(ship: AceDuelShip): void {
    const container = this.add.container(ship.x, ship.y) as unknown as ShipSprite;
    container.shipId = ship.id;

    const color = FACTION_COLORS[ship.faction] ?? 0xffffff;
    const size = SHIP_SIZES.medium;

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
    container.setSize(size * 2, size * 2);
    container.setInteractive();
    ShipStatCard.attachHoverCard(this, container, ship.definitionId);

    this.shipSprites.set(ship.id, container);
  }

  private createHealthBar(ship: AceDuelShip): void {
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

  private findTarget(ship: AceDuelShip): AceDuelShip | null {
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

  private fireAt(attacker: AceDuelShip, target: AceDuelShip): void {
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
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;

      // Find enemy ships
      const enemyIds = this.side1ShipIds.includes(ship.id) ? this.side2ShipIds : this.side1ShipIds;
      let closestEnemy: AceDuelShip | null = null;
      let closestDist = Infinity;

      for (const enemyId of enemyIds) {
        const enemy = this.ships.get(enemyId);
        if (!enemy || enemy.hull <= 0) continue;

        const dist = Phaser.Math.Distance.Between(ship.x, ship.y, enemy.x, enemy.y);
        if (dist < closestDist) {
          closestEnemy = enemy;
          closestDist = dist;
        }
      }

      if (!closestEnemy) continue;

      const angleToTarget = Phaser.Math.Angle.Between(ship.x, ship.y, closestEnemy.x, closestEnemy.y) * Phaser.Math.RAD_TO_DEG;
      const shipFacing = ship.angle - 90;
      let angleDiff = angleToTarget - shipFacing;
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;

      const dial = getShipDial(ship.definitionId);

      // AI decision quality based on ownership and difficulty
      let optimalChance = 0.8; // Default for player ships (simple AI)
      if (ship.owner === 'ai') {
        optimalChance = { easy: 0.5, normal: 0.7, hard: 0.9, brutal: 1 }[this.difficulty];
      }

      if (Math.random() < optimalChance) {
        if (Math.abs(angleDiff) < 20) {
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
        const maneuvers = dial.filter(m => ['straight', 'bank_left', 'bank_right'].includes(m.direction));
        const chosen = maneuvers[Math.floor(Math.random() * maneuvers.length)];
        if (chosen) {
          ship.currentManeuverDir = chosen.direction;
          ship.currentSpeed = chosen.speed;
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

    const side1Alive = this.side1ShipIds.some(id => {
      const ship = this.ships.get(id);
      return ship && ship.hull > 0;
    });

    const side2Alive = this.side2ShipIds.some(id => {
      const ship = this.ships.get(id);
      return ship && ship.hull > 0;
    });

    if (!side2Alive) {
      this.endRound(1);
    } else if (!side1Alive) {
      this.endRound(2);
    }
  }

  private endRound(winner: 1 | 2): void {
    this.isRoundActive = false;

    if (winner === 1) {
      this.side1Wins++;
      const isPlayerWin = this.playerSide === 1;
      this.showRoundResult(isPlayerWin ? 'VICTORY!' : 'DEFEAT', isPlayerWin ? '#44ff44' : '#ff4444');
    } else {
      this.side2Wins++;
      const isPlayerWin = this.playerSide === 2;
      this.showRoundResult(isPlayerWin ? 'VICTORY!' : 'DEFEAT', isPlayerWin ? '#44ff44' : '#ff4444');
    }

    this.updateScoreDisplay();

    // Best of 3 - need 2 wins
    if (this.side1Wins >= 2 || this.side2Wins >= 2) {
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

    const playerWins = this.playerSide === 1 ? this.side1Wins : this.side2Wins;
    const enemyWins = this.playerSide === 1 ? this.side2Wins : this.side1Wins;
    const playerWon = playerWins > enemyWins;

    // Mark matchup as completed
    if (playerWon) {
      this.completedMatchups.add(this.selectedMatchup.id);
      this.saveCompletedMatchups();
    }

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);
    bg.setScrollFactor(0);
    bg.setDepth(2000);

    const title = playerWon ? 'DUEL WON!' : 'DUEL LOST';
    const color = playerWon ? '#44ff44' : '#ff4444';

    this.add.text(centerX, centerY - 80, title, {
      font: 'bold 56px Arial',
      color,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001);

    this.add.text(centerX, centerY - 20, `Final Score: ${playerWins} - ${enemyWins}`, {
      font: '28px Arial',
      color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001);

    // Achievement check
    if (this.completedMatchups.size === ACE_MATCHUPS.length) {
      this.add.text(centerX, centerY + 20, '🏆 DUELIST ACHIEVEMENT UNLOCKED!', {
        font: 'bold 20px Arial',
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
