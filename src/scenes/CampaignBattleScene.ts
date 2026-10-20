/**
 * Campaign Battle Scene
 *
 * Real-time arcade combat for campaign missions — same flight/combat model as
 * DogfightScene/SurvivalScene (X-Wing cycle engine: template arcs committed
 * each cycle, pilot stress; autofire; toroidal battlefield). The flagship is
 * flown by the player through the shared pilot controls; escorts and enemies
 * are BotPilots (the bots the skill gates measure, tiers per
 * CampaignAiSteering) under their sides' squad orders, and R marks the
 * player's target for the escorts. Owns objective tracking, scripted enemy
 * spawns from mission data, and the briefing/debrief hand-off. Campaign used
 * to run on a separate discrete turn-based engine (BattleManager/TurnSystem);
 * that engine was removed so every game mode shares one combat model.
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
import type { ManeuverDefinition } from "../core/types";
import {
  createCycleFlight,
  tickCycleFlight,
  type CycleFlightState,
} from "../arcade/systems/CycleFlight";
import { PlayerFlightPilot } from "../arcade/systems/PlayerFlightPilot";
import { shiftMotion, wrapCoordinate } from "../arcade/systems/ShipMotion";
import { torusAxisDelta } from "../core/Torus";
import type {
  FlightControlResult,
  FlightEvent,
} from "../arcade/systems/PilotFlightTypes";
import { SquadBattleAi } from "../arcade/systems/SquadBattleAi";
import {
  CAMPAIGN_ESCORT_TIER,
  campaignEnemyTier,
} from "../arcade/systems/CampaignAiSteering";
import type { BotPilot } from "../arcade/ai/BotPilot";
import { playFlightEventFx } from "../arcade/ArcadeFX";
import {
  assignQuickBuilds,
  equipFlight,
  equipQuickBuild,
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
  deathBlastDamage,
  deathBlastTargets,
  hasWingman,
  rewardKill,
} from "../arcade/PilotAbilityCombat";
import {
  attackIntervalMs,
  HitImmunityLedger,
} from "../arcade/systems/CombatTempo";
import {
  nearestHostile,
  nearestTargetInArc,
} from "../arcade/systems/ArcTargeting";
import { squadHudSnapshot } from "../arcade/systems/FlagshipHudSnapshot";
import type {
  BattleWeapons,
  BattleWeaponsLink,
  WeaponHit,
} from "./battleUi/BattleWeapons";
import {
  createSceneWeapons,
  weaponBodyOf,
  withSecondaryWeapons,
} from "./battleUi/sceneWeapons";
import {
  armorReductionOf,
  damageMitigationOf,
  shotAurasOf,
} from "../arcade/systems/DamageRules";
import type { ActiveAura } from "../systems/SupportAura";
import {
  ACE_ATTACK_BONUS,
  BOSS_ATTACK_BONUS,
  aceDurability,
  bossDurability,
  withEvolutionBonuses,
  type DurabilityCaps,
} from "../arcade/systems/CampaignDurability";
import { BattleHud, cameraViewFrom } from "../ui/hud";
import { CampaignModeHud } from "../ui/modeHud/CampaignModeHud";
import type { ResultOverlay } from "../ui/modeHud/HoloResultOverlay";
import {
  showCampaignFailure,
  showCampaignVictoryFlash,
  type MissionTally,
} from "../ui/campaign/CampaignResultScreens";
import { applyInstantStress } from "../arcade/ArcadeStress";
import {
  NEUTRAL_MODIFIERS,
  type CombatModifiers,
} from "../core/CombatModifiers";
import { random } from "../utils/random";
import {
  trackDeath,
  trackModeEnd,
  trackModeStart,
} from "../telemetry/telemetry";
import { matchStats } from "../telemetry/matchTelemetry";
import { dealerOf } from "../telemetry/matchStatTypes";
import { addShipVisual } from "../rendering/ShipVisual";
import type { CampaignMission, MissionEnemy } from "../data/CampaignData";
import { campaignOfMission } from "../data/CampaignData";
import {
  campaignPlayFlags,
  canonRecord,
  recordCampaignVictory,
} from "../systems/campaignChronicle";
import type { CampaignSaveData } from "../systems/CampaignSaveManager";
import { CampaignSaveManager } from "../systems/CampaignSaveManager";
import { CampaignMissionDirector } from "../campaign/battle/CampaignMissionDirector";
import type {
  BattleSpawnRequest,
  CampaignBattleBridge,
} from "../campaign/battle/battleTypes";
import { factionOfShip } from "../campaign/battle/missionSpawns";
import { withVictoryLines } from "../campaign/battle/victoryLines";
import {
  compileMission,
  type MissionPlan,
} from "../campaign/mission/compileMission";
import { campaignBonuses } from "../campaign/armory/campaignBonuses";
import type { CampaignShipBonuses } from "../campaign/armory/bonusTypes";
import { withCampaignBonuses } from "../arcade/systems/CampaignLoadoutBonuses";
import { missionVictoryRecord } from "../arcade/systems/CampaignVictory";
import { CAMPAIGN_PILOTS } from "../data/PilotData";
import { audioManager } from "../audio/AudioManager";
import { bossFinalPhase, campaignBattleMode } from "../audio/musicContexts";
import { syncListenerToCamera } from "../audio/CameraListener";
import { installBattleSpace } from "../rendering/spaceMap/installBattleSpace";
import { EffectsManager } from "../rendering/EffectsManager";
import { HealthBar } from "../ui/HealthBar";
import { ShipRepairFeedback, overlaySide } from "../ui/hud/overlay";
import { applyAllyAuraRepairs } from "../systems/aura/AllyAuraRepair";
import { bindAutoPause, pauseBattleIfRunning } from "./battleUi/AutoPause";
import { BattlePauseMenu } from "./battleUi/BattlePauseMenu";
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
import type { CreatureEncounter } from "../arcade/creatures/CreatureEncounter";
import {
  createBattleEncounter,
  creatureShipStats,
  seedFromText,
} from "../arcade/creatures/creatureSpawn";
import { findCreature, getCreature } from "../data/creatures/creatureCatalog";
import {
  SceneCreatures,
  type SceneCreatureBridge,
} from "./creatures/SceneCreatures";
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
  weaponCooldown: number;
  /** Quick build flown (upgrades + pilot), or null for the bare hull. */
  loadoutId: string | null;
  /** Real-time effects of the quick build and its campaign pilot's abilities. */
  modifiers: CombatModifiers;
  /** Scene time (ms) until which a kill-frenzy ability is active. */
  frenzyUntilMs: number;
  /** Present only for boss-tier ships. */
  capitalSystems?: CapitalSystemsState | null;
  /** The encounter driving it when it is a creature (no bot, no dial). */
  creature?: CreatureEncounter | null;
  /** Hull radius of a creature (px). */
  radiusPx?: number;
  /** True for a boss creature (its adds are counted against it). */
  isBossCreature?: boolean;
  /** Its AI pilot (enemies, escorts), or null when the player flies it. */
  bot: BotPilot | null;
  /** Mission tags (squad, wingman, transport, boss, ally squadron…). */
  tags: string[];
  /** Moved by an objective (transports, stations), never flown. */
  scripted: boolean;
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

/** Player squad start offset below the battlefield centre (px). */
const PLAYER_START_OFFSET_Y = 220;

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
  /** Repair mechanic + overlay shimmer + repair drones (built in create). */
  private repairFeedback: ShipRepairFeedback | null = null;
  private playerShipIds: string[] = [];
  private enemyShipIds: string[] = [];
  private inputSubscriptionIds: number[] = [];

  // Mission state
  private factionId!: FactionId;
  private mission!: CampaignMission;
  private saveData!: CampaignSaveData;
  private selectedShips: string[] = [];
  private selectedLoadouts: (string | null)[] = [];
  /** Flags the mission is played with: the save\u0027s plus the Chronicle\u0027s canon. */
  private playFlags: Readonly<Record<string, boolean>> = {};
  /** The mission compiled for this launch (variants, flags, geometry). */
  private plan!: MissionPlan;
  /** Objectives, script, hazards, hero powers and campaign HUD extras. */
  private director!: CampaignMissionDirector;
  /** Armory + research bonuses the squad flies with. */
  private bonuses!: CampaignShipBonuses;
  private totalKills = 0;
  private playerShipsLost = 0;
  /** Legacy timed enemy groups, due at mission time (ms). */
  private pendingEnemySpawns: { enemy: MissionEnemy; spawnAt: number }[] = [];
  private missionComplete = false;
  private missionFailed = false;
  private isPaused = false;
  private pauseMenu!: BattlePauseMenu;

  // UI — holographic battle HUD (flight, radar, weapons) + mission readouts
  private battleHud: BattleHud | null = null;
  private modeHud!: CampaignModeHud;
  private resultOverlay: ResultOverlay | null = null;

  /** X-Wing round tempo: a struck target ignores its attacker for a cycle. */
  private readonly hitLedger = new HitImmunityLedger();
  /** Secondary weapons (missiles, torpedoes, turrets, bombs, mines, cloak). */
  private weapons: BattleWeapons | null = null;
  /** Creature bosses and spawns: bodies, telegraphs, boss bar, cues. */
  private creatures: SceneCreatures<CampaignShip> | null = null;
  /** Creature sim clock (ms): the scene clock slowed by a hero's time-slow. */
  private creatureClockMs = 0;
  /** Faction auras resolved this frame (buffs every shot and stress tick). */
  private auras: ReadonlyMap<string, ActiveAura> = new Map();

  // Camera follow (manual — toroid wrap makes Phaser's startFollow jump at the seam)
  private cameraVirtualX = BATTLEFIELD_SIZE / 2;
  private cameraVirtualY = BATTLEFIELD_SIZE / 2;

  private effectsManager!: EffectsManager;
  private performanceState: PerformanceState = createPerformanceState();
  private telemetry: ShipTelemetry | null = null;
  private cameraShakeEnabled = true;

  /** The human pilot's flight input (InputManager-driven), flying the flagship. */
  private readonly pilot = new PlayerFlightPilot(InputManager);
  /** Bots, squad orders and marks of every AI-flown ship (enemies, escorts). */
  private readonly squadAi = new SquadBattleAi({
    worldSize: BATTLEFIELD_SIZE,
    random: () => random.next(),
  });
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
    const centre = { x: BATTLEFIELD_SIZE / 2, y: BATTLEFIELD_SIZE / 2 };
    this.playFlags = campaignPlayFlags(this.saveData);
    this.plan = compileMission(
      this.mission,
      this.playFlags,
      centre,
      this.factionId,
    );
    this.bonuses = campaignBonuses(
      this.saveData.armory ?? { installed: {} },
      this.saveData.research ?? {},
    );
    this.director = new CampaignMissionDirector({
      bridge: this.createBridge(),
      plan: this.plan,
      save: { ...this.saveData, storyFlags: this.playFlags },
      bonuses: this.bonuses,
      playerStart: { x: centre.x, y: centre.y + PLAYER_START_OFFSET_Y },
      enemyFaction:
        this.plan.enemies[0]?.faction ??
        factionOfShip(this.mission.enemies[0]?.shipId ?? ""),
    });

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
    this.squadAi.reset();
    this.hitLedger.clear();
    this.resultOverlay = null;
  }

  shutdown(): void {
    this.inputSubscriptionIds.forEach((id) => InputManager.off(id));
    this.inputSubscriptionIds = [];
    teardownSceneInput();
    this.pilot.detach();
    this.director?.destroy();
    this.battleHud?.destroy();
    this.battleHud = null;
    this.resultOverlay = null;
    this.weapons?.destroy();
    this.weapons = null;
    this.creatures?.destroy();
    this.creatures = null;
  }

  create(): void {
    // Phaser never calls shutdown() on its own; without this, every restart
    // stacks another set of input subscriptions.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.cameras.main.setBackgroundColor(0x0a0a1a);

    audioManager.playBattleMusic(
      campaignBattleMode(this.mission),
      this.factionId,
    );

    this.effectsManager = new EffectsManager(this);
    this.repairFeedback = new ShipRepairFeedback({
      scene: this,
      shipOf: (id) => this.ships.get(id),
      overlayOf: (id) => this.healthBars.get(id),
      particleScale: () => this.performanceState.effectSettings.particleCount,
    });
    const savedSettings = this.registry.get("settings") as
      { cameraShake: boolean; showDamageNumbers: boolean } | undefined;
    if (savedSettings) {
      this.cameraShakeEnabled = savedSettings.cameraShake;
      this.effectsManager.setUserSettings({
        cameraShake: savedSettings.cameraShake,
        showDamageNumbers: savedSettings.showDamageNumbers,
      });
    }
    installBattleSpace(this, { seed: seedFromText(this.mission.id) });

    this.creatures = new SceneCreatures(this, this.creatureBridge());
    this.creatureClockMs = 0;
    this.createHUD();
    this.setupInput();

    trackModeStart("campaign", {
      mission: this.mission.id,
      faction: this.factionId,
    });
    matchStats.start("campaign", { mission: this.mission.id }, this.events);
    this.weapons = createSceneWeapons(this, this.weaponsLink(), this.hitLedger);
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

    this.modeHud.showBriefing(this.factionId, this.briefingMission());
  }

  update(time: number, delta: number): void {
    InputManager.update();
    // Mix every positional sound relative to what the player is
    // looking at, so a distant firefight sounds distant.
    syncListenerToCamera(this.cameras.main);
    this.modeHud.sync(this.cameras.main);
    this.director.sync(this.cameras.main);
    if (this.isPaused || this.missionComplete || this.missionFailed) return;

    this.performanceState = updateFPS(this.performanceState, delta);
    this.performanceState = evaluateQuality(this.performanceState, time);
    this.effectsManager.setQualitySettings(
      this.performanceState.effectSettings,
    );

    this.director.update(time, delta);
    this.updateAI(time, delta);
    this.flyShips(delta);
    this.stepCreatures(delta);
    // Secondaries first: a held or chosen launch is this cycle's attack.
    this.weapons?.update(delta, this.time.now);
    this.processCombat(delta);
    this.updateCameraFollow();
    this.checkDelayedSpawns(delta);
    this.checkObjectives(delta);
    this.updateHud();
  }

  // ==========================================
  // SETUP
  // ==========================================

  /** Holographic battle HUD (flagship ring, radar, weapons) + mission readouts. */
  private createHUD(): void {
    this.modeHud = new CampaignModeHud(
      this,
      this.factionId,
      this.briefingMission(),
    );
    this.battleHud = new BattleHud(this, { worldSize: BATTLEFIELD_SIZE });
    this.director.create();
  }

  /** @returns The mission as briefed: this launch's title, briefing and visible objectives. */
  private briefingMission(): CampaignMission {
    return {
      ...this.mission,
      title: this.plan.title,
      briefing: this.plan.briefing,
      objectives: this.plan.objectives.filter((o) => !o.hidden),
    };
  }

  /**
   * Refreshes the battle HUD from this frame's state: the flagship as the
   * player (its status ring replaces its health bar), escorts as allies,
   * mission enemies as enemies, objective markers as neutral contacts (radar
   * + edge arrows), its primary's cooldown and the objective tracker.
   */
  private updateHud(): void {
    this.modeHud.updateObjectives(this.director.tracker());
    audioManager.setBossFinalPhase(bossFinalPhase(this.ships.values()));
    const flagship = this.ships.get(this.playerShipIds[0] ?? "") ?? null;
    if (flagship) {
      audioManager.reportPlayerHull(flagship.hull / flagship.maxHull);
      this.healthBars.get(flagship.id)?.destroy();
      this.healthBars.delete(flagship.id);
    }
    const snapshot = squadHudSnapshot({
      flagship,
      ships: this.ships.values(),
      targetId: flagship ? this.hudTargetOf(flagship) : null,
      markedId: this.squadAi.playerMarkOf(this.time.now),
      cooldownRemainingMs: flagship?.weaponCooldown ?? 0,
      attackIntervalMs: flagship
        ? attackIntervalMs(flagship.combatStats.weaponCooldown)
        : 0,
      camera: cameraViewFrom(this.cameras.main),
    });
    this.battleHud?.update({
      ...withSecondaryWeapons(snapshot, this.weapons?.hudSlots() ?? []),
      contacts: [...snapshot.contacts, ...this.director.contacts()],
    });
  }

  /**
   * @param ship - The flagship.
   * @returns Id of what it is shooting at, else the foe it is closing on.
   */
  private hudTargetOf(ship: CampaignShip): string | null {
    const target =
      this.findTarget(ship) ??
      nearestHostile(ship, this.ships.values(), BATTLEFIELD_SIZE, (other) => {
        return other.owner !== ship.owner;
      });
    return target?.id ?? null;
  }

  /**
   * Shows or hides both HUD layers (hidden under result overlays).
   *
   * @param visible - Visibility.
   */
  private setHudVisible(visible: boolean): void {
    this.battleHud?.setVisible(visible);
    this.modeHud.setVisible(visible);
    this.director.setVisible(visible);
  }

  private showMessage(title: string, subtitle: string): void {
    this.modeHud.showMessage(title, subtitle);
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

  /** Leaving the page (tab switch, minimise) pauses an offline battle; resuming is manual. */
  pauseIfRunning(): void {
    pauseBattleIfRunning({ paused: this.isPaused, online: false }, () => this.togglePause());
  }

  private createPauseMenu(): void {
    bindAutoPause(this, () => this.pauseIfRunning());
    this.pauseMenu = new BattlePauseMenu({
      scene: this,
      legend: "campaign",
      onResume: () => {
        this.isPaused = false;
      },
      onRestart: () => {
        this.scene.restart();
      },
      onQuit: () => {
        this.scene.start("CampaignScene", { factionId: this.factionId });
      },
      ensurePaused: () => {
        if (!this.isPaused) this.togglePause();
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
    } else {
      this.pauseMenu.hide();
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

    this.spawnPlayerSquad(centerX, centerY + PLAYER_START_OFFSET_Y);

    // Immediate enemy spawns; timed groups wait for their mission time.
    const immediateEnemies = this.plan.enemies.filter(
      (e) => !e.spawnDelay || e.spawnDelay <= 0,
    );
    for (const enemy of this.plan.enemies) {
      if (enemy.spawnDelay && enemy.spawnDelay > 0) {
        this.pendingEnemySpawns.push({ enemy, spawnAt: enemy.spawnDelay });
      }
    }
    this.spawnEnemyGroup(
      immediateEnemies,
      centerX,
      centerY - PLAYER_START_OFFSET_Y,
      90,
    );
  }

  /**
   * Spawns the player squad on a line: the flagship (index 0, flown by the
   * player) and the AI escorts. Each ship flies its quick build, plus the
   * abilities of the campaign pilot seated in it and the squad's Armory /
   * Research bonuses.
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
      ship.tags = ["squad", i === 0 ? "flagship" : "wingman"];
      this.applyCampaignBonuses(ship, i === 0);
      if (i === 0) this.applyProtagonistBonuses(ship);
      else ship.bot = this.squadAi.createPilot(CAMPAIGN_ESCORT_TIER);
      this.ships.set(ship.id, ship);
      this.playerShipIds.push(ship.id);
      matchStats.record({ kind: "deploy", friendly: true, shipId: ship.id });
      this.createShipSprite(ship);
      this.createHealthBar(ship);
    });
  }

  /**
   * Armory mods and research choices for a player-side ship.
   *
   * @param ship - A freshly created player ship.
   * @param isFlagship - Whether it is the hero's flagship.
   */
  private applyCampaignBonuses(ship: CampaignShip, isFlagship: boolean): void {
    const next = withCampaignBonuses(ship, this.bonuses, isFlagship);
    ship.combatStats = next.combatStats;
    ship.modifiers = next.modifiers;
    this.setDurability(ship, {
      maxHull: next.maxHull,
      maxShields: next.maxShields,
    });
  }

  /** Spawns one or more enemy groups spread along a horizontal line. */
  private spawnEnemyGroup(
    enemies: readonly MissionEnemy[],
    centerX: number,
    y: number,
    angle: number,
  ): void {
    const totalCount = enemies.reduce((sum, e) => sum + e.count, 0);
    if (totalCount === 0) return;
    const spacing = 80;
    const startX = centerX - ((totalCount - 1) * spacing) / 2;
    let slot = 0;
    for (const enemy of enemies) {
      for (let i = 0; i < enemy.count; i++) {
        const id = `enemy_${slot}_${Math.random().toString(36).slice(2, 7)}`;
        const yJitter = y + (Math.random() - 0.5) * 60;
        this.spawnEnemyShip(id, enemy, {
          x: startX + slot * spacing,
          y: yJitter,
          angle,
        });
        slot++;
      }
    }
  }

  /** Spawns a timed group around the flagship's current position. */
  private spawnReinforcements(enemy: MissionEnemy): void {
    this.showMessage("REINFORCEMENTS", "Enemy reinforcements incoming!");
    const flagship = this.ships.get(this.playerShipIds[0] ?? "");
    const cx = flagship?.x ?? BATTLEFIELD_SIZE / 2;
    const cy = flagship?.y ?? BATTLEFIELD_SIZE / 2;
    const spawnRadius = 500;
    for (let i = 0; i < enemy.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const pose = {
        x: cx + Math.cos(angle) * spawnRadius,
        y: cy + Math.sin(angle) * spawnRadius,
        angle: (Phaser.Math.RadToDeg(angle) + 180) % 360,
      };
      this.spawnEnemyShip(
        `reinforcement_${Math.random().toString(36).slice(2, 7)}_${i}`,
        enemy,
        pose,
      );
    }
  }

  /**
   * Spawns one mission enemy (ace/boss stat bumps included) at a pose.
   *
   * @param id - Ship id.
   * @param enemy - Mission enemy entry.
   * @param pose - Spawn pose.
   */
  private spawnEnemyShip(id: string, enemy: MissionEnemy, pose: Pose): void {
    this.spawnFromRequest({
      id,
      definitionId: enemy.shipId,
      faction: enemy.faction,
      owner: "ai",
      pose,
      tags: [
        ...(enemy.isAce ? ["ace"] : []),
        ...(enemy.isBoss ? ["boss"] : []),
      ],
      hullScale: enemy.hullScale ?? 1,
      scripted: false,
      piloted: true,
      isAce: enemy.isAce === true,
      isBoss: enemy.isBoss === true,
      lifetimeMs: null,
    });
  }

  /**
   * Puts any requested ship on the field: mission enemies, scripted waves,
   * allied squadrons, objective entities (transports, stations, targets) and
   * summoned drones.
   *
   * @param req - What to spawn.
   */
  private spawnFromRequest(req: BattleSpawnRequest): void {
    if (findCreature(req.definitionId) && !this.ships.has(req.id)) {
      this.spawnCreatureShip(req);
      return;
    }
    if (!getShipDefinition(req.definitionId) || this.ships.has(req.id)) return;
    const [loadoutId] = assignQuickBuilds([req.definitionId]);
    const ship = this.createShip({ ...req, loadoutId: loadoutId ?? null });
    ship.tags = [...req.tags];
    ship.scripted = req.scripted;
    if (req.owner === "player") this.applyCampaignBonuses(ship, false);
    this.applyRank(ship, req);
    if (req.piloted) {
      ship.bot = this.squadAi.createPilot(
        req.owner === "player"
          ? CAMPAIGN_ESCORT_TIER
          : campaignEnemyTier(this.mission, req),
      );
    }
    this.ships.set(ship.id, ship);
    matchStats.record({
      kind: "deploy",
      friendly: req.owner === "player",
      shipId: ship.id,
    });
    if (req.owner === "ai") this.enemyShipIds.push(ship.id);
    this.createShipSprite(ship, req.isAce, req.isBoss);
    this.createHealthBar(ship);
  }

  /**
   * Hull scale, ace and boss stat bumps (bosses get capital systems).
   *
   * @param ship - A freshly created ship.
   * @param req - Its spawn request.
   */
  private applyRank(ship: CampaignShip, req: BattleSpawnRequest): void {
    if (req.hullScale !== 1) {
      this.setDurability(ship, {
        maxHull: Math.round(ship.maxHull * req.hullScale),
        maxShields: Math.round(ship.maxShields * req.hullScale),
      });
    }
    if (req.isAce) {
      this.setDurability(ship, aceDurability(ship));
      ship.combatStats = {
        ...ship.combatStats,
        attackDice: ship.combatStats.attackDice + ACE_ATTACK_BONUS,
      };
    }
    if (req.isBoss) {
      this.setDurability(ship, bossDurability(ship));
      ship.combatStats = {
        ...ship.combatStats,
        attackDice: ship.combatStats.attackDice + BOSS_ATTACK_BONUS,
      };
      ship.capitalSystems = createCapitalSystems(ship.maxHull);
    }
  }
  /**
   * Puts a creature (a mission boss or a Void Tide spawn) on the field: a
   * ship record carrying its encounter, hit points through the shared
   * durability path (scaled by the request's hull scale), no primary weapon
   * and no bot. It wraps across the map seam like every ship.
   *
   * @param req - The spawn request (its definition id names the creature).
   */
  private spawnCreatureShip(req: BattleSpawnRequest): void {
    const definition = getCreature(req.definitionId);
    const stats = creatureShipStats(definition);
    const standIn = this.ships.get(this.playerShipIds[0] ?? "");
    const base = this.createShip({
      ...req,
      definitionId: standIn?.definitionId ?? definition.id,
      loadoutId: null,
    });
    this.weapons?.forget(base.id);
    const scale = req.hullScale;
    const ship: CampaignShip = {
      ...base,
      definitionId: definition.id,
      hull: Math.round(stats.maxHull * scale),
      maxHull: Math.round(stats.maxHull * scale),
      shields: Math.round(stats.maxShields * scale),
      maxShields: Math.round(stats.maxShields * scale),
      combatStats: {
        ...base.combatStats,
        attackDice: 0,
        agilityDice: stats.agilityDice,
      },
      creature: createBattleEncounter({
        definition,
        battleSeed: seedFromText(this.mission.id),
        serial: this.ships.size,
        worldSize: BATTLEFIELD_SIZE,
        belt: null,
        phases: definition.phases.length,
        start: req.pose,
      }),
      radiusPx: stats.radiusPx,
      isBossCreature: req.isBoss || definition.isBoss,
      tags: [...req.tags],
      scripted: false,
    };
    this.ships.set(ship.id, ship);
    matchStats.record({ kind: "deploy", friendly: false, shipId: ship.id });
    if (req.owner === "ai") this.enemyShipIds.push(ship.id);
    this.shipSprites.set(ship.id, this.creatures!.register(ship) as ShipSprite);
    this.createHealthBar(ship);
  }

  /**
   * One frame of every creature on the creature clock (a hero's time-slow
   * slows it); an EMP-silenced creature does nothing.
   *
   * @param deltaMs - Frame length (ms).
   */
  private stepCreatures(deltaMs: number): void {
    const scale = this.director.powers.timeScaleFor("enemy", this.time.now);
    this.creatureClockMs += deltaMs * scale;
    this.creatures?.update(this.creatureClockMs, deltaMs * scale);
  }

  /** @returns What the creature layer asks of this scene (damage, stress, spawns). */
  private creatureBridge(): SceneCreatureBridge<CampaignShip> {
    return {
      ships: () => this.ships.values(),
      isFlagship: (ship) => ship.id === this.playerShipIds[0],
      isSuppressed: (ship) =>
        this.director.powers.weaponsDisabled(ship.id, this.time.now),
      damage: (victim, amount, attacker) =>
        this.landHit(attacker, victim, { damage: amount, stress: 0 }),
      stress: (victim, amount) =>
        this.setFlight(victim, {
          ...victim.flight,
          stress: applyInstantStress(victim.flight.stress, amount),
        }),
      nudge: (victim, dx, dy) => {
        const motion = shiftMotion(
          victim.flight.motion,
          dx,
          dy,
          BATTLEFIELD_SIZE,
        );
        this.setFlight(victim, { ...victim.flight, motion });
        this.syncShipVisuals(victim);
      },
      setPose: (ship, x, y, angle) => {
        ship.x = x;
        ship.y = y;
        ship.angle = angle;
        this.syncShipVisuals(ship);
      },
      spawnAdd: (creatureId, x, y, angle) =>
        this.spawnFromRequest(this.creatureAddRequest(creatureId, x, y, angle)),
      healed: (ship, hull) => {
        ship.hull = Math.min(ship.maxHull, ship.hull + hull);
        this.healthBars.get(ship.id)?.update(ship.hull, ship.shields);
      },
      effects: () => this.effectsManager,
    };
  }

  /** @returns The spawn request of a creature a boss called. */
  private creatureAddRequest(
    creatureId: string,
    x: number,
    y: number,
    angle: number,
  ): BattleSpawnRequest {
    return {
      id: `add_${creatureId}_${this.ships.size}_${Math.round(this.creatureClockMs)}`,
      definitionId: creatureId,
      faction:
        this.plan.enemies[0]?.faction ??
        factionOfShip(this.mission.enemies[0]?.shipId ?? ""),
      owner: "ai",
      pose: { x, y, angle },
      tags: ["creature_add"],
      hullScale: 1,
      scripted: false,
      piloted: false,
      isAce: false,
      isBoss: false,
      lifetimeMs: null,
    };
  }

  /**
   * Applies the protagonist pilot's evolution bonuses to the flagship. The
   * old turn-based scene only ever applied hull/shields — attack/agility were
   * silently ignored. Applying all four now; hull/shields are miniature
   * points, scaled to real-time hit points.
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

    this.setDurability(ship, withEvolutionBonuses(ship, bonuses));
    ship.combatStats = {
      ...ship.combatStats,
      attackDice: ship.combatStats.attackDice + (bonuses.attack ?? 0),
      agilityDice:
        ship.combatStats.agilityDice +
        (bonuses.agility ?? 0) * AGILITY_EVASION_FACTOR,
    };
  }

  /**
   * Sets a freshly spawned ship's caps and fills it to them.
   *
   * @param ship - The ship.
   * @param caps - Its new hull/shield caps.
   */
  private setDurability(ship: CampaignShip, caps: DurabilityCaps): void {
    ship.maxHull = caps.maxHull;
    ship.hull = caps.maxHull;
    ship.maxShields = caps.maxShields;
    ship.shields = caps.maxShields;
  }

  /**
   * The scene operations the mission director (objectives, scripts,
   * hazards, hero powers) may use.
   *
   * @returns The bridge.
   */
  private createBridge(): CampaignBattleBridge {
    return {
      scene: this,
      factionId: this.factionId,
      worldSize: BATTLEFIELD_SIZE,
      ships: () => this.ships.values(),
      ship: (id) => this.ships.get(id),
      flagship: () => this.ships.get(this.playerShipIds[0] ?? "") ?? null,
      focusTargetId: () => this.focusTargetId(),
      spawn: (request) => this.spawnFromRequest(request),
      remove: (id) => this.destroyShip(id, false, true),
      damage: (id, amount, ignoreShields) =>
        this.damageById(id, amount, ignoreShields),
      repair: (id, amount) =>
        this.adjustShip(
          id,
          (s) => (s.hull = Math.min(s.maxHull, s.hull + amount)),
        ),
      setShields: (id, value) =>
        this.adjustShip(
          id,
          (s) => (s.shields = Math.max(0, Math.min(s.maxShields, value))),
        ),
      addStress: (id, amount) =>
        this.adjustShip(id, (s) =>
          this.setFlight(s, {
            ...s.flight,
            stress: applyInstantStress(s.flight.stress, amount),
          }),
        ),
      setPose: (id, x, y, angle) =>
        this.adjustShip(id, (s) => {
          if (s.creature) {
            s.creature.body.x = x;
            s.creature.body.y = y;
            return;
          }
          const dx = torusAxisDelta(s.x, x, BATTLEFIELD_SIZE);
          const dy = torusAxisDelta(s.y, y, BATTLEFIELD_SIZE);
          // Carry the cycle in progress so the next tick does not snap back.
          const motion = shiftMotion(s.flight.motion, dx, dy, BATTLEFIELD_SIZE);
          this.setFlight(s, { ...s.flight, motion: { ...motion, angle } });
          this.syncShipVisuals(s);
        }),
      banner: (title, subtitle) => this.showMessage(title, subtitle),
      effects: () => this.effectsManager,
    };
  }

  /** @returns The player's mark, else the flagship's HUD target. */
  private focusTargetId(): string | null {
    const mark = this.squadAi.playerMarkOf(this.time.now);
    if (mark) return mark;
    const flagship = this.ships.get(this.playerShipIds[0] ?? "");
    return flagship ? this.hudTargetOf(flagship) : null;
  }

  /**
   * @param id - A living ship.
   * @param change - Mutation to apply (its overlay is refreshed after).
   */
  private adjustShip(id: string, change: (ship: CampaignShip) => void): void {
    const ship = this.ships.get(id);
    if (!ship || ship.hull <= 0) return;
    change(ship);
    this.healthBars.get(id)?.update(ship.hull, ship.shields);
  }

  /**
   * Mission damage (hazards, hero powers): through shields unless piercing;
   * a ship it destroys counts as a kill for the side that did not lose it.
   *
   * @param id - Target ship.
   * @param amount - Damage.
   * @param ignoreShields - Shield-piercing (psionic lance).
   */
  private damageById(id: string, amount: number, ignoreShields: boolean): void {
    const ship = this.ships.get(id);
    if (!ship || ship.hull <= 0) return;
    if (ship.creature?.phased) return;
    if (!ignoreShields) this.applyDamage(ship, amount);
    else if (ship.capitalSystems) this.damageCapitalSystems(ship, amount);
    else ship.hull = Math.max(0, ship.hull - amount);
    this.healthBars.get(id)?.update(ship.hull, ship.shields);
    if (ship.hull <= 0) this.destroyShip(id, ship.owner === "ai");
  }

  /**
   * Timed legacy groups (mission clock, pause-safe) and one step of the
   * mission script and hazards. Calm e2e runs stub this out.
   *
   * @param deltaMs - Frame length.
   */
  private checkDelayedSpawns(deltaMs = 0): void {
    const now = this.director.runtime.elapsedMs;
    const due = this.pendingEnemySpawns.filter((spawn) => now >= spawn.spawnAt);
    this.pendingEnemySpawns = this.pendingEnemySpawns.filter(
      (spawn) => now < spawn.spawnAt,
    );
    for (const spawn of due) this.spawnReinforcements(spawn.enemy);
    this.director.stepScript(deltaMs);
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
      weaponCooldown: 0,
      loadoutId: spawn.loadoutId,
      modifiers: NEUTRAL_MODIFIERS,
      frenzyUntilMs: 0,
      bot: null,
      tags: [],
      scripted: false,
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
    this.weapons?.equip(ship.id, {
      definitionId,
      loadoutId: spawn.loadoutId,
      modifiers: ship.modifiers,
    });
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
      side: overlaySide(false, ship.owner === "player"),
      definitionId: ship.definitionId,
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
    if (ship.hull <= 0 || ship.creature || this.director.isScripted(ship)) {
      return false;
    }
    return !(ship.capitalSystems && isEnginesOffline(ship.capitalSystems));
  }

  /**
   * Flies every ship one frame on the X-Wing cycle engine (template arcs,
   * cycle-boundary commits, stress) and syncs sprites to the new poses.
   * A hero's time-slow scales the enemy side's frame.
   *
   * @param deltaMs - Frame length (ms).
   */
  private flyShips(deltaMs: number): void {
    const enemyScale = this.director.powers.timeScaleFor(
      "enemy",
      this.time.now,
    );
    for (const ship of this.ships.values()) {
      if (!this.canFly(ship)) continue;
      const shipDelta = ship.owner === "ai" ? deltaMs * enemyScale : deltaMs;
      const tick = tickCycleFlight(ship.flight, {
        deltaMs: shipDelta,
        worldSize: BATTLEFIELD_SIZE,
        dial: ship.dial,
        cycleMs: CYCLE_DURATION_MS,
        modifiers: stressModifiersOf(ship.modifiers, this.auras.get(ship.id)),
      });
      this.setFlight(ship, tick.state);
      this.regenerateShipShields(ship, deltaMs);
      if (tick.completed) this.notifyCycleCommitted(ship, tick.state);
      if (tick.completed && ship.id === this.pilotedShipId)
        matchStats.record({
          kind: "cycle",
          dial: ship.dial,
          direction: tick.completed.direction,
          speed: tick.completed.speed,
        });
      this.syncShipVisuals(ship);
    }
    this.auras = applyAllyAuraRepairs(
      this.ships.values(),
      this.repairFeedback,
      deltaMs,
    );
  }

  /**
   * Tells whoever flies the ship (its bot, or the player's pilot) that a
   * cycle committed.
   *
   * @param ship - The ship whose cycle committed.
   * @param flight - Its flight state after the commit.
   */
  private notifyCycleCommitted(
    ship: CampaignShip,
    flight: CycleFlightState,
  ): void {
    const started = flight.motion.control.currentManeuver ?? "straight";
    if (ship.bot) ship.bot.onCycleCommitted(started);
    else if (ship.id === this.pilotedShipId) {
      this.pilot.onCycleCommitted(started);
    }
  }

  /**
   * Applies a ship's own shield regen and hull repair for a frame
   * (equipment and abilities); the repair feedback refreshes its overlay.
   *
   * @param ship - The ship.
   * @param deltaMs - Frame length (ms).
   */
  private regenerateShipShields(ship: CampaignShip, deltaMs: number): void {
    this.repairFeedback?.selfRepair(ship, deltaMs);
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
      if (event === "boost" || event === "barrel_roll") {
        this.director.recordEvasive(ship.id);
      }
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

  /**
   * One frame of weapons: cooldowns and autofire at the nearest target in
   * range and arc — at most one attack per maneuver cycle (X-Wing round).
   *
   * @param delta - Frame length (ms).
   */
  private processCombat(delta: number): void {
    const now = this.time.now;
    const enemyScale = this.director.powers.timeScaleFor("enemy", now);
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0 || ship.creature) continue;
      const shipDelta = ship.owner === "ai" ? delta * enemyScale : delta;
      ship.weaponCooldown = Math.max(0, ship.weaponCooldown - shipDelta);
      if (this.director.powers.weaponsDisabled(ship.id, now)) continue;
      if (ship.weaponCooldown <= 0) {
        const target = this.findTarget(ship);
        if (target) {
          this.fireAt(ship, target);
          ship.weaponCooldown =
            attackIntervalMs(ship.combatStats.weaponCooldown) *
            this.director.powers.attackIntervalMultiplier(ship.id, now);
        }
      }
    }
  }

  /**
   * The foe a ship fires at: its pilot's chosen target (a bot's target; the
   * player's mark for the flagship) when valid, else the nearest foe in
   * weapon range and forward arc — never one still immune to this ship's
   * hits (X-Wing round: one hit per attacker per cycle). Sides are owners,
   * so a mission against the player's own faction still fights.
   *
   * @param ship - The firing ship.
   * @returns Its target, or null when none can be fired at.
   */
  private findTarget(ship: CampaignShip): CampaignShip | null {
    const now = this.time.now;
    return nearestTargetInArc(ship, this.ships.values(), {
      rangePx: ship.combatStats.weaponRange,
      arcDeg: ship.combatStats.firingArc,
      worldSize: BATTLEFIELD_SIZE,
      isHostile: (other) => other.owner !== ship.owner,
      isEligible: (other) =>
        !this.hitLedger.isImmune(ship.id, other.id, now) &&
        !this.director.powers.isCloaked(other.id, now),
      preferredId: ship.bot
        ? ship.bot.targetId
        : this.squadAi.playerMarkOf(now),
    });
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
      targetMarked: this.squadAi.isMarkedBy(
        attacker.owner,
        target.id,
        this.time.now,
      ),
      ...shotAurasOf(this.auras, attacker.id, target.id),
      targetArmor: armorReductionOf(target.definitionId),
    });

    this.effectsManager.fireLaser(
      attacker.x,
      attacker.y,
      target.x,
      target.y,
      attacker.faction,
      result.hit,
    );
    matchStats.record({
      kind: "shot",
      friendly: attacker.owner === "player",
      weapon: "primary",
      hit: result.hit,
    });
    this.weapons?.onAttack(attacker.id);
    if (!result.hit) return;
    const cloak = this.weapons?.incomingDamageFactor(target.id) ?? 1;
    this.landHit(attacker, target, {
      damage: Math.max(1, Math.round(result.damage * cloak)),
      stress: result.stressOnTarget,
    });
  }

  /**
   * A hit lands (laser or secondary weapon): stress, damage, the
   * attacker's immunity tick and the kill.
   *
   * @param attacker - The ship credited with the hit.
   * @param target - The ship hit.
   * @param hit - Damage and stress to apply.
   */
  private landHit(
    attacker: CampaignShip,
    target: CampaignShip,
    hit: { readonly damage: number; readonly stress: number },
  ): void {
    this.setFlight(target, {
      ...target.flight,
      stress: applyInstantStress(target.flight.stress, hit.stress),
    });
    this.applyDamage(target, hit.damage, attacker);
    if (hit.damage > 0) {
      this.hitLedger.recordHit(attacker.id, target.id, this.time.now);
    }
    if (target.hull <= 0) this.killShip(target, attacker);
  }

  /** @returns What the secondary weapons read from (and ask of) this scene. */
  private weaponsLink(): BattleWeaponsLink {
    return {
      bodies: () =>
        [...this.ships.values()].map((ship) =>
          weaponBodyOf(
            ship,
            ship.owner,
            damageMitigationOf(
              ship.modifiers,
              this.fliesWithWingman(ship),
              this.auras.get(ship.id),
            ),
          ),
        ),
      wantedTargetOf: (shipId: string) => {
        const ship = this.ships.get(shipId);
        if (!ship) return null;
        return ship.bot ? ship.bot.targetId : this.hudTargetOf(ship);
      },
      playerShipId: () => this.playerShipIds[0] ?? null,
      playerSide: () => "player",
      sideOf: (shipId: string) => this.ships.get(shipId)?.owner ?? null,
      isBotControlled: (shipId: string) => !!this.ships.get(shipId)?.bot,
      applyHit: (hit: WeaponHit) => this.applyWeaponHit(hit),
      spriteOf: (shipId: string) => this.shipSprites.get(shipId),
    };
  }

  /**
   * A secondary weapon's hit, through the laser's path (hero overcharge,
   * boss systems, mission kill credit). A ship already destroyed (its mine
   * still on the field) is credited to its side.
   *
   * @param hit - The hit from the weapons runtime.
   */
  private applyWeaponHit(hit: WeaponHit): void {
    const target = this.ships.get(hit.targetId);
    if (!target || target.hull <= 0) return;
    const attacker = this.ships.get(hit.attackerId) ?? {
      ...target,
      id: hit.attackerId,
      owner: target.owner === "player" ? "ai" : "player",
      hull: 0,
    };
    this.landHit(attacker, target, { damage: hit.damage, stress: hit.stress });
  }

  /** The secondary-weapons glue (e2e). */
  get secondaryWeapons(): BattleWeapons | null {
    return this.weapons;
  }

  /**
   * Damage taken shields first, then hull — or, on a boss, its capital
   * systems (announcing a system knocked out). A hero's overcharge reduces it.
   *
   * @param target - The ship taking damage.
   * @param rawDamage - Damage to take.
   */
  private applyDamage(
    target: CampaignShip,
    rawDamage: number,
    attacker?: CampaignShip,
  ): void {
    const mitigated =
      rawDamage *
      this.director.powers.damageTakenMultiplier(target.id, this.time.now);
    const damage = target.creature
      ? target.creature.absorbHit({
          fromX: attacker?.x ?? target.x,
          fromY: attacker?.y ?? target.y,
          damage: mitigated,
          nowMs: this.creatureClockMs,
          shieldsUp: target.shields > 0 || attacker === undefined,
        }).damage
      : mitigated;
    const after = absorbDamage(target, damage);
    const hullDamage = damage - (target.shields - after.shields);
    matchStats.record({
      kind: "damage",
      toFriendly: target.owner === "player",
      shield: target.shields - after.shields,
      hull: Math.min(target.hull, hullDamage),
      ...dealerOf(attacker),
    });
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
    const blastDamage = deathBlastDamage(combatantOf(victim));
    if (victim.id === this.pilotedShipId)
      trackDeath("campaign", killer.definitionId, { mission: this.mission.id });
    this.destroyShip(victim.id, killer.owner === "player");
    for (const ship of caught) {
      if (!this.ships.has(ship.id)) continue;
      this.applyDamage(ship, blastDamage);
      if (ship.hull <= 0) this.killShip(ship, victim);
    }
  }

  /**
   * Removes a ship from the battle and reports it to the mission.
   *
   * @param shipId - The ship.
   * @param wasPlayerKill - Whether the player's side gets the kill.
   * @param expired - A summoned ship timing out (no loss, no event).
   */
  private destroyShip(
    shipId: string,
    wasPlayerKill: boolean,
    expired = false,
  ): void {
    const ship = this.ships.get(shipId);
    if (!ship) return;

    if (ship.owner === "ai" && wasPlayerKill) this.totalKills++;
    if (!expired && ship.tags.includes("squad")) this.playerShipsLost++;
    if (!expired) this.director.recordDestroyed(ship);
    if (!expired)
      matchStats.record({
        kind: "kill",
        victimFriendly: ship.owner === "player",
        victimIsPlayer: shipId === this.pilotedShipId,
      });
    this.hitLedger.forget(shipId);
    this.squadAi.forget(shipId);
    this.weapons?.forget(shipId);
    if (!expired) this.creatures?.noteWreck(ship);
    this.creatures?.remove(shipId);

    const sprite = this.shipSprites.get(shipId);
    if (sprite) {
      if (!expired)
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
   * input (and the player's mark, R), enemies' and escorts' from their
   * BotPilots under their squads' orders.
   *
   * @param time - Scene time (ms).
   * @param delta - Frame length (ms).
   */
  private updateAI(time: number, delta: number): void {
    const flagship = this.ships.get(this.playerShipIds[0] ?? "");
    this.trackPilotedShip(flagship ?? null);
    this.squadAi.command(this.ships.values(), time);
    for (const ship of this.ships.values()) {
      if (!this.canFly(ship)) continue;
      if (ship === flagship) this.flyPlayer(ship, time, delta);
      else this.flyBot(ship, time, delta);
    }
    this.applyMarkRequest(flagship ?? null);
  }

  /**
   * Hands the pilot controls to the current flagship, forgetting held-input
   * memory when the flagship changes (the previous one was destroyed): the
   * escort taking over loses its bot — the player flies it now.
   *
   * @param flagship - The flagship, or null when the squad is gone.
   */
  private trackPilotedShip(flagship: CampaignShip | null): void {
    const shipId = flagship?.id ?? null;
    if (shipId === this.pilotedShipId) return;
    this.pilotedShipId = shipId;
    this.pilot.reset();
    if (flagship) flagship.bot = null;
  }

  /**
   * The player pressed MARK (R / R3): mark the flagship's HUD target for the
   * squad. The press is consumed every frame, so it never fires late.
   *
   * @param flagship - The flagship, or null when the squad is gone.
   */
  private applyMarkRequest(flagship: CampaignShip | null): void {
    if (!this.pilot.takeMarkRequest() || !flagship || flagship.hull <= 0) {
      return;
    }
    const targetId = this.hudTargetOf(flagship);
    if (targetId) this.squadAi.markTarget(targetId, this.time.now);
    if (targetId) matchStats.record({ kind: "mark" });
  }

  /**
   * One frame of an AI ship (enemy or escort): its BotPilot presses the same
   * controls the player has (capital hulls fly without specials).
   *
   * @param ship - The AI-flown ship.
   * @param time - Scene time (ms).
   * @param delta - Frame length (ms).
   */
  private flyBot(ship: CampaignShip, time: number, delta: number): void {
    const origin = { x: ship.x, y: ship.y, angle: ship.angle };
    const result = this.squadAi.fly(ship, time, delta);
    if (result) this.applyControls(ship, result, origin);
  }

  /**
   * Applies a pilot's controls (player or bot) and plays their effects.
   *
   * @param ship - The ship flown.
   * @param result - What its pilot's controls did this frame.
   * @param origin - Pose before the controls.
   */
  private applyControls(
    ship: CampaignShip,
    result: FlightControlResult,
    origin: Pose,
  ): void {
    this.setFlight(ship, { motion: result.motion, stress: result.stress });
    this.playFlightEvents(ship, result.events, origin);
  }

  /**
   * Runs one frame of the player's flight input through the shared pilot
   * controls (tap = drift, hold = bank, Q/E = hard turn, Snap turn, Hook,
   * Knife, boost, barrel roll).
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
    this.applyControls(ship, result, origin);
    this.weapons?.showRefusals(result.refusals, ship);
    matchStats.record({ kind: "flight", events: result.events });
    matchStats.record({
      kind: "stress",
      ms: delta,
      stressed: result.stress.isStressed,
    });
  }

  // ==========================================
  // OBJECTIVES / MISSION OUTCOME
  // ==========================================

  /**
   * Steps the mission's objectives and ends the mission on victory or defeat
   * (a required objective failed, or the whole squad is down). Calm e2e
   * runs stub this out.
   *
   * @param deltaMs - Frame length.
   */
  private checkObjectives(deltaMs = 0): void {
    if (this.missionComplete || this.missionFailed) return;
    const outcome = this.director.stepObjectives(deltaMs);
    const squadAlive = [...this.ships.values()].some(
      (ship) => ship.hull > 0 && ship.tags.includes("squad"),
    );
    if (!squadAlive) this.triggerMissionFailed("All ships destroyed");
    else if (outcome === "defeat")
      this.triggerMissionFailed(this.failureReason());
    else if (outcome === "victory") this.triggerMissionVictory();
  }

  /** @returns The first failed required objective, as the failure reason. */
  private failureReason(): string {
    const failed = this.director.runtime.objectives.find(
      (s) => s.status === "failed" && s.def.optional !== true,
    );
    return failed
      ? `Objective failed: ${failed.def.description}`
      : "Objectives not completed";
  }

  /**
   * Seals the victory: bonus objectives and story flags from the mission,
   * rewards (with Armory/Research bonuses) folded into the save (autosave),
   * then the debrief.
   */
  private triggerMissionVictory(): void {
    this.missionComplete = true;
    trackModeEnd("campaign", "victory", { mission: this.mission.id });
    matchStats.finish("victory");
    audioManager.playFactionStinger(this.factionId, "victory");
    const { bonuses, storyFlags, victoryLines } =
      this.director.finalizeVictory();
    const victory = missionVictoryRecord({
      mission: this.mission,
      campaign: campaignOfMission(this.mission, this.factionId),
      save: this.saveData,
      bonuses,
      storyFlags,
      kills: this.totalKills,
      shipsLost: this.playerShipsLost,
      bonusesActive: this.bonuses,
    });
    const preMissionSave = this.saveData;
    const record = canonRecord(victory.record);
    const result = CampaignSaveManager.recordVictory(this.saveData, record);
    recordCampaignVictory(this.mission, record, result.save);
    this.showMissionCompleteFlash(() => {
      this.scene.start("DebriefScene", {
        factionId: this.factionId,
        mission: withVictoryLines(this.mission, victoryLines),
        preMissionSave,
        updatedSave: result.save,
        xpEarned: victory.record.xp,
        creditsEarned: victory.record.credits + result.bonusCredits,
        kills: this.totalKills,
        shipsLost: this.playerShipsLost,
        protagonistBonusXp: victory.bonusXp,
        levelUpEvents: victory.levelUpEvents,
        researchEarned: result.researchEarned,
        bonusObjectives: bonuses.map((b) => b.description),
      });
    });
  }

  /**
   * Victory beat before the debrief (MISSION COMPLETE, then camera fade).
   *
   * @param onComplete - Called once the fade finishes.
   */
  private showMissionCompleteFlash(onComplete: () => void): void {
    this.setHudVisible(false);
    this.resultOverlay = showCampaignVictoryFlash(
      this,
      this.plan.title,
      this.tally(),
      onComplete,
    );
  }

  /** @returns Kills and squad losses so far. */
  private tally(): MissionTally {
    return { kills: this.totalKills, shipsLost: this.playerShipsLost };
  }

  /**
   * Ends the mission as failed: MISSION FAILED with the reason, RETRY / QUIT.
   *
   * @param reason - Why it failed.
   */
  private triggerMissionFailed(reason: string): void {
    this.missionFailed = true;
    trackModeEnd("campaign", "defeat", { mission: this.mission.id, reason });
    matchStats.finish("defeat");
    audioManager.playFactionStinger(this.factionId, "defeat");
    this.cameras.main.setZoom(1.0);
    this.setHudVisible(false);
    this.resultOverlay = showCampaignFailure(this, {
      title: this.plan.title,
      reason,
      tally: this.tally(),
      onRetry: () => this.scene.restart(),
      onQuit: () =>
        this.scene.start("CampaignScene", { factionId: this.factionId }),
    });
  }
}
