/**
 * Campaign Battle Scene
 *
 * Handles campaign mission combat with objective tracking,
 * enemy spawning based on mission data, and victory/defeat conditions.
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
import type { CampaignMission, MissionObjective, MissionEnemy } from '../data/CampaignData';
import type { CampaignSaveData } from '../systems/CampaignSaveManager';
import { CampaignSaveManager } from '../systems/CampaignSaveManager';
import { distributeMissionXp } from '../systems/CampaignPilotManager';
import { CAMPAIGN_PILOTS } from '../data/PilotData';
import { audioManager } from '../audio/AudioManager';

interface ShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
  shipBody: Phaser.GameObjects.Graphics;
  healthBar: Phaser.GameObjects.Graphics;
  selectionRing?: Phaser.GameObjects.Graphics;
}

interface ObjectiveState {
  objective: MissionObjective;
  completed: boolean;
  progress: number;
  target: number;
}

interface SceneData {
  factionId: FactionId;
  mission: CampaignMission;
  saveData: CampaignSaveData;
  selectedShips?: string[];
}

export class CampaignBattleScene extends Phaser.Scene {
  private shipSprites: Map<string, ShipSprite> = new Map();
  private battleManager!: BattleManager;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  // Mission state
  private factionId!: FactionId;
  private mission!: CampaignMission;
  private saveData!: CampaignSaveData;
  private selectedShips: string[] = [];
  private objectiveStates: ObjectiveState[] = [];
  private missionStartTime = 0;
  private totalKills = 0;
  private playerShipsLost = 0;
  private pendingEnemySpawns: { enemy: MissionEnemy; spawnAt: number }[] = [];
  private missionComplete = false;
  private missionFailed = false;

  // UI Elements
  private phaseText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;
  private objectivePanel!: Phaser.GameObjects.Container;
  private objectiveTexts: Phaser.GameObjects.Text[] = [];
  private maneuverButtons: Phaser.GameObjects.Container[] = [];
  private targetButtons: Phaser.GameObjects.Container[] = [];
  private actionButtons: Phaser.GameObjects.Container[] = [];

  constructor() {
    super({ key: 'CampaignBattleScene' });
  }

  init(data: SceneData): void {
    this.factionId = data.factionId;
    this.mission = data.mission;
    this.saveData = data.saveData;
    this.selectedShips = data.selectedShips ?? this.mission.playerShips.slice(0, this.mission.maxSquadSize);

    // Initialize objective states
    this.objectiveStates = this.mission.objectives.map(obj => ({
      objective: obj,
      completed: false,
      progress: 0,
      target: obj.count ?? 1,
    }));

    // Reset mission stats
    this.totalKills = 0;
    this.playerShipsLost = 0;
    this.missionComplete = false;
    this.missionFailed = false;
    this.pendingEnemySpawns = [];
    this.shipSprites.clear();
  }

  create(): void {
    // Set up the battlefield
    this.cameras.main.setBounds(0, 0, BATTLEFIELD_SIZE, BATTLEFIELD_SIZE);
    this.cameras.main.setBackgroundColor(0x0a0a1a);

    this.createStarfield();
    this.createBattlefieldGrid();
    this.setupInput();
    this.createHUD();
    this.createObjectivePanel();

    // Play combat music
    audioManager.playMusic('combat_medium');

    // Build enemy ship list
    const enemyShips: string[] = [];
    const immediateEnemies: MissionEnemy[] = [];

    for (const enemy of this.mission.enemies) {
      if (enemy.spawnDelay && enemy.spawnDelay > 0) {
        // Queue delayed spawn
        this.pendingEnemySpawns.push({
          enemy,
          spawnAt: Date.now() + enemy.spawnDelay,
        });
      } else {
        immediateEnemies.push(enemy);
      }
    }

    for (const enemy of immediateEnemies) {
      for (let i = 0; i < enemy.count; i++) {
        enemyShips.push(enemy.shipId);
      }
    }

    // Determine enemy faction from first enemy
    const enemyFaction = immediateEnemies[0]?.faction ?? 'terran_hegemony';

    // Start battle
    const config: BattleConfig = {
      playerFaction: this.factionId,
      enemyFaction,
      playerShips: this.selectedShips,
      enemyShips,
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

    // Track mission start
    this.missionStartTime = Date.now();

    // Start game clock
    GameClock.start();
  }

  update(_time: number): void {
    if (this.missionComplete || this.missionFailed) return;

    this.handleInput();
    this.updateShipSprites();
    this.checkDelayedSpawns();
    this.checkObjectives();
    this.updateObjectiveDisplay();
  }

  private checkDelayedSpawns(): void {
    const now = Date.now();
    const toSpawn: MissionEnemy[] = [];

    this.pendingEnemySpawns = this.pendingEnemySpawns.filter(spawn => {
      if (now >= spawn.spawnAt) {
        toSpawn.push(spawn.enemy);
        return false;
      }
      return true;
    });

    for (const enemy of toSpawn) {
      this.spawnReinforcements(enemy);
    }
  }

  private spawnReinforcements(enemy: MissionEnemy): void {
    // Add reinforcement message
    this.addLogMessage(`Enemy reinforcements incoming!`);

    // Create new enemy ships through battle manager
    const state = this.battleManager.getState();

    for (let i = 0; i < enemy.count; i++) {
      const shipId = `reinforcement_${Date.now()}_${i}`;
      const def = getShipDefinition(enemy.shipId);
      if (!def) continue;

      // Spawn at random edge position
      const edge = Phaser.Math.Between(0, 3);
      let x: number, y: number, angle: number;

      switch (edge) {
        case 0: // Top
          x = Phaser.Math.Between(200, BATTLEFIELD_SIZE - 200);
          y = 50;
          angle = 180;
          break;
        case 1: // Right
          x = BATTLEFIELD_SIZE - 50;
          y = Phaser.Math.Between(200, BATTLEFIELD_SIZE - 200);
          angle = 270;
          break;
        case 2: // Bottom
          x = Phaser.Math.Between(200, BATTLEFIELD_SIZE - 200);
          y = BATTLEFIELD_SIZE - 50;
          angle = 0;
          break;
        default: // Left
          x = 50;
          y = Phaser.Math.Between(200, BATTLEFIELD_SIZE - 200);
          angle = 90;
          break;
      }

      const newShip: ShipState = {
        id: shipId,
        definitionId: enemy.shipId,
        owner: 'ai',
        faction: enemy.faction,
        x,
        y,
        angle,
        hull: def.baseStats.hull * (enemy.isAce ? 1.5 : 1),
        maxHull: def.baseStats.hull * (enemy.isAce ? 1.5 : 1),
        shields: def.baseStats.shields,
        maxShields: def.baseStats.shields,
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
      };

      state.ships.set(shipId, newShip);
      this.createShipSprite(newShip);
    }
  }

  private checkObjectives(): void {
    const state = this.battleManager.getState();
    const elapsedSeconds = (Date.now() - this.missionStartTime) / 1000;

    // Count living ships
    let playerShipsAlive = 0;
    let enemyShipsAlive = 0;

    for (const ship of state.ships.values()) {
      if (ship.hull > 0) {
        if (ship.owner === 'player') {
          playerShipsAlive++;
        } else {
          enemyShipsAlive++;
        }
      }
    }

    // Check each objective
    for (const objState of this.objectiveStates) {
      if (objState.completed) continue;

      const obj = objState.objective;

      switch (obj.type) {
        case 'eliminate':
          // Track kills
          objState.progress = this.totalKills;
          if (objState.progress >= objState.target) {
            objState.completed = true;
          }
          break;

        case 'survive':
          // Check if time limit reached
          if (obj.timeLimit && elapsedSeconds >= obj.timeLimit) {
            if (playerShipsAlive > 0) {
              objState.completed = true;
            } else {
              // Failed to survive
              if (!obj.optional) {
                this.triggerMissionFailed('Your ships were destroyed');
                return;
              }
            }
          }
          objState.progress = Math.floor(elapsedSeconds);
          break;

        case 'defend':
          // For now, same as survive
          if (obj.timeLimit && elapsedSeconds >= obj.timeLimit) {
            objState.completed = true;
          }
          objState.progress = Math.floor(elapsedSeconds);
          break;

        case 'assassinate':
          // Check if boss/ace is dead
          // For simplicity, complete when all enemies dead
          if (enemyShipsAlive === 0 && this.pendingEnemySpawns.length === 0) {
            objState.completed = true;
          }
          break;

        case 'escort':
        case 'capture':
          // Simplified: complete when enemies eliminated
          if (enemyShipsAlive === 0 && this.pendingEnemySpawns.length === 0) {
            objState.completed = true;
          }
          break;
      }
    }

    // Check victory conditions
    const requiredObjectives = this.objectiveStates.filter(o => !o.objective.optional);
    const allRequiredComplete = requiredObjectives.every(o => o.completed);

    if (allRequiredComplete && !this.missionComplete) {
      this.triggerMissionVictory();
    }

    // Check failure conditions
    if (playerShipsAlive === 0 && !this.missionFailed) {
      this.triggerMissionFailed('All ships destroyed');
    }
  }

  private triggerMissionVictory(): void {
    this.missionComplete = true;
    audioManager.playMusic('victory_sting');

    // Calculate rewards
    const optionalComplete = this.objectiveStates.filter(o => o.objective.optional && o.completed);
    let bonusXp = 0;
    for (const obj of optionalComplete) {
      bonusXp += obj.objective.xpBonus ?? 50;
    }

    const totalXp = this.mission.rewards.xp + bonusXp;
    const totalCredits = this.mission.rewards.credits;

    // Distribute XP to pilots
    const pilotDefs = CAMPAIGN_PILOTS[this.factionId] ?? [];
    const { updatedPilots, levelUpEvents } = distributeMissionXp(
      this.saveData.campaignPilots,
      pilotDefs,
      this.mission.rewards.xp,
      bonusXp
    );

    // Set pendingEvolution if this mission has an evolution choice
    const pendingEvolution = !!this.mission.evolutionChoice;

    // Update save data with pilot progression
    const preMissionSave = this.saveData;
    const updatedSave = CampaignSaveManager.completeMission(
      this.saveData,
      this.mission.id,
      totalXp,
      totalCredits,
      this.totalKills,
      this.playerShipsLost,
      this.mission.rewards.unlocks ?? [],
      updatedPilots,
      pendingEvolution
    );

    // Brief flash then transition to DebriefScene
    this.showMissionCompleteFlash(() => {
      this.scene.start('DebriefScene', {
        factionId: this.factionId,
        mission: this.mission,
        preMissionSave,
        updatedSave,
        xpEarned: totalXp,
        creditsEarned: totalCredits,
        kills: this.totalKills,
        shipsLost: this.playerShipsLost,
        protagonistBonusXp: bonusXp,
        levelUpEvents,
      });
    });
  }

  private showMissionCompleteFlash(onComplete: () => void): void {
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.5);
    overlay.fillRect(0, 0, this.scale.width, this.scale.height);
    overlay.setScrollFactor(0);
    overlay.setDepth(2000);

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    const flashText = this.add.text(centerX, centerY, 'MISSION COMPLETE', {
      font: 'bold 48px Arial',
      color: '#44ff66',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setAlpha(0);

    this.tweens.add({
      targets: flashText,
      alpha: 1,
      duration: 400,
      ease: 'Linear',
      onComplete: () => {
        this.time.delayedCall(1600, () => {
          this.cameras.main.fade(400, 0, 0, 0, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
            if (progress === 1) {
              onComplete();
            }
          });
        });
      },
    });
  }

  private triggerMissionFailed(reason: string): void {
    this.missionFailed = true;
    audioManager.playMusic('defeat_sting');

    // Show defeat screen
    this.showResultScreen(false, 0, 0, this.saveData, reason);
  }

  private showResultScreen(
    victory: boolean,
    xpEarned: number,
    creditsEarned: number,
    saveData: CampaignSaveData,
    failReason?: string
  ): void {
    // Dim the battlefield
    const dimmer = this.add.graphics();
    dimmer.fillStyle(0x000000, 0.7);
    dimmer.fillRect(0, 0, this.scale.width, this.scale.height);
    dimmer.setScrollFactor(0);
    dimmer.setDepth(2000);

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    // Result panel
    const panel = this.add.container(centerX, centerY);
    panel.setScrollFactor(0);
    panel.setDepth(2001);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(victory ? 0x1a3322 : 0x331a1a, 0.95);
    bg.fillRoundedRect(-250, -200, 500, 400, 16);
    bg.lineStyle(3, victory ? 0x44ff66 : 0xff4444, 1);
    bg.strokeRoundedRect(-250, -200, 500, 400, 16);
    panel.add(bg);

    // Title
    const title = this.add.text(0, -160, victory ? 'MISSION COMPLETE' : 'MISSION FAILED', {
      font: 'bold 36px Arial',
      color: victory ? '#44ff66' : '#ff4444',
    }).setOrigin(0.5);
    panel.add(title);

    // Mission name
    const missionName = this.add.text(0, -110, this.mission.title, {
      font: '24px Arial',
      color: '#ffffff',
    }).setOrigin(0.5);
    panel.add(missionName);

    let yOffset = -60;

    if (victory) {
      // Show rewards
      const xpText = this.add.text(-100, yOffset, `XP Earned: ${xpEarned}`, {
        font: '20px Arial',
        color: '#88ff88',
      });
      panel.add(xpText);
      yOffset += 35;

      const creditsText = this.add.text(-100, yOffset, `Credits: ${creditsEarned}`, {
        font: '20px Arial',
        color: '#ffcc44',
      });
      panel.add(creditsText);
      yOffset += 35;

      // Stats
      const killsText = this.add.text(-100, yOffset, `Enemies Destroyed: ${this.totalKills}`, {
        font: '16px Arial',
        color: '#aaaaaa',
      });
      panel.add(killsText);
      yOffset += 25;

      const lossText = this.add.text(-100, yOffset, `Ships Lost: ${this.playerShipsLost}`, {
        font: '16px Arial',
        color: '#aaaaaa',
      });
      panel.add(lossText);
      yOffset += 35;

      // Show unlocks if any
      if (this.mission.rewards.unlocks && this.mission.rewards.unlocks.length > 0) {
        const unlockLabel = this.add.text(-100, yOffset, 'Unlocked:', {
          font: 'bold 16px Arial',
          color: '#ffaa44',
        });
        panel.add(unlockLabel);
        yOffset += 25;

        for (const unlock of this.mission.rewards.unlocks) {
          const unlockText = this.add.text(-80, yOffset, `• ${unlock}`, {
            font: '14px Arial',
            color: '#ffcc88',
          });
          panel.add(unlockText);
          yOffset += 20;
        }
      }
    } else {
      // Show failure reason
      const reasonText = this.add.text(0, yOffset, failReason ?? 'Objectives not completed', {
        font: '18px Arial',
        color: '#ff8888',
      }).setOrigin(0.5);
      panel.add(reasonText);
      yOffset += 50;

      const tipText = this.add.text(0, yOffset, 'Try different tactics or ship loadouts', {
        font: '14px Arial',
        color: '#888888',
      }).setOrigin(0.5);
      panel.add(tipText);
    }

    // Buttons
    const buttonY = 140;

    if (victory) {
      // Continue button
      const continueBtn = this.createResultButton(0, buttonY, 'CONTINUE', 0x44aa44, () => {
        this.scene.start('CampaignScene', { factionId: this.factionId });
      });
      panel.add(continueBtn);
    } else {
      // Retry button
      const retryBtn = this.createResultButton(-80, buttonY, 'RETRY', 0xaa8844, () => {
        this.scene.restart();
      });
      panel.add(retryBtn);

      // Quit button
      const quitBtn = this.createResultButton(80, buttonY, 'QUIT', 0x666666, () => {
        this.scene.start('CampaignScene', { factionId: this.factionId });
      });
      panel.add(quitBtn);
    }

    // Animate in
    panel.setScale(0.5);
    panel.setAlpha(0);
    this.tweens.add({
      targets: panel,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: 'Back.out',
    });
  }

  private createResultButton(
    x: number,
    y: number,
    text: string,
    color: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-60, -20, 120, 40, 8);
    container.add(bg);

    const label = this.add.text(0, 0, text, {
      font: 'bold 18px Arial',
      color: '#ffffff',
    }).setOrigin(0.5);
    container.add(label);

    container.setSize(120, 40);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(color, 0.8);
      bg.fillRoundedRect(-60, -20, 120, 40, 8);
      bg.lineStyle(2, 0xffffff, 1);
      bg.strokeRoundedRect(-60, -20, 120, 40, 8);
    });

    container.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(color, 1);
      bg.fillRoundedRect(-60, -20, 120, 40, 8);
    });

    container.on('pointerdown', () => {
      audioManager.playSound('ui_select', 0.7);
      onClick();
    });

    return container;
  }

  private createObjectivePanel(): void {
    this.objectivePanel = this.add.container(this.scale.width - 10, 10);
    this.objectivePanel.setScrollFactor(0);
    this.objectivePanel.setDepth(1000);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x112233, 0.8);
    bg.fillRoundedRect(-260, 0, 260, 30 + this.mission.objectives.length * 25, 8);
    this.objectivePanel.add(bg);

    // Title
    const title = this.add.text(-250, 5, 'OBJECTIVES', {
      font: 'bold 14px Arial',
      color: '#ffcc00',
    });
    this.objectivePanel.add(title);

    // Objective texts
    this.objectiveTexts = [];
    let yOffset = 30;

    for (const objState of this.objectiveStates) {
      const prefix = objState.objective.optional ? '(Bonus) ' : '';
      const text = this.add.text(-250, yOffset, `${prefix}${objState.objective.description}`, {
        font: '12px Arial',
        color: '#ffffff',
        wordWrap: { width: 240 },
      });
      this.objectivePanel.add(text);
      this.objectiveTexts.push(text);
      yOffset += 25;
    }
  }

  private updateObjectiveDisplay(): void {
    for (let i = 0; i < this.objectiveStates.length; i++) {
      const objState = this.objectiveStates[i];
      const text = this.objectiveTexts[i];
      if (!text || !objState) continue;

      const prefix = objState.objective.optional ? '(Bonus) ' : '';
      let status = '';

      if (objState.completed) {
        text.setColor('#44ff44');
        status = ' ✓';
      } else if (objState.objective.type === 'eliminate') {
        status = ` (${objState.progress}/${objState.target})`;
        text.setColor('#ffffff');
      } else if (objState.objective.type === 'survive' || objState.objective.type === 'defend') {
        const remaining = (objState.objective.timeLimit ?? 0) - objState.progress;
        status = ` (${Math.max(0, remaining)}s)`;
        text.setColor('#ffffff');
      }

      text.setText(`${prefix}${objState.objective.description}${status}`);
    }
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

    // Escape to pause/quit
    this.input.keyboard!.on('keydown-ESC', () => {
      if (!this.missionComplete && !this.missionFailed) {
        this.showPauseMenu();
      }
    });
  }

  private showPauseMenu(): void {
    // Simple pause - just go back to campaign
    this.scene.start('CampaignScene', { factionId: this.factionId });
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
    // Mission name
    this.add.text(10, 10, this.mission.title, {
      font: 'bold 20px Arial',
      color: '#ffffff',
    }).setScrollFactor(0).setDepth(1000);

    // Turn/Phase display
    this.turnText = this.add.text(10, 40, 'Turn 1', {
      font: 'bold 16px Arial',
      color: '#ffffff',
    }).setScrollFactor(0).setDepth(1000);

    this.phaseText = this.add.text(10, 60, 'Planning Phase', {
      font: '14px Arial',
      color: '#88ff88',
    }).setScrollFactor(0).setDepth(1000);

    // Instructions
    this.instructionText = this.add.text(10, 90, '', {
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
    // Track kills
    let currentEnemyCount = 0;
    let currentPlayerCount = 0;

    for (const ship of state.ships.values()) {
      if (ship.hull > 0) {
        if (ship.owner === 'ai') {
          currentEnemyCount++;
        } else {
          currentPlayerCount++;
        }
      }
    }

    // Calculate kills from ship count changes
    // (This is simplified - in real implementation track destroyed events)

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

    // Track kill messages
    if (msg.toLowerCase().includes('destroyed') && msg.toLowerCase().includes('enemy')) {
      this.totalKills++;
    }
    if (msg.toLowerCase().includes('destroyed') && msg.toLowerCase().includes('player')) {
      this.playerShipsLost++;
    }
  }

  private showManeuverUI(): void {
    const maneuvers = this.battleManager.getAvailableManeuvers();
    const grouped = this.groupManeuversBySpeed(maneuvers);

    let yOffset = 130;
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

    let yOffset = 130;
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

    let yOffset = 130;

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
