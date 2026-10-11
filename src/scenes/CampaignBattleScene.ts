/**
 * Campaign Battle Scene
 *
 * Real-time arcade combat for campaign missions — same flight/combat model as
 * DogfightScene/SurvivalScene (X-Wing cycle engine: template arcs committed
 * each cycle, pilot stress; autofire; toroidal battlefield). The flagship is
 * flown by the player through the shared pilot controls; escorts and enemies
 * run the seek AI. Owns objective tracking, scripted enemy spawns from
 * mission data, and the briefing/debrief hand-off. Campaign used to run on a
 * separate discrete turn-based engine (BattleManager/TurnSystem); that engine
 * was removed so every game mode shares one combat model.
 */

import Phaser from "phaser";
import { ShipStatCard } from "../ui/ShipStatCard";
import {
  BATTLEFIELD_SIZE,
  CYCLE_DURATION_MS,
  SHIP_SIZES,
  type FactionId,
} from "../config";
import { getShipDefinition, getShipDial } from "../data/ShipDefinitions";
import {
  getModeCombatStats,
  calculateHitChance,
  type ModeCombatStats,
} from "../data/ModeBalancing";
import { findClosestEnemy } from "../systems/BattleHelpers";
import type { ManeuverDefinition } from "../core/types";
import {
  createCycleFlight,
  steerAiFlight,
  tickCycleFlight,
  type CycleFlightState,
} from "../arcade/systems/CycleFlight";
import { PlayerFlightPilot } from "../arcade/systems/PlayerFlightPilot";
import { wrapCoordinate } from "../arcade/systems/ShipMotion";
import type { FlightEvent } from "../arcade/systems/PilotFlightTypes";
import { canHullKTurn, seekSteerOrder } from "../arcade/systems/AiPursuit";
import { playFlightEventFx } from "../arcade/ArcadeFX";
import {
  assignQuickBuilds,
  equipFlight,
  equipQuickBuild,
  regenerateShields,
  stressModifiersOf,
} from "../arcade/systems/QuickBuildEquip";
import {
  absorbDamage,
  combatantOf,
  resolveDiceAttack,
} from "../arcade/systems/DiceAttack";
import {
  campaignAbilityIds,
  campaignPilotModifiers,
  seatCampaignPilots,
} from "../arcade/systems/CampaignPilotEquip";
import {
  deathBlastTargets,
  hasWingman,
  rewardKill,
} from "../arcade/PilotAbilityCombat";
import { applyInstantStress } from "../arcade/ArcadeStress";
import {
  NEUTRAL_MODIFIERS,
  type CombatModifiers,
} from "../core/CombatModifiers";
import { random } from "../utils/random";
import { addShipVisual } from "../rendering/ShipVisual";
import type {
  CampaignMission,
  MissionObjective,
  MissionEnemy,
} from "../data/CampaignData";
import type { CampaignSaveData } from "../systems/CampaignSaveManager";
import { CampaignSaveManager } from "../systems/CampaignSaveManager";
import { distributeMissionXp } from "../systems/CampaignPilotManager";
import { CAMPAIGN_PILOTS } from "../data/PilotData";
import { audioManager } from "../audio/AudioManager";
import { syncListenerToCamera } from "../audio/CameraListener";
import { addPaintedSpaceBackground } from "../ui/TexturedPanel";
import { renderBattleStarfield } from "../rendering/Starfield";
import { ParallaxBackground } from "../rendering/ParallaxBackground";
import { EffectsManager } from "../rendering/EffectsManager";
import { HealthBar } from "../ui/HealthBar";
import { PauseMenu } from "../ui/PauseMenu";
import {
  createPerformanceState,
  updateFPS,
  evaluateQuality,
  type PerformanceState,
} from "../systems/PerformanceSystem";
import {
  applyCapitalSystemDamage,
  createCapitalSystems,
  isEnginesOffline,
  sumSystemsHull,
  SYSTEM_LABELS,
  type CapitalSystemsState,
} from "../systems/CapitalSystems";
import { ShipTelemetry } from "../debug/ShipTelemetry";
import { InputManager } from "../input/InputManager";
import { setupSceneInput, teardownSceneInput } from "../input/setupSceneInput";

/** Extra weapon range in pixels granted per point of an evolution's agility bonus. */
const AGILITY_EVASION_FACTOR = 0.05;

interface CampaignShip {
  id: string;
  definitionId: string;
  faction: FactionId;
  owner: "player" | "ai";
  x: number;
  y: number;
  angle: number;
  hull: number;
  maxHull: number;
  shields: number;
  maxShields: number;
  combatStats: ModeCombatStats;
  /** Cycle-engine motion and pilot stress; x/y/angle mirror its pose. */
  flight: CycleFlightState;
  dial: readonly ManeuverDefinition[];
  /** True on the frame this ship's maneuver cycle committed. */
  cycleCommitted: boolean;
  /** Whether the AI may K-turn this hull (false for capitals). */
  allowKTurn: boolean;
  weaponCooldown: number;
  /** Quick build flown (upgrades + pilot), or null for the bare hull. */
  loadoutId: string | null;
  /** Real-time effects of the quick build and its campaign pilot's abilities. */
  modifiers: CombatModifiers;
  /** Scene time (ms) until which a kill-frenzy ability is active. */
  frenzyUntilMs: number;
  /** Present only for boss-tier ships. */
  capitalSystems?: CapitalSystemsState | null;
}

/** What a new ship is and how it is equipped. */
interface ShipSpawn {
  readonly id: string;
  readonly definitionId: string;
  readonly faction: FactionId;
  readonly owner: "player" | "ai";
  /** Spawn pose (may lie off the battlefield edge). */
  readonly pose: Pose;
  readonly loadoutId: string | null;
  /** Abilities of the campaign pilot flying it (none for AI-only ships). */
  readonly pilotAbilityIds?: readonly string[];
}

/** Vertical offset (px) of a ship's health bar above its sprite. */
const HEALTH_BAR_OFFSET_Y = 40;

/** A pose on the battlefield. */
interface Pose {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

interface ShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
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
  /** Quick builds chosen for selectedShips (by index); the rest get defaults. */
  selectedLoadouts?: (string | null)[];
}

export class CampaignBattleScene extends Phaser.Scene {
  private ships: Map<string, CampaignShip> = new Map();
  private shipSprites: Map<string, ShipSprite> = new Map();
  private healthBars: Map<string, HealthBar> = new Map();
  private playerShipIds: string[] = [];
  private enemyShipIds: string[] = [];
  private inputSubscriptionIds: number[] = [];

  // Mission state
  private factionId!: FactionId;
  private mission!: CampaignMission;
  private saveData!: CampaignSaveData;
  private selectedShips: string[] = [];
  private selectedLoadouts: (string | null)[] = [];
  private objectiveStates: ObjectiveState[] = [];
  private missionStartTime = 0;
  private totalKills = 0;
  private playerShipsLost = 0;
  private pendingEnemySpawns: { enemy: MissionEnemy; spawnAt: number }[] = [];
  private missionComplete = false;
  private missionFailed = false;
  private isPaused = false;
  private pauseMenu!: PauseMenu;

  // UI
  private missionTitleText!: Phaser.GameObjects.Text;
  private objectivePanel!: Phaser.GameObjects.Container;
  private objectiveTexts: Phaser.GameObjects.Text[] = [];
  private controlsHintText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;

  // Camera follow (manual — toroid wrap makes Phaser's startFollow jump at the seam)
  private cameraVirtualX = BATTLEFIELD_SIZE / 2;
  private cameraVirtualY = BATTLEFIELD_SIZE / 2;

  private effectsManager!: EffectsManager;
  private background!: ParallaxBackground;
  private performanceState: PerformanceState = createPerformanceState();
  private telemetry: ShipTelemetry | null = null;
  private cameraShakeEnabled = true;

  /** The human pilot's flight input (InputManager-driven), flying the flagship. */
  private readonly pilot = new PlayerFlightPilot(InputManager);
  /** Ship the pilot flew last frame; input memory resets when the flagship changes. */
  private pilotedShipId: string | null = null;

  constructor() {
    super({ key: "CampaignBattleScene" });
  }

  init(data: SceneData): void {
    this.factionId = data.factionId;
    this.mission = data.mission;
    this.saveData = data.saveData;
    this.selectedShips =
      data.selectedShips ??
      this.mission.playerShips.slice(0, this.mission.maxSquadSize);
    this.selectedLoadouts = data.selectedLoadouts ?? [];

    this.objectiveStates = this.mission.objectives.map((obj) => ({
      objective: obj,
      completed: false,
      progress: 0,
      target: obj.count ?? 1,
    }));

    this.totalKills = 0;
    this.playerShipsLost = 0;
    this.missionComplete = false;
    this.missionFailed = false;
    this.pendingEnemySpawns = [];
    this.ships.clear();
    this.shipSprites.clear();
    this.healthBars.clear();
    this.playerShipIds = [];
    this.enemyShipIds = [];
    this.pilotedShipId = null;
    this.pilot.reset();
  }

  shutdown(): void {
    this.inputSubscriptionIds.forEach((id) => InputManager.off(id));
    this.inputSubscriptionIds = [];
    teardownSceneInput();
    this.pilot.detach();
  }

  create(): void {
    // Phaser never calls shutdown() on its own; without this, every restart
    // stacks another set of input subscriptions.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.cameras.main.setBackgroundColor(0x0a0a1a);
    addPaintedSpaceBackground(this, "planet_gas_giant", 0);

    audioManager.playFactionMusic(this.factionId, "combat");

    this.effectsManager = new EffectsManager(this);
    const savedSettings = this.registry.get("settings") as
      { cameraShake: boolean; showDamageNumbers: boolean } | undefined;
    if (savedSettings) {
      this.cameraShakeEnabled = savedSettings.cameraShake;
      this.effectsManager.setUserSettings({
        cameraShake: savedSettings.cameraShake,
        showDamageNumbers: savedSettings.showDamageNumbers,
      });
    }
    this.background = new ParallaxBackground(
      this,
      BATTLEFIELD_SIZE,
      BATTLEFIELD_SIZE,
    );
    this.background.startShootingStars();

    this.createStarfield();
    this.createHUD();
    this.createObjectivePanel();
    this.setupInput();

    this.spawnInitialShips();

    if (ShipTelemetry.isEnabled()) {
      this.telemetry = new ShipTelemetry();
      this.telemetry.start();
      (
        window as unknown as { __shipTelemetry: ShipTelemetry }
      ).__shipTelemetry = this.telemetry;
    }

    const flagship = this.ships.get(this.playerShipIds[0] ?? "");
    this.cameraVirtualX = flagship?.x ?? BATTLEFIELD_SIZE / 2;
    this.cameraVirtualY = flagship?.y ?? BATTLEFIELD_SIZE / 2;
    this.cameras.main.centerOn(this.cameraVirtualX, this.cameraVirtualY);
    this.cameras.main.setZoom(1.0);

    this.missionStartTime = Date.now();
    this.showMessage(this.mission.title, "Mission start!");
  }

  update(time: number, delta: number): void {
    InputManager.update();
    // Mix every positional sound relative to what the player is
    // looking at, so a distant firefight sounds distant.
    syncListenerToCamera(this.cameras.main);
    if (this.isPaused || this.missionComplete || this.missionFailed) return;

    this.performanceState = updateFPS(this.performanceState, delta);
    this.performanceState = evaluateQuality(this.performanceState, time);
    this.effectsManager.setQualitySettings(
      this.performanceState.effectSettings,
    );

    this.background.update();

    this.updateAI(time, delta);
    this.flyShips(delta);
    this.processCombat(delta);
    this.updateCameraFollow();
    this.checkDelayedSpawns();
    this.checkObjectives();
    this.updateObjectiveDisplay();
  }

  // ==========================================
  // SETUP
  // ==========================================

  private createStarfield(): void {
    renderBattleStarfield(this, BATTLEFIELD_SIZE, {
      starCount: 300,
      includeNebula: false,
    });
  }

  private createHUD(): void {
    this.missionTitleText = this.add
      .text(10, 10, this.mission.title, {
        font: "bold 20px Arial",
        color: "#ffffff",
      })
      .setScrollFactor(0)
      .setDepth(1000);

    this.messageText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, "", {
        font: "bold 36px Arial",
        color: "#00ffaa",
        stroke: "#004422",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001)
      .setAlpha(0);

    this.controlsHintText = this.add
      .text(
        this.scale.width / 2,
        this.scale.height - 30,
        "UP/DOWN: Speed (x2: Boost) | LEFT/RIGHT: tap drift, hold bank | Q/E: Hard turn | Z: K-turn | Weapons autofire | ESC: Pause",
        { font: "14px monospace", color: "#666666" },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);
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

  private createObjectivePanel(): void {
    this.objectivePanel = this.add.container(this.scale.width - 10, 10);
    this.objectivePanel.setScrollFactor(0);
    this.objectivePanel.setDepth(1000);

    const bg = this.add.graphics();
    bg.fillStyle(0x112233, 0.8);
    bg.fillRoundedRect(
      -260,
      0,
      260,
      30 + this.mission.objectives.length * 25,
      8,
    );
    this.objectivePanel.add(bg);

    const title = this.add.text(-250, 5, "OBJECTIVES", {
      font: "bold 14px Arial",
      color: "#ffcc00",
    });
    this.objectivePanel.add(title);

    this.objectiveTexts = [];
    let yOffset = 30;
    for (const objState of this.objectiveStates) {
      const prefix = objState.objective.optional ? "(Bonus) " : "";
      const text = this.add.text(
        -250,
        yOffset,
        `${prefix}${objState.objective.description}`,
        { font: "12px Arial", color: "#ffffff", wordWrap: { width: 240 } },
      );
      this.objectivePanel.add(text);
      this.objectiveTexts.push(text);
      yOffset += 25;
    }
  }

  private setupInput(): void {
    setupSceneInput(this);
    this.pilot.attach();
    this.createPauseMenu();
    this.inputSubscriptionIds.push(
      InputManager.on("PAUSE", () => this.togglePause()),
    );

    this.input.on(
      "wheel",
      (
        _pointer: Phaser.Input.Pointer,
        _gos: unknown,
        _dx: number,
        deltaY: number,
      ) => {
        const zoom = this.cameras.main.zoom - deltaY * 0.001;
        this.cameras.main.setZoom(Phaser.Math.Clamp(zoom, 0.5, 2));
      },
    );
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
      onSettings: () => {
        this.scene.launch("SettingsScene", {
          returnScene: "CampaignBattleScene",
        });
      },
      onQuit: () => {
        this.scene.start("CampaignScene", { factionId: this.factionId });
      },
    });
  }

  /** Zoom resets to 1.0 first — scrollFactor(0) buttons aren't reliably hit-tested off-zoom. */
  private togglePause(): void {
    if (this.missionComplete || this.missionFailed) return;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.cameras.main.setZoom(1.0);
      this.pauseMenu.show();
    }
  }

  /**
   * Manually follows the flagship with toroid-aware shortest-path lerp
   * (mirrors ArcadeBattleScene/DogfightScene/SurvivalScene).
   */
  private updateCameraFollow(): void {
    const ship = this.ships.get(this.playerShipIds[0] ?? "");
    if (!ship) return;

    let dx = ship.x - this.cameraVirtualX;
    let dy = ship.y - this.cameraVirtualY;
    if (dx > BATTLEFIELD_SIZE / 2) dx -= BATTLEFIELD_SIZE;
    if (dx < -BATTLEFIELD_SIZE / 2) dx += BATTLEFIELD_SIZE;
    if (dy > BATTLEFIELD_SIZE / 2) dy -= BATTLEFIELD_SIZE;
    if (dy < -BATTLEFIELD_SIZE / 2) dy += BATTLEFIELD_SIZE;

    const lerp = 0.09;
    this.cameraVirtualX += dx * lerp;
    this.cameraVirtualY += dy * lerp;
    this.cameraVirtualX =
      ((this.cameraVirtualX % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) %
      BATTLEFIELD_SIZE;
    this.cameraVirtualY =
      ((this.cameraVirtualY % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) %
      BATTLEFIELD_SIZE;

    const zoom = this.cameras.main.zoom;
    this.cameras.main.setScroll(
      this.cameraVirtualX - this.scale.width / (2 * zoom),
      this.cameraVirtualY - this.scale.height / (2 * zoom),
    );
  }

  // ==========================================
  // SHIP SPAWNING
  // ==========================================

  private spawnInitialShips(): void {
    const centerX = BATTLEFIELD_SIZE / 2;
    const centerY = BATTLEFIELD_SIZE / 2;

    this.spawnPlayerSquad(centerX, centerY + 220);

    // Immediate enemy spawns (delayed ones are queued via pendingEnemySpawns).
    const immediateEnemies = this.mission.enemies.filter(
      (e) => !e.spawnDelay || e.spawnDelay <= 0,
    );
    for (const enemy of this.mission.enemies) {
      if (enemy.spawnDelay && enemy.spawnDelay > 0) {
        this.pendingEnemySpawns.push({
          enemy,
          spawnAt: Date.now() + enemy.spawnDelay,
        });
      }
    }
    this.spawnEnemyGroup(immediateEnemies, centerX, centerY - 220, 90);
  }

  /**
   * Spawns the player squad on a line: the flagship (index 0, flown by the
   * player) and the AI escorts. Each ship flies its quick build, plus the
   * abilities of the campaign pilot seated in it.
   *
   * @param centerX - Center of the line.
   * @param y - Line height.
   */
  private spawnPlayerSquad(centerX: number, y: number): void {
    const squadSize = this.selectedShips.length;
    const spacing = 90;
    const startX = centerX - ((squadSize - 1) * spacing) / 2;
    const loadouts = assignQuickBuilds(
      this.selectedShips,
      this.selectedLoadouts,
    );
    const seats = seatCampaignPilots(
      this.saveData.campaignPilots,
      CAMPAIGN_PILOTS[this.factionId] ?? [],
      squadSize,
    );
    this.selectedShips.forEach((defId, i) => {
      const seat = seats[i];
      const ship = this.createShip({
        id: `player_${i}`,
        definitionId: defId,
        faction: this.factionId,
        owner: "player",
        pose: { x: startX + i * spacing, y, angle: 270 },
        loadoutId: loadouts[i] ?? null,
        pilotAbilityIds: seat ? campaignAbilityIds(seat) : [],
      });
      if (i === 0) this.applyProtagonistBonuses(ship);
      this.ships.set(ship.id, ship);
      this.playerShipIds.push(ship.id);
      this.createShipSprite(ship);
      this.createHealthBar(ship);
    });
  }

  /** Spawns one or more enemy groups spread along a horizontal line. */
  private spawnEnemyGroup(
    enemies: MissionEnemy[],
    centerX: number,
    y: number,
    angle: number,
  ): void {
    const totalCount = enemies.reduce((sum, e) => sum + e.count, 0);
    if (totalCount === 0) return;
    const spacing = 80;
    const startX = centerX - ((totalCount - 1) * spacing) / 2;
    const loadouts = assignQuickBuilds(
      enemies.flatMap((enemy) => Array<string>(enemy.count).fill(enemy.shipId)),
    );
    let slot = 0;

    for (const enemy of enemies) {
      for (let i = 0; i < enemy.count; i++) {
        const id = `enemy_${Date.now()}_${slot}_${Math.random().toString(36).slice(2, 7)}`;
        const x = startX + slot * spacing;
        const yJitter = y + (Math.random() - 0.5) * 60;
        const pose = { x, y: yJitter, angle };
        this.spawnEnemyShip(id, enemy, pose, loadouts[slot] ?? null);
        slot++;
      }
    }
  }

  /** Spawns reinforcements around the flagship's current position (no fixed arena center anymore). */
  private spawnReinforcements(enemy: MissionEnemy): void {
    this.showMessage("REINFORCEMENTS", "Enemy reinforcements incoming!");
    const flagship = this.ships.get(this.playerShipIds[0] ?? "");
    const cx = flagship?.x ?? BATTLEFIELD_SIZE / 2;
    const cy = flagship?.y ?? BATTLEFIELD_SIZE / 2;
    const spawnRadius = 500;
    const loadouts = assignQuickBuilds(
      Array<string>(enemy.count).fill(enemy.shipId),
    );

    for (let i = 0; i < enemy.count; i++) {
      const id = `reinforcement_${Date.now()}_${i}`;
      const angle = Math.random() * Math.PI * 2;
      const x = cx + Math.cos(angle) * spawnRadius;
      const y = cy + Math.sin(angle) * spawnRadius;
      const facing = (Phaser.Math.RadToDeg(angle) + 180) % 360;
      const pose = { x, y, angle: facing };
      this.spawnEnemyShip(id, enemy, pose, loadouts[i] ?? null);
    }
  }

  /**
   * Spawns one mission enemy (ace/boss stat bumps included) at a pose.
   *
   * @param id - Ship id.
   * @param enemy - Mission enemy entry.
   * @param spawn - Spawn pose.
   * @param loadoutId - Its quick build, or null for the bare hull.
   */
  private spawnEnemyShip(
    id: string,
    enemy: MissionEnemy,
    spawn: Pose,
    loadoutId: string | null,
  ): void {
    const def = getShipDefinition(enemy.shipId);
    if (!def) return;

    const ship = this.createShip({
      id,
      definitionId: enemy.shipId,
      faction: enemy.faction,
      owner: "ai",
      pose: spawn,
      loadoutId,
    });
    if (enemy.isAce) {
      ship.maxHull = Math.floor(ship.maxHull * 1.5);
      ship.hull = ship.maxHull;
      ship.combatStats = {
        ...ship.combatStats,
        attackDice: ship.combatStats.attackDice + 1,
      };
    }
    if (enemy.isBoss) {
      ship.maxHull = Math.floor(ship.maxHull * 3);
      ship.hull = ship.maxHull;
      ship.maxShields = Math.floor(ship.maxShields * 2);
      ship.shields = ship.maxShields;
      ship.combatStats = {
        ...ship.combatStats,
        attackDice: ship.combatStats.attackDice + 2,
      };
      ship.capitalSystems = createCapitalSystems(ship.maxHull);
    }

    this.ships.set(id, ship);
    this.enemyShipIds.push(id);
    this.createShipSprite(ship, enemy.isAce, enemy.isBoss);
    this.createHealthBar(ship);
  }

  /**
   * Applies the protagonist pilot's evolution bonuses to the flagship. The
   * old turn-based scene only ever applied hull/shields — attack/agility were
   * silently ignored. Applying all four now.
   */
  private applyProtagonistBonuses(ship: CampaignShip): void {
    const protagonist = this.saveData.campaignPilots.find((p) => {
      const def = CAMPAIGN_PILOTS[this.factionId]?.find(
        (d) => d.id === p.pilotId,
      );
      return def?.role === "protagonist";
    });
    const bonuses = protagonist?.statBonuses;
    if (!bonuses) return;

    ship.maxHull += bonuses.hull ?? 0;
    ship.hull = ship.maxHull;
    ship.maxShields += bonuses.shields ?? 0;
    ship.shields = ship.maxShields;
    ship.combatStats = {
      ...ship.combatStats,
      attackDice: ship.combatStats.attackDice + (bonuses.attack ?? 0),
      agilityDice:
        ship.combatStats.agilityDice +
        (bonuses.agility ?? 0) * AGILITY_EVASION_FACTOR,
    };
  }

  private checkDelayedSpawns(): void {
    const now = Date.now();
    const toSpawn: MissionEnemy[] = [];
    this.pendingEnemySpawns = this.pendingEnemySpawns.filter((spawn) => {
      if (now >= spawn.spawnAt) {
        toSpawn.push(spawn.enemy);
        return false;
      }
      return true;
    });
    for (const enemy of toSpawn) this.spawnReinforcements(enemy);
  }

  /**
   * Builds a ship record flying the cycle engine from its spawn pose
   * (wrapped onto the toroidal battlefield), with its quick build — and
   * its campaign pilot's abilities — equipped.
   *
   * @param spawn - Identity, owner, pose and equipment of the new ship.
   * @returns The new ship record.
   */
  private createShip(spawn: ShipSpawn): CampaignShip {
    const { definitionId, pose } = spawn;
    const combatStats = getModeCombatStats(definitionId, "continuous");
    const flight = createCycleFlight(definitionId, {
      x: wrapCoordinate(pose.x, BATTLEFIELD_SIZE),
      y: wrapCoordinate(pose.y, BATTLEFIELD_SIZE),
      angle: pose.angle,
    });
    const ship: CampaignShip = {
      id: spawn.id,
      definitionId,
      faction: spawn.faction,
      owner: spawn.owner,
      x: flight.motion.x,
      y: flight.motion.y,
      angle: flight.motion.angle,
      hull: combatStats.hull,
      maxHull: combatStats.maxHull,
      shields: combatStats.shields,
      maxShields: combatStats.maxShields,
      combatStats,
      flight,
      dial: getShipDial(definitionId),
      cycleCommitted: false,
      allowKTurn: canHullKTurn(definitionId),
      weaponCooldown: 0,
      loadoutId: spawn.loadoutId,
      modifiers: NEUTRAL_MODIFIERS,
      frenzyUntilMs: 0,
    };
    ship.modifiers = equipQuickBuild(ship, spawn.loadoutId);
    const abilityIds = spawn.pilotAbilityIds ?? [];
    if (abilityIds.length > 0) {
      ship.modifiers = campaignPilotModifiers(
        definitionId,
        spawn.loadoutId,
        abilityIds,
      );
    }
    ship.flight = equipFlight(ship.flight, ship.modifiers);
    return ship;
  }

  private createShipSprite(
    ship: CampaignShip,
    isAce = false,
    isBoss = false,
  ): void {
    const container = this.add.container(ship.x, ship.y) as ShipSprite;
    container.shipId = ship.id;

    const shipDef = getShipDefinition(ship.definitionId);
    let size: number = SHIP_SIZES[shipDef?.baseStats.size ?? "small"];
    if (isBoss) size = SHIP_SIZES.large;
    else if (isAce) size = SHIP_SIZES.medium;

    if (isAce || isBoss) {
      const glowColor = isBoss ? 0xff4444 : 0xffdd00;
      const glow = this.add.graphics();
      glow.fillStyle(glowColor, 0.2);
      glow.fillCircle(0, 0, size * 0.8);
      container.add(glow);
    }

    addShipVisual(this, container, {
      definitionId: ship.definitionId,
      faction: ship.faction,
      fallbackSizeName: shipDef?.baseStats.size ?? "small",
      size,
      isPlayer: ship.owner === "player",
    });

    if (isAce || isBoss) {
      const outline = this.add.graphics();
      outline.lineStyle(isBoss ? 4 : 3, isBoss ? 0xff4444 : 0xffdd00, 1);
      outline.strokeCircle(0, 0, size * 1.1);
      container.add(outline);
    }

    container.setAngle(ship.angle);
    container.setDepth(isBoss ? 15 : 10);
    container.setSize(size * 2, size * 2);
    container.setInteractive();
    ShipStatCard.attachHoverCard(this, container, ship.definitionId);

    this.shipSprites.set(ship.id, container);
  }

  private createHealthBar(ship: CampaignShip): void {
    const healthBar = new HealthBar({
      scene: this,
      x: ship.x,
      y: ship.y - HEALTH_BAR_OFFSET_Y,
      faction: ship.faction,
      maxHull: ship.maxHull,
      maxShields: ship.maxShields,
      currentHull: ship.hull,
      currentShields: ship.shields,
    });
    this.healthBars.set(ship.id, healthBar);
  }

  // ==========================================
  // FLIGHT
  // ==========================================

  /**
   * Whether a ship flies this frame: alive, and (for boss hulls) with its
   * engines still online — a crippled capital drifts dead in space.
   *
   * @param ship - The ship.
   * @returns True if the ship's flight should advance.
   */
  private canFly(ship: CampaignShip): boolean {
    if (ship.hull <= 0) return false;
    return !(ship.capitalSystems && isEnginesOffline(ship.capitalSystems));
  }

  /**
   * Flies every ship one frame on the X-Wing cycle engine (template arcs,
   * cycle-boundary commits, stress) and syncs sprites to the new poses.
   *
   * @param deltaMs - Frame length (ms).
   */
  private flyShips(deltaMs: number): void {
    for (const ship of this.ships.values()) {
      if (!this.canFly(ship)) continue;
      const tick = tickCycleFlight(ship.flight, {
        deltaMs,
        worldSize: BATTLEFIELD_SIZE,
        dial: ship.dial,
        cycleMs: CYCLE_DURATION_MS,
        modifiers: stressModifiersOf(ship.modifiers),
      });
      this.setFlight(ship, tick.state);
      this.regenerateShipShields(ship, deltaMs);
      ship.cycleCommitted = tick.completed !== null;
      if (tick.completed && ship.id === this.pilotedShipId) {
        const { control } = tick.state.motion;
        this.pilot.onCycleCommitted(control.currentManeuver ?? "straight");
      }
      this.syncShipVisuals(ship);
    }
  }

  /**
   * Regenerates a ship's shields for a frame (equipment and abilities that
   * restore shields) and refreshes its health bar when they changed.
   *
   * @param ship - The ship.
   * @param deltaMs - Frame length (ms).
   */
  private regenerateShipShields(ship: CampaignShip, deltaMs: number): void {
    const shields = regenerateShields(
      ship.shields,
      ship.maxShields,
      ship.modifiers,
      deltaMs,
    );
    if (shields === ship.shields) return;
    ship.shields = shields;
    this.healthBars.get(ship.id)?.update(ship.hull, ship.shields);
  }

  /**
   * Moves a ship's sprite and health bar to its pose and samples telemetry.
   *
   * @param ship - The ship.
   */
  private syncShipVisuals(ship: CampaignShip): void {
    this.shipSprites
      .get(ship.id)
      ?.setPosition(ship.x, ship.y)
      .setAngle(ship.angle);
    this.healthBars
      .get(ship.id)
      ?.setPosition(ship.x, ship.y - HEALTH_BAR_OFFSET_Y);
    this.telemetry?.sample(ship.id, ship.x, ship.y, ship.angle);
  }

  /**
   * Stores a ship's new flight state and mirrors its pose onto the record
   * (combat, AI and camera read x/y/angle).
   *
   * @param ship - The ship.
   * @param flight - Its new flight state.
   */
  private setFlight(ship: CampaignShip, flight: CycleFlightState): void {
    ship.flight = flight;
    ship.x = flight.motion.x;
    ship.y = flight.motion.y;
    ship.angle = flight.motion.angle;
  }

  /**
   * Visual feedback for flight events, drawn from the pose they started at.
   *
   * @param ship - The ship that acted.
   * @param events - What happened this frame.
   * @param origin - Pose before the actions.
   */
  private playFlightEvents(
    ship: CampaignShip,
    events: readonly FlightEvent[],
    origin: Pose,
  ): void {
    const isPiloted = ship.id === this.pilotedShipId;
    for (const event of events) {
      playFlightEventFx(this, {
        event,
        origin,
        definitionId: ship.definitionId,
        faction: ship.faction,
        sprite: this.shipSprites.get(ship.id),
        cameraShake: isPiloted && this.cameraShakeEnabled,
        zoomPulse: isPiloted,
      });
    }
  }

  // ==========================================
  // COMBAT
  // ==========================================

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

  private findTarget(ship: CampaignShip): CampaignShip | null {
    let best: CampaignShip | null = null;
    let bestDist = Infinity;
    const maxRange = ship.combatStats.weaponRange;
    const maxArcRad = (ship.combatStats.firingArc / 2) * Phaser.Math.DEG_TO_RAD;

    for (const other of this.ships.values()) {
      if (other.faction === ship.faction || other.hull <= 0) continue;
      const dist = Phaser.Math.Distance.Between(
        ship.x,
        ship.y,
        other.x,
        other.y,
      );
      if (dist >= maxRange || dist >= bestDist) continue;
      const angleToTarget = Phaser.Math.Angle.Between(
        ship.x,
        ship.y,
        other.x,
        other.y,
      );
      const shipFacing = (ship.angle - 90) * Phaser.Math.DEG_TO_RAD;
      let arcDiff = Math.abs(angleToTarget - shipFacing);
      if (arcDiff > Math.PI) arcDiff = Math.PI * 2 - arcDiff;
      if (arcDiff < maxArcRad) {
        best = other;
        bestDist = dist;
      }
    }
    return best;
  }

  /**
   * One shot: the attacker's equipment and pilot abilities shape the hit
   * and its damage; a hit stresses the target per the attacker's sheet.
   *
   * @param attacker - The ship firing.
   * @param target - The ship fired at.
   */
  private fireAt(attacker: CampaignShip, target: CampaignShip): void {
    const result = resolveDiceAttack({
      attacker: combatantOf(attacker),
      target: combatantOf(target),
      hitChance: calculateHitChance(
        attacker.combatStats.attackDice,
        target.combatStats.agilityDice,
      ),
      baseDamage: attacker.combatStats.attackDice,
      attackerHasWingman: this.fliesWithWingman(attacker),
      targetHasWingman: this.fliesWithWingman(target),
      nowMs: this.time.now,
      roll: random.next(),
    });

    this.effectsManager.fireLaser(
      attacker.x,
      attacker.y,
      target.x,
      target.y,
      attacker.faction,
      result.hit,
    );
    if (!result.hit) return;

    this.setFlight(target, {
      ...target.flight,
      stress: applyInstantStress(target.flight.stress, result.stressOnTarget),
    });
    this.applyDamage(target, result.damage);
    if (target.hull <= 0) this.killShip(target, attacker);
  }

  /**
   * Damage taken shields first, then hull — or, on a boss, its capital
   * systems (announcing a system knocked out).
   *
   * @param target - The ship taking damage.
   * @param damage - Damage to take.
   */
  private applyDamage(target: CampaignShip, damage: number): void {
    const after = absorbDamage(target, damage);
    const hullDamage = damage - (target.shields - after.shields);
    if (after.shields < target.shields) {
      audioManager.playSoundAt("shield_hit", target.x, target.y, 0.4);
    }
    target.shields = after.shields;
    if (hullDamage > 0) {
      audioManager.playSoundAt("hull_hit", target.x, target.y, 0.4);
      if (target.capitalSystems) this.damageCapitalSystems(target, hullDamage);
      else target.hull = after.hull;
    }
    this.healthBars.get(target.id)?.update(target.hull, target.shields);
  }

  /**
   * Routes hull damage into a boss's capital systems.
   *
   * @param target - The boss.
   * @param damage - Hull damage to take.
   */
  private damageCapitalSystems(target: CampaignShip, damage: number): void {
    if (!target.capitalSystems) return;
    const result = applyCapitalSystemDamage(target.capitalSystems, damage);
    target.capitalSystems = result.systems;
    target.hull = sumSystemsHull(result.systems);
    if (result.justDisabled && result.hitSystemId) {
      this.effectsManager.showFloatingText(
        target.x,
        target.y - 45,
        `${SYSTEM_LABELS[result.hitSystemId]} DISABLED!`,
        "#ff8800",
      );
    }
  }

  /**
   * @param ship - The ship asking.
   * @returns Whether another living ship of its side flies within wingman range.
   */
  private fliesWithWingman(ship: CampaignShip): boolean {
    const allies = [...this.ships.values()].filter(
      (other) => other.faction === ship.faction && other.hull > 0,
    );
    return hasWingman(ship, allies);
  }

  /**
   * Resolves a destruction: the killer's ability reward (shields, frenzy),
   * the victim's removal (kill credit to the killer's side), then the
   * victim's death blast on enemies nearby — whose kills it is credited with.
   *
   * @param victim - The ship destroyed.
   * @param killer - The ship that destroyed it.
   */
  private killShip(victim: CampaignShip, killer: CampaignShip): void {
    if (killer.hull > 0) {
      Object.assign(killer, rewardKill(combatantOf(killer), this.time.now));
      this.healthBars.get(killer.id)?.update(killer.hull, killer.shields);
    }
    const enemies = [...this.ships.values()].filter(
      (other) => other.faction !== victim.faction && other.hull > 0,
    );
    const caught = deathBlastTargets(combatantOf(victim), enemies);
    this.destroyShip(victim.id, killer.owner === "player");
    for (const ship of caught) {
      if (!this.ships.has(ship.id)) continue;
      this.applyDamage(ship, victim.modifiers.deathBlastDamage);
      if (ship.hull <= 0) this.killShip(ship, victim);
    }
  }

  private destroyShip(shipId: string, wasPlayerKill: boolean): void {
    const ship = this.ships.get(shipId);
    if (!ship) return;

    if (ship.owner === "ai" && wasPlayerKill) this.totalKills++;
    if (ship.owner === "player") this.playerShipsLost++;

    const sprite = this.shipSprites.get(shipId);
    if (sprite) {
      this.effectsManager.createExplosion(sprite.x, sprite.y, "medium");
      sprite.destroy();
      this.shipSprites.delete(shipId);
    }
    this.healthBars.get(shipId)?.destroy();
    this.healthBars.delete(shipId);

    this.ships.delete(shipId);
    this.playerShipIds = this.playerShipIds.filter((id) => id !== shipId);
    this.enemyShipIds = this.enemyShipIds.filter((id) => id !== shipId);
  }

  /**
   * Queues every ship's next maneuver: the flagship's from the player's
   * input, enemies' and escorts' from the seek AI (chase the closest enemy).
   *
   * @param time - Scene time (ms).
   * @param delta - Frame length (ms).
   */
  private updateAI(time: number, delta: number): void {
    const flagship = this.ships.get(this.playerShipIds[0] ?? "");
    this.trackPilotedShip(flagship?.id ?? null);
    for (const ship of this.ships.values()) {
      if (!this.canFly(ship)) continue;
      if (ship === flagship) this.flyPlayer(ship, time, delta);
      else this.steerSeeker(ship);
    }
  }

  /**
   * Hands the pilot controls to the current flagship, forgetting held-input
   * memory when the flagship changes (the previous one was destroyed).
   *
   * @param shipId - The flagship's id, or null when the squad is gone.
   */
  private trackPilotedShip(shipId: string | null): void {
    if (shipId === this.pilotedShipId) return;
    this.pilotedShipId = shipId;
    this.pilot.reset();
  }

  /**
   * Steers an AI ship (enemy or escort) at the closest hostile ship.
   * Capital hulls never K-turn.
   *
   * @param ship - The AI-flown ship.
   */
  private steerSeeker(ship: CampaignShip): void {
    const target = findClosestEnemy(ship, this.ships);
    if (!target) return;
    const origin = { x: ship.x, y: ship.y, angle: ship.angle };
    const result = steerAiFlight(
      ship.flight,
      seekSteerOrder({
        flight: ship.flight,
        target,
        cycleCommitted: ship.cycleCommitted,
        allowKTurn: ship.allowKTurn,
      }),
    );
    this.setFlight(ship, result.state);
    this.playFlightEvents(ship, result.events, origin);
  }

  /**
   * Runs one frame of the player's flight input through the shared pilot
   * controls (tap = drift, hold = bank, Q/E = hard turn, K-turn, Segnor,
   * Tallon, boost, barrel roll).
   *
   * @param ship - The flagship.
   * @param time - Scene time (ms).
   * @param delta - Frame length (ms).
   */
  private flyPlayer(ship: CampaignShip, time: number, delta: number): void {
    const origin = { x: ship.x, y: ship.y, angle: ship.angle };
    const result = this.pilot.fly({
      flight: ship.flight,
      ship: ship.flight.motion,
      dial: ship.dial,
      nowMs: time,
      deltaMs: delta,
      worldSize: BATTLEFIELD_SIZE,
    });
    this.setFlight(ship, { motion: result.motion, stress: result.stress });
    this.playFlightEvents(ship, result.events, origin);
  }

  // ==========================================
  // OBJECTIVES / MISSION OUTCOME
  // ==========================================

  private checkObjectives(): void {
    const elapsedSeconds = (Date.now() - this.missionStartTime) / 1000;

    let playerShipsAlive = 0;
    let enemyShipsAlive = 0;
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;
      if (ship.owner === "player") playerShipsAlive++;
      else enemyShipsAlive++;
    }

    for (const objState of this.objectiveStates) {
      if (objState.completed) continue;
      const obj = objState.objective;

      switch (obj.type) {
        case "eliminate":
          objState.progress = this.totalKills;
          if (objState.progress >= objState.target) objState.completed = true;
          break;

        case "survive":
          if (obj.timeLimit && elapsedSeconds >= obj.timeLimit) {
            if (playerShipsAlive > 0) {
              objState.completed = true;
            } else if (!obj.optional) {
              this.triggerMissionFailed("Your ships were destroyed");
              return;
            }
          }
          objState.progress = Math.floor(elapsedSeconds);
          break;

        case "defend":
          if (obj.timeLimit && elapsedSeconds >= obj.timeLimit) {
            if (playerShipsAlive > 0) {
              objState.completed = true;
            } else if (!obj.optional) {
              this.triggerMissionFailed("The defense was overwhelmed");
              return;
            }
          }
          objState.progress = Math.floor(elapsedSeconds);
          break;

        case "assassinate":
          if (enemyShipsAlive === 0 && this.pendingEnemySpawns.length === 0) {
            objState.completed = true;
          }
          break;

        case "escort":
          if (enemyShipsAlive === 0 && this.pendingEnemySpawns.length === 0) {
            if (playerShipsAlive > 0) {
              objState.completed = true;
            } else if (!obj.optional) {
              this.triggerMissionFailed("The escort was lost");
              return;
            }
          }
          break;

        case "capture":
          if (enemyShipsAlive === 0 && this.pendingEnemySpawns.length === 0) {
            if (playerShipsAlive > 0) {
              objState.completed = true;
            } else if (!obj.optional) {
              this.triggerMissionFailed("The capture failed");
              return;
            }
          }
          break;
      }
    }

    const requiredObjectives = this.objectiveStates.filter(
      (o) => !o.objective.optional,
    );
    if (requiredObjectives.every((o) => o.completed) && !this.missionComplete) {
      this.triggerMissionVictory();
    }

    if (playerShipsAlive === 0 && !this.missionFailed) {
      this.triggerMissionFailed("All ships destroyed");
    }
  }

  private updateObjectiveDisplay(): void {
    for (let i = 0; i < this.objectiveStates.length; i++) {
      const objState = this.objectiveStates[i];
      const text = this.objectiveTexts[i];
      if (!text || !objState) continue;

      const prefix = objState.objective.optional ? "(Bonus) " : "";
      let status = "";

      if (objState.completed) {
        text.setColor("#44ff44");
        status = " ✓";
      } else if (objState.objective.type === "eliminate") {
        status = ` (${objState.progress}/${objState.target})`;
        text.setColor("#ffffff");
      } else if (
        objState.objective.type === "survive" ||
        objState.objective.type === "defend"
      ) {
        const remaining =
          (objState.objective.timeLimit ?? 0) - objState.progress;
        status = ` (${Math.max(0, remaining)}s)`;
        text.setColor("#ffffff");
      }

      text.setText(`${prefix}${objState.objective.description}${status}`);
    }
  }

  private triggerMissionVictory(): void {
    this.missionComplete = true;
    audioManager.playFactionStinger(this.factionId, "victory");

    const optionalComplete = this.objectiveStates.filter(
      (o) => o.objective.optional && o.completed,
    );
    let bonusXp = 0;
    for (const obj of optionalComplete) bonusXp += obj.objective.xpBonus ?? 50;

    const totalXp = this.mission.rewards.xp + bonusXp;
    const totalCredits = this.mission.rewards.credits;

    const pilotDefs = CAMPAIGN_PILOTS[this.factionId] ?? [];
    const { updatedPilots, levelUpEvents } = distributeMissionXp(
      this.saveData.campaignPilots,
      pilotDefs,
      this.mission.rewards.xp,
      bonusXp,
    );

    const pendingEvolution = !!this.mission.evolutionChoice;
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
      pendingEvolution,
    );

    this.showMissionCompleteFlash(() => {
      this.scene.start("DebriefScene", {
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
    this.missionTitleText.setVisible(false);
    this.objectivePanel.setVisible(false);
    this.controlsHintText.setVisible(false);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.5);
    overlay.fillRect(0, 0, this.scale.width, this.scale.height);
    overlay.setScrollFactor(0);
    overlay.setDepth(2000);

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const flashText = this.add
      .text(centerX, centerY, "MISSION COMPLETE", {
        font: "bold 48px Arial",
        color: "#44ff66",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001)
      .setAlpha(0);

    this.tweens.add({
      targets: flashText,
      alpha: 1,
      duration: 400,
      ease: "Linear",
      onComplete: () => {
        this.time.delayedCall(1600, () => {
          this.cameras.main.fade(
            400,
            0,
            0,
            0,
            false,
            (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
              if (progress === 1) onComplete();
            },
          );
        });
      },
    });
  }

  private triggerMissionFailed(reason: string): void {
    this.missionFailed = true;
    audioManager.playFactionStinger(this.factionId, "defeat");
    this.showResultScreen(false, 0, 0, reason);
  }

  private showResultScreen(
    victory: boolean,
    xpEarned: number,
    creditsEarned: number,
    failReason?: string,
  ): void {
    this.cameras.main.setZoom(1.0);
    this.missionTitleText.setVisible(false);
    this.objectivePanel.setVisible(false);
    this.controlsHintText.setVisible(false);

    const dimmer = this.add.graphics();
    dimmer.fillStyle(0x000000, 0.7);
    dimmer.fillRect(0, 0, this.scale.width, this.scale.height);
    dimmer.setScrollFactor(0);
    dimmer.setDepth(2000);

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const panel = this.add.container(centerX, centerY);
    panel.setScrollFactor(0);
    panel.setDepth(2001);

    const bg = this.add.graphics();
    bg.fillStyle(victory ? 0x1a3322 : 0x331a1a, 0.95);
    bg.fillRoundedRect(-250, -200, 500, 400, 16);
    bg.lineStyle(3, victory ? 0x44ff66 : 0xff4444, 1);
    bg.strokeRoundedRect(-250, -200, 500, 400, 16);
    panel.add(bg);

    const title = this.add
      .text(0, -160, victory ? "MISSION COMPLETE" : "MISSION FAILED", {
        font: "bold 36px Arial",
        color: victory ? "#44ff66" : "#ff4444",
      })
      .setOrigin(0.5);
    panel.add(title);

    const missionName = this.add
      .text(0, -110, this.mission.title, {
        font: "24px Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    panel.add(missionName);

    let yOffset = -60;
    if (victory) {
      panel.add(
        this.add.text(-100, yOffset, `XP Earned: ${xpEarned}`, {
          font: "20px Arial",
          color: "#88ff88",
        }),
      );
      yOffset += 35;
      panel.add(
        this.add.text(-100, yOffset, `Credits: ${creditsEarned}`, {
          font: "20px Arial",
          color: "#ffcc44",
        }),
      );
      yOffset += 35;
      panel.add(
        this.add.text(-100, yOffset, `Enemies Destroyed: ${this.totalKills}`, {
          font: "16px Arial",
          color: "#aaaaaa",
        }),
      );
      yOffset += 25;
      panel.add(
        this.add.text(-100, yOffset, `Ships Lost: ${this.playerShipsLost}`, {
          font: "16px Arial",
          color: "#aaaaaa",
        }),
      );
      yOffset += 35;

      if (
        this.mission.rewards.unlocks &&
        this.mission.rewards.unlocks.length > 0
      ) {
        panel.add(
          this.add.text(-100, yOffset, "Unlocked:", {
            font: "bold 16px Arial",
            color: "#ffaa44",
          }),
        );
        yOffset += 25;
        for (const unlock of this.mission.rewards.unlocks) {
          panel.add(
            this.add.text(-80, yOffset, `• ${unlock}`, {
              font: "14px Arial",
              color: "#ffcc88",
            }),
          );
          yOffset += 20;
        }
      }
    } else {
      panel.add(
        this.add
          .text(0, yOffset, failReason ?? "Objectives not completed", {
            font: "18px Arial",
            color: "#ff8888",
          })
          .setOrigin(0.5),
      );
      yOffset += 50;
      panel.add(
        this.add
          .text(0, yOffset, "Try different tactics or ship loadouts", {
            font: "14px Arial",
            color: "#888888",
          })
          .setOrigin(0.5),
      );
    }

    // Buttons are added directly to the scene (not reparented into `panel`)
    // — Phaser's pointer input silently breaks hit-testing when an
    // already-setInteractive() Container is added into another Container
    // afterward (verified in DogfightScene/AceDuelScene).
    const buttonY = centerY + 140;
    const resultButtons: Phaser.GameObjects.Container[] = [];

    if (victory) {
      resultButtons.push(
        this.createResultButton(centerX, buttonY, "CONTINUE", 0x44aa44, () => {
          this.scene.start("CampaignScene", { factionId: this.factionId });
        }),
      );
    } else {
      resultButtons.push(
        this.createResultButton(
          centerX - 80,
          buttonY,
          "RETRY",
          0xaa8844,
          () => {
            this.scene.restart();
          },
        ),
      );
      resultButtons.push(
        this.createResultButton(centerX + 80, buttonY, "QUIT", 0x666666, () => {
          this.scene.start("CampaignScene", { factionId: this.factionId });
        }),
      );
    }

    panel.setScale(0.5);
    panel.setAlpha(0);
    resultButtons.forEach((btn) => {
      btn.setScale(0.5);
      btn.setAlpha(0);
    });
    this.tweens.add({
      targets: [panel, ...resultButtons],
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: "Back.out",
    });
  }

  private createResultButton(
    x: number,
    y: number,
    text: string,
    color: number,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-60, -20, 120, 40, 8);
    container.add(bg);

    const label = this.add
      .text(0, 0, text, { font: "bold 18px Arial", color: "#ffffff" })
      .setOrigin(0.5);
    container.add(label);

    container.setSize(120, 40);
    container.setInteractive({ useHandCursor: true });
    container.setScrollFactor(0);
    container.setDepth(2001);

    container.on("pointerover", () => {
      bg.clear();
      bg.fillStyle(color, 0.8);
      bg.fillRoundedRect(-60, -20, 120, 40, 8);
      bg.lineStyle(2, 0xffffff, 1);
      bg.strokeRoundedRect(-60, -20, 120, 40, 8);
    });
    container.on("pointerout", () => {
      bg.clear();
      bg.fillStyle(color, 1);
      bg.fillRoundedRect(-60, -20, 120, 40, 8);
    });
    container.on("pointerdown", () => {
      audioManager.playSound("ui_select", 0.7);
      onClick();
    });

    return container;
  }
}
