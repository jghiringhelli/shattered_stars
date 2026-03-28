/**
 * Survival Mode Scene
 *
 * Roguelite survival mode:
 * - Start with one ship
 * - Defeat waves of enemies
 * - Earn credits between waves
 * - Choose upgrades/perks
 * - Recruit additional ships
 * - Permanent death - start over on loss
 */

import Phaser from 'phaser';
import { ShipStatCard } from '../ui/ShipStatCard';
import type { FactionId } from '../config';
import { BATTLEFIELD_SIZE, FACTION_COLORS, SHIP_SIZES } from '../config';
import { getShipDefinition, getShipsByFaction, getShipDial } from '../data/ShipDefinitions';
import { getModeCombatStats, calculateHitChance, type ModeCombatStats } from '../data/ModeBalancing';
import { getManeuverTemplate, applyManeuver } from '../systems/ManeuverTemplates';
import { HealthBar } from '../ui/HealthBar';
import { EffectsManager } from '../rendering/EffectsManager';
import { headingDiffToTarget } from '../systems/MovementSystem';
import { ParallaxBackground } from '../rendering/ParallaxBackground';
import { audioManager } from '../audio/AudioManager';
import {
  createPerformanceState,
  updateFPS,
  evaluateQuality,
  type PerformanceState,
} from '../systems/PerformanceSystem';
import type { ManeuverDirection } from '../core/types';

/** Default starting ship for each faction in Survival mode. */
const FACTION_STARTER_SHIPS: Record<FactionId, string> = {
  terran_hegemony:      'terran_stiletto',
  free_confederation:   'confed_sparrow',
  synthetic_collective: 'synth_scout_drone',
  void_corsairs:        'corsair_fang',
  ascendant_empire:     'ascendant_herald',
};

interface SurvivalShip {
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

interface Upgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  effect: () => void;
  icon: string;
}

interface ShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
}

export class SurvivalScene extends Phaser.Scene {
  private ships: Map<string, SurvivalShip> = new Map();
  private shipSprites: Map<string, ShipSprite> = new Map();
  private healthBars: Map<string, HealthBar> = new Map();

  private playerShipIds: string[] = [];
  private enemyShipIds: string[] = [];

  // Survival state
  private wave = 0;
  private credits = 0;
  private score = 0;
  private playerFaction: FactionId = 'free_confederation';
  private isWaveActive = false;
  private isPaused = false;
  private isUpgradePhase = false;

  // Upgrades
  private attackBonus = 0;
  private defenseBonus = 0;
  private speedBonus = 0;
  private maxShipsBonus = 0;

  // UI
  private waveText!: Phaser.GameObjects.Text;
  private creditsText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private upgradeContainer!: Phaser.GameObjects.Container;

  // Timing
  private lastManeuverTime = 0;
  private maneuverInterval = 300;

  // Effects
  private effectsManager!: EffectsManager;
  private background!: ParallaxBackground;
  private performanceState: PerformanceState = createPerformanceState();

  constructor() {
    super({ key: 'SurvivalScene' });
  }

  init(data: { factionId?: FactionId }): void {
    if (data?.factionId) this.playerFaction = data.factionId;
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, BATTLEFIELD_SIZE, BATTLEFIELD_SIZE);
    this.cameras.main.setBackgroundColor(0x050510);

    audioManager.initialize();
    audioManager.playMusic('combat_medium');

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

    this.resetState();
    this.createHUD();
    this.setupInput();

    this.cameras.main.centerOn(BATTLEFIELD_SIZE / 2, BATTLEFIELD_SIZE / 2);
    this.cameras.main.setZoom(0.9);

    // Start first wave after brief delay
    this.showMessage('SURVIVAL MODE', 'Survive as long as you can!');
    this.time.delayedCall(2000, () => this.startNextWave());
  }

  private resetState(): void {
    this.wave = 0;
    this.credits = 0;
    this.score = 0;
    this.attackBonus = 0;
    this.defenseBonus = 0;
    this.speedBonus = 0;
    this.maxShipsBonus = 0;
    this.isWaveActive = false;
    this.isPaused = false;
    this.isUpgradePhase = false;

    this.ships.clear();
    this.shipSprites.forEach(s => s.destroy());
    this.shipSprites.clear();
    this.healthBars.forEach(h => h.destroy());
    this.healthBars.clear();
    this.playerShipIds = [];
    this.enemyShipIds = [];

    // Spawn initial player ship based on chosen faction
    this.spawnPlayerShip(FACTION_STARTER_SHIPS[this.playerFaction], BATTLEFIELD_SIZE / 2, BATTLEFIELD_SIZE / 2 + 100);
  }

  update(time: number, delta: number): void {
    if (this.isPaused || this.isUpgradePhase) return;
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
    this.checkWaveComplete();
  }

  private createHUD(): void {
    const style = { font: 'bold 20px monospace', color: '#ffffff' };

    this.waveText = this.add
      .text(20, 20, 'WAVE 0', style)
      .setScrollFactor(0)
      .setDepth(1000);

    this.creditsText = this.add
      .text(20, 50, 'CREDITS: 0', { ...style, color: '#ffdd44' })
      .setScrollFactor(0)
      .setDepth(1000);

    this.scoreText = this.add
      .text(this.scale.width - 20, 20, 'SCORE: 0', style)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    this.messageText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, '', {
        font: 'bold 36px Arial',
        color: '#00ffaa',
        stroke: '#004422',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001)
      .setAlpha(0);

    this.upgradeContainer = this.add.container(0, 0);
    this.upgradeContainer.setScrollFactor(0);
    this.upgradeContainer.setDepth(1002);
    this.upgradeContainer.setVisible(false);

    this.add
      .text(this.scale.width / 2, this.scale.height - 30, 'Arrow keys: Move | ESC: Pause', {
        font: '14px monospace',
        color: '#666666',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);
  }

  private setupInput(): void {
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.isUpgradePhase) return;
      this.isPaused = !this.isPaused;
      if (this.isPaused) {
        this.showMessage('PAUSED', 'Press ESC to resume');
      } else {
        this.messageText.setAlpha(0);
      }
    });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gos: unknown, _dx: number, deltaY: number) => {
      const zoom = this.cameras.main.zoom - deltaY * 0.001;
      this.cameras.main.setZoom(Phaser.Math.Clamp(zoom, 0.5, 2));
    });
  }

  private showMessage(title: string, subtitle: string): void {
    this.messageText.setText(`${title}\n${subtitle}`);
    this.messageText.setAlpha(1);

    this.tweens.add({
      targets: this.messageText,
      alpha: 0,
      delay: 1500,
      duration: 500,
    });
  }

  // ==========================================
  // WAVE MANAGEMENT
  // ==========================================

  /**
   * Wave Structure (from spec):
   * 1-5: Basic fighters and interceptors, Wave 5 mini-boss
   * 6-10: Mixed squadrons with bombers, Wave 10 boss
   * 11-15: Elite pilots and heavy ships, Wave 15 boss
   * 16-20: Epic ship sections appear, Wave 20 boss
   * 21+: Endless scaling, boss every 5 waves
   */
  private startNextWave(): void {
    this.wave++;
    this.waveText.setText(`WAVE ${this.wave}`);
    this.isWaveActive = true;

    const isBossWave = this.wave % 5 === 0;
    const waveType = this.getWaveType();

    if (isBossWave) {
      this.showMessage(`WAVE ${this.wave}`, `BOSS INCOMING!`);
    } else {
      this.showMessage(`WAVE ${this.wave}`, waveType);
    }

    this.spawnWaveEnemies();
  }

  private getWaveType(): string {
    if (this.wave <= 5) return 'Basic Fighters';
    if (this.wave <= 10) return 'Mixed Squadron';
    if (this.wave <= 15) return 'Elite Pilots';
    if (this.wave <= 20) return 'Epic Forces';
    return 'Endless Wave';
  }

  private spawnWaveEnemies(): void {
    const factions: FactionId[] = ['terran_hegemony', 'synthetic_collective', 'void_corsairs', 'ascendant_empire'];
    const enemyFaction = factions[(this.wave - 1) % factions.length]!;
    const enemyShips = getShipsByFaction(enemyFaction);
    const centerX = BATTLEFIELD_SIZE / 2;
    const isBossWave = this.wave % 5 === 0;

    // Determine wave composition based on spec
    if (this.wave <= 5) {
      // Waves 1-5: Basic fighters and interceptors
      const baseCount = 2 + this.wave;
      const shipTypes = enemyShips.filter(s => s.role === 'light_fighter' || s.role === 'heavy_fighter' || s.role === 'interceptor');

      for (let i = 0; i < baseCount; i++) {
        const angle = (i / baseCount) * Math.PI - Math.PI / 2;
        const radius = 350 + Math.random() * 100;
        const x = centerX + Math.cos(angle) * radius;
        const y = 100 + Math.sin(angle) * 50 + i * 30;

        const shipDef = shipTypes[i % shipTypes.length] ?? enemyShips[0];
        if (shipDef) this.spawnEnemyShip(shipDef.id, enemyFaction, x, y);
      }

      // Wave 5 mini-boss: elite ace
      if (isBossWave) {
        const aceShip = enemyShips.find(s => s.role === 'light_fighter' || s.role === 'heavy_fighter') ?? enemyShips[0];
        if (aceShip) this.spawnEliteShip(aceShip.id, enemyFaction, centerX, 150);
      }
    } else if (this.wave <= 10) {
      // Waves 6-10: Mixed squadrons with bombers
      const baseCount = 4 + Math.floor((this.wave - 5) * 1.5);
      const shipTypes = enemyShips.filter(s =>
        s.role === 'light_fighter' || s.role === 'heavy_fighter' || s.role === 'interceptor' || s.role === 'bomber'
      );

      for (let i = 0; i < baseCount; i++) {
        const angle = (i / baseCount) * Math.PI - Math.PI / 2;
        const radius = 350 + Math.random() * 100;
        const x = centerX + Math.cos(angle) * radius;
        const y = 100 + Math.sin(angle) * 50 + i * 25;

        const shipDef = shipTypes[i % shipTypes.length] ?? enemyShips[0];
        if (shipDef) this.spawnEnemyShip(shipDef.id, enemyFaction, x, y);
      }

      // Wave 10 boss: heavy gunship
      if (isBossWave) {
        const bossShip = enemyShips.find(s => s.role === 'bomber' || s.role === 'gunship') ?? enemyShips[0];
        if (bossShip) this.spawnBossShip(bossShip.id, enemyFaction, centerX, 150, 2);
      }
    } else if (this.wave <= 15) {
      // Waves 11-15: Elite pilots and heavy ships
      const baseCount = 6 + Math.floor((this.wave - 10) * 1.2);

      for (let i = 0; i < baseCount; i++) {
        const angle = (i / baseCount) * Math.PI - Math.PI / 2;
        const radius = 350 + Math.random() * 100;
        const x = centerX + Math.cos(angle) * radius;
        const y = 100 + Math.sin(angle) * 50 + i * 20;

        const shipDef = enemyShips[i % enemyShips.length] ?? enemyShips[0];
        if (shipDef) {
          // 30% chance of elite ship
          if (Math.random() < 0.3) {
            this.spawnEliteShip(shipDef.id, enemyFaction, x, y);
          } else {
            this.spawnEnemyShip(shipDef.id, enemyFaction, x, y);
          }
        }
      }

      // Wave 15 boss: capital escort
      if (isBossWave) {
        const bossShip = enemyShips.find(s => s.role === 'gunship') ?? enemyShips[enemyShips.length - 1];
        if (bossShip) this.spawnBossShip(bossShip.id, enemyFaction, centerX, 150, 3);
        // Add escorts
        const escortShip = enemyShips.find(s => s.role === 'light_fighter' || s.role === 'heavy_fighter') ?? enemyShips[0];
        if (escortShip) {
          this.spawnEnemyShip(escortShip.id, enemyFaction, centerX - 100, 200);
          this.spawnEnemyShip(escortShip.id, enemyFaction, centerX + 100, 200);
        }
      }
    } else if (this.wave <= 20) {
      // Waves 16-20: Epic ship sections appear
      const baseCount = 8 + Math.floor((this.wave - 15) * 1.5);

      for (let i = 0; i < baseCount; i++) {
        const angle = (i / baseCount) * Math.PI - Math.PI / 2;
        const radius = 350 + Math.random() * 120;
        const x = centerX + Math.cos(angle) * radius;
        const y = 100 + Math.sin(angle) * 60 + i * 18;

        const shipDef = enemyShips[i % enemyShips.length] ?? enemyShips[0];
        if (shipDef) {
          if (Math.random() < 0.4) {
            this.spawnEliteShip(shipDef.id, enemyFaction, x, y);
          } else {
            this.spawnEnemyShip(shipDef.id, enemyFaction, x, y);
          }
        }
      }

      // Wave 20 boss: full capital ship
      if (isBossWave) {
        const bossShip = enemyShips.find(s => s.role === 'gunship') ?? enemyShips[enemyShips.length - 1];
        if (bossShip) this.spawnBossShip(bossShip.id, enemyFaction, centerX, 150, 4);
        // Heavy escort
        const escortShip = enemyShips.find(s => s.role === 'bomber') ?? enemyShips[0];
        if (escortShip) {
          this.spawnEnemyShip(escortShip.id, enemyFaction, centerX - 120, 220);
          this.spawnEnemyShip(escortShip.id, enemyFaction, centerX + 120, 220);
        }
      }
    } else {
      // Wave 21+: Endless scaling
      const baseCount = Math.min(10 + Math.floor((this.wave - 20) * 0.5), 16);

      for (let i = 0; i < baseCount; i++) {
        const angle = (i / baseCount) * Math.PI - Math.PI / 2;
        const radius = 350 + Math.random() * 150;
        const x = centerX + Math.cos(angle) * radius;
        const y = 100 + Math.sin(angle) * 70 + i * 15;

        const shipDef = enemyShips[i % enemyShips.length] ?? enemyShips[0];
        if (shipDef) {
          if (Math.random() < 0.5) {
            this.spawnEliteShip(shipDef.id, enemyFaction, x, y);
          } else {
            this.spawnEnemyShip(shipDef.id, enemyFaction, x, y);
          }
        }
      }

      // Boss every 5 waves in endless
      if (isBossWave) {
        const bossShip = enemyShips.find(s => s.role === 'gunship') ?? enemyShips[enemyShips.length - 1];
        const bossMultiplier = Math.min(5 + Math.floor((this.wave - 20) / 5), 10);
        if (bossShip) this.spawnBossShip(bossShip.id, enemyFaction, centerX, 150, bossMultiplier);
      }
    }
  }

  private spawnEliteShip(defId: string, faction: FactionId, x: number, y: number): void {
    const id = `elite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const ship = this.createShip(id, defId, faction, 'ai', x, y, 180);
    // Elite ships have +50% hull and +1 attack
    ship.maxHull = Math.floor(ship.maxHull * 1.5);
    ship.hull = ship.maxHull;
    ship.combatStats = { ...ship.combatStats, attackDice: ship.combatStats.attackDice + 1 };
    this.ships.set(id, ship);
    this.enemyShipIds.push(id);
    this.createShipSprite(ship, true);
    this.createHealthBar(ship);
  }

  private spawnBossShip(defId: string, faction: FactionId, x: number, y: number, multiplier: number): void {
    const id = `boss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const ship = this.createShip(id, defId, faction, 'ai', x, y, 180);
    // Boss ships scale with multiplier
    ship.maxHull = ship.maxHull * multiplier;
    ship.hull = ship.maxHull;
    ship.maxShields = ship.maxShields * multiplier;
    ship.shields = ship.maxShields;
    ship.combatStats = { ...ship.combatStats, attackDice: ship.combatStats.attackDice + Math.floor(multiplier / 2) };
    this.ships.set(id, ship);
    this.enemyShipIds.push(id);
    this.createShipSprite(ship, false, true);
    this.createHealthBar(ship);
  }

  private checkWaveComplete(): void {
    if (!this.isWaveActive) return;

    const enemiesAlive = this.enemyShipIds.filter(id => {
      const ship = this.ships.get(id);
      return ship && ship.hull > 0;
    }).length;

    if (enemiesAlive === 0) {
      this.isWaveActive = false;

      // Calculate rewards based on wave milestones (from spec)
      let waveCredits = 50 + this.wave * 25;
      let bonusMessage = '';

      // Boss wave bonuses
      if (this.wave % 5 === 0) {
        waveCredits += 100; // Boss defeat bonus
        bonusMessage = ' (Boss Bonus!)';
      }

      // Milestone rewards
      if (this.wave === 5) {
        bonusMessage = ' - Faction Ability Unlocked!';
      } else if (this.wave === 10) {
        bonusMessage = ' - Upgrade Slot Added!';
      } else if (this.wave === 15) {
        bonusMessage = ' - Dual Faction Abilities!';
      } else if (this.wave === 20) {
        bonusMessage = ' - Ultimate Unlocked!';
      }

      this.credits += waveCredits;
      this.score += this.wave * 100; // 100 points per wave
      this.updateHUD();

      this.showMessage('WAVE COMPLETE!', `+${waveCredits} credits${bonusMessage}`);

      this.time.delayedCall(2000, () => {
        this.showUpgradeMenu();
      });
    }

    // Check player defeat
    const playersAlive = this.playerShipIds.filter(id => {
      const ship = this.ships.get(id);
      return ship && ship.hull > 0;
    }).length;

    if (playersAlive === 0) {
      this.gameOver();
    }
  }

  private showUpgradeMenu(): void {
    this.isUpgradePhase = true;
    this.upgradeContainer.removeAll(true);

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);
    this.upgradeContainer.add(bg);

    // Title
    const title = this.add.text(centerX, 80, 'UPGRADE SHOP', {
      font: 'bold 36px Arial',
      color: '#ffdd44',
    }).setOrigin(0.5);
    this.upgradeContainer.add(title);

    const credits = this.add.text(centerX, 120, `Credits: ${this.credits}`, {
      font: '24px Arial',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.upgradeContainer.add(credits);

    const upgrades = this.getAvailableUpgrades();
    const startY = 180;
    const spacing = 80;

    upgrades.forEach((upgrade, i) => {
      this.createUpgradeButton(centerX, startY + i * spacing, upgrade);
    });

    // Continue button
    this.createContinueButton(centerX, this.scale.height - 80);

    this.upgradeContainer.setVisible(true);
  }

  private getAvailableUpgrades(): Upgrade[] {
    const upgrades: Upgrade[] = [
      {
        id: 'attack',
        name: 'Weapon Upgrade',
        description: '+1 Attack damage',
        cost: 75,
        effect: () => { this.attackBonus++; },
        icon: '⚔️',
      },
      {
        id: 'defense',
        name: 'Hull Plating',
        description: '+2 Max Hull for all ships',
        cost: 100,
        effect: () => {
          this.defenseBonus += 2;
          this.playerShipIds.forEach(id => {
            const ship = this.ships.get(id);
            if (ship) {
              ship.maxHull += 2;
              ship.hull = Math.min(ship.hull + 2, ship.maxHull);
            }
          });
        },
        icon: '🛡️',
      },
      {
        id: 'speed',
        name: 'Engine Boost',
        description: 'Faster weapon cooldown',
        cost: 60,
        effect: () => { this.speedBonus++; },
        icon: '🚀',
      },
      {
        id: 'repair',
        name: 'Emergency Repair',
        description: 'Restore all ships to full health',
        cost: 50,
        effect: () => {
          this.playerShipIds.forEach(id => {
            const ship = this.ships.get(id);
            if (ship) {
              ship.hull = ship.maxHull;
              ship.shields = ship.maxShields;
              const healthBar = this.healthBars.get(id);
              healthBar?.update(ship.hull, ship.shields);
            }
          });
        },
        icon: '💚',
      },
    ];

    // Add recruit ship if player has less than max
    const maxShips = 3 + this.maxShipsBonus;
    if (this.playerShipIds.length < maxShips) {
      upgrades.push({
        id: 'recruit',
        name: 'Recruit Wingman',
        description: 'Add a new ship to your fleet',
        cost: 150,
        effect: () => {
          const ships = getShipsByFaction(this.playerFaction);
          const shipDef = ships[Math.floor(Math.random() * ships.length)];
          if (shipDef) {
            const playerShip = this.ships.get(this.playerShipIds[0]!);
            if (playerShip) {
              const offset = (this.playerShipIds.length) * 80;
              this.spawnPlayerShip(shipDef.id, playerShip.x + offset, playerShip.y + 50);
            }
          }
        },
        icon: '👨‍✈️',
      });
    }

    return upgrades;
  }

  private createUpgradeButton(x: number, y: number, upgrade: Upgrade): void {
    const canAfford = this.credits >= upgrade.cost;
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(canAfford ? 0x224466 : 0x333333, 0.9);
    bg.fillRoundedRect(-250, -30, 500, 60, 8);
    if (canAfford) {
      bg.lineStyle(2, 0x44aaff, 1);
      bg.strokeRoundedRect(-250, -30, 500, 60, 8);
    }
    container.add(bg);

    const icon = this.add.text(-220, 0, upgrade.icon, { font: '24px Arial' }).setOrigin(0, 0.5);
    container.add(icon);

    const nameText = this.add.text(-180, -8, upgrade.name, {
      font: 'bold 18px Arial',
      color: canAfford ? '#ffffff' : '#888888',
    }).setOrigin(0, 0.5);
    container.add(nameText);

    const descText = this.add.text(-180, 12, upgrade.description, {
      font: '14px Arial',
      color: '#aaaaaa',
    }).setOrigin(0, 0.5);
    container.add(descText);

    const costText = this.add.text(220, 0, `${upgrade.cost}`, {
      font: 'bold 20px Arial',
      color: canAfford ? '#ffdd44' : '#ff4444',
    }).setOrigin(1, 0.5);
    container.add(costText);

    if (canAfford) {
      const hitArea = this.add.rectangle(0, 0, 500, 60).setInteractive({ useHandCursor: true });
      container.add(hitArea);

      hitArea.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(0x336688, 0.9);
        bg.fillRoundedRect(-250, -30, 500, 60, 8);
        bg.lineStyle(2, 0x66ccff, 1);
        bg.strokeRoundedRect(-250, -30, 500, 60, 8);
      });

      hitArea.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(0x224466, 0.9);
        bg.fillRoundedRect(-250, -30, 500, 60, 8);
        bg.lineStyle(2, 0x44aaff, 1);
        bg.strokeRoundedRect(-250, -30, 500, 60, 8);
      });

      hitArea.on('pointerdown', () => {
        if (this.credits >= upgrade.cost) {
          this.credits -= upgrade.cost;
          upgrade.effect();
          this.updateHUD();
          audioManager.playSound('ui_select', 0.7);
          this.showUpgradeMenu(); // Refresh menu
        }
      });
    }

    this.upgradeContainer.add(container);
  }

  private createContinueButton(x: number, y: number): void {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(0x227722, 1);
    bg.fillRoundedRect(-100, -25, 200, 50, 8);
    container.add(bg);

    const text = this.add.text(0, 0, 'CONTINUE', {
      font: 'bold 24px Arial',
      color: '#ffffff',
    }).setOrigin(0.5);
    container.add(text);

    const hitArea = this.add.rectangle(0, 0, 200, 50).setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x33aa33, 1);
      bg.fillRoundedRect(-100, -25, 200, 50, 8);
    });

    hitArea.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x227722, 1);
      bg.fillRoundedRect(-100, -25, 200, 50, 8);
    });

    hitArea.on('pointerdown', () => {
      this.upgradeContainer.setVisible(false);
      this.isUpgradePhase = false;
      this.startNextWave();
    });

    this.upgradeContainer.add(container);
  }

  private gameOver(): void {
    this.isPaused = true;

    // Kill any in-progress wave announcement tween so it doesn't bleed through the overlay
    this.tweens.killTweensOf(this.messageText);
    this.messageText.setAlpha(0);

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);
    bg.setScrollFactor(0);
    bg.setDepth(2000);

    this.add.text(centerX, centerY - 80, 'GAME OVER', {
      font: 'bold 48px Arial',
      color: '#ff4444',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001);

    this.add.text(centerX, centerY - 20, `Wave Reached: ${this.wave}`, {
      font: '24px Arial',
      color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001);

    this.add.text(centerX, centerY + 20, `Final Score: ${this.score}`, {
      font: '24px Arial',
      color: '#ffdd44',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001);

    // Buttons
    const retryBtn = this.add.text(centerX - 100, centerY + 80, 'RETRY', {
      font: 'bold 24px Arial',
      color: '#44ff44',
      backgroundColor: '#224422',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setInteractive({ useHandCursor: true });

    retryBtn.on('pointerdown', () => {
      this.scene.restart();
    });

    const menuBtn = this.add.text(centerX + 100, centerY + 80, 'MENU', {
      font: 'bold 24px Arial',
      color: '#ffffff',
      backgroundColor: '#444444',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerdown', () => {
      this.scene.start('MainMenuScene');
    });
  }

  private updateHUD(): void {
    this.creditsText.setText(`CREDITS: ${this.credits}`);
    this.scoreText.setText(`SCORE: ${this.score}`);
  }

  // ==========================================
  // SHIP MANAGEMENT
  // ==========================================

  private spawnPlayerShip(defId: string, x: number, y: number): void {
    const id = `player_${this.playerShipIds.length}`;
    const ship = this.createShip(id, defId, this.playerFaction, 'player', x, y, 0);
    this.ships.set(id, ship);
    this.playerShipIds.push(id);
    this.createShipSprite(ship);
    this.createHealthBar(ship);
  }

  private spawnEnemyShip(defId: string, faction: FactionId, x: number, y: number): void {
    const id = `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const ship = this.createShip(id, defId, faction, 'ai', x, y, 180);
    this.ships.set(id, ship);
    this.enemyShipIds.push(id);
    this.createShipSprite(ship);
    this.createHealthBar(ship);
  }

  private createShip(
    id: string,
    defId: string,
    faction: FactionId,
    owner: 'player' | 'ai',
    x: number,
    y: number,
    angle: number
  ): SurvivalShip {
    const combatStats = getModeCombatStats(defId, 'survival');

    return {
      id,
      definitionId: defId,
      faction,
      owner,
      x,
      y,
      angle,
      hull: combatStats.hull + (owner === 'player' ? this.defenseBonus : 0),
      maxHull: combatStats.maxHull + (owner === 'player' ? this.defenseBonus : 0),
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
  }

  private createShipSprite(ship: SurvivalShip, isElite = false, isBoss = false): void {
    const container = this.add.container(ship.x, ship.y) as unknown as ShipSprite;
    container.shipId = ship.id;

    const color = FACTION_COLORS[ship.faction] ?? 0xffffff;
    let size: number = SHIP_SIZES.small;

    // Boss ships are larger
    if (isBoss) {
      size = SHIP_SIZES.large;
    } else if (isElite) {
      size = SHIP_SIZES.medium;
    }

    const body = this.add.graphics();
    body.fillStyle(color, 1);
    body.fillTriangle(0, -size / 2, -size / 3, size / 2, size / 3, size / 2);

    // Elite ships have golden outline
    if (isElite) {
      body.lineStyle(3, 0xffdd00, 1);
    } else if (isBoss) {
      // Boss ships have red outline
      body.lineStyle(4, 0xff4444, 1);
    } else {
      body.lineStyle(2, 0xffffff, 0.8);
    }
    body.strokeTriangle(0, -size / 2, -size / 3, size / 2, size / 3, size / 2);

    // Add glow for elite/boss
    if (isElite || isBoss) {
      const glowColor = isBoss ? 0xff4444 : 0xffdd00;
      const glow = this.add.graphics();
      glow.fillStyle(glowColor, 0.2);
      glow.fillCircle(0, 0, size * 0.8);
      container.add(glow);
    }

    container.add(body);

    container.setAngle(ship.angle);
    container.setDepth(isBoss ? 15 : 10);
    container.setSize(size * 2, size * 2);
    container.setInteractive();
    ShipStatCard.attachHoverCard(this, container, ship.definitionId);

    this.shipSprites.set(ship.id, container);
  }

  private createHealthBar(ship: SurvivalShip): void {
    const healthBar = new HealthBar({
      scene: this,
      x: ship.x,
      y: ship.y - 40,
      faction: ship.faction,
      maxHull: ship.maxHull,
      maxShields: ship.maxShields,
      currentHull: ship.hull,
      currentShields: ship.shields,
    });
    this.healthBars.set(ship.id, healthBar);
  }

  // ==========================================
  // COMBAT
  // ==========================================

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

      const cooldownMod = ship.owner === 'player' ? Math.max(0.5, 1 - this.speedBonus * 0.1) : 1;
      ship.weaponCooldown = Math.max(0, ship.weaponCooldown - delta);

      if (ship.weaponCooldown <= 0) {
        const target = this.findTarget(ship);
        if (target) {
          this.fireAt(ship, target);
          ship.weaponCooldown = ship.combatStats.weaponCooldown * cooldownMod;
        }
      }
    }
  }

  private findTarget(ship: SurvivalShip): SurvivalShip | null {
    let best: SurvivalShip | null = null;
    let bestDist = Infinity;

    const maxRange = ship.combatStats.weaponRange;
    const maxArcRad = (ship.combatStats.firingArc / 2) * Phaser.Math.DEG_TO_RAD;

    for (const other of this.ships.values()) {
      if (other.faction === ship.faction || other.hull <= 0) continue;

      const dist = Phaser.Math.Distance.Between(ship.x, ship.y, other.x, other.y);
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

  private fireAt(attacker: SurvivalShip, target: SurvivalShip): void {
    let hitChance = calculateHitChance(
      attacker.combatStats.attackDice,
      target.combatStats.agilityDice
    );

    const hit = Math.random() < hitChance;

    if (hit) {
      let damage = attacker.combatStats.attackDice + (attacker.owner === 'player' ? this.attackBonus : 0);

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

      if (target.hull <= 0) {
        this.destroyShip(target.id, attacker.owner === 'player');
      }
    } else {
      this.effectsManager.fireLaser(attacker.x, attacker.y, target.x, target.y, attacker.faction, false);
    }
  }

  private destroyShip(shipId: string, wasPlayerKill: boolean): void {
    const ship = this.ships.get(shipId);
    if (!ship) return;

    if (wasPlayerKill) {
      this.score += 100;
      this.updateHUD();
    }

    const sprite = this.shipSprites.get(shipId);
    if (sprite) {
      this.effectsManager.createExplosion(sprite.x, sprite.y, 'medium');
      sprite.destroy();
      this.shipSprites.delete(shipId);
    }

    const healthBar = this.healthBars.get(shipId);
    if (healthBar) {
      healthBar.destroy();
      this.healthBars.delete(shipId);
    }

    this.playerShipIds = this.playerShipIds.filter(id => id !== shipId);
    this.enemyShipIds = this.enemyShipIds.filter(id => id !== shipId);
  }

  private updateAI(): void {
    for (const shipId of this.enemyShipIds) {
      const ship = this.ships.get(shipId);
      if (!ship || ship.hull <= 0) continue;

      const target = this.findClosestEnemy(ship);
      if (!target) continue;

      const angleDiff = headingDiffToTarget(ship.x, ship.y, ship.angle, target.x, target.y);

      const dial = getShipDial(ship.definitionId);

      if (Math.abs(angleDiff) < 20) {
        const straight = dial.find(m => m.direction === 'straight');
        if (straight) {
          ship.currentManeuverDir = 'straight';
          ship.currentSpeed = straight.speed;
        }
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
    }

    // Player ships also use simple AI if not controlled
    for (const shipId of this.playerShipIds) {
      const ship = this.ships.get(shipId);
      if (!ship || ship.hull <= 0) continue;

      const target = this.findClosestEnemy(ship);
      if (!target) continue;

      const angleDiff = headingDiffToTarget(ship.x, ship.y, ship.angle, target.x, target.y);

      const dial = getShipDial(ship.definitionId);

      if (Math.abs(angleDiff) < 25) {
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

  private findClosestEnemy(ship: SurvivalShip): SurvivalShip | null {
    let closest: SurvivalShip | null = null;
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

  private updateSprites(): void {
    for (const [id, ship] of this.ships) {
      const healthBar = this.healthBars.get(id);
      if (healthBar) {
        healthBar.setPosition(ship.x, ship.y - 40);
      }
    }
  }
}
